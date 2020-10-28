---
title: docker安装php7+nginx事例
date: 2017-11-02 09:34:00
categories: [Docker]
tags: [Docker, PHP, Nginx]
---

# 简介

docker 是由 go 语言开发的的一个虚拟机容器，通过层的概念，把 fs(filesysytem)连接起来，形成一个可以独立的系统。其中涉及到了宿主机的概念，在这里，由于我所用的环境基本都是 centos7，所以这篇文章讲诉的就是 centos7 中使用 docker 安装 php7+nginx 的事例。后续我会发布一些镜像以及 dockerFile 提供大家学习参考。

> 需要注意的是：docker 运动的服务都需要以前台的模式运行

# 安装 docker

```
yum install -y docker
```

由于我们学习如何使用 docker，所以这里就选择了的直接采用 yum 安装了。

# 安装

## 创建 docker 容器操作用户

由于 docker 容器基于宿主机，所以我们可以在宿主机中创建好对容器操作的用户

```
// -g -u 参数分别指的的是gid，和uid
groupadd -g 2017 docker-group
adduser -g 2017 -u 2017 docker-user
```

<!-- more -->

## 创建几个和 docker 容器服务配置有关的目录

```
// 用于docker内nginx服务访问项目目录
mkdir -p /docker-www

// 用于修改nginx配置
mkdir -p /docker-config/nginx_config

// 用于修改php配置
mkdir -p /docker-config/php_config

// 用于修改php-fpm配置
mkdir -p /docker-config/php-fpm_config
```

## 创建一个 php 入口文件来检测 docker 中的 nginx 服务是否正常

```
touch /docker-www/index.php
```

```PHP
<?php

/**
 *
 * index.php
 *
 * @author    Caiwh <471113744@qq.com>
 * @version   2017年10月31日
 * @copyright Copyright caiwh's code
 *
*/

echo 'This is Docker Index.php';
echo PHP_EOL;
echo 'Hello-World';
```

## 从 hub.docker 中拉取 php 镜像

hub.docker 地址：https://hub.docker.com/_/php/

由于我们这里需要配合 nginx 使用，所以我们可以指选择 fpm 系列的。

```
// 这里我选择7.1.11-fpm版本，想要了解这个镜像的基系统的话，可以去查看dockerFile，官方提供的几乎全部都是基于debian系统的。

docker pull php:7.1.11-fpm
```

从 php 官方中拉取对应版本的 php.ini

```
curl -o /docker-config/php_config/php.ini https://raw.githubusercontent.com/php/php-src/php-7.1.11/php.ini-production
```

新建一个 php-fpm 的 zz-docker.conf 用于重写监听端口 9008

```
vim /docker-config/php-fpm_config/zz-docker.conf
```

添加以下内容，

```
[global]
daemonize = no

[www]
listen = [::]:9008
```

## 运行 docker 中的 php 服务

```
// 这里需要注意的是，由于centos7系统主机下有selinux的存在，导致用户操作权限严格受到限制，所以这里我们需要加上--privileged=true这一项，如果是其他宿主机的话，可能不存在这个问题。不加也可以。
docker run --name php -v /docker-www:/home/wwwroot -v /docker-config/php_config/php.ini:/usr/local/etc/php/php.ini -v /docker-config/php-fpm_config/zz-docker.conf:/usr/local/etc/php-fpm.d/zz-docker.conf --privileged=true -p 9008:9000 -d php:7.1.11-fpm
```

修改 docker 内部的用户权限。（这一步貌似没什么意义）

```
// 设置成刚才我们的用户组
docker exec -it php sed -i "s/33/2017/g" /etc/passwd
docker exec -it php sed -i "s/33/2017/g" /etc/group
```

## 从 hub.docker 中拉取 nginx 镜像

这里我们就不做版本的选择了，我们直接拉去，默认的 tag 会是 latest，最新版本。

```
docker pull nginx
```

然后我们在`/docker-config/nginx_config/`里面新增一个 nginx 的项目配置

```shell
server {
     listen       80;
     server_name  localhost.com;
     root         /home/wwwroot;

     index index.html index.htm index.php;

     error_page  404              /404.html;

     error_page   500 502 503 504  /50x.html;

     # 至于php:9008为什么是9008端口呢，是为了可能为本机也有php服务，为了不和宿主机的php服务冲突。
	 # 至于这个php:9008这个是哪里来的php呢，等下启动nginx服务的时候，我们会用--link选项把nginx容器和php容器连接起来，用到的别名就叫php，这个php会解析称为php容器的ip地址。
     location ~ \.php$ {
        fastcgi_pass   php:9008;
        fastcgi_index  index.php;
        fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
        include        fastcgi_params;
     }
}
```

## 运行 docker 中的 nginx 服务

```
docker run --name nginx -v /docker-www:/home/wwwroot -v /docker-config/nginx_config:/etc/nginx/conf.d --privileged=true --link=php:php -p 80:80 -d nginx
```

修改 docker 内部的用户权限。（同上）

```
// 设置成刚才我们的用户组
docker exec -it nginx sed -i "s/104:107/docker-user:2017/g" /etc/passwd
docker exec -it nginx sed -i "s/107/2017/g" /etc/group
```
