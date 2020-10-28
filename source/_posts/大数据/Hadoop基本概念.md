---
title: 【大数据】- Hadoop 基本概念
date: 2019-06-12 09:56:40
categories: [大数据]
tags: [大数据，Hadoop]
---

## 前言

Hadoop 是一个由 Apache 基金会所开发的分布式系统基础架构，它可以使用户在不了解分布式底层细节的情況下开发分布式程序，充分利用集群的威力进行高速运算和存储。

从其定义就可以发现，它解決了两大问题：大数据存储、大数据分析。也就是 Hadoop 的两大核心：HDFS 和 MapReduce。

HDFS(Hadoop Distributed File System)是可扩展、容错、高性能的分布式文件系统，异步复制，一次写入多次读取，主要负责存储。

MapReduce 为分布式计算框架，包含 map(映射)和 reduce(归约)过程，负责在 HDFS 上进行计算。

但是由于目前我没有用到 MapReduce，并且 MapReduce 能效过于地下并且很占系统资料，所以一般数据分析都会用其他的来代替。

所以这里介绍的 Hadoop，会重点讲解 HDFS 和其工作原理。

<!-- more -->

## Hadoop 存储 - HDFS

Hadoop 的存储系统是 HDFS(Hadoop Distributed File System)分布式文件系统，对外部客户端而言，HDFS 就像一个传统的分级文件系统，可以进行创建、删除、移动或重命名文件或文件夹等操作，与 Linux 文件系统类似。

但是，Hadoop HDFS 的架构是基于一组特定的节点构建的，名称节点（NameNode，仅一个)，它在 HDFS 内部提供`元数据服务`；第二名称节点(Secondary NameNode)，名称节点的帮助节点，主要是为了`整合元数据操作(注意不是名称节点的备份)`；数据节点(DataNode)，它为 HDFS 提供`存储块`。由于仅有一个 NameNode，因此这是 HDFS 的一个缺点(单点失败，在 Hadoop2.x 后有较大改善)。

### NameNode

它是一个通常在 HDFS 架构中单独机器上运行的组件，负责管理文件系统名称空间和控制外部客户机的访问。NameNode 决定是否将文件映射到 DataNode 上的复制块上。对于最常见的 3 个复制块，第一个复制块存储在同一机架的不同节点上，最后一个复制块存储在不同机架的某个节点上。

### Secondary NameNode

第二名称节点的作用在于为 HDFS 中的名称节点提供一个 Checkpoint，它只是名称节点的一个`助手节点`，这也是它在社区内被认为是 Checkpoint Node 的原因。

### DatabNode

数据节点也是一个通常在 HDFS 架构中的单独机器上运行的组件。Hadoop 集群包含一个 NameNode 和大量 DataNode。数据节点通常以机架的形式组织，机架通过一个交换机将所有系统连接起来。

数据节点响应来自 HDFS 客户机的`读写请求`。它们还响应来自 NameNode 的`创建`、`删除`和`复制块`的命令。名称节点依赖来自每个数据节点的定期`心跳（heartbeat）消息`。每条消息都包含一个`块报告`，名称节点可以根据这个报告验证块`映射和其他文件系统元数据`。如果数据节点不能发送心跳消息，名称节点将采取修复措施，`重新复制在该节点上丢失的块`。
