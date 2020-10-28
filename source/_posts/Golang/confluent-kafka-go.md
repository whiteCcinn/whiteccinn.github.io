---
title: 【Golang】- confluent-kafka-go
date: 2020-06-01 09:46:51
categories: [Golang]
tags: [Golang, Kafka]
---

## 前言

由于我们部门的一些大数据服务是用到 kafka 的，这个时期正值我们对 golang 语言对一个转型阶段，对比了一下开源对 kafka 客户端，决定使用 `confluent-kafka-go`, 所以在这里记录一下`confluent-kafka-go` 的一些内容

<!-- more -->

## 说明

`confluent-kafka-go` 是一个 confluent 官方的 golang 语言库，其依赖于 `librdkafka` 实现，大多数机器，librakafka 都已经预编译进去 golang 扩展了，不需要额外安装 librdkafka，如果不支持预编译的话，则需要额外安装。

提供一个 dockerfile 的 demo

```Dockerfile
# debian10 : buster
# debian9 : buster
# debian8 : jessie
# debian7 : wheezy
FROM golang:1.14.3-buster

ENV GO111MODULE=on
ENV GOPROXY=https://goproxy.io,direct
ENV GOPRIVATE=git.mingchao.com

# 1. 换源
# 2. 加入confluent的源，安装librakafka
RUN echo \
        deb http://mirrors.aliyun.com/debian/ buster main non-free contrib \
        deb-src http://mirrors.aliyun.com/debian/ buster main non-free contrib \
        deb http://mirrors.aliyun.com/debian-security buster/updates main \
        deb-src http://mirrors.aliyun.com/debian-security buster/updates main \
        deb http://mirrors.aliyun.com/debian/ buster-updates main non-free contrib \
        deb-src http://mirrors.aliyun.com/debian/ buster-updates main non-free contrib \
        deb http://mirrors.aliyun.com/debian/ buster-backports main non-free contrib \
        deb-src http://mirrors.aliyun.com/debian/ buster-backports main non-free contrib \
    > /etc/apt/sources.list && \
    apt-get update -y && \
    wget -qO - https://packages.confluent.io/deb/5.5/archive.key |  apt-key add - > /dev/null && \
    sed -i '$a deb [arch=amd64] https://packages.confluent.io/deb/5.5 stable main' /etc/apt/sources.list && \
    apt-get install -y librdkafka-dev

ARG GIT_USERNAME=git
ARG GIT_PASSWORD=git-password
ARG GIT_CREDEN_FILE=/.git-credentials

RUN touch ${GIT_CREDEN_FILE} && \
    chown 600 ${GIT_CREDEN_FILE} && \
    git config --global credential.helper 'store --file '${GIT_CREDEN_FILE} && \
    echo https://${GIT_USERNAME}:${GIT_PASSWORD}@git.mingchao.com | tee ${GIT_CREDEN_FILE}
```

## 源码 Api 说明

### consumer.go

- 这是一个 consumer 相关的文件。

#### Subscribe(topic string, rebalanceCb RebalanceCb) error

订阅一个 topic，这个 api 会覆盖之前设置过了的 topic 订阅

```golang
func (c *Consumer) Subscribe(topic string, rebalanceCb RebalanceCb) error {
	return c.SubscribeTopics([]string{topic}, rebalanceCb)
}
```

#### SubscribeTopics(topics []string, rebalanceCb RebalanceCb) (err error)

- 订阅多个 topic
- 这个 api 会覆盖之前设置过了的 topic 订阅

```golang
func (c *Consumer) SubscribeTopics(topics []string, rebalanceCb RebalanceCb) (err error) {
	ctopics := C.rd_kafka_topic_partition_list_new(C.int(len(topics)))
	defer C.rd_kafka_topic_partition_list_destroy(ctopics)

	for _, topic := range topics {
		ctopic := C.CString(topic)
		defer C.free(unsafe.Pointer(ctopic))
		C.rd_kafka_topic_partition_list_add(ctopics, ctopic, C.RD_KAFKA_PARTITION_UA)
	}

	e := C.rd_kafka_subscribe(c.handle.rk, ctopics)
	if e != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return newError(e)
	}

	c.rebalanceCb = rebalanceCb
	c.handle.currAppRebalanceEnable = c.rebalanceCb != nil || c.appRebalanceEnable

	return nil
}
```

#### Unsubscribe() (err error)

- 取消当前对 topic 的订阅

```golang
func (c *Consumer) Unsubscribe() (err error) {
	C.rd_kafka_unsubscribe(c.handle.rk)
	return nil
}
```

#### Assign(partitions []TopicPartition) (err error)

- 分配一组要使用的 partition
- 这个 api 会覆盖之前分配过的

```golang
func (c *Consumer) Assign(partitions []TopicPartition) (err error) {
	c.appReassigned = true

	cparts := newCPartsFromTopicPartitions(partitions)
	defer C.rd_kafka_topic_partition_list_destroy(cparts)

	e := C.rd_kafka_assign(c.handle.rk, cparts)
	if e != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return newError(e)
	}

	return nil
}
```

#### Unassign() (err error)

- 取消当前分配的 partition

```golang
func (c *Consumer) Unassign() (err error) {
	c.appReassigned = true

	e := C.rd_kafka_assign(c.handle.rk, nil)
	if e != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return newError(e)
	}

	return nil
}
```

#### Commit() ([]TopicPartition, error)

- 提交当前已经分配的 partition 的 offset 值
- 基于 `StoreOffsets(offsets []TopicPartition) (storedOffsets []TopicPartition, err error)`
- 这是一个阻塞请求，如果需要异步操作，需要调用者自行用协程
- 返回成功提交 offset 的 topicPartition

```golang
func (c *Consumer) Commit() ([]TopicPartition, error) {
	return c.commit(nil)
}
```

#### CommitMessage(m \*Message) ([]TopicPartition, error)

- 这个 API 基于 message 结构体
- 这是一个阻塞请求，如果需要异步操作，需要调用者自行用协程
- 返回成功提交 offset 的 topicPartition

```golang
func (c *Consumer) CommitMessage(m *Message) ([]TopicPartition, error) {
	if m.TopicPartition.Error != nil {
		return nil, newErrorFromString(ErrInvalidArg, "Can't commit errored message")
	}
	offsets := []TopicPartition{m.TopicPartition}
	offsets[0].Offset++
	return c.commit(offsets)
}
```

#### CommitOffsets(offsets []TopicPartition) ([]TopicPartition, error)

- 根据 []TopicPartition 来提交 offset
- 这是一个阻塞请求，如果需要异步操作，需要调用者自行用协程
- 返回成功提交 offset 的 topicPartition

```golang
func (c *Consumer) CommitOffsets(offsets []TopicPartition) ([]TopicPartition, error) {
	return c.commit(offsets)
}
```

#### StoreOffsets(offsets []TopicPartition) (storedOffsets []TopicPartition, err error)

- 根据 []TopicPartition 来记录将会被提交的 offset（如果允许自动提交的话，那么会受`auto.commit.interval.ms`的影响，一定周期性提交，如果是手动提交的话则依赖 `Commit()`Api）
- 返回成功存储的 offsets，如果至少有一个偏移量无法存储，则返回一个错误和偏移量列表。每个偏移量都可以通过它的来检查特定的错误

```golang
func (c *Consumer) StoreOffsets(offsets []TopicPartition) (storedOffsets []TopicPartition, err error) {
	coffsets := newCPartsFromTopicPartitions(offsets)
	defer C.rd_kafka_topic_partition_list_destroy(coffsets)

	cErr := C.rd_kafka_offsets_store(c.handle.rk, coffsets)

	// coffsets might be annotated with an error
	storedOffsets = newTopicPartitionsFromCparts(coffsets)

	if cErr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return storedOffsets, newError(cErr)
	}

	return storedOffsets, nil
}
```

#### Seek(partition TopicPartition, timeoutMs int) error

- 获取指定 partition 的 offset
- 如果`timeoutMs`不是 0，则调用将等待这么长时间以执行查找。如果超时到达，内部状态将未知，并且此函数返回 ErrTimedOut。
- 如果`timeoutMs` 为 0，它将发起查找，但立即返回，不报告任何错误(例如，异步)。
- Seek()只能用于已经使用的分区(通过 Assign()或隐式使用通过自平衡订阅())。
- 要设置起始偏移量，最好使用 Assign()并为每个分区提供一个起始偏移量。

```golang
func (c *Consumer) Seek(partition TopicPartition, timeoutMs int) error {
	rkt := c.handle.getRkt(*partition.Topic)
	cErr := C.rd_kafka_seek(rkt,
		C.int32_t(partition.Partition),
		C.int64_t(partition.Offset),
		C.int(timeoutMs))
	if cErr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return newError(cErr)
	}
	return nil
}
```

#### Poll(timeoutMs int) (event Event)

- 轮询消息或事件。
- 将阻塞最多 `timeoutMs` 的超时时间
- 以下回调可能会被触发
  - Subscribe()'s rebalanceCb
- 如果超时则返回 nil，否则返回一个事件

```golang
func (c *Consumer) Poll(timeoutMs int) (event Event) {
	ev, _ := c.handle.eventPoll(nil, timeoutMs, 1, nil)
	return ev
}
```

#### ReadMessage(timeout time.Duration) (\*Message, error)

- 返回一条消息
- 这是一个方便的 API，它封装了 Poll()，只返回消息或错误。所有其他事件类型都被丢弃。
- 该调用最多会阻塞 `timeout` 等待新消息或错误。`timeout`可以设置为-1，表示无限期等待。
- 超时将会返回`(nil, err)` 当 err 是 `kafka.(Error).Code == Kafka.ErrTimedOut`
- 消息将会返回 `(msg, nil)`, 当有错误当时候将会返回 `(nil, err)`, 当指定 partition 错误的时候（topic，partition，offset），将会返回 `(msg,err)`
- 全部其他的事件类型，像`PartitionEOF`,`AssingedPartitions`等等将会被默认丢弃

```golang
func (c *Consumer) ReadMessage(timeout time.Duration) (*Message, error) {

	var absTimeout time.Time
	var timeoutMs int

	if timeout > 0 {
		absTimeout = time.Now().Add(timeout)
		timeoutMs = (int)(timeout.Seconds() * 1000.0)
	} else {
		timeoutMs = (int)(timeout)
	}

	for {
		ev := c.Poll(timeoutMs)

		switch e := ev.(type) {
		case *Message:
			if e.TopicPartition.Error != nil {
				return e, e.TopicPartition.Error
			}
			return e, nil
		case Error:
			return nil, e
		default:
			// Ignore other event types
		}

		if timeout > 0 {
			// Calculate remaining time
			timeoutMs = int(math.Max(0.0, absTimeout.Sub(time.Now()).Seconds()*1000.0))
		}

		if timeoutMs == 0 && ev == nil {
			return nil, newError(C.RD_KAFKA_RESP_ERR__TIMED_OUT)
		}

	}

}
```

#### Close() (err error)

- 关闭一个 Consumer 对象
- 调用后，对象不再可用。

```golang
func (c *Consumer) Close() (err error) {

	// Wait for consumerReader() or pollLogEvents to terminate (by closing readerTermChan)
	close(c.readerTermChan)
	c.handle.waitGroup.Wait()
	if c.eventsChanEnable {
		close(c.events)
	}

	C.rd_kafka_queue_destroy(c.handle.rkq)
	c.handle.rkq = nil

	e := C.rd_kafka_consumer_close(c.handle.rk)
	if e != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return newError(e)
	}

	c.handle.cleanup()

	C.rd_kafka_destroy(c.handle.rk)

	return nil
}
```

#### GetMetadata(topic *string, allTopics bool, timeoutMs int) (*Metadata, error)

- 用于查询集群中 broker 和 topic 的元数据
- 如果 `topic` 参数不为 nil，则返回和 topoic 相关数据，否则（如果`allTopics`参数为 false，那么将会返回当前使用 topic 的元数据，如果 `allTopics`参数为 true, 那么将返回 broker 中所有 topic 的元数据）
- GetMetadata 相当于 Java API 中的 listTopics、describeTopics 和 describeCluster。

```golang
func (c *Consumer) GetMetadata(topic *string, allTopics bool, timeoutMs int) (*Metadata, error) {
	return getMetadata(c, topic, allTopics, timeoutMs)
}
```

#### QueryWatermarkOffsets(topic string, partition int32, timeoutMs int) (low, high int64, err error)

- 根据 topic 和 partition，查询当前 broker 中他们的低水位和高水位的 offset

```golang
func (c *Consumer) QueryWatermarkOffsets(topic string, partition int32, timeoutMs int) (low, high int64, err error) {
	return queryWatermarkOffsets(c, topic, partition, timeoutMs)
}
```

#### GetWatermarkOffsets(topic string, partition int32) (low, high int64, err error)

- 根据 topic 和 partition 返回当前服务存储的低水位和高水位的 offset
- 每个 fetch 响应或通过调用 `QueryWatermarkOffsets` 填充高水位的 offset
- 如果设置了 `statistics.interval.ms`, 低水位将会有一个 `statistics.interval.ms` 的周期来更新

```golang
func (c *Consumer) GetWatermarkOffsets(topic string, partition int32) (low, high int64, err error) {
	return getWatermarkOffsets(c, topic, partition)
}
```

#### OffsetsForTimes(times []TopicPartition, timeoutMs int) (offsets []TopicPartition, err error)

- 每个分区返回的偏移量是最早的偏移量，其时间戳大于或等于相应分区中的给定时间戳。如果提供的时间戳超过分区中最后一条消息的时间戳，则返回-1 值。

```golang
func (c *Consumer) OffsetsForTimes(times []TopicPartition, timeoutMs int) (offsets []TopicPartition, err error) {
	return offsetsForTimes(c, times, timeoutMs)
}
```

#### Subscription() (topics []string, err error)

- 返回当前被订阅的 topic

```golang
func (c *Consumer) Subscription() (topics []string, err error) {
	var cTopics *C.rd_kafka_topic_partition_list_t

	cErr := C.rd_kafka_subscription(c.handle.rk, &cTopics)
	if cErr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return nil, newError(cErr)
	}
	defer C.rd_kafka_topic_partition_list_destroy(cTopics)

	topicCnt := int(cTopics.cnt)
	topics = make([]string, topicCnt)
	for i := 0; i < topicCnt; i++ {
		crktpar := C._c_rdkafka_topic_partition_list_entry(cTopics,
			C.int(i))
		topics[i] = C.GoString(crktpar.topic)
	}

	return topics, nil
}
```

#### Assignment() (partitions []TopicPartition, err error)

- 返回当前指派的 partition

```golang
func (c *Consumer) Assignment() (partitions []TopicPartition, err error) {
	var cParts *C.rd_kafka_topic_partition_list_t

	cErr := C.rd_kafka_assignment(c.handle.rk, &cParts)
	if cErr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return nil, newError(cErr)
	}
	defer C.rd_kafka_topic_partition_list_destroy(cParts)

	partitions = newTopicPartitionsFromCparts(cParts)

	return partitions, nil
}
```

#### Committed(partitions []TopicPartition, timeoutMs int) (offsets []TopicPartition, err error)

- 查询已经提交 commit 的 offset

```golang
func (c *Consumer) Committed(partitions []TopicPartition, timeoutMs int) (offsets []TopicPartition, err error) {
	cparts := newCPartsFromTopicPartitions(partitions)
	defer C.rd_kafka_topic_partition_list_destroy(cparts)
	cerr := C.rd_kafka_committed(c.handle.rk, cparts, C.int(timeoutMs))
	if cerr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return nil, newError(cerr)
	}

	return newTopicPartitionsFromCparts(cparts), nil
}
```

#### Position(partitions []TopicPartition) (offsets []TopicPartition, err error)

- 根据 partition 返回其 offset
- 典型的用法是调用 assign()来获取分区列表，然后将其传递给 Position()来获取每个分区的当前 offset
- 消费的位置是分区读取的下一个消息，例如（最后一条信息的+1）

```golang
func (c *Consumer) Position(partitions []TopicPartition) (offsets []TopicPartition, err error) {
	cparts := newCPartsFromTopicPartitions(partitions)
	defer C.rd_kafka_topic_partition_list_destroy(cparts)
	cerr := C.rd_kafka_position(c.handle.rk, cparts)
	if cerr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return nil, newError(cerr)
	}

	return newTopicPartitionsFromCparts(cparts), nil
}
```

#### Pause(partitions []TopicPartition) (err error)

- 根据提供的 partition 暂停消费
- 如果设置了`go.events.channel.enable`，只会受到`go.events.channel.size`的影响，这个 API 将不会生效

```golang
func (c *Consumer) Pause(partitions []TopicPartition) (err error) {
	cparts := newCPartsFromTopicPartitions(partitions)
	defer C.rd_kafka_topic_partition_list_destroy(cparts)
	cerr := C.rd_kafka_pause_partitions(c.handle.rk, cparts)
	if cerr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return newError(cerr)
	}
	return nil
}
```

#### Resume(partitions []TopicPartition) (err error)

- 唤醒被暂停的 partition

```golang
func (c *Consumer) Resume(partitions []TopicPartition) (err error) {
	cparts := newCPartsFromTopicPartitions(partitions)
	defer C.rd_kafka_topic_partition_list_destroy(cparts)
	cerr := C.rd_kafka_resume_partitions(c.handle.rk, cparts)
	if cerr != C.RD_KAFKA_RESP_ERR_NO_ERROR {
		return newError(cerr)
	}
	return nil
}
```

#### GetConsumerGroupMetadata() (\*ConsumerGroupMetadata, error)

- 返回当前消费者组的元数据
- 这个返回的对象，应该传递给事务生产者的 SendOffsetsToTransaction() API

```golang
func (c *Consumer) GetConsumerGroupMetadata() (*ConsumerGroupMetadata, error) {
	cgmd := C.rd_kafka_consumer_group_metadata(c.handle.rk)
	if cgmd == nil {
		return nil, NewError(ErrState, "Consumer group metadata not available", false)
	}
	defer C.rd_kafka_consumer_group_metadata_destroy(cgmd)

	serialized, err := serializeConsumerGroupMetadata(cgmd)
	if err != nil {
		return nil, err
	}

	return &ConsumerGroupMetadata{serialized}, nil
}
```
