---
title: 【消息队列】- Kafka相关
date: 2019-10-01 15:25:40
categories: [消息队列]
tags: [消息队列，Kafka]
---

## 前言

目前 kafka 客户端在 php 中比较出名的仅有 2 个，但是其各有利弊，在这里就不展开详细说明了。因此，我们实现了一个叫`kafka-swoole`的项目，项目由`swoole4.x`协程+多进程实现，实现在串行化协程的基础上实现并行操作。

由于很多小伙伴对 kafka 并不是特别了解，所以在这里记录一下一些基础的 kafka 自带的命令使用方式

<!-- more -->

我的 kafka 集群是 4 个 broker，是用 docker 连接在一起的 kafka 集群。分别设置了 hostname

- mkafka1:9092
- mkafka2:9092
- mkafka3:9092
- mkafka4:9092
- mzookeeper:2181

### kafka-topics.sh

这个脚本主要是用于 kafka 创建 topics 而使用。

#### 创建 topic

| Option                                                  | Description                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| --alter                                                 | 修改 topic 的分区数，副本指派以及 topic 的现有配置                           |
| --config <name=value>                                   | 创建 topic 的时候会用到默认配置，置顶具体的配置参数，具体查看 kafka 的配置项 |
| --create                                                | 创建 topic                                                                   |
| --delete                                                | 删除 topic                                                                   |
| --delete-config <name>                                  | 创建 topic 的时候移除某一个配置项                                            |
| --describe                                              | 某一个 topic 的详情描述                                                      |
| --list                                                  | 所有可用的 topic 列表                                                        |
| --partitions <number>                                   | 指定 topic 数目                                                              |
| --replica-assignment <broker_id_for_part1_replica1,...> | 创建或更改的主题的手动分区到代理的分配列表。                                 |
| --replication-factor <number>                           | topic 的副本因子                                                             |
| --topic <topic>                                         | 需要创建的 topic 名字                                                        |
| --unavailable-partitions                                | --describe 主题的时候，则只显示其 leader 不可用的分区                        |
| --zookeeper                                             | zookeeper 节点                                                               |

```
kafka-topics.sh --create --zookeeper mzookeeper:2181 --replication-factor 2 --partitions 4 --topic kafka-swoole

## 标准输出
Created topic "kafka-swoole".
```

这样子执行命令，我们就可以创建一个副本因子为 2，并且分区数为 4 ，名字叫 kafka-swoole 的 topic

#### 查看所有的 topic 列表

```
kafka-topics.sh --list --zookeeper mzookeeper:2181

## 标准输出
__consumer_offsets
caiwenhui
caiwenhui2
kafka-swoole
test
```

#### 查看 某个 topic 的详情

```
kafka-topics.sh  --zookeeper mzookeeper:2181 --topic kafka-swoole --describe

## 标准输出
Topic:kafka-swoole	PartitionCount:4	ReplicationFactor:2	Configs:
	Topic: kafka-swoole	Partition: 0	Leader: 1003	Replicas: 1003,1002	Isr: 1003,1002
	Topic: kafka-swoole	Partition: 1	Leader: 1004	Replicas: 1004,1003	Isr: 1004,1003
	Topic: kafka-swoole	Partition: 2	Leader: 1001	Replicas: 1001,1004	Isr: 1001,1004
	Topic: kafka-swoole	Partition: 3	Leader: 1002	Replicas: 1002,1001	Isr: 1002,1001
```

#### 向某个 topic 写入消息

```
kafka-console-producer.sh --broker-list mkafka1:9092 --topic kafka-swoole
```

#### 从某个 topic 读取消息

##### 从最开始的 offset 读取

```
kafka-console-consumer.sh --bootstrap-server mkafka1:9092 --topic kafka-swoole --from-beginning
```

##### 从最新的 offset 中读

```
kafka-console-consumer.sh --bootstrap-server mkafka1:9092 --topic kafka-swoole
```

#### 查看某个 topic 的某个时刻的 offset

##### 最早之前的消息的 offset

```
kafka-run-class.sh kafka.tools.GetOffsetShell --broker-list 192.168.11.148:9092 -time -2 --topic kafka-swoole

# 标准输出
kafka-swoole:2:0
kafka-swoole:1:0
kafka-swoole:3:0
kafka-swoole:0:0
```

##### 最近的消息 offset

```
kafka-run-class.sh kafka.tools.GetOffsetShell --broker-list 192.168.11.148:9092 -time -1 --topic kafka-swoole

# 标准输出
kafka-swoole:2:0
kafka-swoole:1:0
kafka-swoole:3:0
kafka-swoole:0:6
```

##### 某一个时刻的 offset

```
kafka-run-class.sh kafka.tools.GetOffsetShell --broker-list 192.168.11.148:9092 -time 1569943885 --topic kafka-swoole
```
