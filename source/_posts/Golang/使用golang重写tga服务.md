---
title: 【Golang】- 使用golang重写tga服务
date: 2020-12-17 09:46:51
categories: [Golang]
tags: [Golang]
---

## 前言

早期，在我们的部门中后端的技术栈语言主要有三种语言，分别是`php/python/erlang`，其中用于做服务的是 `php/erlang`。

在我们的体系中，日志采集服务体系目前都是用erlang写的，而php写的服务多是基于swoole写的一些基础服务。

在tga服务中，我们需要从`kafka` -> `服务` -> `本地文件`的模式。

业务据流图如下：

```

+---------------------------------------------------------------+
|                                                               |
|                                                               |
|       +---------------------------------------------+         |
|       |                                             |         |
|       |                                             |         |
|       |                  kafka服务                   |         |
|       |                                             |         |
|       |                                             |         |
|       |                                             |         |
|       +----------------------+----------------------+         |
|                              |                                |
|                              |                                |
|       +----------------------v-----------------------+        |                     +----------------------------+
|       |                                              |        |                     |                            |
|       |                                              |        |                     |                            |
|       |                                              |        |                     |                            |
|       |               mthinkingdata服务               |        <---------------------+          logbus服务        |
|       |                                              |        |                     |                            |
|       |                                              |        |                     |                            |
|       |                                              |        |                     |                            |
|       +----------------------+-----------------------+        |                     +----------------------------+
|                              |                                |
|                              |                                |
|       +----------------------v------------------------+       |
|       |                                               |       |
|       |                                               |       |
|       |                                               |       |
|       |                   本地文件                     +-------+
|       |                                               |       |
|       |                                               |       |
|       |                                               |       |
|       +-----------------------------------------------+       |
|                                                               |
+---------------------------------------------------------------+

```


于是我们试探性的自研基于swoole的kafka客户端，我们自己实现根据kafka协议的封包，解包，流程处理。(`swoole-kafka`)
`mthinkingdata服务`就是我们基于`kafka-swoole`研发的业务服务。


```
+------------+
|            |
|  message1  +------------+
|            |            |
+------------+            |
                          |
+------------+     +------+--------+
|            |     |               |
|  message2  +-----+   snappy压缩   |
|            |     |               |
+------------+     +------+--------+
                           |
+---------------+          |
|               |          |
| message[3..n] +----------+
|               |
+---------------+
```

在这个过程中，我们发现php对于cpu密集型的处理存在瓶颈，因为我们在生产者一方如果发送多条协议的情况下，会经过 `snappy` 算法的压缩再推送以便减少network-io（增加cpu-io）。
消费者在接受消息的时候也是被压缩过的数据，所以我们需要解压，在这个解压的过程中，是个十分消费cpu的过程，即使我们当时是基于swoole4.3的协程版本来处理，
不行的是的抢占式协程当时并没有很好的完成，我们没办法达到快速的接受多个数据包的行为。消费速度也并不是特别理想。
在这个大环境下，我们还需要借助redis来作为中间的存储。而redis是单线程的，我们在这个过程中，试过使用`pipeline`等手段减少tcp中的响应包的带来的性能损耗。但是由于redis只能利用单核的缘故，批量处理一批指令后，最高的cpu利用率接近100%下无法再增长。
也因此，我们的服务注定无法达到很好的性能测试。

我们得出结论，当时服务的瓶颈在于：

- 1. php语言本身的性能
- 2. swoole协程不支持抢占式调度
- 3. 未实现动态伸缩扩展worker数量（感兴趣可以去看看kafka-swoole的架构分享）
- 4. redis未能利用多核，cpu利用率达到峰值

<!-- more -->

## 方案

针对以上几个问题，我们逐一得出解决方案

- 1. 使用golang语言（语言优先在公司内部博客有比较）
- 2. 使用基于golang的嵌入式存储服务作为中间存储服务（`badger`）（`rocksdb`的使用在尝试中）

也因此催生出了使用golang重写tga服务（`mtga`）的需求。以其中一个项目开发为例子(项目编号：`24`)

```
├── README.md
├── _build                                 # 部署的目录结构
│   ├── README.md
│   ├── bin                                 
│   │   └── mtga                           # 编译后的二进制文件
│   ├── config
│   │   ├── common.env
│   │   ├── msource.yml
│   │   ├── mtga.local.yml
│   │   └── mtga.yml
│   ├── mctl                               # 操作入口脚本
│   ├── scripts
│   │   └── init.sh                        # 第一次部署项目需要执行的初始化脚本
│   ├── settings
│   │   ├── mthinkingdata:filter.24.json
│   │   └── mthinkingdata:metadata.24.json
│   └── tmp
├── _local_build                           # 本地开发部署的目录结构
│   ├── README.md
│   ├── bin
│   │   └── mtga
│   ├── config
│   │   ├── common.env
│   │   ├── msource.yml
│   │   ├── mtga.local.yml
│   │   └── mtga.yml
│   ├── mctl
│   ├── scripts
│   │   └── init.sh
│   ├── settings
│   │   ├── mthinkingdata:filter.24.json
│   │   └── mthinkingdata:metadata.24.json
│   └── tmp
├── build
│   ├── Dockerfile
│   ├── Jenkinsfile
│   └── README.md
└── src
    ├── Makefile                         # 便于构建服务
    ├── app                              # 业务代码
    │   ├── bussiness.go                 # 消费者的业务核心代码
    │   ├── config
    │   │   ├── app.go
    │   │   ├── redis_keys.go
    │   │   ├── setting_tools.go
    │   │   └── settings.go
    │   ├── main.go
    │   └── reporter
    │       └── notify.go
    ├── cmd                              # cli终端命令
    │   ├── clear_failure_queue.go       # 清理失败队列
    │   ├── failure_queue_count.go       # 失败队列数量
    │   ├── kafka_lag.go                 # 当前消费者阻塞总数据量
    │   ├── offset_checker.go            # topic中各个partition的当前offset以及阻塞情况
    │   ├── restart.go                   # 重启服务
    │   ├── root.go
    │   ├── start.go                     # 启动服务
    │   ├── start_not_daemon.go          # 以非守护进程的方式启动服务
    │   └── stop.go                      # 暂停服务
    ├── config                           # 配置目录
    │   ├── msource.yml
    │   ├── mtga.local.yml
    │   └── mtga.yml
    ├── go.mod
    ├── go.sum
    ├── main.go
    ├── settings
    │   ├── mthinkingdata:filter.24.json
    │   └── mthinkingdata:metadata.24.json
    └── test
        ├── setting_test.go
        └── setting_tools_test.go
```

> 早期我们还没抛弃redis的时候，持续占用cpu100%的话就会出现这个。 如果不用pipe模式的话，tps测试只有2500-3500之间。
> 抛弃redis使用了badger之后， 结合业务逻辑，tps:1w/s左右

其中用到内部的组件包含如下：

- commentjson
- go-graceful-daemon
- logbdev
- metl-sdk
- msink
- msource

## mtga && msource


```json
// 转换前
{
    "headers":{
        "app_id":24,
        "log_name":"log_item"
    },
    "logs":{
        "account_name":"4866014107",
        "action":2146,
        "agent_id":36,
        "amount":1,
        "bag_amount":0,
        "bag_type":0,
        "bind_type":1,
        "client_version":"",
        "device_id":"",
        "end_time":0,
        "idfa":"",
        "imei":"",
        "is_internal":0,
        "item_id":31103003,
        "mac":"",
        "mtime":1608184243,
        "pid":1608184244000008,
        "platform":3100,
        "quality":0,
        "regrow":14,
        "role_id":6001310009300,
        "role_level":800,
        "server_id":5001,
        "server_version":"",
        "sn":"205914E03BF640CB76",
        "star":0,
        "start_time":1608184243,
        "upf":3100,
        "via":"36|3100",
        "zero_dateline":1608134400
    }
}

// 转换后
{
    "#account_id":"10289100005300x",
    "#distinct_id":"",
    "#event_name":"t_log_item",
    "#ip":"",
    "#time":"2020-12-17 13:52:39",
    "#type":"track",
    "properties":{
        "account_name":"1608153237001005108",
        "action":1005,
        "agent_id":11,
        "amount":-1,
        "bag_amount":1,
        "bag_type":0,
        "bind_type":1,
        "client_version":"",
        "device_id":"",
        "end_time":0,
        "idfa":"",
        "imei":"",
        "is_internal":0,
        "item_id":10203101,
        "mac":"",
        "mtime":1608184359,
        "pid":1608184359000031,
        "platform":101,
        "quality":0,
        "regrow":1,
        "role_id":110289100005300,
        "role_level":160,
        "server_id":289,
        "server_version":"",
        "sn":"",
        "star":0,
        "start_time":1608184359,
        "upf":101,
        "via":"11|101",
        "zero_dateline":1608134400
    }
}

```

数据在`msource`到`mtga`的交互


改版前：

```

                       +-----------------------------------------+
                       | +---------+                             |
                       | | msource |                             |
                       | +---------+                             |
                       |                                         |
                       |    +--------------------------------+   |
                       |    |                                |   |
                       |    |       spoutKafka(channel)      |   |
                       |    |                                +->X+-------------------------+
                       |    |                                |   |                         |
                       |    +-------------^----------^-------+   |           +-------------v----------------+
                       |                  |          |           |           |-----------+                  |
                       |                  |          |           |           || 业务服务 |                   |
                       |                  |          |           |           +-----------+                  |
+------------+         |                  |          |           |           |                              |
|            |         |    +--------------------------------+   |           |      XXXXXXXXXXXXXXX         |
|   kafka    +--------->X+  | +-------+   |          |       |   |           |      X1.过滤的数据 X          |
|            |         | |  | | badge |   |          |       |   |           |      XXXXXXXXXXXXXXX         |
+------------+         | |  | +-------+   |          |       |   |           |                              |
                       | |  |             |          |       |   |           |                              |
                       | |  |      +------+-------+  |       |   |           |      +---------------+       |
                       | ^--------->              |  |       | ^--------------------+2.失败的数据     |       |
                       |    |      |  等待ack队列   <-----^   | | |           |      +---------------+       |
                       |    |      |              |  |  |    | | |           |                              |
                       |    |      +--------------+  |  |    | | |           |                              |
                       |    |                        |  |    | | |           |                              |
                       |    |      +--------------+  |  |    | | |           |     +------------------+     |
                       |    |      |              +--^  <--------------------------+3.正常处理完的数据   |     |
                       |    |      |  业务失败队列  |          | | |           |     +------------------+     |
                       |    |      |              <------------v |           |                              |
                       |    |      +--------------+          |   |           +------------------------------+
                       |    +--------------------------------+   |
                       +-----------------------------------------+
```

改版后：

```

                       +-----------------------------------------+
                       | +---------+                             |           +-----------------------+
                       | | msource |                             |           |                       |
                       | +---------+                             |           |  特定条件下提交offse    <----------+
                       |                                         |           |                       |          |
                       |    +--------------------------------+   |           +-----------------------+          |
                       |    |                                |   |                                              |
                       | +-->       spoutKafka(channel)      |   |                                              |
                       | |  |        （有缓冲）                +->X+-------------------------+                    |
                       | |  |                                |   |                         |                    |
                       | |  +------------------------^-------+   |           +-------------v----------------+   |
                       | |                           |           |           |-----------+                  |   |
                       | |                           |           |           || 业务服务  |                  |   |
                       | |                           |           |           +-----------+                  |   |
+------------+         | |                           |           |           |                              |   |
|            |         | |  +--------------------------------+   |           |      XXXXXXXXXXXXXXX         |   |
|   kafka    +--------->X+  | +-------+              |       |   |           |      X1.过滤的数据   X         |   |
|            |         |    | | badge |              |       |   |           |      XXXXXXXXXXXXXXX         |   |
+------------+         |    | +-------+     ^-------->       |   |           |                              |   |
                       |    |               |                |   |           |                              |   |
                       |    |       +-------+------+         |   |           |      +---------------+       |   |
                       |    |       |              <-----------+X+------------------+2.失败的数据     |       |   |
                       |    |       |  业务失败队列  |         |   |           |      +---------------+       |   |
                       |    |       |              |         |   |           |                              |   |
                       |    |       +--------------+         |   |           |                              |   |
                       |    |                                |   |           |                              |   |
                       |    |                                |   |           |     +------------------+     |   |
                       |    +--------------------------------+   |           |     |3.正常处理完的数据   +--------->
                       |                                         |           |     +------------------+     |
                       |                                         |           |                              |
                       |                                         |           +------------------------------+
                       |                                         |
                       +-----------------------------------------+
```

- 每10s记录一次本地offset
- 接收到信号量（`SIGINT/SIGTERM`）到时候也提交一次

```golang
// 接收到信号量到时候也提交一次
go func() {
  ch := make(chan os.Signal, 1)
  signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
  for _ = range ch {
    t.Stop()
    logic.ackf.RLock()
    for _, partitionMessage := range logic.acks {
      for _,msg := range partitionMessage {
        logic.Sk.Ack(msg)
      }
    }
    logic.ackf.RUnlock()
  }
}()

// 每10s记录一次本地offset
t := time.NewTicker(10 * time.Second)
go func() {
  for {
    select {
    case <-t.C:
      logic.ackf.RLock()
      for _, partitionMessage := range logic.acks {
        for _,msg := range partitionMessage {
          logic.Sk.Ack(msg)
        }
      }
      logic.ackf.RUnlock()
    }
  }
}()
```

```Golang
// 服务worker启动核心逻辑
wg := sync.WaitGroup{}
logic := new(CoreLogic)
logic.Sk = sk
logic.acks = map[string]map[int32]*kafka.Message{}
logic.ackf = sync.RWMutex{}

for i := 0; i < config.AppConfig.Worker; {
		wg.Add(1)
		go func() {
			defer wg.Done()
			logic.Consume()
		}()
		i++
	}
wg.Wait()
```

```Golang
// bussiness.go 的核心代码
type CoreLogic struct {
	Sk *msource.SpoutKafka

	ackf sync.RWMutex
	acks map[string]map[int32]*kafka.Message
}

func (business *CoreLogic) Consume() {
  ...
  // 从正常队列来的数据
	if msg.TopicPartition.Topic != nil {
			business.ackf.Lock()
			if _, ok := business.acks[*msg.TopicPartition.Topic]; !ok {
				business.acks[*msg.TopicPartition.Topic] = map[int32]*kafka.Message{}
			}
			business.acks[*msg.TopicPartition.Topic][msg.TopicPartition.Partition] = msg
			business.ackf.Unlock()
	} else {
		// 从失败队列来的数据，独立写入，独立Ack
		err = p.Write(fileName, string(sinkBuffer))
		if err != nil {
			logbdev.Error(err)
		}
			business.Sk.Ack(msg)
	}
}
```

由于我们的消费者需要从`msource`中把消息拉出来，所以设置了一个`Corelogic`的结构体，其中包含了 `sk`,`acks`,`ackf`三个属性。

> 由于我们需要异步的提交offset，所以需要设置 ackf 的锁来确保数据的完整性

```Golang
// 读取消息的方式
for msg := range business.Sk.MessageChan() {
  ...
}
```

golang的格式化时间戳很奇葩，需要以`"2006-01-02 15:04:05"`为格式进行格式化。

```golang
// yyyy-MM-dd hh:mm:ss
// yyyy-MM-dd H:i:s

jsonArray["#time"] = time.Unix(time.Now().Unix(), 0).Format("2006-01-02 15:04:05")
```

## msource

`msource`是`kafka`和`本地存储`的桥梁(通信服务)，间接得做着服务可靠性的保证。（数据不丢，不重，方便查看堵塞情况）

```
./mctl

Usage:
  mtga [command]

Available Commands:
  clear_failure_queue 清空失败队列
  failure_queue_count 失败队列数量
  kafka_lag           消费阻塞
  offset_checker      offset的情况
```

以下命令都是msource提供出来的api，再由业务服务封装成命令

例如：offset_checker

```
.---.----------------.-----------.------------.------------.------------.-----.
| # |     Topic      | Partition |    Low     |    High    |  Current   | Lag |
+---+----------------+-----------+------------+------------+------------+-----+
| 0 | mulog_clean_24 | 0         | 6171720626 | 6197511755 | 6197511494 | 261 |
| 1 | mulog_clean_24 | 1         | 6169152656 | 6197196879 | 6197196555 | 324 |
| 2 | mulog_clean_24 | 2         | 6169656725 | 6195509715 | 6195509483 | 232 |
| 3 | mulog_clean_24 | 3         | 6172416843 | 6197496752 | 6197496518 | 234 |
| 4 | mulog_clean_24 | 4         | 6170706518 | 6197423974 | 6197423659 | 315 |
| 5 | mulog_clean_24 | 5         | 6168091223 | 6196757252 | 6196756991 | 261 |
'---'----------------'-----------'------------'------------'------------'-----'
```

例如：kafka_lag/failure_queue_count

```
1234
```

msource如何做到由业务系统控制指定offset中消费呢？

我们还是通过了`badger`来存储各个topic-partition的offset。服务在启动的时候会取各个partition的offset，如果存在的话，就设置需要从对应的offset开始读取数据。如果不存在对应的offset的话，那么就根据你的策略从`最早`,`最近`开始选择拉取数据。

```
+-------------------+
|---------+         |
|| badger |         |
+---------+         +---------------+
|                   |               |
|      offset存储   |               |
|                   |               |
+-------------------+     +---------v-------------+
                          |                       |      +------------+
                          |  从partition拉取数据    +-----+   。。。。。。|
                          |                       |      +------------+
                          +---------+-------------+
                                    |
                                    |
+-------------------+               |
|                   |               |
|      Kafka        <---------------+
|                   |
+-------------------+
```

msource的工作原理在介绍mtga的时候基本也差不多介绍完了。至于这些api的实现是基于`Unix Socket`实现的。

```Golang
func (sk *SpoutKafka) unixSocketListen() {
start:
	lis, err := net.Listen("unix", UNIX_SOCKET_FILE)
	if err != nil {
		logbdev.Info("UNIX Domain Socket 创建失败，正在尝试重新创建 -> ", err)
		err = os.Remove(UNIX_SOCKET_FILE)
		if err != nil {
			logbdev.Info("删除 sock 文件失败！程序退出 -> ", err)
		}
		goto start
	} else {
		logbdev.Info("创建 UNIX Domain Socket 成功")
	}

	sigs := make(chan os.Signal, 1)

	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigs
		if sk.SigTermCbNeed {
			sk.SigTermCb(true)
		}
	}()

	defer func() {
		lis.Close()
		os.Remove(UNIX_SOCKET_FILE)
	}()

	invokeObjectMethod := func(conn net.Conn, object interface{}, methodName string, args ...interface{}) {
		inputs := make([]reflect.Value, len(args))
		for i, _ := range args {
			inputs[i] = reflect.ValueOf(args[i])
		}

		intCb := func(v reflect.Value) {
			n, err := conn.Write([]byte(fmt.Sprintf("%d\n", v.Int())))
			if n > 0 {
				logbdev.Info(fmt.Sprintf("Cmd: %s ,成功响应结果: %d", methodName, v.Int()))
			}
			if err != nil {
				logbdev.Error(fmt.Sprintf("Cmd: %s ,响应失败 %s", methodName, err))
			}
		}

		strCb := func(v reflect.Value) {
			n, err := conn.Write([]byte(fmt.Sprintf("%s\n", v.String())))
			if n > 0 {
				logbdev.Info(fmt.Sprintf("Cmd: %s ,成功响应结果: %s", methodName, v.String()))
			}
			if err != nil {
				logbdev.Error(fmt.Sprintf("Cmd: %s ,响应失败 %s", methodName, err))
			}
		}

		for _, v := range reflect.ValueOf(object).MethodByName(methodName).Call(inputs) {
			switch v.Kind() {
			case reflect.Int:
			case reflect.Int64:
				intCb(v)
				break
			case reflect.String:
				strCb(v)
				break
			default:
				_, err := conn.Write([]byte(fmt.Sprintf("%s\n", "不支持的响应数据类型")))
				if err != nil {
					handleError(err.Error())
				}
			}
		}
	}

	handle := func(conn net.Conn) {
		defer conn.Close()

		for {
			var buf = make([]byte, 1024)
			n, err := conn.Read(buf)

			// 如果已经没数据了，则结束
			if err == io.EOF {
				return
			}
			if err != nil {
				logbdev.Info("Socket conn read error:", err)
				return
			}

			var cmd Cmd
			if n > 0 {
				err := json.Unmarshal(buf[:n], &cmd)
				if err != nil {
					_, err := conn.Write([]byte(fmt.Sprintf("Rpc-Json解析失败, err: %s", err) + "\n"))
					if err != nil {
						logbdev.Warn(err)
						continue
					}
				}
				invokeObjectMethod(conn, sk, cmd.RpcFuncName, cmd.Params...)
			}
		}
	}

	for {
		conn, err := lis.Accept()
		if err != nil {
			logbdev.Info("请求接收错误 -> ", err)
			continue // 一个连接错误，不会影响整体的稳定性，忽略就好
		}
		go handle(conn) //开始处理数据
	}
}
```

之前在mtga中出现过一个问题，那就是rpc超时问题的问题（socket超时）。这个问题导致了我们在执行各种命令的时候，如果出现问题会一直`hang up`的状态，得不到结果的同时一直卡住。影响到了我们对服务的监控。

```
+----------------------------------------------------------+
|   +-------------+                                        |
|   |   msource   |                                        |
|   +-------------+                                        |
|                                                          |
|   +---------------------+     +---------------------+    |
|   |                     |     |                     |    |
|   | unix socket server  |     | unix socket client  |    |
|   |                     |     |                     |    |
|   +---------------------+     +---------------------+    |
+----------------------------------------------------------+
```

为了解决这个问题。我们在`unix socket client` 这里加了一个超时的机制。借助是`context`的机制，实现协程之间的超时通信。

```golang
const (
	TimeoutMsg = "操作超时, 请检查服务状态!"
	TimeoutInt = -1
)

rcn := make(chan bool)
ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
defer cancel()

go func() {
  if exists(UNIX_SOCKET_FILE) {
    conn, err := net.Dial("unix", UNIX_SOCKET_FILE)
    if err != nil {
      handleError(err.Error())
    }
    defer conn.Close()

    rpc := Cmd{RpcFuncName: "FailureQueueCount"}
    data, err := json.Marshal(rpc)
    if err != nil {
      handleError(fmt.Sprintf("encode-json失败"))
    }

    n, err := conn.Write(data)

    if n > 0 && err == nil {
      reader := bufio.NewReader(conn)
      msg, err := reader.ReadString('\n')
      if err != nil {
        logbdev.Info(err)
      }
      msg = msg[:len(msg)-len("\n")]
      lagInt, err := strconv.Atoi(msg)
      if err != nil {
        handleError(err.Error())
      }
      lag = int64(lagInt)
    }
  } else {
    sk := SourceToolRun(configOpts)
    lag = sk.FailureQueueCount()
  }
  rcn <- true
}()

for {
  select {
  case <-ctx.Done():
    if ctx.Err() != nil {
      logbdev.Warn(ctx.Err())
      return TimeoutInt
    } else {
      return lag
    }
  case <- rcn:
    return lag
  }
}
```

这里需要注意的是，这个`context.WithTimeout` 是不管你内部是否处理完毕，一定会在指定的时间内`timeout`，所以如果提前完成了必须通过自己的手段提前结束。

## msink

这个组件的作用主要是用于把指定的消息进行sink到各种`终端`，例如`msink_file`,`msink_kafka`等等。

目前我们是封装在同一个仓库中，以不同文件保存，后续，我们或许会考虑拆分开来便于维护发版。

```
├── Dockerfile
├── README.MD
├── config.go
├── config.yml
├── config_test.go
├── error.go
├── go.mod
├── go.sum
├── msource_spout.go
├── msource_spout_test.go
└── rpc.go
```


这里主要和大家说以下`msink_file`吧，`msink_kafka`的实现原理差不多。

- 支持自定义回调函数，判断是否写入成功
- 支持批处理和流式处理

流式处理有独立的Api

- `func (f *FileClient) WriteWithoutEol(filePath string, message string) error`
- `func (f *FileClient) Write(filePath string, message string) error`
- `(f *FileClient) BatchLineDataChannel() chan<- map[Filename]ChannelMessage`

批处理的Api

- `(f *FileClient) BatchLineDataChannel() chan<- map[Filename]ChannelMessage`

可能细心的朋友已经发现了，流式处理的Api包含了批处理的Api。
是的，被包含在一起了，为什么会这样子？

```Golang
func NewFileClient(client afero.Fs, opts ...DialOption) *FileClient {
	p := new(FileClient)
	p.client = client
	p.dopts = defaultOptions()
	p.batchLineDataChannel = make(chan map[Filename]ChannelMessage, 1000)
	p.events = make(chan FileMetaMessage, 100)

	//循环调用opts
	for _, opt := range opts {
		opt.apply(&p.dopts)
	}

	var writer func(fileClient *FileClient)
	if p.dopts.batchWrite {
		writer = channelBatchWriter
	} else {
		writer = channelWriter
	}

	p.wg.Add(1)
	go func() {
		writer(p)
		p.wg.Done()
	}()

	p.wg.Add(1)
	go func() {
		p.run()
		p.wg.Done()
	}()

	return p
}

// 流式
func channelWriter(client *FileClient) {
	for m := range client.batchLineDataChannel {
		for fn, msg := range m {
			err := client.WriteWithoutEol(string(fn), string(msg))
			client.events <- FileMetaMessage{Message: string(msg), Error: err}
		}
	}
}

// 批量
func channelBatchWriter(client *FileClient) {
	var buffered = make(map[Filename][]ChannelMessage)
	bufferedCnt := 0
	batchSize := client.dopts.batchLineDataChannelCount

	for m := range client.batchLineDataChannel {
		for fn, msg := range m {
			buffered[fn] = append(buffered[fn], msg)
			bufferedCnt++
		}

	loop:
		for true {
			select {
			case m, ok := <-client.batchLineDataChannel:
				if !ok {
					break loop
				}
				if m == nil {
					panic("nil message received on batchLineDataChannel")
				}

				for fn, msg := range m {
					buffered[fn] = append(buffered[fn], msg)
					bufferedCnt++
					if bufferedCnt > batchSize {
						break loop
					}
				}
			default:
				break loop
			}
		}

		var tmpLongMsg = make(map[Filename]string)
		for Filename, ChannelMessageList := range buffered {
			tmpMsg := ""
			for _, cm := range ChannelMessageList {
				tmpMsg += string(cm)
			}

			tmpLongMsg[Filename] = tmpMsg
		}

		for Filename, longMsg := range tmpLongMsg {
			err := client.WriteWithoutEol(string(Filename), longMsg)
			for _, ChannelMessageList := range buffered {
				for _, cm := range ChannelMessageList {
					client.events <- FileMetaMessage{Message: string(cm), Error: err}
				}
			}
		}

		buffered = make(map[Filename][]ChannelMessage)
		bufferedCnt = 0
	}
}
```

看到这里大家应该也知道Api应该就可以理解为什么会被包含在一起了。

## logdev

这是我们的日志组件，在上面的代码中，多多少少已经有了这个组件的身影。

```
├── README.md
├── exported.go
├── go.mod
├── go.sum
├── hooks
│   ├── reporter
│   │   ├── metl.go
│   │   ├── reporter.go
│   │   └── reporter_test.go
│   └── stacker
│       ├── stacker.go
│       └── stacker_test.go
├── logbdev.go
├── logbdev_test.go
├── logger.go
├── mc_formatter.go
```

常规设置，主要是我们在这个组件中添加了几个`hook`，分别是`reporter`,`stacker`

- reporter （设置需要上报日志的级别，用于如果发现了`error`级别的错误就推送日志到我们的`告警服务`中。）

- stacker （设置需要输出堆栈的级别日志级别）

日志存储的方式有几种

- 1. 常规的单日志存储
- 2. 日志按照大小轮转
- 3. 日志按照日期轮转

## commentjson

这个是用来解析包含了`换行符`,`空白行`,`行注释`,`段注释`等等的`json`字符串

```
├── README.md
├── hjson.go
├── hjson_test.go
└── test.json
```

这个原理也比较简单，就是一个个字符去匹配，重新构造出一个新的合法的json格式。里面的单元测试也做得比较完善了。

## go-graceful-daemon

这个组件是用来将服务变成守护进程用的。

```Golang
├── README.md
├── daemon.go
├── go.mod
├── go.mod2
├── signal.go
└── test
    └── test.go
```

这里的核心主要是借助了`syscall`的`ForkExec`实现。

```Golang
func forkDaemon() error {
	args := os.Args
	os.Setenv("__Daemon", "true")
	procAttr := &syscall.ProcAttr{
		Env:   os.Environ(),
	}
	pid, err := syscall.ForkExec(os.Args[0], args, procAttr)
	if err != nil {
		return err
	}
	log.Printf("[%d] %s start daemon\n", pid, AppName)
	savePid(pid)
	return nil
}
```

并且支持自定实现信号量的捕捉处理逻辑

```Golang
var ErrStop = errors.New("stop serve signals")

type SignalHandlerFunc func(sig os.Signal) (err error)

func SetSigHandler(handler SignalHandlerFunc, signals ...os.Signal) {
	for _, sig := range signals {
		handlers[sig] = handler
	}
}

// ServeSignals calls handlers for system signals.
func ServeSignals() (err error) {
	signals := make([]os.Signal, 0, len(handlers))
	for sig := range handlers {
		signals = append(signals, sig)
	}

	ch := make(chan os.Signal, 8)
	signal.Notify(ch, signals...)

	for sig := range ch {
		err = handlers[sig](sig)
		if err != nil {
			break
		}
	}

	signal.Stop(ch)

	if err == ErrStop {
		err = nil
	}

	return
}

var handlers = make(map[os.Signal]SignalHandlerFunc)

func init() {
	handlers[syscall.SIGINT] = sigtermDefaultHandler
	handlers[syscall.SIGTERM] = sigtermDefaultHandler
	handlers[syscall.SIGHUP] = sighupDefaultHandler
}

func sigtermDefaultHandler(sig os.Signal) error {
	log.Printf("[%d] %s stop graceful", os.Getpid(), AppName)
	log.Printf("[%d] %s stopped.", os.Getpid(), AppName)
	os.Remove(PidFile)
	os.Exit(1)
	return ErrStop
}

func sighupDefaultHandler(sig os.Signal) error {
	//only deamon时不支持kill -HUP,因为可能监听地址会占用
	log.Printf("[%d] %s stopped.", os.Getpid(), AppName)
	os.Remove(PidFile)
	os.Exit(2)
	return ErrStop
}
```

> 目前内置了`SIGINT`,`SIGTERM`,`SIGHUP`的默认行为
