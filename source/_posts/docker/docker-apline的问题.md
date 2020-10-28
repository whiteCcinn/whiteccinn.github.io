---
title: 【Docker】docker-apline的问题
date: 2020-06-18 20:28:30
categories: [Docker]
tags: [Docker]
---

## 前言

今天领导发现了一个docker的问题，他在用apline作为基础镜像的时候，在公司的服务器上无法`ping baidu.com`

但是我们却是能在nslookup中解析到域名。

<!-- more -->

## 问题1. ping baidu.com

在用apline作为基础镜像的时候，发现无法ping的情况，在我翻阅了一些文献的。说到了docker-apline是以`8.8.8.8`Google的dns服务作为默认网关。

又由于我国具有“墙”的特性，所以我们需要指定国内的dns服务器，例如`114.114.114.114`，但是这些并不能解决我们的问题。

又有一些网友说是因为我们自己的dns网关服务不正常导致的，但是确实我们的dns服务一直很正常。

基于了这些都不能解决我们问题点。基于感觉到了没有任何希望。

但是后来还是找到了一些另类的解决思路。

例如有一批人提到了`/etc/resolve.conf`的`ndots`的参数。

于是好奇的搜索了一些`ndots`相关的内容，发现这个是用于`优化dns解析速度`的参数。

## ndots

`options ndots:0` 稍微有点麻烦，我查了一些资料。如果需要查找域名是相对域名，且该域名中包含的. 的数目大于或等于 `option ndots:${n}`命令指定的数，则查询的仅是该域名。否则会依次往传入的域名后追加 search 列表（search 列表在这里没有，详见`search`）中的后缀，直到解析出ip地址，或者解析完列表中所有后缀才会停止。这里设置成 0，意思就是对于传入的相对域名，只查询该域名。

一般ndots都是5即可。最高就是15。

默认：1

```
ndots:n
	Sets a threshold for the number of dots which must appear in a name given to res_query(3) (see resolver(3)) before an initial absolute query will be made.  The default  for  n  is  1, meaning  that  if  there  are  any  dots  in a name, the name will be tried first as an absolute name before any search list elements are appended to it.  The value for this option is silently capped to 15.
```

于是抱着尝试的态度。

没有加入参数前

```shell
[root@webapp_public_S1_192.168.8.135_61618_A ~]# docker run -it --rm composer:2.0 ping baidu.com
ping: bad address 'baidu.com'
```

加入参数后

```
[root@webapp_public_S1_192.168.8.135_61618_A ~]# docker run -it --dns-opt=ndots:5 --rm composer:2.0 ping baidu.com
PING baidu.com (39.156.69.79): 56 data bytes
64 bytes from 39.156.69.79: seq=0 ttl=43 time=37.941 ms
64 bytes from 39.156.69.79: seq=1 ttl=43 time=37.891 ms
```

 神奇的一幕出现了，dns服务正常解析了。于是可以确定ndots在解决apline域名解析上有重要的作用。
