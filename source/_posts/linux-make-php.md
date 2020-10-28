---
title: Centos7下自行编译PHP
date: 2017-08-16 12:02:00
categories: [Linux, PHP]
tags: [Linux, PHP, 编译安装]
---

# 说明

为了满足我的一篇博文，我单独抽出来写一篇 PHP 的编译篇

# 下载

最好不要去 github 上下载，因为你不知道哪一个是稳定版，我们最好去官网寻找最新的稳定版下载

- [官网下载](http://php.net/downloads.php)

```
cd /usr/local/src/

sudo mkdir php

cd php

wget xxxxx.php -O php-xx.tar.gz

tar -zxvf php-xx.tar.gz

cd php-xx
```

<!-- more -->

> 在这里，我的 php 版本是 php-7.1.8

修改源码目录所有者

```
chown -R caiwh:caiwh php-7.1.8
```

进入目录

```
cd php-7.1.8
```

### 最小化安装的模块

- `curl扩展` (使用 curl 的 API)
- --with-curl

- `fpm扩展` （管理 PHP 进程的服务）
- --enable-fpm

- `openssl扩展` (打开 ssl 服务，很多服务都依赖这个，必须安装，例如：composer、mysql 的 ssl 等等)
- --with-openssl

- `mysqlnd扩展` （mysql native drive）
- [--enable-mysqlnd](启动了mysql-pdo-mysql之后，如果不开启这个的话，默认会自动开启这个参数)
- --mysql-pdo-mysql=mysqlnd

- `gd扩展` （可以操作图片）
- --enable-gd
- --with-jpeg-dir (GD 库默认不支持 jpeg 格式，需要额外的添加)

- `zlib扩展` (压缩解压缩服务)
- --enable-zlib
- --with-zlib
- --with-libzip

- `mb扩展` (可以使用于 mb 系列的函数，例如汉字的截止之类的)
- --enable-mbstring

- `socket扩展` （可以使用 socket 系列的函数）
- --enable-sockets

- `x-debug扩展` （断点调试用，但是在生产环境不应该安装这个扩展，因为会拖底性能）
- --enable-debug

- `readline扩展` （可以在 CLI 模式下直接交互，例如 php -a）
- --enable-readline

### 最后的编译参数

```
./configure --prefix=/usr/local/php --with-config-file-path=/usr/local/php/etc --with-config-file-scan-dir=/usr/local/php/etc/php.d --enable-mysqlnd --with-pdo-mysql=mysqlnd --with-gd --with-jpeg-dir --with-curl --with-readline --with-openssl --with-zlib --with-libzip --enable-mbstring --enable-sockets --enable-bcmath --enable-fpm --with-fpm-user=phper --with-fpm-group=phper
```

好的，开始补类库的过程，这个时候，告诉我没有 libxm2，所以我又要去安装了，这里我们再次用 yum 安装

让我们先看看我们的源是否有这些包

```
yum search libxml2
```

OK，开始安装

```
sudo yum install libxml2-devel libxml2 -y
```

再次编译。

好的，我还没有安装 libcurl 类，同样的做法

```
sudo yum install libcurl-devel libcurl -y
```

再次编译。

还有一些问题，针对对应的类库安装对应的，这里就不一一列出来的，一次过写出来了

```
sudo yum install libjpeg-turbo-devel libjpeg-turbo libpng-devel libpng readline-devel readline -y
```

再次编译。

编译完成！！

# 安装

```
sudo make && make install
```

安装的速度取决你的服务器配置。

....Loading....
....Loading....
....Loading....

....Waiting....
....Waiting....
....Waiting....

安装完毕！！

### 配置 php-fpm

```
cd sapi/fpm
```

开始调试 php-fpm

```
./php-fpm -h
```

讲一下几个重要的参数

- -c 指定 php.ini 配置文件的路径
- -y 指定 php-fpm.conf 配置文件的路径
- -n 不用 php.ini 运行

```
sudo ./php-fpm -t
```

好的，我们发现测试失败，说是没有配置文件，我们去这个目录下，发现又一个文件叫 `php-fpm.conf.default` copy 一份出来，把 default 去掉

```
sudo cp /usr/local/php/etc/php-fpm.conf.default /usr/local/php/etc/php-fpm.conf
```

开启 pid 文件

详细的配置文件也要弄一份出来

```
sudo cp /usr/local/php/etc/php-fpm.d/www.conf.default /usr/local/php/etc/php-fpm.d/www.conf
```

测试通过。

因为我们用了 user=phper 和 group=phper 的用户去启动 php-fpm 的 worker 进程。所以，我要创建这么一个不可登录的用户

```
useradd -M -s /sbin/nologin -U phper
```

OK。

启动成功。完美。

### 把服务加入到 Systemctl

首先，需要这么一个 shell 脚本

```
cd /usr/local/php/sbin/

sudo vim php-fpm.sh
```

```shell
#! /bin/sh

### BEGIN INIT INFO
# Provides:          caiwh[471113744@qq.com]
# Short-Description: starts php-fpm
# Description:       starts the PHP FastCGI Process Manager daemon
### END INIT INFO

prefix=/usr/local/php
exec_prefix=${prefix}

php_fpm_BIN=${exec_prefix}/sbin/php-fpm
php_fpm_CONF=${prefix}/etc/php-fpm.conf
php_fpm_PID=${prefix}/var/run/php-fpm.pid


php_opts="--fpm-config $php_fpm_CONF --pid $php_fpm_PID"


wait_for_pid () {
        try=0

        while test $try -lt 35 ; do

                case "$1" in
                        'created')
                        if [ -f "$2" ] ; then
                                try=''
                                break
                        fi
                        ;;

                        'removed')
                        if [ ! -f "$2" ] ; then
                                try=''
                                break
                        fi
                        ;;
                esac

                echo -n .
                try=`expr $try + 1`
                sleep 1

        done

}

case "$1" in
        start)
                echo -n "Starting php-fpm "

                $php_fpm_BIN --daemonize $php_opts

                if [ "$?" != 0 ] ; then
                        echo " failed"
                        exit 1
                fi

                wait_for_pid created $php_fpm_PID

                if [ -n "$try" ] ; then
                        echo " failed"
                        exit 1
                else
                        echo " done"
                fi
        ;;

        stop)
                echo -n "Gracefully shutting down php-fpm "

                if [ ! -r $php_fpm_PID ] ; then
                        echo "warning, no pid file found - php-fpm is not running ?"
                        exit 1
                fi

                kill -QUIT `cat $php_fpm_PID`

                wait_for_pid removed $php_fpm_PID

                if [ -n "$try" ] ; then
                        echo " failed. Use force-quit"
                        exit 1
                else
                        echo " done"
                fi
        ;;

        status)
                if [ ! -r $php_fpm_PID ] ; then
                        echo "php-fpm is stopped"
                        exit 0
                fi

                PID=`cat $php_fpm_PID`
                if ps -p $PID | grep -q $PID; then
                        echo "php-fpm (pid $PID) is running..."
                else
                        echo "php-fpm dead but pid file exists"
                fi
        ;;

        force-quit)
                echo -n "Terminating php-fpm "

                if [ ! -r $php_fpm_PID ] ; then
                        echo "warning, no pid file found - php-fpm is not running ?"
                        exit 1
                fi

                kill -TERM `cat $php_fpm_PID`

                wait_for_pid removed $php_fpm_PID

                if [ -n "$try" ] ; then
                        echo " failed"
                        exit 1
                else
                        echo " done"
                fi
        ;;

        restart)
                $0 stop
                $0 start
        ;;

        reload)

                echo -n "Reload service php-fpm "

                if [ ! -r $php_fpm_PID ] ; then
                        echo "warning, no pid file found - php-fpm is not running ?"
                        exit 1
                fi

                kill -USR2 `cat $php_fpm_PID`

                echo " done"
        ;;

        configtest)
                $php_fpm_BIN -t
        ;;

        *)
                echo "Usage: $0 {start|stop|force-quit|restart|reload|status|configtest}"
                exit 1
        ;;

esac
```

保存退出，然后修改权限

```
sudo chmod 755 php-fpm.sh
```

然后就可以写 systemctl 的 service 了。

```
sudo vim /usr/lib/systemd/system/php-fpm.service
```

把以下代码拷贝进去

```
[Unit]
Description=Belong caiwh - php-fpm
Documentation= /usr/local/php/etc/php-fpm/
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
ExecStartPre=/usr/local/php/sbin/php-fpm.sh configtest
ExecStart=/usr/local/php/sbin/php-fpm.sh start
ExecReload=/usr/local/php/sbin/php-fpm.sh restart
ExecStop=/usr/local/php/sbin/php-fpm.sh stop
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```
systemctl daemon-reload
```

完成 systemctl 重启

然后就可以用

```
#1.systemctl start php-fpm 启动服务
#2.systemctl stop php-fpm 停止服务
#3.systemctl restart php-fpm 重启服务
```

完美结合
