---
title: ssp-adx-localcache优化
date: 2023-08-27 09:53:00
categories: [组件优化]
tags: [cache]
---

## 前言

最近在处理`ssp-adx-rtb`的服务的性能优化，做了好多方面的优化，其中一个就是我们的本地的`localcache`的问题。

经过`pprof`的性能分析，发现`cache2go`，在 `CPU Flame Graph` 中，占比十分严重，基本大于`1/3`，既然是`localcache`，那么，我们的目的本意就是为了提速，所以占比那么大，是十分不合理的。

所以需要找到原因，并且解决它。降低cpu使用率，从而提高服务的QPS，减少服务器成本。

![cache2go1](/images/公司/cache2go1.jpg)

<!-- more -->

## cache2go旧版

- [cache2go](https://github.com/muesli/cache2go)
- https://github.com/muesli/cache2go

项目的描述为：

```shell
Concurrency-safe Go caching library with expiration capabilities and access counters
```

并发安全，并且带有效期的和访问计数器的一个类库组件

我们需要用他来解决我们的3大核心问题

- 本地缓存
- 并发安全
- 带ttl功能

对于开源版本第一版本，我们已经做为处理了。

就是他的淘汰策略，是`ttl+lru`，当一个缓存在一定时间内被连续访问，或者在一个key，准备过期的时候，如果被访问，那么他的过期时间将继续延长到下一个周期。

这一特点，并不是我们需求，所以我们需要对这一点进行了调整，过期时间，只需要判断为 `ttl` 过期即可，不需要加上 `lru` 的方式。

这里就不展开细说。

## cache2go新版

- [cache2go-new](https://github.com/whiteCcinn/cache2go)
- https://github.com/whiteCcinn/cache2go

![localcache](/images/公司/localcache.jpg)

![cache2go2](/images/公司/cache2go2.jpg)

![cache2go3](/images/公司/cache2go3.jpg)

在这一个版本，基本把整个库都按需重构了。主要是以下几个方面。

- 加入`hash分片`机制，把key打散到不同的`bucket`中，让`bucket-lock`的争抢降低
- 同一个`cache-table`，有且仅有一个`goroutine`，来处理 `ttl` 数据，并不会因为分片的个数调整带来更多的无效`goroutine`
- 没有采用渐进式的方式来删除key, 在 `add`, `get` 的阶段，尽量保持服务的高效性能，方式由于锁带来的性能衰减
- 采用`双写机制`，实现`L1`和`L2`的二级包装级别，从而做到 `读写分离`, 尽可能的避免在必要的场景下由于`整个写锁`导致`读锁阻塞`的问题，让后台在处理 `ttl` 和 `重建map`的过程中，服务依然高效提供服务
- 定期重建底层`map`属性，来释放map申请的内存，让整个服务相对处于一个内存稳定的状态

`需求+机制`，就可以在`读写较多`或者`后台需要处理map`的情况下，性能依旧保持有一个较好的性能体现。

为了实现这几点：

```go
type CacheTable struct {
	sync.RWMutex

	hash *fnv64a          // 用于hash
	shardMask uint64      // 用于hash的mask，在做按位与操作的时候，实现求余一样的行为，由于是位运算，效率一般都偏高

	name string           // cache的命名

	L1Shards  shardItems  // L1的分片组
	L2Shards  shardItems  // L2的分片组

	cleanupInterval time.Duration  // 定时处理ttl的数据

	l1BlockChan []*CacheItem // 用于在L1分片组被后台处理过程中，暂时把数据缓存起来
	l2BlockChan []*CacheItem // 用于在L2分片组被后台处理过程中，暂时把数据缓存起来

	l1Mask int32 // L1原子计数器，用来代替lock，防止lock的堵塞现象，导致服务被影响
	l2Mask int32 // L2原子计数器，用来代替lock，防止lock的堵塞现象，导致服务被影响

	switchMask uint8 // 记录当前 cache-table是否在处理L1,L2分片组
}
```

### Add

这是一个写入过程，实现起来也不算太复杂

```go
func (table *CacheTable) Add(key interface{}, lifeSpan time.Duration, data interface{}) *CacheItem {
	item := NewCacheItem(key, lifeSpan, data)

    // 判断当前表是否在处理L1
	if table.switchMask != 1<<1 {
        // 记录L1正在处理写入行为，+1操作
		atomic.AddInt32(&table.l1Mask, 1)
        // 结束的时候L1写入的时候，-1操作
		defer atomic.AddInt32(&table.l1Mask, -1)
        // L1内部分片片级写锁开发
		table.L1Shards[item.hashedKey&table.shardMask].lock.Lock()
        // L1内部分片写入item
		table.L1Shards[item.hashedKey&table.shardMask].m[item.key] = item
        // L1内部分片片级写锁结束
		table.L1Shards[item.hashedKey&table.shardMask].lock.Unlock()
	} else {
        // 如果当前后台在处理L1的话，那么先缓存起来
		table.l1BlockChan = append(table.l1BlockChan, item)
	}

    // 判断当前表是否在处理L2
	if table.switchMask != 1<<2 {
        // 记录L2正在处理写入行为，+1操作
		atomic.AddInt32(&table.l2Mask, 1)
        // 结束的时候L2写入的时候，-1操作
		defer atomic.AddInt32(&table.l2Mask, -1)
        // L2内部分片片级写锁开发
		table.L2Shards[item.hashedKey&table.shardMask].lock.Lock()
        // L2内部分片写入item
		table.L2Shards[item.hashedKey&table.shardMask].m[item.key] = item
        // L2内部分片片级写锁结束
		table.L2Shards[item.hashedKey&table.shardMask].lock.Unlock()
	} else {
        // 如果当前后台在处理L2的话，那么先缓存起来
		table.l2BlockChan = append(table.l2BlockChan, item)
	}

	return item
}
```

通过双写的方式，实现`L1`和`L2`的同时写入,以此达到空间换时间的做法。

其中 `(& 2^(n-1))` 做到 `(%m)`的效果，并且由于是位运算，所以按理说效率会更高

### Value

> Value 和 就是Get方法，获取key的item

```go
func (table *CacheTable) Value(key interface{}, args ...interface{}) (*CacheItem, error) {
	keyBytes, _ := json.Marshal(key)
    // 哈希的key
	hashedKey := table.hash.Sum64(string(keyBytes))
	var sm *shardItem

	if table.switchMask == 1>>1 {
		// 先查l1
		sm = table.L1Shards[hashedKey&table.shardMask]
		sm.lock.RLock()
		r, ok := sm.m[key]
		sm.lock.RUnlock()

		if ok {
			// 正常返回结果
			return r, nil
		}

		// 再查l2
		sm = table.L2Shards[hashedKey&table.shardMask]
		sm.lock.RLock()
		r, ok = sm.m[key]
		sm.lock.RUnlock()

		if ok {
			// 正常返回结果
			return r, nil
		}

		// 找不到key
		return nil, ErrKeyNotFound

	} else if table.switchMask == 1<<1 {
		// 正在处理l1，需要从l2读
		sm = table.L2Shards[hashedKey&table.shardMask]
		sm.lock.RLock()
		r, ok := sm.m[key]
		sm.lock.RUnlock()
		if ok {
			// 正常返回结果
			return r, nil
		}
		// 找不到key
		return nil, ErrKeyNotFound
	} else {
		// 正在处理l2，需要从l1读
		sm = table.L1Shards[hashedKey&table.shardMask]
		sm.lock.RLock()
		r, ok := sm.m[key]
		sm.lock.RUnlock()

		if ok {
			// 正常返回结果
			return r, nil
		}

		// 找不到key
		return nil, ErrKeyNotFound
	}
}
```

- 可以看到这里，如果后台没有在操作`L1`, `L2` 的话，那么先从`L1`拿数据，然后再从`L2`拿数据
- 如果后台在`操作L1`, 那么只能从 `L2` 读取
- 如果后台在`操作L2`, 那么只能从 `L1` 读取

所以通过`L1`和`L2`，我们实现了一个读写分离的策略，并且在最大的程度上减少`分片锁`的读写锁冲突，从而提高服务的效率

## 后台任务

```go
// 定时清理过期缓存
go func(t *CacheTable, ctx context.Context) {
    // 定时监测ttl数据
    ticker := time.NewTicker(cleanInterval)
    // 定期重建map，以此来释放map申请的空间
    reBuildTicker := time.NewTicker(30 * time.Minute)
    for {
        select {
        case <-ctx.Done():
            ticker.Stop()
            reBuildTicker.Stop()
            return
        case <-ticker.C:
            // 表锁
            t.Lock()
            // 扫描需要删除的key
            var deleteList []*CacheItem

            // 先处理l1，再处理l2
            t.switchMask = 1 << 1
            now := time.Now()

            // 处理l1
            // 不允许l1读写入，读写通过l2
            for {
                if atomic.LoadInt32(&t.l1Mask) == 0 {
                    // 当L1已经操作完Add操作的时候继续往下走
                    break
                }
            }
            for i, sad := range t.L1Shards {
                // 分片片级别读锁
                sad.lock.RLock()
                for _, r := range sad.m {
                    // ttl数据校验处理
                    if now.Sub(r.createdOn).Seconds() > r.lifeSpan.Seconds() {
                        deleteList = append(deleteList, r)
                    }
                }
                sad.lock.RUnlock()
            }
            // 开始删除
            for _, item := range deleteList {
                // 分片片级别写锁，防止在 Value操作的时候，并行读写异常
                t.L1Shards[item.hashedKey&t.shardMask].lock.Lock()
                delete(t.L1Shards[item.hashedKey&t.shardMask].m, item.key)
                t.L1Shards[item.hashedKey&t.shardMask].lock.Unlock()
            }
            // 重置deleteList
            deleteList = make([]*CacheItem, 0)

            // 处理完l1,处理l2
            t.switchMask = 1 << 2

            // 堵塞的item加回来到l1
            l1Length := len(t.l1BlockChan)
            for _, item := range t.l1BlockChan {
                if item != nil {
                    t.L1Shards[item.hashedKey&t.shardMask].lock.Lock()
                    t.L1Shards[item.hashedKey&t.shardMask].m[item.key] = item
                    t.L1Shards[item.hashedKey&t.shardMask].lock.Unlock()
                }
            }

            // 重置l1BlockChan, 预先申请大小为原来到一半
            t.l1BlockChan = make([]*CacheItem, 0, l1Length/2)

            // 不允许l2读写入，读写通过l1
            for {
                if atomic.LoadInt32(&t.l2Mask) == 0 {
                    break
                }
            }

            for i, sad := range t.L2Shards {
                sad.lock.RLock()
                for _, r := range sad.m {
                    if now.Sub(r.createdOn).Seconds() > r.lifeSpan.Seconds() {
                        deleteList = append(deleteList, r)
                    }
                }
                sad.lock.RUnlock()
            }

            // 开始删除
            for _, item := range deleteList {
                t.L2Shards[item.hashedKey&t.shardMask].lock.Lock()
                delete(t.L2Shards[item.hashedKey&t.shardMask].m, item.key)
                t.L2Shards[item.hashedKey&t.shardMask].lock.Unlock()
            }

            // 恢复正常
            t.switchMask = 1 >> 1


            for _, item := range t.l2BlockChan {
                //fmt.Println(t.name, t.L1Shards[item.hashedKey&t.shardMask])
                if item != nil {
                    t.L2Shards[item.hashedKey&t.shardMask].lock.Lock()
                    t.L2Shards[item.hashedKey&t.shardMask].m[item.key] = item
                    t.L2Shards[item.hashedKey&t.shardMask].lock.Unlock()
                }
            }

            // 重置l2BlockChan
            t.l2BlockChan = make([]*CacheItem, 0, l2Length/2)

            t.Unlock()

        case <-reBuildTicker.C:
            t.Lock()
            // 为了释放map内存

            // 先处理l1，再处理l2
            t.switchMask = 1 << 1
            now := time.Now()

            // 处理l1
            // 不允许l1读写入，读写通过l2
            for {
                if atomic.LoadInt32(&t.l1Mask) == 0 {
                    break
                }
            }


            for _, sad := range t.L1Shards {
                sad.lock.Lock()
                nm := make(shard, len(sad.m))
                for key, r := range sad.m {
                    if now.Sub(r.createdOn).Seconds() < r.lifeSpan.Seconds() {
                        nm[key] = r
                    }
                }
                sad.m = nil
                sad.m = nm
                sad.lock.Unlock()
            }

            // 先处理l1，再处理l2
            t.switchMask = 1 << 2
            for {
                if atomic.LoadInt32(&t.l2Mask) == 0 {
                    break
                }
            }

            for _, sad := range t.L2Shards {
                sad.lock.Lock()
                nm := make(shard, len(sad.m))
                for key, r := range sad.m {
                    if now.Sub(r.createdOn).Seconds() < r.lifeSpan.Seconds() {
                        nm[key] = r
                    }
                }
                sad.m = nil
                sad.m = nm
                sad.lock.Unlock()
            }

            // 恢复正常
            t.switchMask = 1 >> 1

            runtime.GC()
            debug.FreeOSMemory()
            t.Unlock()
        }
    }
}(t, ctx)
```

