---
title: 64位分布式自增发号器
date: 2017-07-13 17:30:00
categories: [算法]
tags: [算法, ID发号器, PHP, C]
---

## IdCenterSender ---PHP 源码实现-64 位分布式自增发号器

PHP 实现 64 位分布式 ID 发号器, github 上也有 C 语言版本上的连接可以进去跳转

[github 地址 : IdCenterSender](https://github.com/whiteCcinn/IdCenterSender)

> 觉得好记的给个 Start 喔。

## 原理

参考 Snowflake 算法,根据自身设计情况扩展了其中的细节

<!-- more -->

> 64bits 分成了 4 个部分。

> 最高位舍弃
> 毫秒级的时间戳,有 41 个 bit.能够使用 139 年，当然这些是可以扩展的,可以通知指定起始时间来延长这个日期长度。也就是说服务启动开始之后就可以持续使用 139 年
> 自定义分布式机器节点 id,占位 12 个 bit,能够支持 8191 个节点。部署的时候可以配置好服务器 id,也就是代码里面的 node_id 变量，每一台机器都需要用不同的 node_id 来标志，就像 mysql 的 server_id 一样
> 进程（毫秒）自增序号。占位 10bit,一毫秒能产生 2047 个 id。

## 总结特点：

- 类 snowflake 算法
- ID 发号器有效期可以延续从发布开始的 139 年
- 分布式支持 8191 台机器
- 单进程调用的情况下，并发每秒支持 200 万个 ID 生成

## 唯一性保证

> 同一毫秒内自增变量保证并发的唯一性(采用文件锁的方式对 cache 文件进行锁定)。

## 使用

```PHP
include_once '../cckeyid/IdCenterSender.php';

echo \cckeyid\IdCenterSender::getInstance()->ck_get_new_id(1);

echo PHP_EOL;

print_r(\cckeyid\IdCenterSender::getInstance(true)->ck_get_new_id(4));

```
