---
title: 【API网关】- Orange
date: 2019-07-05 18:15:00
categories: [API网关]
tags: [API网关]
---

## 前言

> 版本：0.7

API 网关/网关，充当的职责无非以下几点：

- 鉴权
- 限流
- 分流
- 负载均衡

> 隐含的功能就是动态 upstream

大多与的 API 网关都是用利用 lua 实现的 Openresty 来实现的，因为它可以很好的和 nginx 结合在一起，可以同时运行 lua 脚本和 C 库，并且由于 lua 在协程上实现得十分早，对于 IO 密集型的处理十分的高效。

在给予 Openresty 实现的 API 网关中，有一些是比较出名的，例如 kong/orange

- [kong](https://github.com/Kong/kong) 算是行业认为最强大成熟的一个组件的，但是过于复杂了。

- [orange](https://github.com/orlabs/orange) 利用插件的形式来处理请求，并且间接直接，易于二次开发和扩展

<!-- more -->

## Orange

由于 3 个部分构成：

- main-server: 一个 location 的表示格式
- api-server: orange 的 api 服务
- dashboard: 面板

依赖的存储服务：

- mysql

前端技栈：

- html
- css
- jquery

## Orange 脑图

![Orange](/images/API网关/ORANGE.png)

## 插件

### BASE_AUTH

基于 Basic Authorization 的插件

![BASE_AUTH](/images/API网关/BASE_AUTH.png)

## DIVIDE

分流插件

![DIVIDE](/images/API网关/DIVIDE.png)

## DYNAMIC_UPSTREAM

动态 upstream 插件

![DYNAMIC_UPSTREAM](/images/API网关/DYNAMIC_UPSTREAM.png)
