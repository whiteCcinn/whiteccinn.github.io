---
title: 【Linux命令】- 性能监控
date: 2018-02-28 15:00:50
categories: [Linux]
tags: [Linux, Shell]
---

使用操作系统的过程中，我们经常需要查看当前的性能如何，需要了解 CPU、内存和硬盘的使用情况；
本节介绍的这几个工具能满足日常工作要求；

## 监控 CPU

```shell
top
```

## 查询内存

```shell
free -m
```

<!-- more -->

当系统中 sar 不可用时(sar 最好用)，可以使用以下工具替代：linux 下有 vmstat、Unix 系统有 prstat

eg：
查看 cpu、内存、使用情况：
vmstat n m （n 为监控频率、m 为监控次数）

```
[/home/weber#]vmstat 1 3
procs -----------memory---------- ---swap-- -----io---- -system-- ----cpu----
r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa
0  0  86560  42300   9752  63556    0    1     1     1    0    0  0  0 99  0
1  0  86560  39936   9764  63544    0    0     0    52   66   95  5  0 95  0
0  0  86560  42168   9772  63556    0    0     0    20  127  231 13  2 84  0
```

使用 watch 工具监控变化
当需要持续的监控应用的某个数据变化时，watch 工具能满足要求；
执行 watch 命令后，会进入到一个界面，输出当前被监控的数据，一旦数据变化，便会高亮显示变化情况；

eg：操作 redis 时，监控内存变化：

```
$watch -d -n 1 './redis-cli info | grep memory'
(以下为watch工具中的界面内容，一旦内存变化，即实时高亮显示变化）
Every 1.0s: ./redis-cli info | grep memory                                                                  Mon Apr 28 16:10:36 2014

used_memory:45157376
used_memory_human:43.07M
used_memory_rss:47628288
used_memory_peak:49686080
used_memory_peak_human:47.38M
```

## 总结

top / sar / free / watch
