---
title: 【OpenResty】 带你入门高性能http代理服务器应用
date: 2018-07-08 00:23:00
categories: [Nginx]
tags: [Nginx, Openresty]
---

## 前言

OpenResty® 是一个基于 Nginx 与 Lua 的高性能 Web 平台，其内部集成了大量精良的 Lua 库、第三方模块以及大多数的依赖项。用于方便地搭建能够处理超高并发、扩展性极高的动态 Web 应用、Web 服务和动态网关。

OpenResty® 通过汇聚各种设计精良的 Nginx 模块（主要由 OpenResty 团队自主开发），从而将 Nginx 有效地变成一个强大的通用 Web 应用平台。这样，Web 开发人员和系统工程师可以使用 Lua 脚本语言调动 Nginx 支持的各种 C 以及 Lua 模块，快速构造出足以胜任 10K 乃至 1000K 以上单机并发连接的高性能 Web 应用系统。

OpenResty® 的目标是让你的 Web 服务直接跑在 Nginx 服务内部，充分利用 Nginx 的非阻塞 I/O 模型，不仅仅对 HTTP 客户端请求,甚至于对远程后端诸如 MySQL、PostgreSQL、Memcached 以及 Redis 等都进行一致的高性能响应。

> 以上都是官方说辞

<!-- more -->

## 实践

这里我使用都 mac 系统都 brew 安装都 openresty，类似于 centos 下都 yum 安装。默认都情况下，openresty 已经帮忙安装好了 luajit（lua 解析器），和 MySQL、PostgreSQL、Memcached 以及 Redis 等扩展的 lua 文件，具体如下。

```
├── cjson.so
├── ngx
│   ├── balancer.lua
│   ├── base64.lua
│   ├── errlog.lua
│   ├── ocsp.lua
│   ├── process.lua
│   ├── re.lua
│   ├── resp.lua
│   ├── semaphore.lua
│   ├── ssl
│   │   └── session.lua
│   └── ssl.lua
├── redis
│   └── parser.so
└── resty
    ├── aes.lua
    ├── core
    │   ├── base.lua
    │   ├── base64.lua
    │   ├── ctx.lua
    │   ├── exit.lua
    │   ├── hash.lua
    │   ├── misc.lua
    │   ├── phase.lua
    │   ├── regex.lua
    │   ├── request.lua
    │   ├── response.lua
    │   ├── shdict.lua
    │   ├── time.lua
    │   ├── uri.lua
    │   ├── var.lua
    │   └── worker.lua
    ├── core.lua
    ├── dns
    │   └── resolver.lua
    ├── limit
    │   ├── conn.lua
    │   ├── count.lua
    │   ├── req.lua
    │   └── traffic.lua
    ├── lock.lua
    ├── lrucache
    │   └── pureffi.lua
    ├── lrucache.lua
    ├── md5.lua
    ├── memcached.lua
    ├── mysql.lua
    ├── random.lua
    ├── redis.lua
    ├── sha.lua
    ├── sha1.lua
    ├── sha224.lua
    ├── sha256.lua
    ├── sha384.lua
    ├── sha512.lua
    ├── string.lua
    ├── upload.lua
    ├── upstream
    │   └── healthcheck.lua
    └── websocket
        ├── client.lua
        ├── protocol.lua
        └── server.lua
```

我们需要做的步骤很简单。找到配置文件。

然后需要关注的主要目录只有 1 个。

- lualib ，上图中的 tree 结构就是由这个目录下显示的。

我们需要找到对应 openresty 的 nginx 启动的可执行文件。

我们进入到`bin`目录。

发现了 openrestry 这个`软连接`，指向到是我们上级目录 nginx 中到 sbin 中到 nginx 可执行文件。

我们需要找到对应到配置文件和路径。

```
./openresty -t
```

从结果中，我们找到了配置文件到路径，并且打开配置文件，进行添加部分内容。

（其实就是 nginx 到配置，只不过需要加上一些内容来加载 lua 相关的包和扩展）

在这里，我们需要加上这 2 行代码，这是 lua 的标准配置。

```
     # lua配置
     lua_package_path "/usr/local/opt/openresty/lualib/?.lua;;"; #lua 模块
     lua_package_cpath "/usr/local/opt/openresty/lualib/?.so;;"; #c模块
```

里面的路径就是刚才我们找到的`lualib`的路径，至于为什么是`;;`呢，这里代表着找的是 2 个路径，一个是默认路径，一个是指定路径。

写完之后，就可以写我们的 lua 代码了。

这里，我们设置了一个`server`段，端口设置为`8080`，需要注意的是<font color="red">charset utf-8;</font>，这个配置项务必写上，否则在你 lua 代码中输出的中文，将会乱码。

然后我们配置了 location，设置了默认的响应类型为 text/html.

`lua_code_cache off`这个也是十分重要的，在开发模式下，我们添加上这句话，我们就不必每次写完 lua 文件都重启一遍 nginx，这里如果没有 cache 都话，每次都会去由于 luajit 来从头解析一遍 lua，类似于我们 php 中都 opcache 都作用。所以，如果在生产环境中，务必设置为 on，或者删掉这句话（默认为:`lua_code_cache on`）。

接下来就是 nginx 配置中，挂载 lua 文件都一个重要语句了，那就是`content_by_lua_file`，这里我们都脚本语言 lua 就可以嵌入到 nginx 中去了。

我们来看看我写到一个和`redis`通信到一个例子。

```
 local redis = require "resty.redis"
 local red = redis:new()

 red:set_timeout(1000)

 local ok, err = red:connect("127.0.0.1", 6379)
 if not ok then
     ngx.say("failed to connect: ", err)
     return
 end

 local clientIp = ngx.req.get_headers()["X-Real-Ip"]
 if clientIP == nil then
    clientIp = ngx.req.get_headers()["x_forwarded_for"]
 end
 if clientIP == nil then
    clientIP = ngx.var.remote_addr
 end
 local incrKey = "user:"..clientIP..":freq"
 local blockKey = "user:"..clientIP..":block"

 local is_block,err = red:get(blockKey)
 if tonumber(is_block) == 1 then
    ngx.say(blockKey.."你被限流了！")
    ngx.exit(ngx.HTTP_FORBIDDEN)
 end

 ngx.say(blockKey.."调用成功！")
```

具体到 lua 语法就不详细说明了，这里需要大家去学一下 lua 的基本语法。

当我们执行的时候，就可以看到了这么一串东西了，当我在 redis 中设置对应当 key 当时候。

我们再来访问一下，这个时候就会发现，有变化了。

经过这个简单的例子，我们就可以想到，我们经常说在要 http 代理服务器中对请求进行拦截，或者一些高并发例如秒杀等拦截的时候，我们就可以借助 openresty 来进行一个`流量削峰`，等请求真正到达我们等下游服务器等时候，爆炸了请求已经被过滤掉了 80%无用的请求。
