---
title: linuxの修改语言包
date: 2017-06-19 16:32:00
categories: [Linux]
tags: [Linux, 语言包]
---

1. 执行 `locale -a` 发现存在中文语言包，语言包存放路径应该是 `/usr/share/locale/`。

2. 执行 `echo $LANG` 发现语言配置是 C，大概是 ANSI C 的意思。

3. 修改 `/etc/locale.conf` 为 LANG="zh_CN.UTF-8"，并执行 `source /etc/locale.conf` 使配置生效。

4. 现在支持中文了，可是提示语也变中文了，我想保留英文作为系统语言，同时支持中文，所以重新修改 `/etc/locale.conf` LANG="en_US.UTF-8"，并执行 source
