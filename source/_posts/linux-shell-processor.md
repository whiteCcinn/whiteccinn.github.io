---
title: 【Linux命令】- 进程管理工具
date: 2018-02-28 14:50:53
categories: [Linux]
tags: [Linux, Shell]
---

# 查询进程

```shell
ps -ef

// 查看某用户的进程

ps -u phper

// 查看进程完整信息

ps -ajx

// 显示进程信息，并实时更新
top
```

<!-- more -->

## 分析线程栈

```shell
pmap PID
```
