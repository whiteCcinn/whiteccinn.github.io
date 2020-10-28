---
title: 【网络协议】TCP/IP协议
date: 2019-08-06 10:43:43
categories: [网络协议]
tags: [TCP]
---

## 前言

由于最近看了 Redis5 的源码，所以对网络编程又进一步加深了了解，在这里，由于没有很系统的整理过 TCP/IP 协议相关的内容，所以写下这篇文章，以此来记录我最近学习到的内容，内容会分为以下几个方面。

- TCP/IP 协议，三次握手，四次挥手，协议细节
- 协议相关的细节，优化调整内核参数
- 模拟异常连接，优化调整内核参数
- 利用 C 语言，基于 epoll 写一个支持高并发的 TCP 聊天服务器

<!-- more -->

## TCP/IP 协议

在这里，先推荐一本书[TCP/IP 详解卷 1：协议](http://www.52im.net/topic-tcpipvol1.html?mobile=no)

TCP 头部协议，大家一定要牢记这一幅图，才能更好的理解协议，记得，协议图的看法：`从第一行开始到第二行，是连在一起读到`，切勿将协议分段读取，否则会一脸懵逼，这样子就可以看懂整个协议和字节数了。

![TCP协议](/images/网络协议/tcp-header.png)

![TCP协议-2](/images/网络协议/tcp-header-2.webp)

![TCP协议的相对完整流程图](/images/网络协议/RelativeTCP.png)

![TCP协议的相对完整流程图-2](/images/网络协议/TCP-Sequence-Diagram.png)

### tcp 标志位

#### CWR && ECN

CWR(Congestion Window Reduced) & ECN（ECN-Echo, Explicit Congestion Notification）

CWR 阻塞窗口已减少，意思是告诉对端我已经按照你的要求，进行阻塞窗口减少了，并启动阻塞算法来控制我的发包速度； ECN 显式阻塞窗口通知，意思通知发送方，我接收的报文出现了阻塞，请控制发包速度。也就是说，CWR 和 ECN 必须配合使用，CWR 是收到 ECN 的应答。此外，在 tcp 三次握手时，这两个标志表明 tcp 端是否支持 ECN。如果建立连接一方支持，则在发送的 SYN 包，将 ECN 标志置为 1，如果服务端也支持，则在 ACK 包只设置 ECN。

缘由：tcp 建立连接后，报文经过经过路由或网关等网络设备后，在路由器或网关等网络设备出现阻塞时，路由器或网关等设备设置 IP 层的某个标志表明出现阻塞，这样接收可以明确知道报文出现了阻塞。然而，需要知道阻塞进行阻塞控制的是报文发送方而非接收方。所以接收方会在 `ACK` 报文中设置 ECN 标志，同时发送方在 `ACK` 中设置 CWR 标志，表明已经收到 ECN，并进行了减少阻塞窗口操作和启用阻塞算法。

#### URG

URG(Urgent)

这就是传说中的带外数据。因为 tcp 是没有消息边界的，假如有一种情况，你已经发送了一些数据，但是此时，你要发送一些数据优先处理，就可以设置这些标志。同时如果设置了这个标志，紧急指针(报文头中, Urgent Pointer(16Bit)部分)也会设置为相应的偏移。当接受方收到 URG 数据时，不缓存在接收窗口，直接往上传给上层。具体的使用带外数据大体的方法，就是，调用 send 和 recv 是要加上 `MSG_OOB 参数`。同时接收方要处理 SIGURG 信号。使用 MSG_OOB 是需要注意：

- 紧急指针只能标示一个字节数据，所以如果发送带外数据多于一个字节，其他数据将当成是正常的数据。
- 接收端需要调用 fcntl(sockfd,F_SETOWN, getpid());，对 socket 描述符号进行宿主设置，否则无法捕获 SIGURG 信号。
- 如果设置选项 SO_OOBINLINE，那么将不能使用 MSG_OOB 参数接收的报文(调用报错)，紧急指针的字符将被正常读出来，如果需要判断是否紧急数据，则需要提前判断：`ioctl (fd,SIOCATMARK,&flag);if (flag) {read(sockfd,&ch,1)`;。

不过，据说这个带外数据在实际上，用得很少。

#### PSH

PSH（Push）

tcp 报文的流动，先是发送方塞进发送方的缓存再发送；同样接收方是先塞到接收方的缓存再投递到应用。PSH 标志的意思是，无论接收或发送方，都不用缓存报文，直接接收投递给上层应用或直接发送。PSH 标志可以提供报文发送的实时性。如果设置了 `SO_NODELAY 选项(也就是关闭 Nagle 算法)`，可以强制设置这个标志。

#### SYN && ACK && FIN && RST

1. SYN(Synchronize), ACK(Acknowledgement), FIN（Finish）和 RST(Reset) 这几个标记比较容易理解。
2. SYN, Synchronize sequence numbers。
3. ACK, Acknowledgement Number 有效，应答标记。
4. FIN,发送端结束发送。
5. RST 连接不可达。

### tcp 选项(不完全)

tcp 除了 20 字节基本数据外，后面还包括了最多 40 个字节的 tcp 的选项。tcp 选项一般存储为 kind/type(1byte) length(1byte) value 的格式式，不同的选项具体格式有所不同。这里简单罗列一些常见的 tcp 选项并做简单介绍。

#### MSS(Maximum Segment Size)

tcp 报文最大传输长读，tcp 在三次握手建立阶段，在 SYN 报文交互该值，注意的是，这个数值并非协商出来的，而是由网络设备属性得出。MSS 一个常见的值是 1460(MTU1500 - IP 头部 - TCP 头部)。

详细请查看《TCP - 窗口》这一篇文章。

#### SACK(Selective Acknowledgements)

选择 ACK，用于处理 segment 不连续的情况，这样可以减少报文重传。比如： A 向 B 发送 4 个 segment，B 收到了 1,2,4 个 segment，网络丢失了 3 这个 segment。B 收到 1,2segment 后，回应 ACK 3，表示 1,2 这两个 ACK 已经收到，同时在选项字段里面，包括 4 这个段，表示 4 这个 segment 也收到了。于是 A 就重传 3 这个 segment，不必重传 4 这个 segment。B 收到 3 这个 segment 后，直接 ACK 5，表明 3,4 都收到了。

详细请查看《TCP - 重传机制》这一篇文章。

#### WS(Window Scale)

在 tcp 头部，Window Size(16Bit)表面接收窗口大小，但是对于现代网络而言，这个值太小了。所以 tcp 通过选项来增加这个窗口的值。WS 值的范围 0 ～ 14，表示 Window Size(16Bit)数值先向左移动的位数。这样实际上窗口的大小可达 31 位。在程序网络设计时，有个 `SO_RECVBUF`，表示设置接收缓冲的大小，然而需要注意的是，`这个值和接收窗口的大小不完全相等`，但是这个数值和接收窗口存在一定的关系，在内核配置的范围内，大小比较接近。

#### TS(Timestamps)

Timestamps 在 tcp 选项中包括两个 32 位的 timestamp: `TSval(Timestamp value)`和 `TSecr(Timestamp Echo Reply)`。如果设置了 TS 这个选项，发送方发送时，将当前时间填入 TSval，接收方回应时，将发送方的 TSval 填入 TSecr 即可(注意发送或接收都有设置 TSval 和 TSecr )。TS 选项的存在有两个重要作用：

1. 一是可以更加精确计算 RTT(Round-Trip-Time)，只需要在回应报文里面用当前时间减去 TSecr 即可；
2. 二是 PAWS(Protection Against Wrapped Sequence number, 防止 sequence 回绕)

什么意思呢？比如说，发送大量的数据：0-10G，假设 segment 比较大为 1G 而且 sequence 比较小为 5G，接收端接收 1,3,4,5 数据段正常接收，收到的发送时间分别 1,3,4,5，第 2 segment 丢失了，由于 SACK，导致 2 被重传，在接收 6 时，sequence 由于回绕变成了 1，这时收到的发送时间为 6，然后又收到迷途的 2，seq 为 2，发送时间为 2，这个时间比 6 小，是不合法的，tcp 直接丢弃这个迷途的报文。

#### UTO(User Timeout)

UTO 指的是发送 SYN，收到 ACK 的超时时间，如果在 UTO 内没有收到，则认为对端已挂。 在网络程序设计的时候，为了探测对端是否存活，经常涉及心跳报文，通过 tcp 的 keepalive 和 UTO 机制也可以实现，两者的区别是，前者可以通过`心跳报文实时知道对端是否存活`，二后者只有等待下次调用发送或接收函数才可以断定： 1) `SO_KEEPALIVE` 相关选项 设置 SO_KEEPALIVE 选项，打开 keepalive 机制。 设置 `TCP_KEEPIDLE` 选项，空闲时间间隔启动 keepalive 机制，`默认为 2 小时`。 设置 `TCP_KEEPINTVL` 选项，keepalive 机制启动后，每隔多长时间发送一个 keepalive 报文。`默认为 75 秒`。 设置 `TCP_KEEPCNT` 选项，设置发送多少个 keepalive 数据包都没有正常响应，则断定对端已经崩溃。`默认为 9`。 由于 tcp 有超时重传机制，如果对于 ACK 丢失的情况，keepalive 机制将有可能失效。

### 三次握手

在这里我们老生常谈的一个东西，就是 TCP/IP 协议，基本上我们常用的链接，大多数都是基于 TCP 协议来的，那么这个协议中包含了 2 个比较重要的概念，分别上 `三次握手` 和 `四次挥手`，相信大家当了一定程度，都对这 2 个概念有所耳闻，那么这 2 个概念的流程是怎么样的呢。我们用图表示出来。

![三次握手图-1](/images/网络协议/3-way-handshake-1.png)

#### tcpdump 抓包查看 TCP 协议

这里，我们用 redis 来测试。

```
root@8152f1016ea8:/data# tcpdump -iany tcp port 6379 -S
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on any, link-type LINUX_SLL (Linux cooked), capture size 262144 bytes
06:18:05.136476 IP localhost.34698 > localhost.6379: Flags [S], seq 493310144, win 43690, options [mss 65495,sackOK,TS val 10045219 ecr 0,nop,wscale 7], length 0
06:18:05.136570 IP localhost.6379 > localhost.34698: Flags [S.], seq 3870646421, ack 493310145, win 43690, options [mss 65495,sackOK,TS val 10045219 ecr 10045219,nop,wscale 7], length 0
06:18:05.136602 IP localhost.34698 > localhost.6379: Flags [.], ack 3870646422, win 342, options [nop,nop,TS val 10045219 ecr 10045219], length 0
```

看上述情况，我们用`tcpdump` 监听了所有网卡，并且是`TCP协议`，并且 src 或者 dst 的端口为 6379 的协议，加上`-S`是为了现实绝对值，否则`tcpdump`将显示相对值，对于小白来说，绝对值比相对值更好看。对于老手来说，相对值可以排除无效的内容，简化内容，更利于查看分析。

第一次握手：

```
06:18:05.136476 IP localhost.34698 > localhost.6379: Flags [S], seq 493310144, win 43690, options [mss 65495,sackOK,TS val 10045219 ecr 0,nop,wscale 7], length 0
```

这条协议，我们看到是我们本地生成打开了一个 fd，并且监听了 34698 端口，并且这个协议是发送`SYN`协议的一条协议，代表这个协议中，`SYN 标识位`被设置为了 1，序列包被设置为了：493310144，并且滑动窗口大小为：43690，代表客户端目前最大可以接收 43690 字节的数据，options 代表 tcp 可选配置，在这里，设置了

- MSS 最大发送的数据包：65495
- sackOK：启用了 SACK 算法，
- TS 时间戳
  - val ：发送端时间 10045219
  - ecr ：接收端时间 0
- nop: 占位符，没任何选项
- wscale ：窗口因子 7

length: 数据包长度为 0

这时候客户端连接会变成：SYN-SENT 状态

第二次握手：

```
06:18:05.136570 IP localhost.6379 > localhost.34698: Flags [S.], seq 3870646421, ack 493310145, win 43690, options [mss 65495,sackOK,TS val 10045219 ecr 10045219,nop,wscale 7], length 0
```

这条协议，我们看到 redis 服务器返回给了客户端一个协议，这个协议包含了`SYN`和`ACK`，代表这个协议的`SYN`和`ACK`标志位都被设置成了 1，所以这个协议包的`seq`和`ack`是有效的，滑动窗口大小为 43690,代表服务端可以读取 43690 字节的数据，options 代表 tcp 的可选配置。

- MSS 最大发送的数据包：65495
- sackOK：启用了 SACK 算法，
- TS 时间戳
  - val ：发送端时间 10045219
  - ecr ：接收端时间 10045219
- nop: 占位符，没任何选项
- wscale ：窗口因子 7

length: 数据包长度为 0

这时候服务端连接会变成：SYN-RECEIVED 状态

第三次握手：

```
06:18:05.136602 IP localhost.34698 > localhost.6379: Flags [.], ack 3870646422, win 342, options [nop,nop,TS val 10045219 ecr 10045219], length 0
```

这条协议，我们看到，包含了`ACK`包，所以只有`ACK`的标志位被设置位了 1，代表只有`ack`这个值是有效的，客户端告诉服务端，当前窗口大小为 342，所以最大只能发送 342 字节的数据，

- op: 占位符，没任何选项
- op: 占位符，没任何选项
- TS 时间戳
  - val ：发送端时间 10045219
  - ecr ：接收端时间 10045219

length: 数据包长度为 0

到这里为止，我们的三次握手就完成了，2 者的变的状态都会变成`ESTABLISHED`，完成了我们的三次握手，接下来就可以发送数据包。

### 四次挥手

为什么我们这里是四次挥手呢，这个也是一个老生常谈的话题了，因为我们的 TCP 协议 是全双工的，不能单边的关闭其中一边。

#### tcpdump 抓包查看 TCP 协议

同样的，我们用 redis 的客户端和服务端为例子。

```
07:04:52.517203 IP localhost.6379 > localhost.34698: Flags [.], ack 493310162, win 342, options [nop,nop,TS val 10326272 ecr 10317312], length 0
07:05:07.843078 IP localhost.34698 > localhost.6379: Flags [.], ack 3870657890, win 1427, options [nop,nop,TS val 10327808 ecr 10326272], length 0
07:05:07.843136 IP localhost.6379 > localhost.34698: Flags [.], ack 493310162, win 342, options [nop,nop,TS val 10327808 ecr 10317312], length 0
07:05:23.202386 IP localhost.34698 > localhost.6379: Flags [.], ack 3870657890, win 1427, options [nop,nop,TS val 10329344 ecr 10327808], length 0
07:05:23.202425 IP localhost.6379 > localhost.34698: Flags [.], ack 493310162, win 342, options [nop,nop,TS val 10329344 ecr 10317312], length 0
07:05:38.529675 IP localhost.34698 > localhost.6379: Flags [.], ack 3870657890, win 1427, options [nop,nop,TS val 10330880 ecr 10329344], length 0
07:05:38.529706 IP localhost.6379 > localhost.34698: Flags [.], ack 493310162, win 342, options [nop,nop,TS val 10330880 ecr 10317312], length 0
07:10:26.796243 IP localhost.34698 > localhost.6379: Flags [F.], seq 493310162, ack 3870657890, win 1427, options [nop,nop,TS val 10359737 ecr 10358528], length 0
07:10:26.796488 IP localhost.6379 > localhost.34698: Flags [F.], seq 3870657890, ack 493310163, win 342, options [nop,nop,TS val 10359737 ecr 10359737], length 0
07:10:26.796519 IP localhost.34698 > localhost.6379: Flags [.], ack 3870657891, win 1427, options [nop,nop,TS val 10359737 ecr 10359737], length 0
```

在这里，我们看到了很多条消息，全部都是带有 ACK 包的，倒数第三条之前的，都是常规的 ACK 包，也可以理解为心跳包。

这里，我们让客户端接收到退出信号，用：quit 命令退出客户端。

客户端：第一次挥手：

```
07:10:26.796243 IP localhost.34698 > localhost.6379: Flags [F.], seq 493310162, ack 3870657890, win 1427, options [nop,nop,TS val 10359737 ecr 10358528], length 0
```

客户端状态变成：FIN_WAIT1

这一条消息中，我们看到里面有`FIN`和`ACK`的标志位被设置为了 1，所以代表数据包中的：`seq`和 `ack`是有效的，seq=493310162，ack=3870657890，需要注意的是，这条消息中的 ACK 包并不是为了 4 次挥手而存在的，他只是单纯的告诉服务端，我下一条消息的字节需要从序号为 3870657890 开始读起，所以这里为了四次挥手而存在的协议只有 seq。

服务端：第二和第三次挥手：

```
07:10:26.796488 IP localhost.6379 > localhost.34698: Flags [F.], seq 3870657890, ack 493310163, win 342, options [nop,nop,TS val 10359737 ecr 10359737], length 0
```

这一条消息中，我们看到里面同样有`FIN`和`ACK`的标志位被设置为了 1，所以代表数据包中的`seq`和`ack`是有效的，这个时候，我们的 seq=3870657890(ack)，ack=
(上一条消息的 seq+1)，这个时候这个 ack 包是为了四次挥手而存在的。所以这 2 个不同标志位：分别代表了第二次和第三次挥手，其中 ACK 代表第二次挥手，FIN 代表第三次挥手

这个时候，客户端会根据 ACK 包变成：FIN-WAIT-2，接着又因为接收到服务端的 FIN 包，所以会变成 TIME_WAIT 状态，服务端发送了 ACK 包变成：CLOSE-WAIT 状态，等待客户端 ACK 最后一次握手消息。

客户端：第四次挥手：

```
07:10:26.796519 IP localhost.34698 > localhost.6379: Flags [.], ack 3870657891, win 1427, options [nop,nop,TS val 10359737 ecr 10359737], length 0
```

这里客户端发送了一条 ack 包，ack=(上一条消息的 seq+1)，所以服务端会在这里断开链接，变成完全关闭状态（CLOSED）。

### 疑问

#### 为什么建立连接协议是三次握手，而关闭连接却是四次握手呢？

这是因为服务端的 LISTEN 状态下的 SOCKET 当收到 SYN 报文的建连请求后，它可以把 ACK 和 SYN（ACK 起应答作用，而 SYN 起同步作用）放在`一个报文`里来发送。但关闭连接时，当收到对方的 FIN 报文通知时，它仅仅表示对方没有数据发送给你了；但未必你所有的数据都全部发送给对方了，所以你可能未必会马上会关闭 SOCKET,也即你可能还需要发送一些数据给对方之后，再发送 FIN 报文给对方来表示你同意现在可以关闭连接了，所以它这里的 ACK 报文和 FIN 报文`多数情况下`都是分开发送的。

#### 为什么 TIME_WAIT 状态还需要等 2MSL 后才能返回到 CLOSED 状态

这是因为虽然双方都同意关闭连接了，而且握手的 4 个报文也都协调和发送完毕，按理可以直接回到 CLOSED 状态（就好比从 SYN_SEND 状态到 ESTABLISH 状态那样）：

一方面是可靠的实现 TCP 全双工连接的终止，也就是当最后的 ACK 丢失后，被动关闭端会重发 FIN，因此主动关闭端需要维持状态信息，以允许它重新发送最终的 ACK。

另一方面，但是因为我们必须要假想网络是不可靠的，你无法保证你最后发送的 ACK 报文会一定被对方收到，因此对方处于 LAST_ACK 状态下的 SOCKET 可能会因为超时未收到 ACK 报文，而重发 FIN 报文，所以这个 TIME_WAIT 状态的作用就是用来重发可能丢失的 ACK 报文。

TCP 在 2MSL 等待期间，定义这个连接(4 元组)不能再使用，任何迟到的报文都会丢弃。设想如果没有 2MSL 的限制，恰好新到的连接正好满足原先的 4 元组，这时候连接就可能接收到网络上的延迟报文就可能干扰最新建立的连接。

### TCP 整个生命周期的流程图：

![TCP流程图-1](/images/网络协议/tcp-flow-1.png)

### TCP 整个生命周期的状态图：

![TCP状态图](/images/网络协议/Tcp_state_diagram.png)

对于状态图，可能大家对这个图第一眼是蒙蔽的，在这里，我们叙述一下流程。

我们的`Client`或者 `Server`都是从 `CLOSE`状态启动的，Server 启动之后，就是到了`LISTEN`状态，Client 启动之后，就是连接，也就是三次握手的过程，第一步就是发送 `SYN` 数据包，Clinet 变成了 `SYN SENT`状态（这是三次握手的第一步），

## 影响 TCP 连接的内核参数

影响 TCP 连接的内核参数可以通过一下命令来查看

```
sysctl -a | grep tcp
net.ipv4.tcp_base_mss = 1024
net.ipv4.tcp_ecn = 2
net.ipv4.tcp_ecn_fallback = 1
net.ipv4.tcp_fin_timeout = 60
net.ipv4.tcp_fwmark_accept = 0
net.ipv4.tcp_keepalive_intvl = 75
net.ipv4.tcp_keepalive_probes = 9
net.ipv4.tcp_keepalive_time = 7200
net.ipv4.tcp_l3mdev_accept = 0
net.ipv4.tcp_mtu_probing = 0
net.ipv4.tcp_notsent_lowat = 4294967295
net.ipv4.tcp_orphan_retries = 0
net.ipv4.tcp_probe_interval = 600
net.ipv4.tcp_probe_threshold = 8
net.ipv4.tcp_reordering = 3
net.ipv4.tcp_retries1 = 3
net.ipv4.tcp_retries2 = 15
net.ipv4.tcp_syn_retries = 6
net.ipv4.tcp_synack_retries = 5
net.ipv4.tcp_syncookies = 1
net.ipv4.vs.secure_tcp = 0
net.ipv4.vs.sloppy_tcp = 0
net.netfilter.nf_conntrack_tcp_be_liberal = 0
net.netfilter.nf_conntrack_tcp_loose = 1
net.netfilter.nf_conntrack_tcp_max_retrans = 3
net.netfilter.nf_conntrack_tcp_timeout_close = 10
net.netfilter.nf_conntrack_tcp_timeout_close_wait = 60
net.netfilter.nf_conntrack_tcp_timeout_established = 432000
net.netfilter.nf_conntrack_tcp_timeout_fin_wait = 120
net.netfilter.nf_conntrack_tcp_timeout_last_ack = 30
net.netfilter.nf_conntrack_tcp_timeout_max_retrans = 300
net.netfilter.nf_conntrack_tcp_timeout_syn_recv = 60
net.netfilter.nf_conntrack_tcp_timeout_syn_sent = 120
net.netfilter.nf_conntrack_tcp_timeout_time_wait = 120
net.netfilter.nf_conntrack_tcp_timeout_unacknowledged = 300
```

如果又一些参数不在上面的话，就代表这个参数并未被开启，可以手动开启。
可以通过命令直接设置，`sysctl *`，也可以操作 `vi /etc/sysctl.conf`。

写入`sysctl.conf`的参数并不会立刻生效，需要手动执行`sysctl -p`

### 发现系统存在大量 TIME_WAIT 状态的连接

```
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_tw_recycle = 1
net.ipv4.tcp_fin_timeout = 30
```

- net.ipv4.tcp_syncookies = 1 表示开启 SYN Cookies。当出现 SYN 等待队列溢出时，启用 cookies 来处理，可防范少量 SYN 攻击，默认为 0，表示关闭；
- net.ipv4.tcp_tw_reuse = 1 表示开启重用。允许将 TIME-WAIT sockets 重新用于新的 TCP 连接，默认为 0，表示关闭；
- net.ipv4.tcp_tw_recycle = 1 表示开启 TCP 连接中 TIME-WAIT sockets 的快速回收，默认为 0，表示关闭。
- net.ipv4.tcp_fin_timeout 修改系統默认的 TIMEOUT 时间

## backlog

![backlog](/images/网络协议/backlog.png)

TCP 建立连接是要进行三次握手，但是否完成三次握手后，服务器就处理（accept）呢？

backlog 其实是连接队列，`在 Linux 内核 2.2 之前`，backlog 大小包括`半连接状态`和`全连接状态`两种队列大小。

1. 半连接状态为：服务器处于 Listen 状态时收到客户端 SYN 报文时放入半连接队列中，即 SYN queue（服务器端口状态为：SYN_RCVD）。
2. 全连接状态为：TCP 的连接状态从服务器（SYN+ACK）响应客户端后，到客户端的 ACK 报文到达服务器之前，则一直保留在半连接状态中；当服务器接收到客户端的 ACK 报文后，该条目将从半连接队列搬到全连接队列尾部，即 accept queue （服务器端口状态为：ESTABLISHED）。

`在 Linux 内核 2.2 之后`，分离为`两个 backlog` 来分别限制`半连接（SYN_RCVD 状态）队列大小`和`全连接（ESTABLISHED 状态）队列大小`。

当`应用程序调用 listen 系统调用`让一个 socket 进入 `LISTEN` 状态时，需要指定一个参数：`backlog`。这个参数经常被描述为，`新连接队列的长度限制`。

由于 TCP 建立连接需要进行 3 次握手，一个新连接在到达 `ESTABLISHED` 状态可以被 `accept 系统调用`返回给`应用程序前`，必须经过一个`中间状态 SYN RECEIVED`。这意味着，TCP/IP 协议栈在实现 backlog 队列时，有两种不同的选择：

1. 仅使用一个队列，队列规模由 listen 系统调用 backlog 参数指定。当协议栈`收到一个 SYN 包`时，`响应 SYN/ACK 包`并且`将连接加进该队列`。当服务端相应的 ACK 响应包收到后，连接变为 `ESTABLISHED 状态`，可以向应用程序返回。这意味着队列里的连接可以有两种不同的状态：`SEND RECEIVED` 和 `ESTABLISHED`。`只有后一种连接`才能被 `accept 系统调用`返回给应用程序。
2. 使用两个队列——`SYN 队列(待完成连接队列)`和 `accept 队列(已完成连接队列)`。状态为 `SYN RECEIVED` 的连接进入 `SYN 队列`，后续当状态变更为 ESTABLISHED 时`移到 accept 队列`(即收到 3 次握手中最后一个 ACK 包)。顾名思义，accept 系统调用就只是简单地从 accept 队列消费新连接。在这种情况下，listen 系统调用 backlog 参数决定 accept 队列的最大规模。

历史上，起源于 BSD 的 TCP 实现使用第一种方法。这个方案意味着，但 backlog 限制达到，系统将停止对 SYN 包响应 SYN/ACK 包。通常，协议栈只是丢弃 SYN 包(而不是回一个 RST 包)以便客户端可以重试(而不是异常退出)。
`TCP/IP 详解 卷 3 第 14.5 节`中有提到这一点。书中作者提到，`BSD 实现虽然使用了两个独立的队列，但是行为跟使用一个队列并没什么区别`。
在 Linux 上，情况有所不同，情况 listen 系统调用 man 文档页：

```
backlog参数的行为在Linux2.2之后有所改变。
现在，它指定了等待accept系统调用的已建立连接队列的长度，而不是待完成连接请求数。
待完成连接队列长度由/proc/sys/net/ipv4/tcp_max_syn_backlog指定；
在syncookies启用的情况下，逻辑上没有最大值限制，这个设置便被忽略。
```

也就是说，当前版本的 Linux 实现了第二种方案，使用两个队列——`一个 SYN 队列`，长度`系统级别可设置`以及`一个 accept 队列`长度`由应用程序指定`。

总结一下：

Linux 内核协议栈在收到 3 次握手`最后一个 ACK 包`，确认一个新连接已完成，而 `accept 队列已满的情况下`，会忽略这个包。一开始您可能会对此感到奇怪——`别忘了 SYN RECEIVED 状态下有一个计时器实现`：如果 ACK 包没有收到(或者是我们讨论的忽略)，服务端会利用计时器, 协议栈会`重发 SYN/ACK 包`(重试次数由`/proc/sys/net/ipv4/tcp_synack_retries` 决定)。

例子：一个客户正尝试连接一个已经达到其最大 backlog 的 socket

```
0.000  127.0.0.1 -> 127.0.0.1  TCP 74 53302 > 9999 [SYN] Seq=0 Len=0
0.000  127.0.0.1 -> 127.0.0.1  TCP 74 9999 > 53302 [SYN, ACK] Seq=0 Ack=1 Len=0
0.000  127.0.0.1 -> 127.0.0.1  TCP 66 53302 > 9999 [ACK] Seq=1 Ack=1 Len=0
0.000  127.0.0.1 -> 127.0.0.1  TCP 71 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
0.207  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
0.623  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
1.199  127.0.0.1 -> 127.0.0.1  TCP 74 9999 > 53302 [SYN, ACK] Seq=0 Ack=1 Len=0
1.199  127.0.0.1 -> 127.0.0.1  TCP 66 [TCP Dup ACK 6#1] 53302 > 9999 [ACK] Seq=6 Ack=1 Len=0
1.455  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
3.123  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
3.399  127.0.0.1 -> 127.0.0.1  TCP 74 9999 > 53302 [SYN, ACK] Seq=0 Ack=1 Len=0
3.399  127.0.0.1 -> 127.0.0.1  TCP 66 [TCP Dup ACK 10#1] 53302 > 9999 [ACK] Seq=6 Ack=1 Len=0
6.459  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
7.599  127.0.0.1 -> 127.0.0.1  TCP 74 9999 > 53302 [SYN, ACK] Seq=0 Ack=1 Len=0
7.599  127.0.0.1 -> 127.0.0.1  TCP 66 [TCP Dup ACK 13#1] 53302 > 9999 [ACK] Seq=6 Ack=1 Len=0
13.131  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
15.599  127.0.0.1 -> 127.0.0.1  TCP 74 9999 > 53302 [SYN, ACK] Seq=0 Ack=1 Len=0
15.599  127.0.0.1 -> 127.0.0.1  TCP 66 [TCP Dup ACK 16#1] 53302 > 9999 [ACK] Seq=6 Ack=1 Len=0
26.491  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
31.599  127.0.0.1 -> 127.0.0.1  TCP 74 9999 > 53302 [SYN, ACK] Seq=0 Ack=1 Len=0
31.599  127.0.0.1 -> 127.0.0.1  TCP 66 [TCP Dup ACK 19#1] 53302 > 9999 [ACK] Seq=6 Ack=1 Len=0
53.179  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
106.491  127.0.0.1 -> 127.0.0.1  TCP 71 [TCP Retransmission] 53302 > 9999 [PSH, ACK] Seq=1 Ack=1 Len=5
106.491  127.0.0.1 -> 127.0.0.1  TCP 54 9999 > 53302 [RST] Seq=1 Len=0
```

由于客户端的 TCP 实现在`收到多个 SYN/ACK 包时`，`认为 ACK 包已经丢失了并且重传它`。如果在 SYN/ACK 重试次数达到限制前，服务端应用从 accept 队列接收连接，使得 backlog 减少，那么协议栈会处理这些重传的 ACK 包，将连接状态从 SYN RECEIVED 变更到 ESTABLISHED 并且将其加入 accept 队列。`否则，正如以上包跟踪所示，客户读会收到一个 RST 包宣告连接失败`。

在客户端看来，`第一次收到 SYN/ACK 包之后，连接就会进入 ESTABLISHED 状态`。如果这时客户端首先开始发送数据，那么数据也会被重传。`好在 TCP 有慢启动机制，在服务端还没进入 ESTABLISHED 之前，客户端能发送的数据非常有限。`

相反，如果客户端一开始就在等待服务端，而服务端 backlog 没能减少，那么最后的结果是连接在客户端看来是 ESTABLISHED 状态，但在服务端看来是 CLOSED 状态。这也就是所谓的`半开连接`。

`SYN queue` 队列长度由其中一个参数指定，默认为 2048

```
/proc/sys/net/ipv4/tcp_max_syn_backlog
```

`Accept queue` 队列长度由 `/proc/sys/net/core/somaxconn` 和`使用 listen 函数时传入的参数`，`二者取最小值`。`默认为 128`。在 Linux 内核 2.4.25 之前，是写死在代码常量 SOMAXCONN ，在 Linux 内核 2.4.25 之后，在配置文件 `/proc/sys/net/core/somaxconn` 中直接修改，或者在 `/etc/sysctl.conf` 中配置 `net.core.somaxconn = 128` 。

```
/proc/sys/net/core/somaxconn
```

```
[root@localhost ~]# ss -l
State       Recv-Q Send-Q                                     Local Address:Port                                         Peer Address:Port
LISTEN      0      128                                                    *:http                                                    *:*
LISTEN      0      128                                                   :::ssh                                                    :::*
LISTEN      0      128                                                    *:ssh                                                     *:*
LISTEN      0      100                                                  ::1:smtp                                                   :::*
LISTEN      0      100                                            127.0.0.1:smtp                                                    *:*
```

在 LISTEN 状态，其中 Send-Q 即为 Accept queue 的最大值，Recv-Q 则表示 Accept queue 中等待被服务器 accept()。

另外客户端 connect()返回不代表 TCP 连接建立成功，有可能此时 `accept queue 已满`，系统会直接丢弃后续 ACK 请求；客户端误以为连接已建立，开始调用等待至超时；服务器则等待 ACK 超时，`会重传 SYN+ACK 给客户端`，重传次数受限 `net.ipv4.tcp_synack_retries` ，默认为 5，表示重发 5 次，每次等待 30~40 秒，即半连接默认时间大约为 180 秒，该参数可以在 tcp 被洪水攻击是临时启用这个参数。

## keepalive

其实 keepalive 的原理就是 TCP 内嵌的一个心跳包。

`以服务器端为例`，如果当前 server 端检测到超过一定时间（默认是 7,200,000 milliseconds，也就是 `2 个小时`）`没有数据传输`，那么会`向 client 端`发送一个 keep-alive packet（该 keep-alive packet 就是 ACK 和当前 TCP 序列号减一的组合），此时 client 端应该为以下三种情况之一：

1.  client 端仍然存在，网络连接状况良好。此时 client 端会返回一个 ACK。server 端接收到 ACK 后重置计时器（复位存活定时器），在 2 小时后再发送探测。如果 2 小时内连接上有数据传输，那么在该时间基础上向后推延 2 个小时。
2.  客户端异常关闭，或是网络断开。在这两种情况下，client 端都不会响应。服务器没有收到对其发出探测的响应，并且在一定时间（系统默认为 1000 ms）后重复发送 keep-alive packet，并且重复发送一定次数（2000 XP 2003 系统默认为 5 次, Vista 后的系统默认为 10 次）。
3.  客户端曾经崩溃，但已经重启。这种情况下，服务器将会收到对其存活探测的响应，但该响应是一个复位，从而引起服务器对连接的终止。

对于应用程序来说，2 小时的空闲时间太长。因此，我们需要手工开启 Keepalive 功能并设置合理的 Keepalive 参数。

全局设置可更改/etc/sysctl.conf,加上:

```
net.ipv4.tcp_keepalive_intvl = 20
net.ipv4.tcp_keepalive_probes = 3
net.ipv4.tcp_keepalive_time = 60
```

在程序中设置如下:

```c
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/types.h>
#include <netinet/tcp.h>

// 注意我这里故意用心跳包和探测包来区分，心跳包是正常心跳包，探测包是心跳包发送失败，或者接收返回的ack失败之后，发送的异常心跳包
int keepAlive = 1; // 开启keepalive属性
int keepIdle = 60; // 每次心跳包发送的时间间隔
int keepInterval = 5; // 每个探测包的时间间隔为5 秒
int keepCount = 3; // 探测尝试的次数.如果第1次探测包就收到响应了,则后2次的不再发，变回正常的心跳包

setsockopt(rs, SOL_SOCKET, SO_KEEPALIVE, (void *)&keepAlive, sizeof(keepAlive));
setsockopt(rs, SOL_TCP, TCP_KEEPIDLE, (void*)&keepIdle, sizeof(keepIdle));
setsockopt(rs, SOL_TCP, TCP_KEEPINTVL, (void *)&keepInterval, sizeof(keepInterval));
setsockopt(rs, SOL_TCP, TCP_KEEPCNT, (void *)&keepCount, sizeof(keepCount));
```

在程序中表现为,当 tcp 检测到对端 socket 不再可用时(不能发出探测包,或探测包没有收到 ACK 的响应包),select 会返回 socket 可读,并且在 recv 时返回-1,同时置上 errno 为 ETIMEDOUT.

## 模拟异常连接

## 基于 Epoll 的聊天服务器
