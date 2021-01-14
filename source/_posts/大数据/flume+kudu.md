---
title: 【大数据】- flume + kudu 操作指南
date: 2021-01-05 09:56:40
categories: [大数据]
tags: [大数据, flume, kudu]
---

## 前言

由于我们要尝试使用kudu，架构是由flume->kudu

<!-- more -->

[kudu-flume-sink(v1.9)] (https://github.com/apache/kudu/blob/1.9.0/java/kudu-flume-sink/src/main/java/org/apache/kudu/flume/sink/KuduSink.java)

1.9 Configuration of KuDu Sink:  
---------------------------
| Property Name | Default | Required |Description |
| ----------------------- | :-----: | :-----: | :---------- |
| channel | - | Yes | 要绑定读取的channel |
| type | - |  Yes | 组件名，必须填写`org.apache.kudu.flume.sink.KuduSink` |
| masterAddresses | - | Yes | 逗号分隔kudu master地址，例子: `host1:port1,host2:port2`,其中端口是选填 |
| tableName | - |  Yes |要写入的kudu表名 |
| batchSize | 1000 |  No | sink每批次处理最大数 |
| ignoreDuplicateRows | true |  No | 是否忽略插入导致的重复主键错误。 |
| timeoutMillis | 10000 | No | Kudu写操作的超时时间，单位为毫秒 |
| producer | SimpleKuduOperationsProducer | No | 接收器应该使用实现了的`KuduOperationsProducer` 接口的的完全限定类名。 |
| producer.* | - | (Varies by operations producer) |要传递给操作生产者实现的配置属性。 |

> 由于这种方式必须一个sink对应一个table，不符合我们的使用场景，我们该用了其他方案。文章待定。
