---
title: Systemctl服务管理软件
date: 2017-08-16 11:21:00
categories: [Linux]
tags: [Linux, Centos7, Systemctl]
---

# 说明

由于特殊原因!!刚才写的文章没保存下来!!!接下来简写.!!!

Centos7 和 Centos7 之前的版本有几点比较重要的不同,一个是 firewall-cmd 代替了 iptables，然后就是 systemctl 代替了 service。这里，现在我就写一下如何使用 systemctl 管理服务。

---

# 服务的基本命令

- systemctl status xx （服务状态）

- systemctl start xx （服务启动）

- systemctl stop xx （停止服务）

- systemctl restart xx（重启服务）

- systemctl enable xx （服务随开机启动）

- systemctl disable xx （服务取消随启动）

- systemctl cat xx （查看服务的配置信息）

- systemctl daemon-reload (每次修改了一个 service 配置或者新增了一个配置，都需要执行这个命令，让 systemctl 服务重启，然后重新加载服务配置文件)

- systemctl list-dependencies [target name]（查看依赖树状图，十分的直观好用）

---

<!-- more -->

# 添加服务

我们的服务配置文件存放的路径为

```
/usr/lib/systemd/system/
```

在这个文件下，你可以看到这些服务，但是你的 nginx 服务不是 yum 等软件管理工具安装的话，这里是不会存在`nginx.service`这个文件的，这个文件需要我们手动添加。

![](https://usblog.crazylaw.cn/usr/uploads/2017/08/2218887774.png)

这里，以添加 nginx 服务到 systemctl 为例子。

```
sudo vim /usr/lib/systemd/system/nginx.service
```

以下是我 nginx 的配置文件的信息

```shell
[Unit]
Description=Belong caiwh - nginx - high performance web server
Documentation= ----> http://nginx.org/en/docs/
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
PIDFile=/var/run/nginx.pid
ExecStartPre=/usr/sbin/nginx -t -c /etc/nginx/nginx.conf
ExecStart=/usr/sbin/nginx -c /etc/nginx/nginx.conf
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s QUIT $MAINPID
#if you don't like use ExecStop,you can use:
#KillSignal=SIGQUIT
##why KillMode use process? because the nginx master process will be control the child process
#KillMode=process
PrivateTmp=true
TimeoutStopSec=5

[Install]
WantedBy=multi-user.target
```

保存。然后执行如下命令：

```shell
sudo systemctl daemon-reload
```

然后启动 nginx:

```shell
sudo systemctl start nginx
```

接下来，要介绍，我们 systemctl 的重要内容了。

---

# 开启启动和不开启启动的区别

开启启动的情况下，systemctl 只会启动以下路径的服务配置

```shell
/etc/systemd/system
```

但是，一般我们的基本服务，都是配置在以下路径：

```
/usr/lib/systemd/system
```

当我们用到上述介绍到的命令 `systemctl enable xx` 的时候，其实就是在 `/etc/systemd/system` 目录里面创建以下软连接到 `/usr/lib/systemd/system` 里面

---

# [Unit] 区块：启动顺序与依赖关系

- `Description` 给出当前服务的简单描述

- `Documentation` 给出文档位置

- `After` 表示该服务要在当前目标组或者目标服务启动之后才能启动（在这里就是 nginx 服务需要在 network.target remote-fs.target nss-lookup.target 启动之后才可以启动）

- `Before` 与 After 相对

- `Wants` 表示该服务和哪一些服务有 `弱依赖` 关系。意思就是，所依赖的服务如果启动失败的话或者异常了，也不会影响到该服务的启动和继续运行

- `Requires` 与 `Wants` 相反 ，`强依赖`

# [Service] 区块：启动行为

- `EnvironmentFile` 表示该服务自定义的配置参数变量文件，文件已 `KEY=VALUE` 键值对的形式存在，后续可以用 `$KEY` 来读取 value。

- `ExecReload` : 重启服务时执行的命令

- `ExecStop` : 停止服务时执行的命令

- `ExecStartPre` : 启动服务之前执行的命令

- `ExecStart` : 启动服务执行的命令

- `ExecStartPost` : 启动服务之后执行的命令

- `ExecStopPost` : 停止服务之后执行的命令

所有的启动设置之前，都可以加上一个连词号`（-）`，表示"抑制错误"，即发生错误的时候，不影响其他命令的执行。比如，`EnvironmentFile=-/etc/my-conf`（注意等号后面的那个连词号），就表示即使 `/etc/my-conf` 文件不存在，也不会抛出错误。

- `Type` 启动类型

1. `simple（默认值）`：ExecStart 字段启动的进程为主进程
2. `forking`：ExecStart 字段将以 fork()方式启动，此时父进程将会退出，子进程将成为主进程
3. `oneshot`：类似于 simple，但只执行一次，Systemd 会等它执行完，才启动其他服务
4. `dbus`：类似于 simple，但会等待 D-Bus 信号后启动
5. `notify`：类似于 simple，启动结束后会发出通知信号，然后 Systemd 再启动其他服务
6. `idle`：类似于 simple，但是要等到其他任务都执行完，才会启动该服务。一种使用场合是为让该服务的输出，不与其他服务的输出相混合

- `KillMode` 杀死进程模式

1. `control-group（默认值）`：当前控制组里面的所有子进程，都会被杀掉
2. `process`：只杀主进程
3. `mixed`：主进程将收到 SIGTERM 信号，子进程收到 SIGKILL 信号
4. `none`：没有进程会被杀掉，只是执行服务的 stop 命令。

- `Restar` 重启进程模式

1. `no（默认值）`：退出后不会重启
2. `on-success`：只有正常退出时（退出状态码为 0），才会重启
3. `on-failure`：非正常退出时（退出状态码非 0），包括被信号终止和超时，才会重启
4. `on-abnormal`：只有被信号终止和超时，才会重启
5. `on-abort`：只有在收到没有捕捉到的信号终止时，才会重启
6. `on-watchdog`：超时退出，才会重启
7. `always`：不管是什么退出原因，总是重启

# [Install] 区块

- `WantedBy` 表示该服务所在的 Target 组

这个设置非常重要，因为执行 systemctl enable xx 命令时，xx.service 的一个符号链接，就会放在/etc/systemd/system 目录下面的 WantedBy 命名的目录的子目录之中。
