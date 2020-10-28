---
title: 【消息队列】- kafka-swoole
date: 2019-11-04 10:37:40
categories: [消息队列]
tags: [消息队列，Kafka, Swoole]
---

## 前言

目前 kafka 客户端在 php 中比较出名的仅有 2 个，这 2 个项目都有各自的利弊。在这里我选择几个来列一下

- [weiboad/kafka-php](https://github.com/weiboad/kafka-php)
  - 协议非结构化封装，自定义性较强，不好维护
  - 目前的 API 在消费者中由于单例设计的原因，不允许在消费者中生产消息
  - 不支持多种压缩协议
  - 单进程“协程式”逻辑，数据未实现分离，容易堵塞消费
- [arnaud-lb/php-rdkafka](https://github.com/arnaud-lb/php-rdkafka)
  - 协议非结构化封装，自定义性较强，不好维护
  - 不支持多种压缩协议
  - 利用多线程，但是 PHP 对多线程对支持并不友好，相对于用 swoole 而言，劣势较为明显，容易出 bug，且维护性不高

基于以上几点，我们在基于`swoole-4.3`以上重新开发了`kafka-swoole`项目，优点如下：

- 多进程多核处理
- 支持 kafka 多个 sink 方式，实现拉取 kafka 数据和业务逻辑分离，从而不堵塞数据拉取
- 首个支持多种压缩方式（normal(不压缩)/gzip/snappy）的 php 客户端，从而在大吞吐对情况下减少带宽占用，提高传输速率
- 协议封装采用 OOP 的方式，结构化了协议的封装，利于维护和封装，对协议利用反射来统一封包和解包
- 利用协程来实现单个进程中对异步逻辑处理
- 提供了 runtime 的 rpc 命令，实时获取 kafka 成员进程对内部数据，实时查看消费情况
- 提供了 kafka 命令，方便获取 kafka 服务相关信息和 kafka 相关操作
- 在成员进程挂掉的情况下，记录错误信息，自动拉起。
- 对于常驻进程，不排除业务逻辑写出了内存泄漏的情况，所以所有的子进程都带有内存临界值重启机制来释放内存
- 主进程退出的情况下，发起了`离开消费者组`的请求，使得 kafka 能快速响应消费者组最新状态，从而更好平滑重新加入消费者

<!-- more -->

## 服务架构

![kafka-swoole架构图](/images/消息队列/kafka/kafka-swoole.jpg)

kafka-swoole 的大体架构图如上，可以笼统的概括为 2 个部分组成，分别的 `kafka-client` 和`consumer/sinker`。

`kafka-client`主要是负责从 kafka 服务中拉取数据，`consumer/sinker`主要负责消费数据。

`consumer`和`sinker` 的区别在于，数据是否经过了`中间存储介质`，如果不经过`中间存储介质`的话，那么就是`consumer`，就是我们接下来会在配置说到的`KAFKA_MESSAGE_STORAGE=Directly`，这也将会是我们是否启用额外的 `sinker` 进程的`关键所在`，如果它被选择之后，client 和消费者将会在同一个进程中处理，所以如果你的业务逻辑比较耗时的话，势必会影响数据拉取速度。如果采用`中间存储介质`的话，那么目前支持 2 种存储介质，分别是`Redis`,`File`。目前来说更加推荐采用`Redis`的方式，虽然借助了第三方服务，但是它在其他各个方面都比 File 好，就举一个例子来说，如果用 File 作为存储介质的话，File 的话还需要自己做磁盘备份来保证数据不会丢失。

## runtime 的 rpc 命令的实现细节

本项目中，所谓的 rpc 的命名，主要是由主进程想 kafka-client 进程发起 rpc 请求的行为。用于获取 kakfa-client 实时状况而存在的一种方式，所以，这里我们需要实现进程间的通信，这里的选型，我们选择选择了`AF_UNIX`的方式来进行通信，而没有使用端口服务的方式，是因为，我们的 rpc 请求不对外提供服务，并且是针对本项目，并且`AF_UNIX`也让我们通信更加高效。

由于我们这里需要实现三方通信，所有发起请求的命令独占一个`UNIX_FILE`，我们主进程占一个`UNIX_FILE`，每个 kafka-client 同样占一个`UNIX_FILE`，实现三方通信。

### rpc 协议

协议本身十分简单，协议头有 4 个字节的无符号整形封包协议主体的长度，协议主体是由`role`,`rpc`,`method`一起组成的 json_encode 后的字符串。

```php
$cmd = [
          'role'   => $external,
          'rpc'    => $rpc,
          'method' => $method,
      ];
$data = json_encode($cmd);
$package = pack('N', strlen($data)) . $data;
```

### 处理流程

在 core 项目 `src/RPC`中，是我们的所有的 RPC 服务处理类，类有 2 种类型的方法，分别是`getXxx`和`onXxx`，它们的区别在于

`getXxx`：各个 kafka-client 进程处理该 RPC 请求处理的逻辑

`onXxx`：负责主进程节奏各个 kafka-client 进程处理后的结果，进行汇总处理

## sinker 相关的内容

当我们使用`kafka-swoole`项目的时候，要如何使用呢，其实业务方并不需要过多的关注 kafka-client 的细节，因为它的作用仅仅是拉取数据到`存储介质`，我们写业务的时候，其实主要都是在`sinker`中写业务。

我们在 `app/Controller`中有一个`SinkerController`，里面的`hanlder(array $messages)`就是接收从存储介质中读取回来的数据，但是这里需要注意的是，从存储介质中拉取出来的时候是否被消费这个问题，这里不管是`Redis`还是`File`，都没有自带的一个`ack`机制让我们保证数据正确被消费了。但是，我们迂回得实现了这个方式，利用的就是 redis 的可靠性队列。

![kafka-swoole-redis的存储介质关系图](/images/消息队列/kafka/Redis存储介质关系图.png)

通过上图所示的方式，我们的 ack 机制通过业务方来确认，所以，该方法的返回结果为一个数组，数组下标对应每条消息的状态，当状态为`true`的时候代表被顺利消费了，消息会在 `processing`的队列中被移除，如果被标记为了`false`，那么消息将不会被移除，对于失败的消息，目前我们并没有做任何的处理，因为对于部分消息，可能是重试的情况，部分消息，可能是真的错误的情况。因此这部分消息如果重新消费的话，需要业务方确认，并且通过命令来把数据拉回到`pending`队列中来实现重新消费的情况。如果是错误的话，就需要通过命令来清空队列。

## kafka 相关的命令的提供

```bash
php bin/kafka-client
Console Tool

Usage:
  command [options] [arguments]

Options:
  -h, --help            Display this help message
  -q, --quiet           Do not output any message
  -V, --version         Display this application version
      --ansi            Force ANSI output
      --no-ansi         Disable ANSI output
  -n, --no-interaction  Do not ask any interactive question
  -v|vv|vvv, --verbose  Increase the verbosity of messages: 1 for normal output, 2 for more verbose output and 3 for debug

Available commands:
  help                  Displays help for a command
  kafka.describeGroups  See consumer group details
  kafka.produce         Send a message
  list                  Lists commands
  rpc                   Built-in runtime RPC command
  start                 Start Kafka-Swoole
```

带有 kafka 前缀的命令，都是直接请求 kafka 相关的 API 的命令。

### kafka.describeGroups

用于查询某个消费者组订阅的 topic 的详情

```bash
php bin/kafka-client kafka.describeGroups -h
Description:
  See consumer group details

Usage:
  kafka.describeGroups [options]

Options:
  -t, --topic=TOPIC     Which topic is subscribed by the consumer group?
  -g, --group=GROUP     Which consumer group?
  -h, --help            Display this help message
  -q, --quiet           Do not output any message
  -V, --version         Display this application version
      --ansi            Force ANSI output
      --no-ansi         Disable ANSI output
  -n, --no-interaction  Do not ask any interactive question
  -v|vv|vvv, --verbose  Increase the verbosity of messages: 1 for normal output, 2 for more verbose output and 3 for debug

Help:
  See consumer group details...
```

例子如下图：

```bash
php bin/kafka-client kafka.describeGroups -t mulog_clean_24 -g kafka-swoole

DescribeGruops-BaseInfo
=======================

 -------------- ------------ -------------- --------------
  groupId        groupState   protocolType   protocolData
 -------------- ------------ -------------- --------------
  kafka-swoole   Stable       consumer       Range
 -------------- ------------ -------------- --------------

 --------------------------------------------------- -------------- -------------- ---------------- -----------
  memberId                                            clientId       clientHost     topcic           paritions
 --------------------------------------------------- -------------- -------------- ---------------- -----------
  kafka-swoole-44857c49-b019-439b-90dd-d71112b2c01e   kafka-swoole   /192.167.8.2   mulog_clean_24   0,1
 --------------------------------------------------- -------------- -------------- ---------------- -----------

 --------------------------------------------------- -------------- -------------- ---------------- -----------
  memberId                                            clientId       clientHost     topcic           paritions
 --------------------------------------------------- -------------- -------------- ---------------- -----------
  kafka-swoole-5714cd77-a0dd-4d29-aa20-718f9d713908   kafka-swoole   /192.167.8.2   mulog_clean_24   2,3
 --------------------------------------------------- -------------- -------------- ---------------- -----------
```

### kafka.produce

用于生产一条消息到某个 topic 中，支持多种压缩方式，支持多种生产消息策略

生产者 partition 策略：

- `-p/--partition=` 采用指定 partition 的策略
- `-k/--key=` 采用通过 key 的哈希到 partition 策略
- 以上两个都不选，则采用 随机发送 partition 策略

生产者压缩方式：

- `-c/--compress=` 采用的压缩方式：0=不压缩/1=采用 gzip 压缩/2=使用 snappy 压缩/3=使用 lz4 压缩
- 不填写，则不进行压缩

```bash
php bin/kafka-client kafka.produce --help
Description:
  Send a message

Usage:
  kafka.produce [options] [--] <message>

Arguments:
  message                      The message you wish to send.

Options:
  -t, --topic[=TOPIC]          Which is the topic you want to send?
  -p, --partition[=PARTITION]  Which is the topic you want to send to partition?
  -k, --key[=KEY]              Which is the topic you want to send to partition by key?
  -c, --compress[=COMPRESS]    Which one do you want to compress: 0: normal 1:gzip 2:snappy 3:lz4
  -h, --help                   Display this help message
  -q, --quiet                  Do not output any message
  -V, --version                Display this application version
      --ansi                   Force ANSI output
      --no-ansi                Disable ANSI output
  -n, --no-interaction         Do not ask any interactive question
  -v|vv|vvv, --verbose         Increase the verbosity of messages: 1 for normal output, 2 for more verbose output and 3 for debug

Help:
  This command will help you send separate messages to a topic...
```

例子如下图：

```bash
php bin/kafka-client kafka.produce -t test_topic_A -- 'This is my test'
array(3) {
  ["responses"]=>
  array(1) {
    [0]=>
    array(2) {
      ["topic"]=>
      string(12) "test_topic_A"
      ["partition_responses"]=>
      array(1) {
        [0]=>
        array(3) {
          ["partition"]=>
          int(0)
          ["errorCode"]=>
          int(0)
          ["baseOffset"]=>
          int(0)
        }
      }
    }
  }
  ["responseHeader"]=>
  array(1) {
    ["correlationId"]=>
    int(0)
  }
  ["size"]=>
  int(40)
}
```

目前输出方式并没有优化，后续进行输出样式优化

### rpc

提供实时获取 kafka-client 成员的内部情况

```bash
php bin/kafka-client rpc -h
Description:
  Built-in runtime RPC command

Usage:
  rpc <type>

Arguments:
  type                  which you want to execute command?

Options:
  -h, --help            Display this help message
  -q, --quiet           Do not output any message
  -V, --version         Display this application version
      --ansi            Force ANSI output
      --no-ansi         Disable ANSI output
  -n, --no-interaction  Do not ask any interactive question
  -v|vv|vvv, --verbose  Increase the verbosity of messages: 1 for normal output, 2 for more verbose output and 3 for debug

Help:
  The following are the built-in RPC command options：
  kafka_lag
  offset_checker
  block_size
  member_leader
  metadata_brokers
  metadata_topics
```

例子如下图：

```bash
php bin/kafka-client rpc kafka_lag
1000

php bin/kafka-client rpc offset_checker
 -------------- ----------- ---------------- ------------------ -----------------
  topic          partition   current-offset   kafka-max-offset   remaining-count
 -------------- ----------- ---------------- ------------------ -----------------
  kafka-swoole   2           50223            50223              0
  kafka-swoole   3           70353            70353              0
  kafka-swoole   0           52395            52395              0
  kafka-swoole   1           50407            50407              0
 -------------- ----------- ---------------- ------------------ -----------------

php bin/kafka-client rpc block_size
254

php bin/kafka-client rpc member_leader
 ---------------------------------------------------
  consumer-group-leaderId
 ---------------------------------------------------
  kafka-swoole-da43c9a0-b12d-46df-9941-ee80456ec9a2
 ---------------------------------------------------

 ---------------------------------------------------
  consumer-group-membersId
 ---------------------------------------------------
  kafka-swoole-6080eb8e-3bfb-4be0-a923-037bb99a2666
  kafka-swoole-da43c9a0-b12d-46df-9941-ee80456ec9a2
 ---------------------------------------------------

 php bin/kafka-client rpc metadata_brokers
 --------- --------- ------
  node-id   host      port
 --------- --------- ------
  1003      mkafka3   9092
  1004      mkafka4   9092
  1001      mkafka1   9092
  1002      mkafka2   9092
 --------- --------- ------

 php bin/kafka-client rpc metadata_topics
 -------------- ----------- ----------- --------------- -----------
  topic          partition   leader-id   replica-nodes   isr-nodes
 -------------- ----------- ----------- --------------- -----------
  kafka-swoole   2           1001        1001,1004       1001,1004
  kafka-swoole   1           1004        1004,1003       1004,1003
  kafka-swoole   3           1002        1002,1001       1002,1001
  kafka-swoole   0           1003        1003,1002       1002,1003
 -------------- ----------- ----------- --------------- -----------

```

## kafka 客户端启动到拉取数据流程

以下列出所有的必备请求，到`Fetch`请求位置，都是同步请求，`OffsetCommit`和`HeartBeat`都是分开的独立请求

- Metadata 获取元数据信息
- FindCoordinator 让 kafka 分配消费者组协调器入口
- JoinGroup 告诉 kafka 当前 kafka-client 需要加入消费者组
- SyncGroup 同步消费者组消息（如果发起请求的是 leader 的话，则需要带上所有消费者组成员所需要订阅 topic 和 partition 的信息，所以由 leader 分配）
- ListsOffsets 获取当前 topic 在 kafka/zookeeper 中存储的 offset 的最大值和最小值
- OffsetFetch 获取当前消费者组在 kafka/zookeeper 中存储的 offset 的值
- Fetch 拉取数据
- OffsetCommit 提交当前消费者组处理到的 offset
- HeartBeat  心跳请求

### Rebalance 流程

#### 发送加入组请求（Rebalance 流程）

消费者首次加入 group 也可以认为是 Rebalance 的一种，其中包含了两类请求：JoinGroup 和 SyncGroup 请求。我们先看一下两次请求的流程：

![Rebalance-JoinGroup](/images/消息队列/kafka/Rebalance-JoinGroup.jpg)

当组内成员加入 group 时，它会向协调者发送一个 JoinGroup 请求。请求中会将自己要订阅的 Topic 上报，这样协调者就可以收集到所有成员的订阅信息。收集完订阅信息之后，通常情况下，第一个发送 JoinGroup 请求的成员将会自动称为 Leader。所有后棉其他成员加入的时候，就发生了 Rebalance 的情况了。

#### 新成员入组

![Rebalance-JoinGroup-2](/images/消息队列/kafka/Rebalance-JoinGroup-2.jpg)

#### 组成员主动离组

![Rebalance-LeaveGroup](/images/消息队列/kafka/Rebalance-LeaveGroup.jpg)

#### 组成员崩溃离组

![Rebalance-LeaveGroup-2](/images/消息队列/kafka/Rebalance-LeaveGroup-2.jpg)

#### Rebalance 时组内成员需要提交 offset

![Rebalance-commitoffset](/images/消息队列/kafka/Rebalance-commitoffset.jpg)

### Consumer 分区分配策略

#### RangeAssignor

RangeAssignor 是按照 Topic 的维度进行分配的，也就是说按照 Topic 对应的每个分区平均的按照范围区段分配给 Consumer 实例。这种分配方案是按照 Topic 的维度去分发分区的，此时可能会造成先分配分区的 Consumer 实例的任务过重。

![RangeAssignor](/images/消息队列/kafka/RangeAssignor.jpg)

从上图的最终分配结果看来，因为是按照 Topic A 和 Topic B 的维度进行分配的。对于 Topic A 而言，有 2 个消费者，此时算出来 C0 得到 2 个分区，C1 得到 1 个分区；对于 Topic B 的维度也是一样，也就是先分配的 Consumer 会得到的更多，从而造成倾斜。需要注意一点的是，RangeAssignor 是按照范围截断分配的，不是按顺序分发的。

#### RoundRobinAssignor

RoundRobinAssignor 中文可以翻译为轮询，也就是顺序一个一个的分发。其中代码里面的大概逻辑如下：拿到组内所有 Consumer 订阅的 TopicPartition，按照顺序挨个分发给 Consumer，此时如果和当前 Consumer 没有订阅关系，则寻找下一个 Consumer。从上面逻辑可以看出，如果组内每个消费者的订阅关系是同样的，这样 TopicPartition 的分配是均匀的。

![RoundRobinAssignor](/images/消息队列/kafka/RoundRobinAssignor.jpg)

当组内每个消费者订阅的 Topic 是不同的，这样就可能会造成分区订阅的倾斜。

![RoundRobinAssignor-2](/images/消息队列/kafka/RoundRobinAssignor-2.jpg)

#### StickyAssignor

StickyAssignor 是 Kafka Java 客户端提供的 3 中分配策略中最复杂的一种，从字面上可以看出是具有“粘性”的分区策略。Kafka 从 0.11 版本开始引入，其主要实现了两个功能：

1、主题分区的分配要尽可能的均匀。

2、当 Rebalance 发生时，尽可能保持上一次的分配方案。

当然，当上面两个条件发生冲突是，第一个提交件要优先于第二个提交，这样可以使分配更加均匀。下面我们看一下官方提供的 2 个例子，来看一下 RoundRoubin 和 Sticky 两者的区别。

![StickyAssignor](/images/消息队列/kafka/StickyAssignor.jpg)

从上面我们可以看出，初始状态各个 Consumer 订阅是相同的时候，并且主题的分区数也是平均的时候，两种分配方案的结果是相同的。但是当 Rebalance 发生时，可能就会不太相同了，加入上面的 C1 发生了离组操作，此时分别会有下面的 Rebalance 结果：

![StickyAssignor-2](/images/消息队列/kafka/StickyAssignor-2.jpg)

从上面 Rebalance 后的结果可以看出，虽然两者最后分配都是均匀的，但是 RoundRoubin 完全是重新分配了一遍，而 Sticky 则是在原先的基础上达到了均匀的状态。

下面我们再看一个 Consumer 订阅主题不均匀的例子。

![StickyAssignor-3](/images/消息队列/kafka/StickyAssignor-3.jpg)

从上面的订阅关系可以看出，Consumer 的订阅主题个数不均匀，并且各个主题的分区数也是不相同的。此时两种分配方案的结果有了较大的差异，但是相对来说 Sticky 方式的分配相对来说是最合理的。下面我们看一下 C1 发生离组时，Rebalance 之后的分配结果。

![StickyAssignor-4](/images/消息队列/kafka/StickyAssignor-4.jpg)

从上面结果可以看出，RoundRoubin 的方案在 Rebalance 之后造成了严重的分配倾斜。因此在生产上如果想要减少 Rebalance 的开销，可以选用 Sticky 的分区分配策略。

## 协议封装细节规则

官方协议说明链接：[Apache-kafka-protocol](http://kafka.apache.org/protocol.html)
非官方协议说明链接：[非官方协议说明](https://www.iteblog.com/archives/2217.html)

项目中协议的封装在我们的 core 项目中的`src/Protocol`里面。整个树形图如下：

```bash
rpc/Protocol
├── AbstractRequest.php
├── AbstractRequestOrResponse.php
├── AbstractResponse.php
├── CommonRequest.php
├── CommonResponse.php
├── Request
│   ├── Common
│   │   └── RequestHeader.php
│   ├── CreateTopics
│   │   ├── AssignmentsCreateTopics.php
│   │   ├── ConfigsCreateTopics.php
│   │   └── TopicsCreateTopics.php
│   ├── CreateTopicsRequest.php
│   ├── DescribeGroupsRequest.php
│   ├── Fetch
│   │   ├── PartitionsFetch.php
│   │   └── TopicsFetch.php
│   ├── FetchRequest.php
│   ├── FindCoordinatorRequest.php
│   ├── HeartbeatRequest.php
│   ├── JoinGroup
│   │   ├── ProtocolMetadataJoinGroup.php
│   │   ├── ProtocolNameJoinGroup.php
│   │   ├── ProtocolsJoinGroup.php
│   │   └── TopicJoinGroup.php
│   ├── JoinGroupRequest.php
│   ├── LeaveGroupRequest.php
│   ├── ListOffsets
│   │   ├── PartitionsListsOffsets.php
│   │   └── TopicsListsOffsets.php
│   ├── ListOffsetsRequest.php
│   ├── Metadata
│   │   └── TopicMetadata.php
│   ├── MetadataRequest.php
│   ├── OffsetCommit
│   │   ├── PartitionsOffsetCommit.php
│   │   └── TopicsOffsetCommit.php
│   ├── OffsetCommitRequest.php
│   ├── OffsetFetch
│   │   ├── PartitionsOffsetFetch.php
│   │   └── TopicsOffsetFetch.php
│   ├── OffsetFetchRequest.php
│   ├── Produce
│   │   ├── DataProduce.php
│   │   ├── MessageProduce.php
│   │   ├── MessageSetProduce.php
│   │   └── TopicDataProduce.php
│   ├── ProduceRequest.php
│   ├── SyncGroup
│   │   ├── AssignmentsSyncGroup.php
│   │   ├── GroupAssignmentsSyncGroup.php
│   │   ├── MemberAssignmentsSyncGroup.php
│   │   └── PartitionAssignmentsSyncGroup.php
│   └── SyncGroupRequest.php
├── Response
│   ├── Common
│   │   └── ResponseHeader.php
│   ├── CreateTopics
│   │   └── TopicsCreateTopics.php
│   ├── CreateTopicsResponse.php
│   ├── DescribeGroups
│   │   ├── GroupsDescribeGroups.php
│   │   ├── MembersAssignmentDescribeGroups.php
│   │   ├── MembersDescribeGroups.php
│   │   ├── MembersMetadataDescribeGroups.php
│   │   └── PartitionsAssignmentDescribeGroups.php
│   ├── DescribeGroupsResponse.php
│   ├── Fetch
│   │   ├── MessageFetch.php
│   │   ├── MessageSetFetch.php
│   │   ├── PartitionHeaderFetch.php
│   │   ├── PartitionResponsesFetch.php
│   │   └── ResponsesFetch.php
│   ├── FetchResponse.php
│   ├── FindCoordinatorResponse.php
│   ├── HeartbeatResponse.php
│   ├── JoinGroup
│   │   ├── MembersJoinGroup.php
│   │   ├── ProtocolMetadataJoinGroup.php
│   │   └── TopicJoinGroup.php
│   ├── JoinGroupResponse.php
│   ├── LeaveGroupResponse.php
│   ├── ListOffsets
│   │   ├── PartitionsResponsesListOffsets.php
│   │   └── ResponsesListOffsets.php
│   ├── ListOffsetsResponse.php
│   ├── Metadata
│   │   ├── BrokerMetadata.php
│   │   ├── PartitionMetadata.php
│   │   └── TopicMetadata.php
│   ├── MetadataResponse.php
│   ├── OffsetCommit
│   │   ├── PartitionsOffsetCommit.php
│   │   └── TopicOffsetCommit.php
│   ├── OffsetCommitResponse.php
│   ├── OffsetFetch
│   │   ├── PartitionsResponsesOffsetFetch.php
│   │   └── ResponsesOffsetFetch.php
│   ├── OffsetFetchResponse.php
│   ├── Produce
│   │   ├── PartitionResponsesProduce.php
│   │   └── ResponsesProduce.php
│   ├── ProduceResponse.php
│   ├── SyncGroup
│   │   ├── MemberAssignmentsSyncGroup.php
│   │   └── PartitionAssignmentsSyncGroup.php
│   └── SyncGroupResponse.php
├── TraitStructure
│   ├── ToArrayTrait.php
│   └── ValueTrait.php
└── Type
    ├── AbstractType.php
    ├── Arrays32.php
    ├── Bytes32.php
    ├── Int16.php
    ├── Int32.php
    ├── Int64.php
    ├── Int8.php
    └── String16.php
```

我们先说明一下以此目录为根目录到情况下，一级文件（非目录）的作用：

- AbstractRequestOrResponse.php (这个是无论是 request 还是 response 都必须有都字段：字节长度)
- AbstractRequest.php (继承 AbstractRequestOrResponse，包含了请求协议头，封包核心逻辑)
- AbstractResponse.php （继承 AbstractRequestOrResponse，包含了响应协议头，解包核心逻辑）
- CommonRequest.php （继承 AbstractRequest，用于辅助封装协议中特殊的字段处理方式）
- CommonResponse.php（继承 AbstractResponse，用于辅助解开协议中特殊的字段处理方式）

### Type

在这个目录中，全部都是数据类型，我们整个协议的所有字段的定义都来自于此目录的数据类型，目前用到的数据类型有

- Arrays32 (数组类型，占 32bits，PHP 中的标记为：N)
- Bytes32 (字节类型，占 32bits，PHP 中的标记为：N)
- String16 (字符串类型，占 16bits，PHP 中的标记为：n)
- Int8 (整型类型，占 8bits，PHP 中的标记为：C)
- Int16 (整型类型，占 16bits，PHP 中的标记为：n)
- Int32 (整型类型，占 32bits，PHP 中的标记为：N)
- Int64 (整型类型，占 64bits，PHP 中的标记为：N2)

### Request

在这个目录中，全部都是请求协议体的内容，以此为根目录下的一级文件（非目录），都是对应的每一个 API 协议，它们全部都继承`AbstractRequest`类，并且属性必须为`private`修饰符，更重要的是，不要忘记了写上关键信息，就是这个`属性的数据类型的注解(@var Xxx $ooo)`，这将会我们封包关键所在，这个数据类型，都来自于`Type目录`。而根目录下的二级目录则是对应的协议结构中的子结构，规则和之前描述的大体一致，需要注意的是，这个时候子结构并没有继承了任何父类。

其中每个类中可能存在`onXxx`的方法，这个时候`AbstractRequest`并不会正常的解析这个类中的字段，而是去执行每个类中特定的回调方法，进行定制封包。

### Response

在这个目录中，全部都是请求协议体的内容，以此为根目录下的一级文件（非目录），都是对应的每一个 API 协议，它们全部都继承`AbstractResponse`类，并且属性必须为`private`修饰符，更重要的是，不要忘记了写上关键信息，就是这个`属性的数据类型的注解(@var Xxx $ooo)`，这将会我们封包关键所在，这个数据类型，都来自于`Type目录`。而根目录下的二级目录则是对应的协议结构中的子结构，规则和之前描述的大体一致，需要注意的是，这个时候子结构并没有继承了任何父类。

其中每个类中可能存在`onXxx`的方法，这个时候`AbstractRespose`并不会正常的解析这个类中的字段，先执行回调方法，进行定制解包。通过返回 true 或者返回 false 来判断是否需要继续正常解析这个字段，如果返回 true 则是跳过这个字段不再解析，说明了这个字段在`onXxx`中可以解析完毕了。否则将继续解析这个字段。

### TraitStructure

在这个目录中，都是一些复用体（trait），目前来说用上的只有`ToArrayTrait`，这个结构体主要的职责是把对象返回成数组结构。

## 压缩方式详解

经过我对上文中提到对 2 个最多 star 的仓库的考察，发现这 2 个仓库要么是压缩方式不支持，要么就是协议方式封装错误。

所以，在这里可以很对压缩方式做一些说明。

正常情况下，我们的数据是可以不压缩的，但是，当我们的生产者在决定用压缩数据的方式来传输数据的时候，就代表你这的消费端就必须支持对应的解压方式。

在压缩的情况下，我们的数据量可以被压缩存储在 kafka 中，不但可以节约服务器的磁盘空间，而且还减少了带宽的占用，提高了传输速率。所以在生产者和消费者的机器 CPU 有条件的情况下，最好还是对数据进行压缩传输。

由于我们目前只对 VERSION=0 的协议进行封装，所以用此来说明。

```
MessageSet (Version: 0) => [offset message_size message]
    offset => INT64
    message_size => INT32
    message => crc magic_byte attributes key value
        crc => INT32
        magic_byte => INT8
        attributes => INT8
            bit 0~2:
                0: no compression
                1: gzip
                2: snappy
            bit 3~7: unused
        key => BYTES
        value => BYTES
```

我们看到这个协议说明中，message 结构体中包含了以下几个关键内容：

- crc
- magic_byte
- attributes
  - 第[0-2]bit 代表着压缩方式
  - 第[3-7]bit 留空
- key
- value

所以我们在解协议的时候，从 attributes 的第[0-2]个 bit 中可以知道 value 的数据是否需要进行压缩或者解压。

在代码层面中就是：

压缩：

```php
    /**
     * @param $protocol
     *
     * @throws \Kafka\Exception\ProtocolTypeException
     * @throws \ReflectionException
     */
    public function onMessageSetSize(&$protocol)
    {
        if (($this->getMessage()->getAttributes()->getValue() & 0x07) !== CompressionCodecEnum::NORMAL) {
            $wrapperMessage = clone $this->getMessage();
            $this->getMessage()->setAttributes(Int8::value(CompressionCodecEnum::NORMAL))
                 ->setValue($this->getMessage()
                                 ->getValue());
            $commentRequest = new CommonRequest();
            $data = $commentRequest->packProtocol(MessageProduce::class, $this->getMessage());
            $data = pack(Int32::getWrapperProtocol(), strlen($data)) . $data;

            $left = 0xffffffff00000000;
            $right = 0x00000000ffffffff;
            $l = (-1 & $left) >> 32;
            $r = -1 & $right;
            $data = pack(Int64::getWrapperProtocol(), $l, $r) . $data;

            if (($wrapperMessage->getAttributes()->getValue() & 0x07) === CompressionCodecEnum::SNAPPY) {
                $compressValue = snappy_compress($data);
            } elseif (($wrapperMessage->getAttributes()->getValue() & 0x07) === CompressionCodecEnum::GZIP) {
                $compressValue = gzencode($data);
            } else {
                throw new RuntimeException('not support lz4');
            }
            $wrapperMessage->setKey(Bytes32::value(''))->setValue(Bytes32::value($compressValue));
            $this->setMessage($wrapperMessage);
        }

        $commentRequest = new CommonRequest();
        $data = $commentRequest->packProtocol(MessageProduce::class, $this->getMessage());
        $this->setMessageSetSize(Int32::value(strlen($data)));
        $protocol .= pack(Int32::getWrapperProtocol(), $this->getMessageSetSize()->getValue());
    }
```

解压：

```php
    /**
     * @param $protocol
     *
     * @return bool
     * @throws \Kafka\Exception\ProtocolTypeException
     * @throws \ReflectionException
     */
    public function onRecordSet(&$protocol)
    {
        $recordSet = [];
        while (is_string($protocol) && strlen($protocol) > 0) {
            $commonResponse = new CommonResponse();
            $instance = new MessageSetFetch();
            $commonResponse->unpackProtocol(MessageSetFetch::class, $instance, $protocol);

            // Insufficient reading sub-section, the message is put on the next read
            if ($instance->getMessage()->getCrc()->getValue() === null) {
                continue;
            }
            // Internal decompression
            if ($instance->getMessage()->getAttributes()->getValue() !== CompressionCodecEnum::NORMAL) {
                $buffer = $instance->getMessage()->getValue()->getValue();
                $commonResponse->unpackProtocol(MessageSetFetch::class, $instance, $buffer);
            }
            $recordSet[] = $instance;
        }
        $this->setRecordSet($recordSet);

        return true;
    }


    /**
     * @param $protocol
     *
     * @return bool
     */
    public function onValue(&$protocol)
    {
        if (($this->getAttributes()->getValue() & 0x07) === CompressionCodecEnum::SNAPPY) {
            /* snappy-java adds its own header (SnappyCodec)
               which is not compatible with the official Snappy
               implementation.
               8: magic, 4: version, 4: compatible
               followed by any number of chunks:
                 4: length
                 ...: snappy-compressed data.
             */
            $protocol = substr($protocol, 20);
            $ret = [];
            SnappyDecompression:
            if (!is_string($protocol) || (is_string($protocol) && strlen($protocol) <= 0)) {
                $ret = implode('', $ret);
            } else {
                $buffer = substr($protocol, 0, ProtocolTypeEnum::B32);
                $protocol = substr($protocol, ProtocolTypeEnum::B32);
                $len = unpack(ProtocolTypeEnum::getTextByCode(ProtocolTypeEnum::B32), $buffer);
                $len = is_array($len) ? array_shift($len) : $len;

                $data = substr($protocol, 0, $len);
                $protocol = substr($protocol, $len);
                $ret[] = snappy_uncompress($data);
                goto SnappyDecompression;
            }
            $this->setValue(Bytes32::value($ret));

            return true;
        } else if (($this->getAttributes()->getValue() & 0x07) === CompressionCodecEnum::GZIP) {
            $buffer = substr($protocol, 0, ProtocolTypeEnum::B32);
            $protocol = substr($protocol, ProtocolTypeEnum::B32);
            $len = unpack(ProtocolTypeEnum::getTextByCode(ProtocolTypeEnum::B32), $buffer);
            $len = is_array($len) ? array_shift($len) : $len;

            $data = substr($protocol, 0, $len);
            $protocol = substr($protocol, $len);

            $this->setValue(Bytes32::value(gzdecode($data)));

            return true;
        }

        // Normal
        return false;
    }
```

在压缩的时候，我们需要注意的是，在对数据进行压缩处理的时候，`attributes`属性必须设置为 0，这是和解压逻辑相对应的。只要在压缩完毕之后，二次封装的时候，attributes 在第二次赋值的时候才会设置成真正的值。

所以这里，我们通过`$this->getAttributes()->getValue() & 0x07`的方式，来判断当前数据是否需要解压。需要注意的是，当采用 snappy/zip 的压缩方式的时候,数据压缩了，细节被屏蔽了起来，消息更加的安全了，我们在第一次对`messageSet`解压后得出来后来，value 其实仍然并没有被解压，这个时候，我们需要判断`attributes`的值，如果经过第一次解压，`attributes`不为 0 的情况下，那么它需要再进行一次解压，这一次，数据将重新覆盖整个`messageSet`结构体，并且`arttibutes`将会被设置为 0，以此来告诉客户端，协议已经正确解析完毕。

还有一点需要注意的是 kafka 并不仅仅只是单单用了 snappy 压缩方式，它还加入了它自己的协议头（这个真的是个巨坑），所以你需要忽略前面的 20 个字节。后续以被 4 个字节的解析出来的字符长度来递归解压。相对于 snappy 的压缩方式，gzip 的压缩方式就是中规中矩了。

## 如何利用 docker 环境尝试加入开发

项目中，已经把开发用的`docker-composer.yaml`已经写好了，只需要采用`docker-composer up`即可。其他的都是常规操作。

```docker-composer.yaml

version: "3"

services:
  mzookeeper:
    image: wurstmeister/zookeeper
    container_name: kafka-swoole-zookeeper

  mkafka1:
    image: wurstmeister/kafka:2.11-0.9.0.1
    container_name: kafka-swoole-kafka1
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://:9092
      KAFKA_LISTENERS: PLAINTEXT://:9092
      KAFKA_ZOOKEEPER_CONNECT: mzookeeper:2181
      KAFKA_NUM_PARTITIONS: 4
    depends_on:
    - mzookeeper

  mkafka2:
    image: wurstmeister/kafka:2.11-0.9.0.1
    container_name: kafka-swoole-kafka2
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://:9092
      KAFKA_LISTENERS: PLAINTEXT://:9092
      KAFKA_ZOOKEEPER_CONNECT: mzookeeper:2181
      KAFKA_NUM_PARTITIONS: 4
    depends_on:
    - mzookeeper

  mkafka3:
    image: wurstmeister/kafka:2.11-0.9.0.1
    container_name: kafka-swoole-kafka3
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://:9092
      KAFKA_LISTENERS: PLAINTEXT://:9092
      KAFKA_ZOOKEEPER_CONNECT: mzookeeper:2181
      KAFKA_NUM_PARTITIONS: 4
    depends_on:
    - mzookeeper

  mkafka4:
    image: wurstmeister/kafka:2.11-0.9.0.1
    container_name: kafka-swoole-kafka3
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://:9092
      KAFKA_LISTENERS: PLAINTEXT://:9092
      KAFKA_ZOOKEEPER_CONNECT: mzookeeper:2181
      KAFKA_NUM_PARTITIONS: 4
    depends_on:
    - mzookeeper

  kafka-swoole:
    build: ./
    container_name: kafka-swoole-php
    volumes:
      - ./:/data/www
    depends_on:
    - mzookeeper
    - mkafka1
    - mkafka2
    - mkafka3
    - mkafka4

```
