---
title: 【Golang】- devle
date: 2020-08-14 09:46:51
categories: [Golang]
tags: [Golang]
---

## 前言

由于我们可能断点调试程序，所以我们需要debug工具，对于golang来说，delve比gdb对go程序更友好。所以，我们今天来看看devle怎么debug程序

<!-- more -->

## 安装

```
go get github.com/go-delve/delve/cmd/dlv

```

## 用法

a）dlv debug

使用dlv debug可以在main函数文件所在目录直接对main函数进行调试，也可以在根目录以指定包路径的方式对main函数进行调试。

b）dlv test

使用dlv test可以对test包进行调试。

c）dlv attach

使用dlv attach可以附加到一个已在运行的进程进行调试。

d）dlv connect

使用dlv connect可以连接到调试服务器进行调试。

e）dlv trace

使用dlv trace可以追踪程序。

f）dlv exec

使用dlv exec可以对编译好的二进制进行调试


创建main.go文件，main函数先通过循初始化一个切片，然后输出切片的内容：

```go
package main

import (
    "fmt"
)

func main() {
    nums := make([]int, 5)
    for i := 0; i < len(nums); i++ {
        nums[i] = i * i
    }
    fmt.Println(nums)
}
```

命令行进入包所在目录，然后输入`dlv debug`命令进入调试：

```
$ dlv debug
Type 'help' for list of commands.
(dlv)
```

输入`help`命令可以查看到Delve提供的调试命令列表：

```
(dlv) help
The following commands are available:

Running the program:
    call ------------------------ Resumes process, injecting a function call (EXPERIMENTAL!!!)
    continue (alias: c) --------- Run until breakpoint or program termination.
    next (alias: n) ------------- Step over to next source line.
    rebuild --------------------- Rebuild the target executable and restarts it. It does not work if the executable was not built by delve.
    restart (alias: r) ---------- Restart process.
    step (alias: s) ------------- Single step through program.
    step-instruction (alias: si)  Single step a single cpu instruction.
    stepout (alias: so) --------- Step out of the current function.

Manipulating breakpoints:
    break (alias: b) ------- Sets a breakpoint.
    breakpoints (alias: bp)  Print out info for active breakpoints.
    clear ------------------ Deletes breakpoint.
    clearall --------------- Deletes multiple breakpoints.
    condition (alias: cond)  Set breakpoint condition.
    on --------------------- Executes a command when a breakpoint is hit.
    trace (alias: t) ------- Set tracepoint.

Viewing program variables and memory:
    args ----------------- Print function arguments.
    display -------------- Print value of an expression every time the program stops.
    examinemem (alias: x)  Examine memory:
    locals --------------- Print local variables.
    print (alias: p) ----- Evaluate an expression.
    regs ----------------- Print contents of CPU registers.
    set ------------------ Changes the value of a variable.
    vars ----------------- Print package variables.
    whatis --------------- Prints type of an expression.

Listing and switching between threads and goroutines:
    goroutine (alias: gr) -- Shows or changes current goroutine
    goroutines (alias: grs)  List program goroutines.
    thread (alias: tr) ----- Switch to the specified thread.
    threads ---------------- Print out info for every traced thread.

Viewing the call stack and selecting frames:
    deferred --------- Executes command in the context of a deferred call.
    down ------------- Move the current frame down.
    frame ------------ Set the current frame, or execute command on a different frame.
    stack (alias: bt)  Print stack trace.
    up --------------- Move the current frame up.

Other commands:
    config --------------------- Changes configuration parameters.
    disassemble (alias: disass)  Disassembler.
    edit (alias: ed) ----------- Open where you are in $DELVE_EDITOR or $EDITOR
    exit (alias: quit | q) ----- Exit the debugger.
    funcs ---------------------- Print list of functions.
    help (alias: h) ------------ Prints the help message.
    libraries ------------------ List loaded dynamic libraries
    list (alias: ls | l) ------- Show source code.
    source --------------------- Executes a file containing a list of delve commands
    sources -------------------- Print list of source files.
    types ---------------------- Print list of types

Type help followed by a command for full documentation.
```

每个Go程序的入口是main.main函数，我们可以用`break(b)`在此设置一个断点：

```
(dlv) break main.main
Breakpoint 1 set at 0x10ae9b8 for main.main() ./main.go:7
```

然后通过`breakpoints(bp)`查看已经设置的所有断点：

```
(dlv) breakpoints
Breakpoint unrecovered-panic at 0x102a380 for runtime.startpanic()
    /usr/local/go/src/runtime/panic.go:588 (0)
        print runtime.curg._panic.arg
Breakpoint 1 at 0x10ae9b8 for main.main() ./main.go:7 (0)
```

我们发现除了我们自己设置的`main.main`函数断点外，Delve内部已经为panic异常函数设置了一个断点。

通过`vars`命令可以查看全部包级的变量。因为最终的目标程序可能含有大量的全局变量，我们可以通过一个正则参数选择想查看的全局变量：

```
(dlv) vars main
main.initdone· = 2
runtime.main_init_done = chan bool 0/0
runtime.mainStarted = true
(dlv)
```

然后就可以通过`continue(c)`命令让程序运行到下一个断点处：

```
(dlv) continue
> main.main() ./main.go:7 (hits goroutine(1):1 total:1) (PC: 0x10ae9b8)
     2:
     3: import (
     4:         "fmt"
     5: )
     6:
=>   7: func main() {
     8:         nums := make([]int, 5)
     9:         for i := 0; i < len(nums); i++ {
    10:                 nums[i] = i * i
    11:         }
    12:         fmt.Println(nums)
(dlv)
```

输入`next(n)`命令单步执行进入main函数内部：

```
(dlv) next
> main.main() ./main.go:8 (PC: 0x10ae9cf)
     3: import (
     4:         "fmt"
     5: )
     6:
     7: func main() {
=>   8:         nums := make([]int, 5)
     9:         for i := 0; i < len(nums); i++ {
    10:                 nums[i] = i * i
    11:         }
    12:         fmt.Println(nums)
    13: }
(dlv)
```

进入函数之后可以通过`args`和`locals`命令查看函数的参数和局部变量：

```
(dlv) args
(no args)
(dlv) locals
nums = []int len: 842350763880, cap: 17491881, nil
```

因为main函数没有参数，因此args命令没有任何输出。而locals命令则输出了局部变量nums切片的值：此时切片还未完成初始化，切片的底层指针为nil，长度和容量都是一个随机数值。

再次输入next命令单步执行后就可以查看到nums切片初始化之后的结果了：

```
(dlv) next
> main.main() ./main.go:9 (PC: 0x10aea12)
     4:         "fmt"
     5: )
     6:
     7: func main() {
     8:         nums := make([]int, 5)
=>   9:         for i := 0; i < len(nums); i++ {
    10:                 nums[i] = i * i
    11:         }
    12:         fmt.Println(nums)
    13: }
(dlv) locals
nums = []int len: 5, cap: 5, [...]
i = 17601536
(dlv)
```

此时因为调试器已经到了for语句行，因此局部变量出现了还未初始化的循环迭代变量i。

下面我们通过组合使用`break(b)`和`condition(cond)`命令，在循环内部设置一个条件断点，当循环变量i等于3时断点生效：

```
(dlv) break main.go:10
Breakpoint 2 set at 0x10aea33 for main.main() ./main.go:10
(dlv) condition 2 i==3
(dlv)
```

然后通过continue执行到刚设置的条件断点，并且输出局部变量：

```
(dlv) continue
> main.main() ./main.go:10 (hits goroutine(1):1 total:1) (PC: 0x10aea33)
     5: )
     6:
     7: func main() {
     8:         nums := make([]int, 5)
     9:         for i := 0; i < len(nums); i++ {
=>  10:                 nums[i] = i * i
    11:         }
    12:         fmt.Println(nums)
    13: }
(dlv) locals
nums = []int len: 5, cap: 5, [...]
i = 3
(dlv) print nums
[]int len: 5, cap: 5, [0,1,4,0,0]
(dlv)
```

我们发现当循环变量i等于3时，nums切片的前3个元素已经正确初始化。

我们还可以通过stack查看当前执行函数的栈帧信息：

```
(dlv) stack
0  0x00000000010aea33 in main.main
   at ./main.go:10
1  0x000000000102bd60 in runtime.main
   at /usr/local/go/src/runtime/proc.go:198
2  0x0000000001053bd1 in runtime.goexit
   at /usr/local/go/src/runtime/asm_amd64.s:2361
(dlv)
```

或者通过`goroutine`和`goroutines`命令查看当前Goroutine相关的信息：

```
(dlv) goroutine
Thread 101686 at ./main.go:10
Goroutine 1:
  Runtime: ./main.go:10 main.main (0x10aea33)
  User: ./main.go:10 main.main (0x10aea33)
  Go: /usr/local/go/src/runtime/asm_amd64.s:258 runtime.rt0_go (0x1051643)
  Start: /usr/local/go/src/runtime/proc.go:109 runtime.main (0x102bb90)
(dlv) goroutines
[4 goroutines]
* Goroutine 1 - User: ./main.go:10 main.main (0x10aea33) (thread 101686)
  Goroutine 2 - User: /usr/local/go/src/runtime/proc.go:292 \
                runtime.gopark (0x102c189)
  Goroutine 3 - User: /usr/local/go/src/runtime/proc.go:292 \
                runtime.gopark (0x102c189)
  Goroutine 4 - User: /usr/local/go/src/runtime/proc.go:292 \
                runtime.gopark (0x102c189)
(dlv)
```

最后完成调试工作后输入quit命令退出调试器。至此我们已经掌握了Delve调试器器的简单用法。
