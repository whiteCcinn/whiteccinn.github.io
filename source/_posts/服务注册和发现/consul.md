---
title: 【服务注册和发现】- Consul
date: 2019-07-04 11:15:00
categories: [服务注册和发现]
tags: [服务注册和发现]
---

服务注册与服务发现是在分布式服务架构中常常会涉及到的东西，业界常用的服务注册与服务发现工具有 [ZooKeeper](https://zookeeper.apache.org/)、[etcd](https://etcd.io/)、[Consul](https://www.consul.io/) 和 [Eureka](https://github.com/Netflix/eureka)。Consul 的主要功能有服务发现、健康检查、KV 存储、安全服务沟通和多数据中心。Consul 与其他几个工具的区别可以在这里查看 [Consul vs. Other Software。](https://www.consul.io/intro/vs/index.html)

<!-- more -->

## 为什么需要有服务注册与服务发现？

假设在分布式系统中有两个服务 Service-A （下文以“S-A”代称）和 Service-B（下文以“S-B”代称），当 S-A 想调用 S-B 时，我们首先想到的时直接在 S-A 中请求 S-B 所在服务器的 IP 地址和监听的端口，这在服务规模很小的情况下是没有任何问题的，但是在服务规模很大每个服务不止部署一个实例的情况下是存在一些问题的，比如 S-B 部署了三个实例 S-B-1、S-B-2 和 S-B-3，这时候 S-A 想调用 S-B 该请求哪一个服务实例的 IP 呢？还是将 3 个服务实例的 IP 都写在 S-A 的代码里，每次调用 S-B 时选择其中一个 IP？这样做显得很不灵活，这时我们想到了 Nginx 刚好就能很好的解决这个问题，引入 Nginx 后现在的架构变成了如下图这样：

![图1](/images/服务注册和发现/consul/图1.png)

我们还需要实现一个动态 upstream，就是当我们的 S-B 的服务换了机器或者更换机器 IP 之后，依然能够热重启 nginx。

![图2](/images/服务注册和发现/consul/图2.png)

在这个架构中：

- 首先 S-B 的实例启动后将自身的服务信息（主要是服务所在的 IP 地址和端口号）注册到注册工具中。不同注册工具服务的注册方式各不相同，后文会讲 Consul 的具体注册方式。
- 服务将服务信息注册到注册工具后，注册工具就可以对服务做健康检查，以此来确定哪些服务实例可用哪些不可用。
- S-A 启动后就可以通过服务注册和服务发现工具获取到所有健康的 S-B 实例的 IP 和端口，并将这些信息放入自己的内存中，S-A 就可用通过这些信息来调用 S-B。
- S-A 可以通过监听（Watch）注册工具来更新存入内存中的 S-B 的服务信息。比如 S-B-1 挂了，健康检查机制就会将其标为不可用，这样的信息变动就被 S-A 监听到了，S-A 就更新自己内存中 S-B-1 的服务信息。

所以务注册与服务发现工具除了服务本身的服务注册和发现功能外至少还需要有健康检查和状态变更通知的功能。

## Consul

Consul 作为一种分布式服务工具，为了避免单点故障常常以集群的方式进行部署，在 Consul 集群的节点中分为 Server 和 Client 两种节点（所有的节点也被称为 Agent），Server 节点保存数据，Client 节点负责健康检查及转发数据请求到 Server；Server 节点有一个 Leader 节点和多个 Follower 节点，Leader 节点会将数据同步到 Follower 节点，在 Leader 节点挂掉的时候会启动选举机制产生一个新的 Leader。

Client 节点很轻量且无状态，它以 RPC 的方式向 Server 节点做读写请求的转发，此外也可以直接向 Server 节点发送读写请求。下面是 Consul 的架构图：

![图3](/images/服务注册和发现/consul/图3.png)

Consul 的安装和具体使用及其他详细内容可浏览[官方文档](https://www.consul.io/docs/index.html)。

### Consul 默认端口

| Use                                                                                                            | Default Ports     | 用途说明                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS: The DNS server (TCP and UDP)                                                                              | 8600              | 用于解析 DNS 查询。                                                                                                                                   |
| HTTP: The HTTP API (TCP Only)                                                                                  | 8500              | 客户端使用它来与 HTTP API 通信。                                                                                                                      |
| HTTPS: The HTTPs API                                                                                           | disabled (8501)\* | （可选）默认情况下处于关闭状态，但端口 8501 是各种工具默认使用的约定。                                                                                |
| gRPC: The gRPC API                                                                                             | disabled (8502)\* | （可选）。目前 gRPC 仅用于将 xDS API 公开给 Envoy 代理。默认情况下它处于关闭状态，但端口 8502 是各种工具用作默认值的约定。在-dev 模式下默认为 8502 。 |
| LAN Serf: The Serf LAN port (TCP and UDP)                                                                      | 8301              | 用于处理 LAN 中的八卦。所有代理商都要求。                                                                                                             |
| Wan Serf: The Serf WAN port TCP and UDP)                                                                       | 8302              | 服务器使用它来通过 WAN 闲聊到其他服务器。从 Consul 0.8 开始，WAN 加入泛洪功能要求 Serf WAN 端口（TCP / UDP）在 WAN 和 LAN 接口上进行监听。            |
| server: Server RPC address (TCP Only)                                                                          | 8300              | 服务器使用它来处理来自其他代理的传入请求。                                                                                                            |
| Sidecar Proxy Min: Inclusive min port number to use for automatically assigned sidecar service registrations.  | 21000             | 无                                                                                                                                                    |
| Sidecar Proxy Max: Inclusive max port number to use for automatically assigned sidecar service registrations.. | 21255             | 无                                                                                                                                                    |

默认端口可以通过 [agent configuration](https://www.consul.io/docs/agent/options.html#ports) 来修改

### 运行 Consul 服务

下面是我用 Docker 的方式搭建了一个有 2 个 Server 节点和 1 个 Client 节点的 Consul 集群。

```shell
# 这是Consul服务主节点
docker run -d --name=c1 -p 8500:8500 -e CONSUL_BIND_INTERFACE=eth0 consul agent --server=true --bootstrap-expect=2 --client=0.0.0.0 -ui
```

```shell
docker exec -it c1 ifconfig
eth0      Link encap:Ethernet  HWaddr 02:42:AC:11:00:03
          inet addr:172.17.0.3  Bcast:172.17.255.255  Mask:255.255.0.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:24 errors:0 dropped:0 overruns:0 frame:0
          TX packets:16 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0
          RX bytes:5835 (5.6 KiB)  TX bytes:1619 (1.5 KiB)

lo        Link encap:Local Loopback
          inet addr:127.0.0.1  Mask:255.0.0.0
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)
```

这里，我们看到我们的 server 的主节点的 IP 为:172.17.0.3

让 follwer 节点加入 leader 节点

```shell
docker run -d --name=c2 -e CONSUL_BIND_INTERFACE=eth0 consul agent --server=true --client=0.0.0.0 --join 172.17.0.3
```

启动 client 节点

```shell
#下面是启动 Client 节点
docker run -d --name=c3 -e CONSUL_BIND_INTERFACE=eth0 consul agent --server=false --client=0.0.0.0 --join 172.17.0.3
```

```shell
docker ps
CONTAINER ID        IMAGE                        COMMAND                  CREATED             STATUS              PORTS                                                                      NAMES
262fcb21e07a        consul                       "docker-entrypoint.s…"   28 seconds ago      Up 27 seconds       8300-8302/tcp, 8500/tcp, 8301-8302/udp, 8600/tcp, 8600/udp                 c3
ffd0c626653f        consul                       "docker-entrypoint.s…"   41 minutes ago      Up 41 minutes       8300-8302/tcp, 8500/tcp, 8301-8302/udp, 8600/tcp, 8600/udp                 c2
d6bb5fee079d        consul                       "docker-entrypoint.s…"   43 minutes ago      Up 43 minutes       8300-8302/tcp, 8301-8302/udp, 8600/tcp, 8600/udp, 0.0.0.0:8500->8500/tcp   c1
```

操作 Consul 有 [Commands](https://www.consul.io/docs/commands/index.html) 和 [HTTP API](https://www.consul.io/api/index.html) 两种方式，进入任意一个容器执行 `consul members` 都可以有如下的输出，说明 Consul 集群就已经搭建成功了。

```shell
docker exec -it c1 consul members
Node          Address          Status  Type    Build  Protocol  DC   Segment
d6bb5fee079d  172.17.0.3:8301  alive   server  1.5.2  2         dc1  <all>
ffd0c626653f  172.17.0.4:8301  alive   server  1.5.2  2         dc1  <all>
262fcb21e07a  172.17.0.5:8301  alive   client  1.5.2  2         dc1  <default>
```

### 服务注册

服务注册对方式有 2 种方式

- 通过 client 的配置来注册
- 通过 Http-Api 来注册服务

由于我们的需求是需要用 Http api 来注册服务，所以接下来的例子都是以[http-api-register-service](https://www.consul.io/api/agent/service.html#register-service)为例子

- 请求 Method：PUT
- 请求 Path：/agent/server/register
- 请求 Content-type: application/json

---

- Blocking Queries：No
- Consistency Modes：None
- Agent Caching：None
- ACL Required：service:write （Acl 需要拥有写入的权限）

#### 参数

参数不仅仅只支持 StudlyCaps（首字母大写的驼峰写法`camel_case`）,还支持 蛇形大小写，`snake_case`。

- Name (string: &lt;required&gt;): 指定服务的逻辑名称。许多服务实例可以共享相同的逻辑服务名称。
- ID (string: "") : 指定此服务的唯一 ID。每个代理必须是唯一的。Name 如果未提供，则默认为参数。
- Tags (array&lt;string&gt;: nil) : 指定要分配给服务的标记列表。这些标记可用于以后的过滤，并通过 API 公开。
- Address (string: "") : 指定服务的地址。如果未提供，则在 DNS 查询期间将代理的地址用作服务的地址。
- Meta (map&lt;string|string&gt;: nil) : 指定链接到服务实例的任意 KV 元数据。
- Port (int: 0) : 指定服务的端口。
- Kind (string: "") : 默认为空，代表典型的 consul 服务，这个值可填写的：connect-proxy，代表另一个服务的支持 Connect 的代理服务
- Connect (Connect: nil)- 指定 Connect 的 [配置](https://www.consul.io/docs/connect/configuration.html)。有关支持的字段，请参阅下面的[连接结构](https://www.consul.io/api/agent/service.html#connect-structure)
- Check (Check: nil) - 指定检查。有关接受的字段的详细信息，请参阅[检查文档](https://www.consul.io/api/agent/check.html)。如果您没有为支票提供名称或 ID，则会生成它们。要提供自定义 ID 和/或名称，请设置 CheckID 和/或 Name 字段。
- Checks (array&lt;Check&gt: nil) - 指定检查列表。有关接受的字段的详细信息，请参阅 [检查文档](https://www.consul.io/api/agent/check.html)。如果您没有为支票提供名称或 ID，则会生成它们。要提供自定义 ID 和/或名称，请设置 CheckID 和/或 Name 字段。自动生成 Name 并 CheckID 依赖于数组中检查的位置，因此即使行为是确定性的，建议所有检查要么让 consul CheckID 通过将字段留空/省略来设置，或者提供唯一值。
- EnableTagOverride (bool: false) - 指定禁用此服务标签的反熵功能。如果 EnableTagOverride 设置为，true 则外部代理可以在[目录](https://www.consul.io/api/catalog.html)中更新此服务 并修改标记。此代理的后续本地同步操作将忽略更新的标记。例如，如果外部代理修改了此服务的标记和端口，并且 EnableTagOverride 设置为 true 在下一个同步周期之后，则服务的端口将恢复为原始值，但标记将保持更新的值。作为一个反例，如果一个外部代理修改了这个服务的标签和端口，并 EnableTagOverride 设置为 false 在下一个同步周期后服务的端口和 标签将恢复为原始值，并且所有修改都将丢失。
- Weights (Weights: nil) - 指定服务的权重。有关权重的更多信息，请参阅 [服务文档](https://www.consul.io/docs/agent/services.html)。如果未提供此字段，则权限将默认为 {"Passing": 1, "Warning": 1}。请务必注意，这仅适用于本地注册的服务。如果您有多个节点都注册相同的服务，则其 EnableTagOverride 配置和所有其他服务配置项彼此独立。更新在一个节点上注册的服务的标记与在另一个节点上注册的相同服务（按名称）无关。如果 EnableTagOverride 未指定，则默认值为 false。有关详细信息，请参阅反熵同步。

### 服务注册

#### 样本载体(Sample Payload)

```json
## cat payload1.json
{
  "ID": "redis1",
  "Name": "redis",
  "Tags": [
    "primary",
    "v1"
  ],
  "Address": "127.0.0.1",
  "Port": 8000,
  "Meta": {
    "redis_version": "4.0"
  },
  "EnableTagOverride": false,
  "Check": {
    "HTTP": "http://127.0.0.1:5000/health",
    "Interval": "10s"
  },
  "Weights": {
    "Passing": 1,
    "Warning": 1
  }
}
```

```json
## cat payload2.json
{
  "ID": "redis2",
  "Name": "redis",
  "Tags": [
    "primary",
    "v1"
  ],
  "Address": "127.0.0.1",
  "Port": 8000,
  "Meta": {
    "redis_version": "4.0"
  },
  "EnableTagOverride": false,
  "Weights": {
    "Passing": 1,
    "Warning": 1
  }
}
```

```json
## cat payload3.json
{
  "ID": "redis3",
  "Name": "redis",
  "Tags": [
    "primary",
    "v1"
  ],
  "Address": "127.0.0.1",
  "Port": 8001,
  "Meta": {
    "redis_version": "4.0"
  },
  "EnableTagOverride": false,
  "Weights": {
    "Passing": 1,
    "Warning": 1
  }
}
```

#### 样本请求(Sample Request)

```shell
curl \
    --request PUT \
    --data @payload1.json \
    http://127.0.0.1:8500/v1/agent/service/register
```

```shell
curl \
    --request PUT \
    --data @payload2.json \
    http://127.0.0.1:8500/v1/agent/service/register
```

```shell
curl \
    --request PUT \
    --data @payload3.json \
    http://127.0.0.1:8500/v1/agent/service/register
```

在 consul-ui 上可以看到是否注册成功，也可以通过 http-api 查看是否注册成功

![图4](/images/服务注册和发现/consul/图4.png)

![图5](/images/服务注册和发现/consul/图5.png)

![图6](/images/服务注册和发现/consul/图6.png)

从上图看出，有`check`机制的那个有一个节点目前是`心跳检测失败`的。

#### 心跳机制(check)

Http 的 check 机制只要返回的状态为`2xx`，就算为成功，如果是`4xx`,就算为危险，`其他状态码`算为严重.

### 服务发现

服务注册之后，我们就需要从 consul 中拿到这些服务信息

- [Health 相关的 API](https://www.consul.io/api/health.html)
- [Health-service 的 API](https://www.consul.io/api/health.html#list-nodes-for-service)

```shell
curl http://127.0.0.1:8500/v1/health/service/redis?passing=true
```

- passing （这个参数可以帮我们只显示可用的服务节点）
- filter （服务需要定制过滤的可以传入这个参数，详情看文档）

这个时候，我们可以拿到所有`可用`的服务列表之后，需要找到`地方(内存)`把这个`"列表"`存储起来，在我们的 Client 或者 API 网关进程内部实现一个内部`LB`的机制，这样子就不需要每次请求都去拿一次这个可用服务的信息。

内部的`LB`机制一般就是`轮训`或者`随机`。

### 服务更新 LB 信息(Watch)

由于我们的服务不一定一直都处于可用的状态，所以我们要跟随者`服务注册中心`来更新我们的内部的`LB`内容，所以我们需要`服务注册中心`告诉我们我要访问的那些服务，哪一些服务变成不可用了，我要移除`LB`。

所以，这里，我们需要利用 consul 的[watch 机制](https://www.consul.io/docs/agent/watches.html)。

Consul 有两种 Watch 的方式

- script （触发 client 端本地的脚本）
- http (触发远端的 url，类似钩子的行为)

这里，我们选择 http 的方式。

#### Watch 的类型

- [key](https://www.consul.io/docs/agent/watches.html#key) - Watch a specific KV pair
- [keyprefix](https://www.consul.io/docs/agent/watches.html#keyprefix) - Watch a prefix in the KV store
- [services](https://www.consul.io/docs/agent/watches.html#services) - Watch the list of available services
- [nodes](https://www.consul.io/docs/agent/watches.html#nodes) - Watch the list of nodes
- [service](https://www.consul.io/docs/agent/watches.html#service)- Watch the instances of a service
- [checks](https://www.consul.io/docs/agent/watches.html#checks) - Watch the value of health checks
- [event](https://www.consul.io/docs/agent/watches.html#event) - Watch for custom user events

 这里，我们需要 watch 的是`service`，因为我们需要动态的去更新我们自身的`LB`。

```
{
  "type": "service",
  "service": "redis",
  "handler_type": "http",
  "http_handler_config": {
    "path":"https://localhost:8000/callBackWatch",
    "method": "POST",
    "header": {"x-foo":["bar", "baz"]},
    "timeout": "10s",
    "tls_skip_verify": false
  }
}
```

这里，我们提供了一个`callBackWatch`的服务用于接手 consul 的 watch 到 service 变化的 payload，用于更新我们自己的`LB` 内容。

### 常规部署架构图

![图8](/images/服务注册和发现/consul/图8.png)

首先需要有一个正常的 Consul 集群，有 Server，有 Leader。这里在服务器 Server1、Server2、Server3 上分别部署了 Consul Server，假设他们选举了 Server2 上的 Consul Server 节点为 Leader。这些服务器上最好只部署 Consul 程序，以尽量维护 Consul Server 的稳定。

然后在服务器 Server4 和 Server5 上通过 Consul Client 分别注册 Service A、B、C，这里每个 Service 分别部署在了两个服务器上，这样可以避免 Service 的单点问题。服务注册到 Consul 可以通过 HTTP API（8500 端口）的方式，也可以通过 Consul 配置文件的方式。Consul Client 可以认为是无状态的，它将注册信息通过 RPC 转发到 Consul Server，服务信息保存在 Server 的各个节点中，并且通过 Raft 实现了强一致性。

最后在服务器 Server6 中 Program D 需要访问 Service B，这时候 Program D 首先访问本机 Consul Client 提供的 HTTP API，本机 Client 会将请求转发到 Consul Server，Consul Server 查询到 Service B 当前的信息返回，最终 Program D 拿到了 Service B 的所有部署的 IP 和端口，然后就可以选择 Service B 的其中一个部署并向其发起请求了。如果服务发现采用的是 DNS 方式，则 Program D 中直接使用 Service B 的服务发现域名，域名解析请求首先到达本机 DNS 代理，然后转发到本机 Consul Client，本机 Client 会将请求转发到 Consul Server，Consul Server 查询到 Service B 当前的信息返回，最终 Program D 拿到了 Service B 的某个部署的 IP 和端口。

### 部署架构

官方推荐的是那个主机都安装一个 clinet，这个是十分不科学的做法，如果你实在不想在每个主机部署 Consul Client，还有一个多路注册的方案可供选择。

![图7](/images/服务注册和发现/consul/图7.png)

如图所示，在专门的服务器上部署 Consul Client，然后每个服务都注册到多个 Client，这里为了避免服务单点问题还是每个服务部署多份，需要服务发现时，程序向一个提供负载均衡的程序发起请求，该程序将请求转发到某个 Consul Client。这种方案需要注意将 Consul 的 8500 端口绑定到私网 IP 上，默认只有 127.0.0.1。

#### 这个架构的优势：

- Consul 节点服务器与应用服务器隔离，互相干扰少；
- 不用每台主机都部署 Consul，方便 Consul 的集中管理；
- 某个 Consul Client 挂掉的情况下，注册到其上的服务仍有机会被访问到；

#### 但也需要注意其缺点：

- 引入更多技术栈：负载均衡的实现，不仅要考虑 Consul Client 的负载均衡，还要考虑负载均衡本身的单点问题。
- Client 的节点数量：单个 Client 如果注册的服务太多，负载较重，需要有个算法（比如 hash 一致）合理分配每个 Client 上的服务数量，以及确定 Client 的总体数量。
- 服务发现要过滤掉重复的注册，因为注册到了多个节点会认为是多个部署（DNS 接口不会有这个问题）。

这个方案其实还可以优化，服务发现使用的负载均衡可以直接代理 Server 节点，因为相关请求还是会转发到 Server 节点，不如直接就发到 Server。

### Consul 的健康检查

Consul 做服务发现是专业的，健康检查是其中一项必不可少的功能，其提供 Script/TCP/HTTP+Interval，以及 TTL 等多种方式。服务的健康检查由服务注册到的 Agent 来处理，这个 Agent 既可以是 Client 也可以是 Server。

很多同学都使用 ZooKeeper 或者 etcd 做服务发现，使用 Consul 时发现节点挂掉后服务的状态变为不可用了，所以有同学问服务为什么不在各个节点之间同步？这个根本原因是服务发现的实现原理不同。

#### Consul 与 ZooKeeper、etcd 的区别

后边这两个工具是通过键值存储来实现服务的注册与发现。

- ZooKeeper 利用临时节点的机制，业务服务启动时创建临时节点，节点在服务就在，节点不存在服务就不存在。
- etcd 利用 TTL 机制，业务服务启动时创建键值对，定时更新 ttl，ttl 过期则服务不可用。

ZooKeeper 和 etcd 的键值存储都是强一致性的，也就是说键值对会自动同步到多个节点，只要在某个节点上存在就可以认为对应的业务服务是可用的。

Consul 的数据同步也是强一致性的，服务的注册信息会在 Server 节点之间同步，相比 ZK、etcd，服务的信息还是持久化保存的，即使服务部署不可用了，仍旧可以查询到这个服务部署。但是业务服务的可用状态是由注册到的 Agent 来维护的，Agent 如果不能正常工作了，则无法确定服务的真实状态，并且 Consul 是相当稳定了，Agent 挂掉的情况下大概率服务器的状态也可能是不好的，此时屏蔽掉此节点上的服务是合理的。Consul 也确实是这样设计的，DNS 接口会自动屏蔽挂掉节点上的服务，HTTP API 也认为挂掉节点上的服务不是 passing 的。

鉴于 Consul 健康检查的这种机制，同时避免单点故障，所有的业务服务应该部署多份，并注册到不同的 Consul 节点。部署多份可能会给你的设计带来一些挑战，因为调用方同时访问多个服务实例可能会由于会话不共享导致状态不一致，这个有许多成熟的解决方案，可以去查询，这里不做说明。

#### 健康检查能不能支持故障转移？

上边提到健康检查是由服务注册到的 Agent 来处理的，那么如果这个 Agent 挂掉了，会不会有别的 Agent 来接管健康检查呢？答案是否定的。

从问题产生的原因来看，在应用于生产环境之前，肯定需要对各种场景进行测试，没有问题才会上线，所以显而易见的问题可以屏蔽掉；如果是新版本 Consul 的 BUG 导致的，此时需要降级；如果这个 BUG 是偶发的，那么只需要将 Consul 重新拉起来就可以了，这样比较简单；如果是硬件、网络或者操作系统故障，那么节点上服务的可用性也很难保障，不需要别的 Agent 接管健康检查。

从实现上看，选择哪个节点是个问题，这需要实时或准实时同步各个节点的负载状态，而且由于业务服务运行状态多变，即使当时选择出了负载比较轻松的节点，无法保证某个时段任务又变得繁重，可能造成新的更大范围的崩溃。如果原来的节点还要启动起来，那么接管的健康检查是否还要撤销，如果要，需要记录服务们最初注册的节点，然后有一个监听机制来触发，如果不要，通过服务发现就会获取到很多冗余的信息，并且随着时间推移，这种数据会越来越多，系统变的无序。

从实际应用看，节点上的服务可能既要被发现，又要发现别的服务，如果节点挂掉了，仅提供被发现的功能实际上服务还是不可用的。当然发现别的服务也可以不使用本机节点，可以通过访问一个 Nginx 实现的若干 Consul 节点的负载均衡来实现，这无疑又引入了新的技术栈。

如果不是上边提到的问题，或者你可以通过一些方式解决这些问题，健康检查接管的实现也必然是比较复杂的，因为分布式系统的状态同步是比较复杂的。同时不要忘了服务部署了多份，挂掉一个不应该影响系统的快速恢复，所以没必要去做这个接管。
