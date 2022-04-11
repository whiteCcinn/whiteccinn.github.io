---
title: 【Golang】- go map源码阅读
date: 2022-03-10 15:55:51
categories: [Go源码剖析系列]
tags: [Golang, Go源码剖析]
---

## 前言

最近发现同事去面试，发现很多时候会被问到`go map`的底层结构。今天我们来记录一下map的底层实现。

<!-- more -->

当下的源码阅读基于1.17

```go
// A header for a Go map.
type hmap struct {
	// Note: the format of the hmap is also encoded in cmd/compile/internal/gc/reflect.go.
	// Make sure this stays in sync with the compiler's definition.
	count     int // # live cells == size of map.  Must be first (used by len() builtin)
	flags     uint8
	B         uint8  // log_2 of # of buckets (can hold up to loadFactor * 2^B items)
	noverflow uint16 // approximate number of overflow buckets; see incrnoverflow for details
	hash0     uint32 // hash seed

	buckets    unsafe.Pointer // array of 2^B Buckets. may be nil if count==0.
	oldbuckets unsafe.Pointer // previous bucket array of half the size, non-nil only when growing
	nevacuate  uintptr        // progress counter for evacuation (buckets less than this have been evacuated)

	extra *mapextra // optional fields
}
```

可以看到这是一个map的头部结构，其中有几个关键结构，分别是

- `count` 当前map的元素个数
- `buckets` 桶的数量，一般是2^B个
- `oldbuckets` 扩容前的buckets

```go
// mapextra holds fields that are not present on all maps.
type mapextra struct {
	// If both key and elem do not contain pointers and are inline, then we mark bucket
	// type as containing no pointers. This avoids scanning such maps.
	// However, bmap.overflow is a pointer. In order to keep overflow buckets
	// alive, we store pointers to all overflow buckets in hmap.extra.overflow and hmap.extra.oldoverflow.
	// overflow and oldoverflow are only used if key and elem do not contain pointers.
	// overflow contains overflow buckets for hmap.buckets.
	// oldoverflow contains overflow buckets for hmap.oldbuckets.
	// The indirection allows to store a pointer to the slice in hiter.
	overflow    *[]*bmap
	oldoverflow *[]*bmap

	// nextOverflow holds a pointer to a free overflow bucket.
	nextOverflow *bmap
}
```

> 简单来说，这个可以忽略。

```go
// A bucket for a Go map.
type bmap struct {
	// tophash generally contains the top byte of the hash value
	// for each key in this bucket. If tophash[0] < minTopHash,
	// tophash[0] is a bucket evacuation state instead.
	tophash [bucketCnt]uint8
	// Followed by bucketCnt keys and then bucketCnt elems.
	// NOTE: packing all the keys together and then all the elems together makes the
	// code a bit more complicated than alternating key/elem/key/elem/... but it allows
	// us to eliminate padding which would be needed for, e.g., map[int64]int8.
	// Followed by an overflow pointer.
}
```

bmap有2个模块的属性是在编译注入的，在源码上没办法浏览。

```
                                                    ┌─────────────────────────────────────┐
                                                    │bmap                                 │
┌─────────────────────────────────────┐             │                                     │
│bmap                                 │             │                                     │
│                                     │             │                                     │
│                                     │             │    ┌──────────────────────────────┐ │
│                                     │             │    │tohash[bucketCnt]uint8        │ │
│    ┌──────────────────────────────┐ │             │    │                              │ │
│    │tohash[bucketCnt]uint8        │ │             │    │                              │ │
│    │                              │ │             │    │                              │ │
│    │                              │ │             │    └──────────────────────────────┘ │
│    │                              │ │             │                                     │
│    └──────────────────────────────┘ │             │    ++++++++++++++++++++++++++++++++ │
│                                     │             │    +  byte-array                  + │
│    ++++++++++++++++++++++++++++++++ │             │    +        (save key-value)      + │
│    +  byte-array                  + │     ┌──────►│    +                              + │
│    +        (save key-value)      + │     │       │    ++++++++++++++++++++++++++++++++ │
│    +                              + │     │       │                                     │
│    ++++++++++++++++++++++++++++++++ │     │       │    ++++++++++++++++++++++++++++++++ │
│                                     │     │       │    +   point to growed bucket     + │
│    ++++++++++++++++++++++++++++++++ │     │       │    +                              + │
│    +   point to growed bucket     + │     │       │    +                              + │
│    +                              + ├─────┘       │    +++++++++++++─┐+++++++++++++++++ │
│    +                              + │             │                  │                  │
│    ++++++++++++++++++++++++++++++++ │             │                  │                  │
│                                     │             └──────────────────┼──────────────────┘
│                                     │                                │
└─────────────────────────────────────┘                                │
                                                                       │
                                                                       ▼
                                                     ┌─────────────────────────────────────┐
                                                     │bmap                                 │
                                                     │                                     │
                                                     │                                     │
                                                     │                                     │
                                                     │    ┌──────────────────────────────┐ │
                                                     │    │tohash[bucketCnt]uint8        │ │
                                                     │    │                              │ │
                                                     │    │                              │ │
                                                     │    │                              │ │
                                                     │    └──────────────────────────────┘ │
                                                     │                                     │
                                                     │    ++++++++++++++++++++++++++++++++ │
                                                     │    +  byte-array                  + │
                                                     │    +        (save key-value)      + │
                                                     │    +                              + │
                                                     │    ++++++++++++++++++++++++++++++++ │
                                                     │                                     │
                                                     │    ++++++++++++++++++++++++++++++++ │
                                                     │    +   point to growed bucket     + │
                                                     │    +                              + │
                                                     │    +                              + │
                                                     │    ++++++++++++++++++++++++++++++++ │
                                                     │                                     │
                                                     │                                     │
                                                     └─────────────────────────────────────┘s
```


相比于hmap，bucket的结构显得简单一些，`byte-array`是我们使用的map中的key和value就存储在这里。`高位哈希值`数组记录的是当前bucket中key相关的`索引`

## mapassign 赋值过程

```go
	// 1. 判断会否当前已经进行了写保护
	if h.flags&hashWriting != 0 {
		throw("concurrent map writes")
	}
	// 2. 根据key计算哈希值
	hash := t.hasher(key, uintptr(h.hash0))
	// 3. 进行写保护
	h.flags ^= hashWriting
	// 4. 计算hash的低位部分
	bucket := hash & bucketMask(h.B)
	// 5. 判断是否正在扩容，如果是，则数据迁移
	if h.growing() {
		growWork(t, h, bucket)
	}
	// 6. 根据低位hash找到对应的bucket
	b := (*bmap)(add(h.buckets, bucket*uintptr(t.bucketsize)))
	// 7. 计算高位hash
	top := tophash(hash)
	// 8. 从对应的bucket以及overflow buckets中找到对应的key的位置
	// 9. 判断是否需要扩容，如果需要，则重新找到key的位置
	if !h.growing() && (overLoadFactor(h.count+1, h.B) || tooManyOverflowBuckets(h.noverflow, h.B)) {
		hashGrow(t, h)
		goto again // Growing the table invalidates everything, so try again
	}
	// 10. 拿着可以插入kv的内存地址进行赋值
	if t.indirectkey() {
		kmem := newobject(t.key)
		*(*unsafe.Pointer)(insertk) = kmem
		insertk = kmem
	}
	if t.indirectelem() {
		vmem := newobject(t.elem)
		*(*unsafe.Pointer)(elem) = vmem
	}
	// 11. 写保护检查，并且解除写保护
		if h.flags&hashWriting == 0 {
		throw("concurrent map writes")
	}
	h.flags &^= hashWriting
```

赋值过程就是：

1. 进行写保护
2. 根据key计算哈希值
3. 在低位哈希中找到bucket
4. 计算高位hash
5. 在bucket和overflow bucket桶中找到能插入key/value的位置
6. 找到了就赋值
7. 解除锁保护

> 其中有多次判断bucket是否需要扩容和是否正在扩容
