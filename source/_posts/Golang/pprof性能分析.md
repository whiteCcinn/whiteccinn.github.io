---
title: 【Golang】- pprof性能分析
date: 2020-08-14 16:35:51
categories: [Golang]
tags: [Golang]
---

## 前言

最近在开发一个golang的大数据服务，发现只要到了业务层性能就急剧下降，为了排查这个原因，使用pprof进行性能分析

<!-- more -->

## 使用

在main函数中加入以下代码

```Go
import "runtime/pprof"
// ...
cpuProfile, _ := os.Create("cpu_profile")
pprof.StartCPUProfile(cpuProfile)
defer pprof.StopCPUProfile()
// ...
```

这里 `os.Create("cpu_profile")` 指定生成的数据文件, 然后 pprof.StartCPUProfile 看名字就知道是开始对 CPU 的使用进行监控. 有开始就有结束, 一般直接跟着 defer pprof.StopCPUProfile() 省的后面忘了. 编译执行一次以后会在目录下生成监控数据并记录到 `cpu_profile`. 接着就可以使用 pprof 来解读分析这些监控生成的数据.


## CPU Profiling

```
root@60b1d42d6330:/www# go tool pprof cpu_profile
File: main
Build ID: 3d9d75a7fe2c5c4917c59acabfd743a6512d91fa
Type: cpu
Time: Aug 14, 2020 at 8:34am (UTC)
Duration: 205.73ms, Total samples = 30ms (14.58%)
Entering interactive mode (type "help" for commands, "o" for options)
```
