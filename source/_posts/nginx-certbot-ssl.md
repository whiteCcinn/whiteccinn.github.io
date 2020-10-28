---
title: 【SSL】使用certbot工具申请letsencrypt的ssl证书
date: 2018-04-08 10:55:00
categories: [Nginx]
tags: [Nginx, ssl]
---

## 申请 ssl 证书之前，先梳理几个要点：

1、确定好拟申请 ssl 证书的域名，这里为了便于说明假设申请 ssl 的域名为：a.baicai.com，www.baicai.com、account.baicai.com 等其他域名（和主机），没有本质上的区别，仅名称上的差异；

2、确定拟申请 ssl 证书的域名正确解析到当前主机，本例也就是通过http://blog.crazylaw.com 能够正确解析到当前主机（注意是正确解析，至于是不是能正确访问依据 certbot 的模式不同要求也不同）；

3、确定好拟申请 ssl 证书域名解析到当前主机后的 web 根目录，假设为：/www/blog/

## Github 上拉取 cerbot

```
git clone https://github.com/certbot/certbot
```

然后进入

```
cd cerbot
```

接着看到`cerbot-auto`的可执行文件

然后生成证书。

<font color="red">注意，如果你第一次使用 letsencrypy 的话，一般需要指定邮箱，并且 letsencrypy 会发送证书到你的邮箱，请确认订阅 letsencrypy，下面的命令是带上了邮箱信息的</font>！

<font color="red">注意，需要暂时停止 nginx</font>！

## standalone 模式申请 ssl 证书

standalone 模式不需要上述梳理出的 3 个要点中的第三条，也就意味着如果你的主机需要关停 80 端口（或和 443 端口）的 web 服务，譬如正在运行的 nginx、Apache 需要关停。

```
##standalone模式，其中-d参数指定拟申请ssl证书的域名 #可以通过多个-d参数指定多个域名，但你得确保这些指定的多个域名均能正常解析到当前主机

./certbot-auto certonly --standalone --email you@email.com -d example.com -d www.example.com -d other.example.net
```

## 非 standalone 模式申请 ssl 证书

这种模式需要使用-w 参数（或者--webroot-path 参数）指定当前正在运行的 web 服务器的根目录。--webroot-path 参数指定 web 根目录后，`certbot工具会自动在该目录下生成.well-known的隐藏目录`，以及用于效验域名所有者的特定文件，此文件 Let's Encrypt 的服务器会主动发起 http 请求去读取从达到效验域名所有者或者管理者就是本次操作 certbot 工具的人；certbot 工具自动生成的完整目录为：-w 参数指定的根目录`/.well-known/acme-challenge`，对于 nginx 而言 web 根目录下的隐藏目录默认情况下是不允许访问的，所以 nginx 情况下再执行非 standalone 模式申请 ssl 证书之前，`需要将nginx网站根目录下的.well-known隐藏目录设置成允许访问`。

```
##nginx对应主机的配置文件中添加允许.well-known隐藏目录的访问
#注意配置文件中禁止浏览隐藏文件的相关代码引起冲突
location ~ /.well-known {
    allow all;
}
```

如果熟悉 nginx，甚至可以为.well-known 隐藏目录指定单独的 root 入口；这就是 nginx 有关的合理利用了，不再补充。

```
##--webroot指定当前正在运行的web server的根目录
certbot certonly --webroot -w /var/www/ -d c1c2.test.com
```

## 一般使用 standalone 模式，继续

接着如果你没订阅过的话，会在邮箱收到邮件，然后你要选择订阅。接着你会看到如下信息，选择 `a` 和 `y` 之后。

默认路径如下：

```

/etc/letsencrypt/live/{you.domain}/fullchain.pem

/etc/letsencrypt/live/{you.domain}/privkey.pem
```

如何更新？这里截图写得很清楚了，再执行一次 `certbot-auto` 命令+参数即可，如果你想全部重新执行一边的话，可以使用 `certbot-auto renew`。

## nginx 配置

然后我们重启 nginx，即可。！

## 如何实现自动化？

- 停止 nginx
- 执行 certbot-auto
- 重启 nginx
