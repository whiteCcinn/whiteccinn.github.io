---
title: 【Nginx】map-详解
date: 2019-06-13 11:13:30
categories: [nginx]
tags: [nginx]
---

## 前言

map 指令是由 ngx_http_map_module 模块提供的，默认情况下安装 nginx 都会安装该模块。

map 的主要作用是创建自定义变量，通过使用 nginx 的内置变量，去匹配某些特定规则，如果匹配成功则设置某个值给自定义变量。 而这个自定义变量又可以作于他用。

<!-- more -->
