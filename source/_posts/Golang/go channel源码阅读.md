---
title: 【Golang】- go channel源码阅读
date: 2022-03-04 00:43:51
categories: [Go源码剖析系列]
tags: [Golang, Go源码剖析]
---

## 前言

channel 是 Golang 中一个非常重要的特性，也是 `Golang CSP` 并发模型的一个重要体现。简单来说就是，goroutine 之间可以通过 channel 进行通信。

channel 在 Golang 如此重要，在代码中使用频率非常高，以至于不得不好奇其内部实现。本文将基于 `go 1.17` 的源码，分析 channel 的内部实现原理。

<!-- more -->

## channel 的基本使用

在正式分析 channel 的实现之前，我们先看下 channel 的最基本用法，代码如下：

```go
package main
import "fmt"

func main() {
    c := make(chan int)

    go func() {
        c <- 1 // send to channel
    }()

    x := <-c // recv from channel

    fmt.Println(x)
}
```

在以上代码中，我们通过 `make(chan int)` 来创建了一个类型为 int 的 channel。
在一个 goroutine 中使用 `c <- 1` 将数据发送到 channel 中。在主 goroutine 中通过 `x := <- c` 从 channel 中读取数据并赋值给 x。

以上代码对应了 channel 的两种基本操作：
- send 操作 `c <- 1` 表示发送数据到 channel
- recv 操作 `x := <- c` 表示从 channel 中接收数据。

此外，channel 还分为`有缓存 channel` 和`无缓存 channel`。上述代码中，我们使用的是无缓冲的 channel。对于无缓冲的 channel，如果当前没有其他 goroutine 正在接收 channel 数据，则发送方会阻塞在发送语句处。

我们可以在 channel 初始化时指定缓冲区大小。例如，`make(chan int, 2)` 则指定缓冲区大小为 2。在缓冲区未满之前，发送方无阻塞地可以往 channel 发送数据，无需等待接收方准备好。而如果缓冲区已满，则发送方依然会阻塞。

## channel 对应的底层实现函数

在探究 channel 源码之前，我们肯定首先需要先找到 channel 在 Golang 的具体实现在哪。因为我们在使用 channel 时，用的是 `<- 符号`，并不能直接在 go 源码中找到其实现。但是 Golang 编译器必然会将 `<-` 符号翻译成底层对应的实现。


我们可以使用 Go 自带的命令: `go tool compile -N -l -S hello.go`, 将代码翻译成对应的汇编指令。

或者，直接可以使用 `Compiler Explorer` 这个在线工具。对于上述示例代码可以直接在这个链接看其汇编结果: [go.godbolt.org/z/3xw5Cj](go.godbolt.org/z/3xw5Cj)。如下图：

![chansend1](/images/Go/源码/chansend1.png)

> chansend1

![chanrevc1](/images/Go/源码/chanrevc1.png)

> chanrevc1

通过仔细查看以上示例代码对应的汇编指令，可以发现以下的对应关系：

channel 的构造语句 `make(chan int)`, 对应的是 `runtime.makechan` 函数
发送语句 `c <- 1`, 对应的是 `runtime.chansend1` 函数
接收语句 `x := <- c`, 对应的是 `runtime.chanrecv1` 函数
以上几个函数的实现都位于 go 源码中的 `runtime/chan.go` 代码文件中。我们接下来针对这几个函数，探究下 channel 的实现。


## channel 的构造

channel 的构造语句 `make(chan int)`，将会被 golang 编译器翻译为 `runtime.makechan` 函数, 其函数签名如下：

```go
func makechan(t *chantype, size int) *hchan
```

其中，`t *chantype` 即构造 channel 时传入的元素类型。`size int` 即用户指定的 channel 缓冲区大小，不指定则为 0。该函数的返回值是 `*hchan`。hchan 则是 channel 在 golang 中的内部实现。其定义如下：

```go
type hchan struct {
	qcount   uint           // buffer 中已放入的元素个数
	dataqsiz uint           // 用户构造 channel 时指定的 buf 大小
	buf      unsafe.Pointer // buffer
	elemsize uint16         // buffer 中每个元素的大小
	closed   uint32         // channel 是否关闭，== 0 代表未 closed
	elemtype *_type         // channel 元素的类型信息
	sendx    uint           // buffer 中已发送的索引位置 send index
	recvx    uint           // buffer 中已接收的索引位置 receive index
	recvq    waitq          // 等待接收的 goroutine  list of recv waiters
	sendq    waitq          // 等待发送的 goroutine list of send waiters

	lock mutex
}
```

hchan 中的所有属性大致可以分为三类：

- buffer 相关的属性。例如 `buf`、`dataqsiz`、`qcount` 等。 当 channel 的缓冲区大小不为 0 时，buffer 中存放了待接收的数据。使用 `ring buffer` 实现。
- waitq 相关的属性，可以理解为是一个 FIFO 的标准队列。其中 `recvq` 中是正在等待接收数据的 goroutine，`sendq` 中是等待发送数据的 goroutine。waitq 使用`双向链表`实现。
- 其他属性，例如 lock、elemtype、closed。

通过简单分析 hchan 的属性，我们可以知道其中有两个重要的组件，`buffer` 和 `waitq`。hchan 所有行为和实现都是围绕这两个组件进行的。

## 向 channel 中发送数据

channel 的发送和接收流程很相似，我们先分析下 channel 的发送过程 (如 `c <- 1`), 对应于 `runtime.chansend` 函数的实现。

在尝试向 channel 中发送数据时，如果 `recvq` 队列不为空，则首先会从 `recvq` 中头部取出一个等待接收数据的 goroutine 出来。并将数据直接发送给该 goroutine。代码如下：

```go
lock(&c.lock)

if c.closed != 0 {
	unlock(&c.lock)
	panic(plainError("send on closed channel"))
}

if sg := c.recvq.dequeue(); sg != nil {
	send(c, sg, ep, func() { unlock(&c.lock) }, 3)
	return true
}
```

> 我们看到当我们整个send的过程是需要加锁处理的，并且也可以看到我们老生常谈的一个问题，当向cloesd的channel数据的时候，会导致panic产生

recvq 中是正在等待接收数据的 goroutine。当某个 goroutine 使用 recv 操作 (例如，`x := <- c`)，如果此时 channel 的缓存中没有数据，且没有其他 goroutine 正在等待发送数据 (即 `sendq` 为空)，会将该 goroutine 以及要接收的数据地址打包成 `sudog` 对象，并放入到 recvq 中。

继续接着讲上面的代码，如果此时 `recvq` 不为空，则调用 `send 函数`将数据拷贝到对应的 goroutine 的堆栈上。

这个时候`不经过`我们的`环形缓存！！！`

send 函数的实现主要包含两点：
1. `memmove(dst, src, t.size)` 进行数据的转移，本质上就是一个内存拷贝。
2. `goready(gp, skip+1)` goready 的作用是唤醒对应的 goroutine。

而如果 `recvq` 队列为空，则说明此时`没有等待接收`数据的 goroutine，那么此时 channel 会尝试把数据放到缓存中。

```go
	if c.qcount < c.dataqsiz {
		// Space is available in the channel buffer. Enqueue the element to send.
		qp := chanbuf(c, c.sendx)
		if raceenabled {
			racenotify(c, c.sendx, nil)
		}
		typedmemmove(c.elemtype, qp, ep)
		c.sendx++
		if c.sendx == c.dataqsiz {
			c.sendx = 0
		}
		c.qcount++
		unlock(&c.lock)
		return true
	}
```

以上代码的作用其实非常简单，就是把数据放到 buffer 中而已。此过程涉及了 `ring buffer` 的操作，其中 `dataqsiz` 代表用户指定的 channel 的 buffer 大小，如果不指定则默认为 0。

如果用户使用的是无缓冲 channel 或者此时 buffer 已满，则 `c.qcount < c.dataqsiz` 条件不会满足, 以上流程也并不会执行到。此时会将当前的 goroutine 以及要发送的数据放入到 `sendq` 队列中，同时会切出该 goroutine

```go
	// Block on the channel. Some receiver will complete our operation for us.
	gp := getg()
	mysg := acquireSudog()
	mysg.releasetime = 0
	if t0 != 0 {
		mysg.releasetime = -1
	}
	// No stack splits between assigning elem and enqueuing mysg
	// on gp.waiting where copystack can find it.
	mysg.elem = ep
	mysg.waitlink = nil
	mysg.g = gp
	mysg.isSelect = false
	mysg.c = c
	gp.waiting = mysg
	gp.param = nil
	c.sendq.enqueue(mysg)
	// Signal to anyone trying to shrink our stack that we're about
	// to park on a channel. The window between when this G's status
	// changes and when we set gp.activeStackChans is not safe for
	// stack shrinking.
	atomic.Store8(&gp.parkingOnChan, 1)
	// 将 goroutine 转入 waiting 状态
	gopark(chanparkcommit, unsafe.Pointer(&c.lock), waitReasonChanSend, traceEvGoBlockSend, 2)
	// Ensure the value being sent is kept alive until the
	// receiver copies it out. The sudog has a pointer to the
	// stack object, but sudogs aren't considered as roots of the
	// stack tracer.
	KeepAlive(ep)
	// 确保正在发送的值保持活动状态，直到接收者将其复制出来。sudog有一个指向堆栈对象的指针，但是sudog不被认为是堆栈跟踪程序的根。
	// 总而言之：防止被GC
```

调用 gopark 后，对于用户侧来看，该向 channel 发送数据的代码语句会进行阻塞。

以上过程就是 channel 的发送语句 (如，`c <- 1`) 的内部工作流程，同时整个发送过程都使用 `c.lock` 进行加锁，保证并发安全。

简单来说，整个流程如下：

1. 检查 recvq 是否为空，如果不为空，则从 recvq 头部`取一个 goroutine`，将数据发送过去，并`唤醒对应的 goroutine` 即可
2. 如果 recvq 为空，则将数据放入到 buffer 中
3. 如果 buffer 已满，则将要发送的数据和当前 goroutine 打包成 `sudog` 对象放入到 `sendq` 中。并将当前 goroutine 置为 waiting 状态。

从 channel 中接收数据的过程基本与发送过程类似，此处不再赘述了。

这里需要注意的是，channel 的`整个发送过程`和`接收过程`都使用 `runtime.mutex` 进行加锁。`runtime.mutex` 是 runtime 相关源码中常用到的一个`轻量级锁`。整个过程并不是最高效的 `lockfree` 的做法。

golang 在这里有个 [issue:go/issues#8899](https://github.com/golang/go/issues/8899)，给出了 `lockfree` 的 `channel` 的方案。