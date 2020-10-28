---
title: 【Nginx】- Rewrite功能
date: 2018-02-23 09:57:00
categories: [Nginx]
tags: [Nginx]
---

## 说明

Nginx 作为一个 http 服务器，其中最重要的一个特点就是 rewrite 功能，这个功能算是 nginx 必会内容了，接下来，我们详细说明一下 URL 重写配置以及信息详解

Nginx-rewrite 依赖

- PCRE 软件的支持，支持 perl 兼容正则表达式语句进行规则匹配

rewrite 是实现 URL 重写的关键指令，根据 regex（正则表达式）部分内容，重定向到 replacement，结尾是 flag 标记。

## 语法

```regex
rewrite   <regex>    <replacement> [flag]

关键字     正则表达式  替换内容       flag标记
```

- 关键字：固定 rewrite 开启的关键字

- 正则：perl 兼容正则表达式语句进行规则匹配

- 替代内容：将正则匹配的内容替换成 replacement

- flag 标记：rewrite 支持的 flag 标记

<!-- more -->

### flag 标记说明：

- last 本条规则匹配完成后，继续向下匹配新的 location URI 规则

- break 本条规则匹配完成即终止，不再匹配后面的任何规则

- redirect 返回 302 临时重定向，浏览器地址会显示跳转后的 URL 地址

- permanent 返回 301 永久重定向，浏览器地址会显示跳转后的 URL 地址

## 例子

`rewrite ^/(.*) http://usblog.crazylaw.cn/$1 permanent;`

这个例子，无论说明请求过来，都会永久重定向到`http://usblog.crazylaw.cn/$1`上，返回状态吗 301

具体例子:
当具体的 url 请求:
`https://nginx.crazylaw.cn/index.php/archives/333/`
被 nginx-rewirte 之后,链接变成如下
`https://usblog.crazylaw.cn/index.php/archives/333/`

## location

另外有一些`location`关键字，需要用到以下特殊符号：

- `~ <rule>` 为区分大小写匹配

- `~* <rule>` 为不区分大小写匹配

- `!~ <rule>` 和 `!~* <rule>` 分别是区分大小写不匹配以及不区分大小写不匹配

## 逻辑判断专用符号

- `-f <file>` 和 `!-f <file>` 判断是否存在文件

- `-d <dir>` 和 `!-d <dir>` 判断是否存在目录

- `-e <file|[dir]>` 和 `!-e <file|[dir]>` 判断是否存在文件或者目录

- `!x` 和 `!-x` 判断文件是否可以执行

## Proxy_pass

该关键字和`rewrite`要做一点区别，`proxy_pass`用于反向代理，顾名思义，和重定向不同，`proxy_pass`并不会改变浏览器的 url，整个关键字是用于内部服务器请求转发的。

特点可以归纳如下：

- 不影响浏览器地址栏的 url
- 设置被代理 server 的协议和地址，URI 可选（可以有，也可以没有）
- 协议可以为 http 或 https
- 地址可以为域名或者 IP，端口可选；eg：`proxy_pass http://localhost:8000/uri/;`

如果一个域名可以解析到多个地址，那么这些地址会被轮流使用，此外，还可以把一个地址指定为 server group（如：nginx 的 upstream）, eg:

```shell
upstream backend {
    server backend1.example.com       weight=5;
    server backend2.example.com:8080;
    server unix:/tmp/backend3;

    server backup1.example.com:8080   backup;
    server backup2.example.com:8080   backup;
}

server {
    location / {
        proxy_pass http://backend;
    }
}
```

如果 proxy_pass 的 URL 定向里包括 URI，那么请求中匹配到 location 中 URI 的部分会被 proxy_pass 后面 URL 中的 URI 替换，eg：

```
location /name/ {
    proxy_pass http://127.0.0.1/remote/;
}

请求http://127.0.0.1/name/test.html 会被代理到http://example.com/remote/test.htm
```

如果 proxy_pass 的 URL 定向里不包括 URI，那么请求中的 URI 会保持原样传送给后端 server，eg：

```
location /name/ {
    proxy_pass http://127.0.0.1;
}

请求http://127.0.0.1/name/test.html 会被代理到http://127.0.0.1/name/test.html
```
