---
title: linux-make-tcpdump
date: 2017-08-22 18:06:24
categories: [协议, 网络, Linux]
tags: [协议, 网络, Linux, TcpDump]
---

# 说明

TCPDUMP 可以帮写我们抓包，相当于 window 下的`wireshark`，为了我们更好的深入分析，我们把 tcpdump 也安装了。

# 下载

- [tcpdump-国内镜像](http://www.tcpdump.org/#latest-releases)

找到最新版,安装 tcpdump 需要把 libpcap 也安装了.

## 安装 libpcap

下载

```
cd /usr/local/src && sudo mkdir libpcap && sudo wget http://www.tcpdump.org/release/libpcap-1.8.1.tar.gz && sudo tar -zxvf && sudo tar -zxvf libpcap-1.8.1.tar.gz && cd libpcap-1.8.1
```

<!-- more -->

编译  

```
sudo ./configure
```

发现告诉我们需要安装 flex

我的 yum 仓库没有 flex，所以就需要去找了。找了几个地方之后，发现只有 github 有最新的版本了。

```
git clone https://github.com/westes/flex.git
```

进入到 flex 目录

安装 flex

```
sudo ./autogen.sh
```

发现又有安装依赖了，说我没有 libtoolize

好的，我又要去找了

给大家介绍一个国内 gun 库

- [国内 GUN 库](http://ftp.gnu.org/gnu/)

基本所有 GUN 库都可以在这里找到相关的信息

找到 libtoolize

```
sudo mkdir -p /usr/local/src/libtoolize && sudo wget http://ftp.gnu.org/gnu/libtool/libtool-2.4.tar.gz && cd /usr/local/src/libtoolize/libtool-2.4
```
