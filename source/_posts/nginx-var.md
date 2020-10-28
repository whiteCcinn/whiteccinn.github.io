---
title: 【Nginx】 - 变量
date: 2018-02-23 10:26:00
categories: [Nginx]
tags: [Nginx]
---

# 说明

Nginx配置文件管理者整个nginx服务的运作，有一些逻辑我们可以通过nginx内置变量或者自定义变量来选择性配置。

## 内置常见变量参见下表：

| 名称             | 说明                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| $arg_name        | 请求中的name参数                                                            |
| $args            | 请求中的参数                                                                |
| $content_length  | HTTP请求里面的"Content-Length"                                              |
| $content_type    | HTTP请求里面的"Content-Type"                                                |
| $document_root   | 配置里面设置的 `root` 赋值                                                  |
| $host            | 请求信息种的"HOST",如果请求头不存在`Host`的话，那么久等于`server_name` 赋值 |
| $http_cookie     | cookie信息                                                                  |
| $http_referer    | 引用地址，就是前一个链接地址                                                |
| $http_user_agent | 客户端代理信息                                                              |
| $is_args         | 如果请求行带有参数，返回“？”，否则返回空字符串                            |
| $limit_rate      | 当前连接速率的限制                                                          |
| $pid             | nginx当前worker进程的PID                                                    |
| $query_string    | 与$args基本一致                                                             |
| $remote_addr     | 客户端IP地址                                                                |
| $remote_port     | 客户端端口号                                                                |
| $scheme          | 当前所用的协议，比如http或者https                                           |
| $request_method  | 请求方法，比如“GET”，“POST”等                                           |
| $request_uri     | 请求的URI，带参数，比如：`http://localhost:8080/uuu`                        |

<!-- more -->
##  自定义变量

可以使用`set`关键字来设置，例如

set $name caiwh

在对应的结构体之内就用`$name`来代表caiwh了