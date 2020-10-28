---
title: 【消息队列】- Kafka数据动态迁移
date: 2020-02-27 17:25:40
categories: [消息队列]
tags: [消息队列，Kafka]
---

## 前言

kafka作为高效的消息队列，其数据的维护也是十分重要的。有时候，我们可能存在对broker进行数据迁移，或者增加或者减少broker。对于我们已经创建了对topic。其配置不会随便进行更新。isr中依然存在着已经移除了对broker，这个时候，我们就需要更新它们的信息，告诉kafka数据分布的情况。并且在最少isr的问题到来之前，提前减少事故的事发。

<!-- more -->

### 1. 创建topic

```shell
bash-4.4# kafka-topics.sh --create --topic test-topic \
--zookeeper mzookeeper \
--replication-factor 2 --partitions 3
Created topic "test-topic".
```

### 2.查看test-topic

```shell
bash-4.4# kafka-topics.sh --describe --zookeeper mzookeeper --topic test-topic
Topic:test-topic	PartitionCount:3	ReplicationFactor:2	Configs:
	Topic: test-topic	Partition: 0	Leader: 1002	Replicas: 1002,1003	Isr: 1002,1003
	Topic: test-topic	Partition: 1	Leader: 1003	Replicas: 1003,1004	Isr: 1003,1004
	Topic: test-topic	Partition: 2	Leader: 1004	Replicas: 1004,1001	Isr: 1004,1001
```

### 3. 产生一批数据

```shell
bash-4.4# kafka-console-producer.sh --topic test-topic --broker-list mkafka1:9092
111111
22222
33333
44444
555555
66666
1111
2222
3333
4444
```

### 4. kafka-reassign-partitions重分区(假设需要减少节点broker 1004，本测试通过关闭对应kafka broker节点模拟)

```shell
bash-4.4# kafka-topics.sh --describe --zookeeper mzookeeper --topic test-topic
Topic:test-topic	PartitionCount:3	ReplicationFactor:2	Configs:
	Topic: test-topic	Partition: 0	Leader: 1002	Replicas: 1002,1003	Isr: 1002,1003
	Topic: test-topic	Partition: 1	Leader: 1003	Replicas: 1003,1004	Isr: 1003
	Topic: test-topic	Partition: 2	Leader: 1001	Replicas: 1004,1001	Isr: 1001
```

这里，我们看到partition=2的Leader由1004变为了1001，并且isr中的1004已经不见了。

### 5. 新建文件topic-to-move.json ，比加入如下内容

```shell
cat>topic-to-move.json<<EOF
{"topics": [{"topic":"test-topic"}], "version": 1}
EOF
```

### 6. 使用--generate生成迁移计划，broker-list根据自己环境设置，我的环境由于broker 10004挂掉了，只剩下1001和1002和1003

```shell
bash-4.4# kafka-reassign-partitions.sh --zookeeper mzookeeper --topics-to-move-json-file topic-to-move.json --broker-list "1001,1002,1003" --generate
Current partition replica assignment

{"version":1,"partitions":[{"topic":"test-topic","partition":0,"replicas":[1002,1003]},{"topic":"test-topic","partition":2,"replicas":[1004,1001]},{"topic":"test-topic","partition":1,"replicas":[1003,1004]}]}
Proposed partition reassignment configuration

{"version":1,"partitions":[{"topic":"test-topic","partition":0,"replicas":[1003,1001]},{"topic":"test-topic","partition":2,"replicas":[1002,1003]},{"topic":"test-topic","partition":1,"replicas":[1001,1002]}]}
```

我们把最下面分配好的建议的分区副本分布配置拿出来，写入一个新的文件中
(生产上一般会保留当前分区副本分布，仅更改下线的分区，这样数据移动更少)

```shell
cat > kafka-reassign-execute.json <<EOF
{"version":1,"partitions":[{"topic":"test-topic","partition":0,"replicas":[1003,1001]},{"topic":"test-topic","partition":2,"replicas":[1002,1003]},{"topic":"test-topic","partition":1,"replicas":[1001,1002]}]}
EOF
```

### 7. 使用--execute执行迁移计划  (有数据移动，broker 1004上的数据会移到broker 1001和1002和1003上，如果数据量大，执行的时间会比较久，耐心等待即可)

```shell
bash-4.4# kafka-reassign-partitions.sh --zookeeper mzookeeper \
--reassignment-json-file kafka-reassign-execute.json \
--execute
Current partition replica assignment

{"version":1,"partitions":[{"topic":"test-topic","partition":0,"replicas":[1002,1003]},{"topic":"test-topic","partition":2,"replicas":[1004,1001]},{"topic":"test-topic","partition":1,"replicas":[1003,1004]}]}

Save this to use as the --reassignment-json-file option during rollback
Successfully started reassignment of partitions {"version":1,"partitions":[{"topic":"test-topic","partition":0,"replicas":[1003,1001]},{"topic":"test-topic","partition":2,"replicas":[1002,1003]},{"topic":"test-topic","partition":1,"replicas":[1001,1002]}]}
```

这里还是列出了原始的配置和最新的配置，并且有一句提示：如果需要回滚的话，请使用第一份配置，第二份配置已经成功开始重新分发。

### 8. 使用-verify查看迁移进度

```shell
bash-4.4# kafka-reassign-partitions.sh --zookeeper mzookeeper \
--reassignment-json-file kafka-reassign-execute.json \
--verify
Status of partition reassignment:
Reassignment of partition [test-topic,0] completed successfully
Reassignment of partition [test-topic,2] completed successfully
Reassignment of partition [test-topic,1] completed successfully
```

成功处理完毕了。

### 9. 查看详情

```
bash-4.4# kafka-topics.sh --describe --zookeeper mzookeeper --topic test-topic
Topic:test-topic	PartitionCount:3	ReplicationFactor:2	Configs:
	Topic: test-topic	Partition: 0	Leader: 1003	Replicas: 1003,1001	Isr: 1003,1001
	Topic: test-topic	Partition: 1	Leader: 1001	Replicas: 1001,1002	Isr: 1001,1002
	Topic: test-topic	Partition: 2	Leader: 1002	Replicas: 1002,1003	Isr: 1003,1002
```

可以看到1004的broker_id已经被彻底移除了。

### 9. 通过消费者验证，可知，并未丢失数据。注意需要加--from-beginning。

```shell
bash-4.4# kafka-console-consumer.sh --topic test-topic --from-beginning --zookeeper mzookeeper
111111
44444
1111
4444
33333
66666
3333
22222
555555
2222
```