---
title: Home Assistant （二）
date: 2023-08-01 00:00:19
categories: [智能家居]
tags: [智能家居, Home Assistant, HA]
---

## 前言

本次主要是讲解一下进阶版的`HA`，为什么说是进阶版本呢，因为我也是花了几天的时候，去了解各种知识才了解得到的内容。

内容包括：什么叫`hassio`，`hassos`，并且他们和`Home Assistant` 是什么关系。

并且我会重点讲解`docker版本`的`HA`都是需要怎么玩（`不借助hassio`），你问我为什么，我就告诉你因为过于繁琐，并且多了很多无用的容器占用系统资源。

为什么我偏执于`docker版本的ha`？因为我不想一台机器，只做一件事，这对高配置和高性能的机器是一种绝对的浪费。

在这个时候，`环境隔离`就成了`重要的因素`, 而`docker`就很好的做到了这一点，并且不像`hassio`的底层依赖。

<!-- more -->

## MQTT

> 什么是MQTT协议，这个得大家去了解了，这里我只和大家说，这是一个开源的发布订阅的简易协议
> 它可以做到服务发现的功能，也可以做到事件通知等等
> 它是传统的物联网大家都会选择的一个协议

这里，我们需要安装一个`MQTT的服务器`，这个项目就是如下

- `eclipse-mosquitto` (https://github.com/eclipse/mosquitto) (https://hub.docker.com/r/amd64/eclipse-mosquitto)

这是一个一个由于C语言实现的MQTT协议的服务器，但是我们不直接用他。我们借助`docker`的特性，用docker来安装。

插一个题外话，其实`Home Assistant`的 `ADD-ON` 功能，也是创建一些服务的容器，所以我们手动操作，也是一样的。这个时候就是解答有一些小伙伴经常会纠结的一个问题，为什么我用docker安装的`HA`，它不存在 `Add-on` 这个加载项，我要怎么使用这个功能。答案就是：手动处理。当然如果你有编程能力的话，也可以做成一个自动化脚本，这也是我接下来准备做的。

好的，话不多说，我们继续我们的操作，基于 `docker` 安装 `eclipse-mosquitto` 服务。

找到一个目录，接着执行如下命令创建目录

```shell
mkdir -p ~/ha/mqtt/config
mkdir -p ~/ha/mqtt/data
mkdir -p ~/ha/mqtt/log
```

在 `~/ha/mqtt/config` 目录下创建配置文件 `mosquitto.conf`

```shell
vim mosquitto.conf
```

内容如下，主要分别是需要持久化数据，存储的路径是容器内部的路径

```shell
# 是否允许未提供用户名的客户端进行连接
allow_anonymous true
# 0.0.0.0很重要，否则你的宿主机转发的端口，也无法被mqtt接收到
listener 1883 0.0.0.0
# 是否持久化数据
persistence true
# 持久化数据的路径
persistence_location /mosquitto/data
# 落盘日志
log_dest file /mosquitto/log/mosquitto.log
```

具体配置文档 `https://mosquitto.org/man/mosquitto-conf-5.html`

最后执行如下命令即可启动 `mosquitto 容器`：

```shell
docker run -d --name=mosquitto --privileged
-p 1883:1883 \
-v $(PWD)/config/mosquitto.conf:/mosquitto/config/mosquitto.conf \
-v $(PWD)/data:/mosquitto/data \
-v $(PWD)/log:/mosquitto/log \
eclipse-mosquitto
```

> 我的 `$(PWD)`代表当前目录，你可以改成上面的 `~/ha/mqtt/`目录

查看容器是否启动：

```shell
CONTAINER ID   IMAGE                          COMMAND                  CREATED          STATUS          PORTS                                                                      NAMES
b4a8f33dc8b2   eclipse-mosquitto              "/docker-entrypoint.…"   17 seconds ago   Up 17 seconds   0.0.0.0:1883->1883/tcp      mosquitto
```

查看日志信息:

```shell
tail log/mosquitto.log
1690908079: mosquitto version 2.0.15 starting
1690908079: Config loaded from /mosquitto/config/mosquitto.conf.
1690908079: Starting in local only mode. Connections will only be possible from clients running on this machine.
1690908079: Create a configuration file which defines a listener to allow remote access.
1690908079: For more details see https://mosquitto.org/documentation/authentication-methods/
1690908079: Opening ipv4 listen socket on port 1883.
1690908079: Opening ipv6 listen socket on port 1883.
1690908079: Error: Address not available
1690908079: mosquitto version 2.0.15 running
```

OK，我们看到一切正常。

让我们来测试一下是不是真的ok了。

我们同样，用2个容器，分别创建`发布者`和`订阅者`

> 由于我的是macbook，所以我的容器可以通过`host.docker.internal`来访问宿主机，如果是linux环境下的，可以使用 `--net host` 模式

订阅者（窗口1）:

```shell
docker run --rm -it eclipse-mosquitto sh -c 'mosquitto_sub -h host.docker.internal -p 1883 -t "#" -v'
```

> 对应的参数就不一一解释了

发布者（窗口2）:

```shell
docker run --rm -it eclipse-mosquitto sh -c 'mosquitto_pub -h host.docker.internal -p 1883 -t "test/testdevice"  -m caiwenhui-hello'
```

回到`窗口1`查看订阅者的情况

```shell
docker run --rm -it eclipse-mosquitto sh -c 'mosquitto_sub -h host.docker.internal -p 1883 -t "#" -v'                                                                         
test/testdevice caiwenhui-hello
```

可以看见，我们的消息和对应的topic都正常接受到了。非常好！

接下来，我们接入我们的`HA`！！

## 让HA和MQTT连接

我们打开回到我们的HA, `http://127.0.0.1:8123`

![mqtt1](/images/智能家居/mqtt1.jpg)

![mqtt2](/images/智能家居/mqtt2.jpg)

![mqtt3](/images/智能家居/mqtt3.jpg)

![mqtt4](/images/智能家居/mqtt4.jpg)

由于我这里没有账号密码，并且允许匿名发送，所以这里可以先忽视这些，正常的情况下，我们需要设置，`否则一旦mqtt被破解`，被发送`恶意指令`，可能会让你的设备`“发疯”`

![mqtt5](/images/智能家居/mqtt5.jpg)

![mqtt6](/images/智能家居/mqtt6.jpg)

![mqtt7](/images/智能家居/mqtt7.jpg)

看到这里，我们配置完成了。接下里，就是在HA里面测试是否真的配置正确并且可通的了。

![mqtt8](/images/智能家居/mqtt8.jpg)

![mqtt9](/images/智能家居/mqtt9.jpg)

![mqtt10](/images/智能家居/mqtt10.jpg)

可以看到关键信息: `i am ha's caiwenhui` , 是因为我在我的电脑发送的消息`被HA接收到了`

![mqtt11](/images/智能家居/mqtt11.jpg)

可以看到，这个图，代表，我接收到了从ha系统发出的消息。ok，我们ha和mqtt的连接在不借助 `hassio` 和 `add-on`的情况下已经打通了。


