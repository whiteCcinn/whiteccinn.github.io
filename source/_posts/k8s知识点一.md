---
title: k8s の 基础知识
date: 2019-05-16 14:24:00
categories: [k8s]
tags: [k8s]
---

# k8s 知识点一

## k8s 总架构由于 2 个概念构成

- Master
- Node

`Master` 和 `Node` 都是服务器物理机或者虚拟机, 都可以由于一台或者多台组成，如果 Master 不考虑`HA(高可用)`的情况下。一般都是 1 台 Master + N 台 Node。

## Master 上所需要的服务

- etcd
- Api Server
- Controller Manager
- Scheduler

后三个组件构成了 Kubernetes 的总控中心，这些进程实现了整个集群的资源管理、Pod 调度、弹性伸缩、安全控制、系统监控和纠错等管理功能，并且全都是自动完成。

## Node 上所需要的服务

- kubelet
- proxy

<!-- more -->

负责对本节点上的 Pod 的生命周期进行管理，以及实现服务代理的功能

## 流程

通过 Kubectl 提交一个创建 RC 的请求，该请求通过 API Server 被写入 etcd 中，此时 Controller Manager 通过 API Server 的监听资源变化的接口监听到这个 RC 事件，分析之后，发现当前集群中还没有它所对应的 Pod 实例，于是根据 RC 里的 Pod 模板定义生成一个 Pod 对象，通过 API Server 写入 etcd，接下来，此事件被 Scheduler 发现，它立即执行一个复杂的调度流程，为这个新 Pod 选定一个落户的 Node，然后通过 API Server 讲这一结果写入到 etcd 中，随后，目标 Node 上运行的 Kubelet 进程通过 API Server 监测到这个“新生的”Pod，并按照它的定义，启动该 Pod 并任劳任怨地负责它的下半生，直到 Pod 的生命结束。

随后，我们通过 Kubectl 提交一个新的映射到该 Pod 的 Service 的创建请求，Controller Manager 会通过 Label 标签查询到相关联的 Pod 实例，然后生成 Service 的 Endpoints 信息，并通过 API Server 写入到 etcd 中，接下来，所有 Node 上运行的 Proxy 进程通过 API Server 查询并监听 Service 对象与其对应的 Endpoints 信息，建立一个软件方式的负载均衡器来实现 Service 访问到后端 Pod 的流量转发功能。

### etcd 

用于持久化存储集群中所有的资源对象，如 Node、Service、Pod、RC、Namespace 等；API Server 提供了操作 etcd 的封装接口 API，这些 API 基本上都是集群中资源对象的增删改查及监听资源变化的接口。

### API Server 

提供了资源对象的唯一操作入口，其他所有组件都必须通过它提供的 API 来操作资源数据，通过对相关的资源数据“全量查询”+“变化监听”，这些组件可以很“实时”地完成相关的业务功能。

### Controller Manager 

集群内部的管理控制中心，其主要目的是实现 Kubernetes 集群的故障检测和恢复的自动化工作，比如根据 RC 的定义完成 Pod 的复制或移除，以确保 Pod 实例数符合 RC 副本的定义；根据 Service 与 Pod 的管理关系，完成服务的 Endpoints 对象的创建和更新；其他诸如 Node 的发现、管理和状态监控、死亡容器所占磁盘空间及本地缓存的镜像文件的清理等工作也是由 Controller Manager 完成的。

### Scheduler 

集群中的调度器，负责 Pod 在集群节点中的调度分配。

### Kubelet 

负责本 Node 节点上的 Pod 的创建、修改、监控、删除等全生命周期管理，同时 Kubelet 定时“上报”本 Node 的状态信息到 API Server 里。

### Proxy 

实现了 Service 的代理与软件模式的负载均衡器。

客户端通过 Kubectl 命令行工具或 Kubectl Proxy 来访问 Kubernetes 系统，在 Kubernetes 集群内部的客户端可以直接使用 Kuberctl 命令管理集群。Kubectl Proxy 是 API Server 的一个反向代理，在 Kubernetes 集群外部的客户端可以通过 Kubernetes Proxy 来访问 API Server。
