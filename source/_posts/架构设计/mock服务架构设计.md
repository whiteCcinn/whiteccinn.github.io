---
title: mock服务架构设计
date: 2024-06-25 11:52:40
categories: [架构设计]
tags: [mock, iptables]
---

## 前言

在公司的日常adx开发流程中，我发现其中一个很费心，很费时的行为，那就是要拿到上游的广告offer。

要拿到一个正常的offer，不单单需要匹配内部的逻辑，还要看上游是否需要对你的这次展示机会进行竞价。

由于在adx的业务逻辑中，`一次请求`会同时`请求N次`上游，所以必然少不了对上游的`询价(请求)`行为，那我们在日常开发，以及做代码调试的过程中，有没有办法可以更好的做到能拿到offer来对我们的竞价行为进行调试和开发呢？

还有一种场景就是测试同学会面临的，就是如何在尽量不影响线上数据的情况下，能安全无痛的进行测试adx呢，如果因为测试的行为，导致线上业务数据异常，或者出现了结算问题，对于大规模流量的广告自动化交易程序来说，这都是致命的，严重点来说，可能随时导致破产。

又换句话说，有没有办法能在我们想要做模拟压测的时候，也能进行正常的内部逻辑呢？其中一个难点就是我们在压测的环节，并**不想**正式去对`上游询价`，但是我又想要拿到上游的offer，除了 `hard code offer`的动作外，有没有一些更理想的架构方案呢？

答案是：有的，接下来就是我们的主题

<!-- more -->

以下会以一个常规的adx架构来进行说明。

![adx-服务架构](/images/架构设计/mock服务架构设计/adx-服务架构.png)

在这个架构中，我们简单的把整体的架构，分为了`三部分`，分别是：

- 中间件: `redis集群`，`mongo服务`
- 业务程序: `adx`
- 上游角色: `dsp`

在实际业务中我们的`redis`可能会丢服务进行一些例如`qps`，`临时缓存`的动作，所以是必不可少的一部分。`mongo`服务则是充当我们的`数据存储层`，`dsp`就是我们`adx`服务的上游，我们的广告竞价的玩家就是来自于`dsp`。

这三个角色大致了解和理解之后，我们会发现，一般的设计中，由于要符合adx的`低延时，高并发`的行为，我们一般会把服务至于同一个内网中（虽然实际的架构设计可能是多个网关，相互行为NAT行为的内部链路），用以减少我们内部之间的网络耗时。对外的请求，只有向`上游DSP`进行`询价`的时候。

所以既然我们要mock的话，那很显然，我们需要mock我们的dsp服务，但是我们并不希望去调整所谓的`上游EP`，或者在内部编写`hard code代码`，虽然在github开源库上我们找到了一些类似`滴滴开发`的`https://github.com/didi/sharingan`的`流量录制回放`服务。但是由于其使用上的繁琐和不便等因素，以及需求的本质性，我认为，暂时不需呀用到这种`大规模`的`流量录制回放`服务。

所以对于这个问题，只需要采用我们新的架构设计，就可以实现这一点。

![adx-dsp-mock服务架构](/images/架构设计/mock服务架构设计/adx-dsp-mock服务架构.png)

在上图中，我们可以发现，我们引入了一个常见的角色`iptables`，这是一个网络防火墙工具，也是内核`netfiler`的`hook`工具，他能让我们的流量在经过系统内部的时候，对其进行额外的行为。

![Netfilter-packet-flow](/images/架构设计/mock服务架构设计/Netfilter-packet-flow.svg)

> Netfilter-packet-flow，这是netfilter系统的工作流程，感兴趣的需要额外去了解哈

## 理论

我们借助iptables去实现每个hook节点的行为。用以实现

1. `adx服务器可以与Redis集群`正常通信
2. `adx服务器可以与mongo`正常通信
3. `adx对dsp的请求`需要`转发`到`mock-dsp服务器`

配置adx服务器的iptables规则如下：

- ADX服务器的IP为 `172.18.0.100/16`
- 目标`mock-dsp`的IP为 `172.18.0.200/16`, 端口为`8080`
- Redis集群的IP范围为 `172.18.0.0/16`(具体ip不用理会), Redis集群的端口范围为 `7001-7006`, 总共6台机器
- MongoDB服务IP范围为 `172.18.0.0/16`(具体ip不用理会), 的端口为 `27017`

#### 配置NAT表

将`非Redis`和`非MongoDB`流量`转发`到`目标内网(MOCK-DSP机器`: 

```shell
# 确保 Redis 和 MongoDB 的流量直接通过
iptables -t nat -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 7001:7006 -j ACCEPT
iptables -t nat -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 27017 -j ACCEPT

# 将非 Redis 和非 MongoDB 的流量转发到 MOCK-DSP机器
# 也就是外部的DSP请求全部转发到mock-dsp的机器上
iptables -t nat -A OUTPUT -p tcp ! -d 172.18.0.0/16 -m multiport ! --dports 7001:7006,27017 -j DNAT --to-destination 172.18.0.200:8080
```

#### 配置SNAT/MASQUERADE规则 (确保返回路径正确)

```shell
# 确保 Redis 和 MongoDB 的流量直接通过
iptables -t nat -A POSTROUTING -p tcp -d 172.18.0.0/16 --dport 7001:7006 -j ACCEPT
iptables -t nat -A POSTROUTING -p tcp -d 172.18.0.0/16 --dport 27017 -j ACCEPT

# 确保转发到mock-dsp器的流量可以正确返回
iptables -t nat -A POSTROUTING -d 172.18.0.200 -j MASQUERADE
```

### 配置filter表规则（可选，但推荐）

> 但是实际上我感觉没必要，只是按照规范来说，是需要加上

配置INPUT规则（允许从Redis集群和MongoDB服务来的连接）

```shell
# 允许来自 Redis 集群的连接
iptables -A INPUT -p tcp -s 172.18.0.0/16 --dport 7001:7006 -m state --state NEW,ESTABLISHED -j ACCEPT
# 允许来自 MongoDB 服务的连接
iptables -A INPUT -p tcp -s 172.18.0.0/16 --dport 27017 -m state --state NEW,ESTABLISHED -j ACCEPT
```

配置OUTPUT规则（允许到Redis集群和MongoDB服务的连接）

```shell
# 允许到 Redis 集群的连接
iptables -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 7001:7006 -m state --state NEW,ESTABLISHED -j ACCEPT
# 允许到 MongoDB 服务的连接
iptables -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 27017 -m state --state NEW,ESTABLISHED -j ACCEPT
# 允许到mock-dsp的转发流量（非 Redis 和非 MongoDB 流量）
iptables -A OUTPUT -p tcp -d 172.18.0.200 -m state --state NEW,ESTABLISHED -j ACCEPT
```

## 完整的例子如下：

```shell
# DNAT规则：将非 Redis 和非 MongoDB 的流量转发到MOCK-DSP机器
iptables -t nat -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 7001:7006 -j ACCEPT
iptables -t nat -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 27017 -j ACCEPT
iptables -t nat -A OUTPUT -p tcp ! -d 172.18.0.0/16 -m multiport ! --dports 7001:7006,27017 -j DNAT --to-destination 172.18.0.200:8080

# SNAT/MASQUERADE规则：确保返回路径正确
iptables -t nat -A POSTROUTING -p tcp -d 172.18.0.0/16 --dport 7001:7006 -j ACCEPT
iptables -t nat -A POSTROUTING -p tcp -d 172.18.0.0/16 --dport 27017 -j ACCEPT
iptables -t nat -A POSTROUTING -d 172.18.0.200 -j MASQUERADE

# 允许来自 Redis 集群的连接
iptables -A INPUT -p tcp -s 172.18.0.0/16 --dport 7001:7006 -m state --state NEW,ESTABLISHED -j ACCEPT

# 允许来自 MongoDB 服务的连接
iptables -A INPUT -p tcp -s 172.18.0.0/16 --dport 27017 -m state --state NEW,ESTABLISHED -j ACCEPT

# 允许到 Redis 集群的连接
iptables -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 7001:7006 -m state --state NEW,ESTABLISHED -j ACCEPT

# 允许到 MongoDB 服务的连接
iptables -A OUTPUT -p tcp -d 172.18.0.0/16 --dport 27017 -m state --state NEW,ESTABLISHED -j ACCEPT

# 允许到mock-dsp的转发流量（非 Redis 和非 MongoDB 流量）
iptables -A OUTPUT -p tcp -d 172.18.0.200 -m state --state NEW,ESTABLISHED -j ACCEPT
```

理论看明白之后，我们再回过头来看这个问题，是不是发现`**清晰明了**`

![adx-dsp-mock服务架构](/images/架构设计/mock服务架构设计/adx-dsp-mock服务架构.png)

## 实战

### 本地docker模拟整体架构

![docker容器服务](/images/架构设计/mock服务架构设计/docker-c.jpg)

![容器的network信息](/images/架构设计/mock服务架构设计/network-ip.jpg)

这里，我们直接上2张图，分别代表了`docker容器服务`, `容器的network信息`。可以看到基本信息都不变, 重点关注一下这里的`<dsp> = <mock dsp>`， 并且实际ip从`172.18.0.200/16 => 172.168.0.10/16`。

获取这些信息之后，对我们`iptables-rule文件`调整了一下，代码如下：

```shell
# 文件名：iptables-rules

# filter表的规则
*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
# 允许宿主机的请求请求可以在宿主机直接打到到我们的adx服务
# 其实不设置也可以，因为上面已经设置了默认协议为`ACCEPT`
-A INPUT -p tcp -m state --state NEW -m tcp --dport 1372 -j ACCEPT
COMMIT

# nat表的规则
*nat
:PREROUTING ACCEPT [0:0]
:INPUT ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]

-A OUTPUT -p tcp -d 172.18.0.0/16 --dport 7001:7006 -j ACCEPT
-A OUTPUT -p tcp -d 172.18.0.0/16 --dport 27017 -j ACCEPT
-A OUTPUT -p tcp ! -d 172.18.0.0/16 -m multiport ! --dports 7001:7006,27017 -j DNAT --to-destination 172.18.0.10:8080

-A POSTROUTING -p tcp -d 172.18.0.0/16 --dport 7001:7006 -j ACCEPT
-A POSTROUTING -p tcp -d 172.18.0.0/16 --dport 27017 -j ACCEPT
-A POSTROUTING -d 172.18.0.10 -j MASQUERADE

COMMIT
```

在我们的`adx服务器上设置iptables规则`，执行命令

```shell
iptables-restore < iptables-rules
```

查看我们服务器上的iptables规则：

```shell
root@87cb4c5933af:# iptables -nvL -t nat
Chain PREROUTING (policy ACCEPT 2 packets, 120 bytes)
 pkts bytes target     prot opt in     out     source               destination

Chain INPUT (policy ACCEPT 2 packets, 120 bytes)
 pkts bytes target     prot opt in     out     source               destination

Chain POSTROUTING (policy ACCEPT 367 packets, 21822 bytes)
 pkts bytes target     prot opt in     out     source               destination
   11   660 ACCEPT     tcp  --  *      *       0.0.0.0/0            172.18.0.0/16        tcp dpts:7001:7006
    2   120 ACCEPT     tcp  --  *      *       0.0.0.0/0            172.18.0.0/16        tcp dpt:27017
    5   300 MASQUERADE  all  --  *      *       0.0.0.0/0            172.18.0.10

Chain OUTPUT (policy ACCEPT 367 packets, 21822 bytes)
 pkts bytes target     prot opt in     out     source               destination
   11   660 ACCEPT     tcp  --  *      *       0.0.0.0/0            172.18.0.0/16        tcp dpts:7001:7006
    2   120 ACCEPT     tcp  --  *      *       0.0.0.0/0            172.18.0.0/16        tcp dpt:27017
    5   300 DNAT       tcp  --  *      *       0.0.0.0/0           !172.18.0.0/16        multiport dports  !7001:7006,27017 to:172.18.0.10:8080
# Warning: iptables-legacy tables present, use iptables-legacy to see them
```

这里可以看到，我们的规则已经按要求`生效`

接下来就是接着我们的启动`adx服务`和 `mock-dsp服务`

![adx-服务启动](/images/架构设计/mock服务架构设计/adx-服务启动.jpg)

![dsp-服务启动](/images/架构设计/mock服务架构设计/dsp-服务启动.jpg)

启动完毕之后，我们在宿主机把入参请求发到容器中的adx服务中

```shell
req=`cat filter.json| jq '.req'`;curl -X POST 'http://127.0.0.1:1372/adx_api?pubid=xxxxx' -d "$req"
```

> 这里的filter.json，是从线上bid日志进行match下来的信息，也是后续我们要放到mock-dsp中的数据源
> 当然，更好的方式是从kafaka中自动更新信息

![三次握手.jpg](/images/架构设计/mock服务架构设计/三次握手.jpg)

通过 `tcpdump -n`，我们可以看到，这里`三次握手的SYN`第一步都是向着`mock-dsp`的机器发出的请求，也就是`172.18.0.10/16` 这个地址发出，所以我们的`nat表`的对`流量转发`**完美**的处理了所有流量的流向。

并且不一会儿我们也得到了一段`正常的广告offer填充！`

![req.jpg](/images/架构设计/mock服务架构设计/req.jpg)


## mock-dsp的简易代码：

```golang
package main

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/goccy/go-json"
	"io/ioutil"
	"net/http"
)

type FileT struct {
	Req  interface{} `json:"req"`
	Resp interface{} `json:"resp"`
}

func main() {
	// 启动gin框架，采用默认配置
	router := gin.Default()
	b, err := ioutil.ReadFile("filter.json")
	if err != nil {
		panic(err)
	}

	var f FileT
	err = json.Unmarshal(b, &f)
	if err != nil {
		panic(err)
	}

	// 编写匿名的handler函数
	router.POST("/request/:dsp_id", func(c *gin.Context) {
		dspId := c.Param("dsp_id")
		c.JSON(http.StatusOK, f.Resp)
	})

	router.GET("/request/:dsp_id", func(c *gin.Context) {
		dspId := c.Param("dsp_id")
		c.JSON(http.StatusOK, f.Resp)
	})

	router.Run() //:8080
}
```

后续我们可以对这个mock-dsp进行更加丰富的针对性处理

- 通过kafka代替文件的方式定时更新offer
- 针对`adformat`的和`dsp_id`进行匹配，得到不同offer的返回


# 总结

这一次，我们通过这种`架构设计`，可以做到后续我们对我们的一些需求得到更好的支持。

- 代码调优
- 开发同学自测逻辑
- 测试同学测试逻辑
- 对服务进行压测