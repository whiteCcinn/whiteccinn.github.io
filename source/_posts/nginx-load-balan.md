---
title: 【Nginx】- 负载均衡
date: 2018-02-23 11:22:00
categories: [Nginx]
tags: [Nginx]
---

# 说明

在现在互联网爆发的时代，稳定性成为每个项目的首选，再次条件下，我们就要实现高可用的概念，实现高可用的最常用的一种手段就是负载均衡，分摊各个服务器的请求压力。

## 1.轮训（默认）

按照请求时间的循序，把请求逐一分配到对应的服务器。如果其中一台服务器 down 了，nginx 会自动剔除 down 掉的服务器。

```
upstream backserver {
    server 192.168.0.14;
    server 192.168.0.15;
}
```

## 2.权重(weight)

其实就是轮训的升级版，给特定的服务器一个指定的权重，nginx 会根据权重分配请求访问。一般用于服务器性能不一致的情况下。

```
upstream backserver {
    server 192.168.0.14 weight=3;
    server 192.168.0.15 weight=7;
}
```

<!-- more -->

权重越高，访问的概率越大，分别是 30%,70%。

## 3. IP 哈希化（ip_hash）

通过 ip 哈希化，可以让同一 ip 的请求分配到同一台机器上。

```
upstream backserver {
    ip_hash;
    server 192.168.0.14:88;
    server 192.168.0.15:80;
}
```

这个做法的好处是可以保证在负载均衡的情况下，用户的 session 信息都保存在一台机器上，不会因为负载均衡导致用户 session 信息丢失。

## 4. fair（fair 模块，需要为 nginx 安装扩展）

按后端服务器的响应时间来分配请求，响应时间短的优先分配。

```
upstream backserver {
    server server1;
    server server2;
    fair;
}
```

这种方式有点类似于 epoll 方式。

## 特别说明

```
server 127.0.0.1:9090 down; (down 表示单前的server暂时不参与负载)

server 127.0.0.1:8080 weight=2; (weight 默认为1.weight越大，负载的权重就越大)

server 127.0.0.1:6060;

server 127.0.0.1:7070 backup; (其它所有的非backup机器down或者忙的时候，请求backup机器)
```
