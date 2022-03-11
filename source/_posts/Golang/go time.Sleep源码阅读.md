---
title: 【Golang】- go time.Sleep源码阅读
date: 2022-03-10 15:55:51
categories: [Go源码剖析系列]
tags: [Golang, Go源码剖析]
---

## 前言

由于time.Sleep()会挂起我们的协程，我们来看一下它的底层原理。

<!-- more -->

## sleep 的实现

我们通常使用 `time.Sleep(1 * time.Second)` 来将 goroutine 暂时休眠一段时间。sleep 操作在底层实现也是基于 timer 实现的。

有一些比较有意思的地方，单独拿出来讲下。

我们固然也可以这么做来实现 goroutine 的休眠:

```go
timer := time.NewTimer(2 * time.Seconds)
<-timer.C
```

这么做当然可以。但 golang 底层显然不是这么做的，因为这样有两个明显的额外性能损耗。

- 每次调用 sleep 的时候，都要创建一个 timer 对象
- 需要一个 channel 来传递事件

既然都可以放在 runtime 里面做。golang 里面做的更加干净：

```go
// timeSleep puts the current goroutine to sleep for at least ns nanoseconds.
//go:linkname timeSleep time.Sleep
func timeSleep(ns int64) {
	if ns <= 0 {
		return
	}

	gp := getg()
	t := gp.timer
	if t == nil {
		t = new(timer)
		gp.timer = t
	}
	t.f = goroutineReady
	t.arg = gp
	t.nextwhen = nanotime() + ns
	if t.nextwhen < 0 { // check for overflow.
		t.nextwhen = maxWhen
	}
	gopark(resetForSleep, unsafe.Pointer(t), waitReasonSleep, traceEvGoSleep, 1)
}
```

- 在G对象上存在一个timer属性，在G的生命周期里timer都是唯一存在，解决了重复新建对象的问题
- 如果不存在timer，则在第一次的时候创建timer

并且把`t.f`设置成`goroutineReay`(这个意思是time到了时间之后设置一个触发函数，这个触发函数就是唤醒我们当前G任务)。

然后通过`gopark`来挂起当前的G任务

## 定时器的触发机制

共分两种方式，分别为 `调度器触发` 和 `监控线程sysmon` 触发，两者主要是通过调用函数 `checkTimers()` 来实现的。

主要有两个地方会检查计时器，一个是 `runtime.schedule`，另一个是 `findrunnable`。

```go
// runtime/proc.go
func schedule() { 
 _g_ := getg() 
 
top: 
 pp := _g_.m.p.ptr() 
 pp.preempt = false 
 
 // 处理调度时的计时器触发 
 checkTimers(pp, 0) 
 ... 
 
 execute(gp, inheritTime) 
}
```

另外一种是当前处理器 P 没有可执行的 Timer，且没有可执行的 G。那么按照调度模型，就会去`窃取其他计时器`和 `G`：

```go
// runtime/proc.go
func findrunnable() (gp *g, inheritTime bool) { 
 _g_ := getg() 
 
top: 
 _p_ := _g_.m.p.ptr() 
 ... 
 now, pollUntil, _ := checkTimers(_p_, 0) 
 ... 
} 
```