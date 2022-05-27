---
title: 【Golang】- Sync包详解
date: 2022-03-04 00:43:51
categories: [Golang]
tags: [Golang]
---

## 前言

我们直到sync包给我们提供了一系列并发安全的数据结构。之前有见过一次sync-map，但是这一次刚好复习整理一下sync包的知识点。

<!-- more -->

## Sync

- Sync.Map
- Sync.Once
- Sync.Pool
- Sync.Cond
- Sync.WaitGroup

## sync.Map

- sync.Map主要针对于Map对于并发读写不支持的场景下提出实现的，其原理是通过对map的写操作进行加锁：Sync.RWMutex
- 同时sync.Map实现了读写分离，当对map进行读操作时，通过读read Map, 当read Map中不存在是去dirty map中读取

```go
type Map struct {
	me Mutex
	read atomic.Value  // readOnly,读数据
	dirty map[interface{}]*entry // 包含最新的写入数据，当missed达到一定的值时，将值赋给read
	misses int  // 计数作用，每次从read中读失败，则missed加一
}

// readOnly的数据结构
type readOnly struct{
	m map[interface{}]*entry
	amended bool  // Map.dirty中的数据和这里的m中的数据不同时值为true
}

// entry的数据结构：
type entry struct {
	p unsafe.Pointer // *interface{}
	// 可见value是一个指针值，虽然read和dirty存在冗余情况，但由于是指针类型，存储空间不会太多
}
```

sync.Map相关问题

- sync.Map的核心实现：两个map,一个用于写，一个用于读，这样的设计思想可以类比于缓存与数据库
- sync.Map的局限性：如果写远高于读，dirty -> readOnly这个类似于刷新数据的频率较高，不如直接使用mutex + map的效率高
- sync.Map的设计思想：保证高频率读的无锁结构，空间换时间的思想


## sync.WaitGroup

- sync.WaitGroup常用于针对goroutine的并发执行，通过WaitGroup可以等待所有的go程序执行结束之后再执行之后的逻辑
- WaitGroup对象内部有一个计数器，最初重0开始，提供了三个方法：Add(),Done(),Wait()用来控制计数器的数量。Add(n)把计数器设置为n,Done()每次把计数器减一，Wait()会阻塞代码的执行，直到计数器的值减到0为止。

