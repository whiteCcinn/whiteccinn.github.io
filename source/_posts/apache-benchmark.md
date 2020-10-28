---
title: apache-benchmark
date: 2017-01-12 14:38:06
categories: 测试
tags: [测试工具,Linux,压力测试,性能测试]
---

## 简介

Apache Benchmark 其实就是我们平时所熟称的abtest，即ab压力测试，它是apache自带的一个很好用的压力测试工具，当安装完apache的时候，就可以在bin下面找到ab。

但是如果我们用的http代理是nginx的时候就需要手动下载这个工具了。接下来就和大家讲讲abtest。

------------

<!-- more -->


## 安装

centos 7下安装ab，只需要一个命令就好了

`yum install httpd-tools`

------------


## 使用

`ab www.baidu.com/`

> 注意压力测试是测试某个目录的，后尾要加上`/`

这就是ab最简单的测试命令，这一命令显示了百度页面的相关数据。

```
This is ApacheBench, Version 2.3 <$Revision: 1430300 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking www.baidu.com (be patient).....done


Server Software:        BWS/1.1
Server Hostname:        www.baidu.com
Server Port:            80

Document Path:          /
Document Length:        102126 bytes

Concurrency Level:      1
Time taken for tests:   0.028 seconds
Complete requests:      1
Failed requests:        0
Write errors:           0
Total transferred:      103076 bytes
HTML transferred:       102126 bytes
Requests per second:    36.01 [#/sec] (mean)
Time per request:       27.773 [ms] (mean)
Time per request:       27.773 [ms] (mean, across all concurrent requests)
Transfer rate:          3624.39 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        8    8   0.0      8       8
Processing:    20   20   0.0     20      20
Waiting:       12   12   0.0     12      12
Total:         28   28   0.0     28      28

```

上边的数据中，**HTML transferred**，**Requests per second**，**Time per request**是我们需要重点关注的，根据这些数据，我们能大概了解Web服务器的性能水平。

### 相关字段说明

| 字段                | 说明                                     |
| ------------------- | ---------------------------------------- |
| Server Software     | 服务器系统                               |
| Server Hostname     | 服务器域名                               |
| Server Port         | 服务器端口                               |
| Document Path       | 访问的路径                               |
| Document Length     | 访问的文件大小                           |
| Concurrency Level   | 并发请求数，可以理解为同一时间的访问人数 |
| Time taken fortests | 响应时间                                 |
| Complete requests   | 总共响应次数                             |
| Failed requests     | 失败的请求次数                           |
| Write errors        | 失败的写入次数                           |
| Total transferred   | 传输的总数据量                           |
| HTML transferred    | HTML页面大小                             |
| Requests per second | 每秒支持多少人访问                       |
| Time per request    | 满足一个请求花费的总时间                 |
| Time per request    | 满足所有并发请求中的一个请求花费的总时间 |
| Transfer rate       | 平均每秒收到的字节                       |



最后的数据包括 Connect , Processing , Waiting , Total 字段。这些数据能大致说明测试过程中所需要的时间。其实我们可以只看Total字段中的min，max两列数据值，这两个值分别显示了测试过程中，花费时间最短和最长的时间。

### 可选参数

ab命令还有很多可选参数，但常用的其实就下边几个：

| 参数 | 功能解释                              |
| ---- | ------------------------------------- |
| -n   | 设置ab命令模拟请求的总次数            |
| -c   | 设置ab命令模拟请求的并发数            |
| -t   | 设置ab命令模拟请求的时间              |
| -k   | 设置ab命令允许1个http会话响应多个请求 |



这三个参数的用法如下：

1）使用ab命令加上"-n"参数模拟1个用户访问百度总共5次

```
ab -n 5 www.baidu.com/
```

2）使用ab命令加上"-n"与"-c"参数模拟5个用户同时访问百度总共9次

```
ab -c 5 -n 9 www.baidu.com/
```


3）使用ab命令加上"-c"与"-t"参数模拟5个用户同时访问百度总共9秒

```
ab -c 5 -t 9 www.baidu.com/
```

3）使用ab命令加上"-c"与"-t"附加"-k"参数模拟5个用户同时访问百度总共9秒,百度会打开5个并发连接，从而减少web服务器创建新链接所花费的时间。

```
ab -c 5 -t 9 -k www.baidu.com/
```

使用ab命令的时候，有几点点要说明：

1）ab命令必须指定要访问的文件，如果没指定，那必须得在域名的结尾加上一个反斜杠，例如
```
ab www.baidu.com
```

得改写为

```
ab www.baidu.com/
```

2）ab命令可能会由于目标web服务器做了相应的过滤处理，导致在某些情况下收不到任何数据，这个时候可以使用"-H"参数，来模拟成浏览器发送请求。例如：

模拟成Chrome浏览器向百度发送1个请求
```
ab -H "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-Us) AppleWeb Kit/534.2 (KHTML, like Gecko) Chrome/6.0.447.0 Safari/534.2" www.baidu.com/
```
3）最后，要注意的就是，在使用ab命令测试服务器时，千万要小心，并且要限制对服务器发出的请求数量，磨途歌希望大家理性使用这些压力测试工具，我们都不希望任何一台正常的服务器陷入不必要的麻烦。

更多的可选参数如下：

| 更多参数 | 说明                                                              |
| -------- | ----------------------------------------------------------------- |
| -A       | 采用base64编码向服务器提供身份验证信息，用法: -A 用户名:密码      |
| -C       | cookie信息，用法: -C mo2g=磨途歌                                  |
| -d       | 不显示pecentiles served table                                     |
| -e       | 保存基准测试结果为csv格式的文件                                   |
| -g       | 保存基准测试结果为gunplot或TSV格式的文件                          |
| -h       | 显示ab可选参数列表                                                |
| -H       | 采用字段值的方式发送头信息和请求                                  |
| -i       | 发送HEAD请求，默认发送GET请求                                     |
| -p       | 通过POST发送数据，用法： -p blog=博客&name=白菜                   |
| -h       | 显示ab可选参数列表                                                |
| -q       | 执行多余100个请求时隐藏掉进度输出                                 |
| -s       | 使用Https协议发送请求，默认使用Http                               |
| -S       | 隐藏中位数和标准偏差值                                            |
| -v       | -v 2 及以上将打印警告和信息，-v 3 打印http响应码，-v 4 打印头信息 |
| -V       | 显示ab工具的版本号                                                |
| -w       | 采用HTML表格打印结果                                              |
| -x       | HTML标签属性，使用 -w 参数时，将放置在`<table>`标签中             |
| -X       | 设置代理服务器，用法 -X 192.168.1.1:80                            |
| -y       | HTML标签属性，使用 -w 参数时，将放置在`<tr>`标签中                |
| -z       | HTML标签属性，使用 -w 参数时，将放置在`<td>`标签中                |


------------