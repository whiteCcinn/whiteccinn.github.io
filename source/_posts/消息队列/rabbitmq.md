---
title: 【消息队列】- Rabbitmq安装与配置
date: 2020-05-08 09:46:51
categories: [消息队列]
tags: [消息队列，Rabbitmq]
---

## 前言

由于部门的大数据服务一直都是用kafka，但是一些常规的业务系统，我们并不希望依赖kafka，所以我们引入了rabbitmq。

<!-- more -->

鉴于我们要对配置做特殊处理，我们写了一个rabbitmq-env.conf来管理具体内容。

```shell
# 这是rabbitmq的配置文件,也支持shell语言
# 该文件受RABBITMQ_CONF_ENV_FILE环境变量影响路径，默/etc/rabbitmq/rabbitmq-env.conf
# 这个配置的环境变量最终都会生成自带有“RABBITMQ_”的前缀，所以请不要手动设置RABBITMQ_
# 由于我们用的FQDN，所以要配置longname环境变量, 因此我们不固定节点名
# https://www.rabbitmq.com/configure.html#environment-env-file-unix


# 基础变量

rabbitmq_uid=rabbitmq
rabbitmq_gid=rabbitmq
rabbitmq_config_file="/etc/rabbitmq/rabbitmq.config"
rabbitmq_mnesia_base="/data/database/rabbitmq"
rabbitmq_log_base="/data/logs/rabbitmq"

# 以下为执行命令

mkdir -p ${rabbitmq_mnesia_base} && chown ${rabbitmq_uid}:${rabbitmq_gid} ${rabbitmq_mnesia_base}
mkdir -p ${rabbitmq_log_base} && chown ${rabbitmq_uid}:${rabbitmq_gid} ${rabbitmq_log_base}

# 以下为环境变量, 切勿手动设置"RABBITMQ_"前缀，否则不生效
# https://www.rabbitmq.com/relocate.html#environment-variables
# https://www.rabbitmq.com/configure.html#supported-environment-variables

# 节点名称定义
# https://www.rabbitmq.com/cli.html#node-names
# NODENAME=rabbitmq@node1

# 节点名字使用FQDN
# https://www.rabbitmq.com/cli.html#node-names
USE_LONGNAME=true

# 配置文件路径
CONFIG_FILE=${rabbitmq_config_file}

# 配置持久化数据库路径
MNESIA_BASE=${rabbitmq_mnesia_base}

# rabbitmq日志存储路径
LOG_BASE=${rabbitmq_log_base}
```

由于我们的hostname一般是采用FQDN（全限定性域名），并且我们采用的是镜像集群的模式，我认为hostname对我们来说，并不需要固定。
即使是发生了故障，只要集群中存在一台机器，那么持久化对数据也并不会丢失。

为什么我们会采用镜像模式？这个模式不是会让大量消息对时候导致内网流量暴涨吗？

确实是会这样子，但是我们一般是后台系统使用居多，目前来说，并不会有大量消息的出现，如果真的是这样子的化，我们更推荐用kafka或者rocketmq。
我们更关注的是数据的完整性可靠性。

注意我们的所有节点都需要开启`rabbitmq-plugins enable rabbitmq_management_agent`，这样子在管理后台中，我们才可以看到所有节点的状态。

我们的原则是：

```
如何选择远程或本地的RabbitMQ？

场景1：A、B 服务在同台机器，一产一消，使用本地（php系统该场景目前的 laravel + redis 方案已能够满足）
场景2：A、B 服务在多台机器，一产一消，使用远程
场景3：A、B、C 服务在同台机器，一产多消，使用本地
场景4：A、B、C 服务在多台机器，一产多消，使用远程

如果确定vhost名称？
1、仅限于单系统并且跨机器使用，则使用系统名称作为 vhost 名称
2、多系统并且跨机器使用，则使用 common 作为 vhost 名称
```
