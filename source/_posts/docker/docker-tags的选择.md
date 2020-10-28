---
title: 【Docker】如何选择hub.docker中的tag标签
date: 2020-05-25 11:28:30
categories: [Docker]
tags: [Docker]
---

## 前言

很多小伙伴或许还不清楚各个tag的区别，其实最大的一个问题在于，你需要了解各大操作系统的不同。

<!-- more -->

## 操作系统

- debian
- ubuntu
- centos
- [alpine](https://alpineliµnux.org/)

## debian


### Debian 发行版本

Debian 一直维护着至少三个发行版本：稳定版（stable），测试版（testing）和不稳定版（unstable）。

#### 稳定版（stable）

稳定版包含了 Debian 官方最近一次发行的软件包。

作为 Debian 的正式发行版本，它是我们优先推荐给用户您选用的版本。

当前 Debian 的稳定版版本号是 10，`开发代号为 buster`。最初版本为 10，于 2019年07月06日 发布，其更新 10.4 已于 2020年05月09日 发布。

#### 测试版（testing）

测试版包含了那些暂时未被收录进入稳定版的软件包，但它们已经进入了候选队列。使用这个版本的最大益处在于它拥有更多版本较新的软件。

想要了解 什么是测试版以及 如何成为稳定版的更多信息，请看 Debian FAQ。

当前的测试版版本代号是 `bullseye`。

#### 不稳定版（unstable）

不稳定版存放了 Debian 现行的开发工作。通常，只有开发者和那些喜欢过惊险刺激生活的人选用该版本。推荐使用不稳定版的用户订阅 debian-devel-announce 邮件列表，以接收关于重大变更的通知，比如有可能导致问题的升级。

不稳定版的版本代号永远都被称为 `sid`。


- 下一代 Debian 正式发行版的代号为 bullseye — 发布时间尚未确定
- Debian 10（buster） — 当前的稳定版（stable）
- Debian 9（stretch） — 旧的稳定版（oldstable）
- Debian 8（jessie） — 更旧的稳定版（oldoldstable）
- Debian 7（wheezy） — 被淘汰的稳定版
- Debian 6.0（squeeze） — 被淘汰的稳定版
- Debian GNU/Linux 5.0（lenny） — 被淘汰的稳定版
- Debian GNU/Linux 4.0（etch） — 被淘汰的稳定版
- Debian GNU/Linux 3.1（sarge） — 被淘汰的稳定版
- Debian GNU/Linux 3.0（woody） — 被淘汰的稳定版
- Debian GNU/Linux 2.2（potato） — 被淘汰的稳定版
- Debian GNU/Linux 2.1（slink） — 被淘汰的稳定版
- Debian GNU/Linux 2.0（hamm） — 被淘汰的稳定版
