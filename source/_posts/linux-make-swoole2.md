---
title: Centos7安装swoole2.x协程系列
date: 2017-09-08 10:47:00
categories: [Linux, PHP]
tags: [Linux, PHP, Swoole]
---

## 说明

对于一个合格的 php 后端开发者而言，`swoole` 的知名度，估计是大家都知道的，swoole 分为 2 个系列，一个是`1.9.x`系列，一个是`2.x`系列，两个系列的区别在于`1.9`系列是原 swoole 成员研发的主分支，`2.x`系列是由腾讯成员研发的副分支。`1.9.x`系列底层原生不支持`协程`的概念，跟着 php 原生态走，但是`2.x`底层采用的是`协程`的概念进行研发，基本上需要用到网络 io 的地方在特定的情况下都会去触发`协程`，记住当前的`VM stack`的信息，然后通过`Eventloop`事件去处理别的请求，形成一个相对于原生态的阻塞的执行过程来说，这种非阻塞的处理方式，把 1+2 = 3 的 IO 时间变成了 max(1,2) =2。从而在高并发的请求下，可以更好的承载更多的请求。

之前我有过一篇文章说的就是安装 v2.0.5 的。但是现在重新装一次，说明一下。

## 下载 git

```
git clone -b v.2.0.9 https://github.com/swoole/swoole-src.git
```

<!-- more -->

进入目录

```
cd swoole-src
```

利用 phpize 提取出编译文件

```
phpize
```

开始编译，注意需要开启几项必须的东西

```
./configure --enable-coroutine --enable-openssl
```

这里我需要开启写协程和 ssl 证书

然后编译完毕之后。

添加到 php.ini 里面即可。

开启 swoole 高性能开发之旅

记住检查 swoole 是否安装了

```
php -m | grep swoole
```

查看 swoole 版本

```
php --ri swoole
```

## 异步 redis 编译添加

```
--enable-async-redis
```

需要安装依赖一个官方的 hredis 的动态 so 库

hiredis 下载地址：https://github.com/redis/hiredis/releases

安装完毕之后,如果 swoole 编译完成，之后，如果出现了如下问题，可以手动 ldconfig，添加搜索动态库目录

`libhiredis.so.0.13: cannot open shared object file: No such file or directory in Unknown on line 0，`

```
1. vim /etc/ld.so.conf
2. 添加 /usr/local/lib
3. sudo ldconfig
```

然后再重新编译

```
make clean
// make && make install
```
