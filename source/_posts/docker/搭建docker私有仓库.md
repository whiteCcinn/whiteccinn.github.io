---
title: 【Docker】搭建docker私有仓库
date: 2019-05-31 11:28:30
categories: [Docker]
tags: [Docker]
---

## 前言

为了配合 k8s，需要搭建一个私有仓库，防止镜像泄漏出去。

<!-- more -->

## 机器准备

最小化分布式集群安装，一台master，一台node。后续可以调整为多master，解决单点问题，node的话也可以增加以加入集群。

| hostname | IP            | 配置  | 操作系统                                                                                                                       |
| -------- | ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| matser   | 192.168.8.171 | 4核8G | CentOS Linux release 7.2.1511 (Core)，Linux version 3.10.0-327.el7.x86_64，gcc version 4.8.3 20140911 (Red Hat 4.8.3-9) (GCC)  |
| node1    | 192.168.8.174 | 4核8G | CentOS Linux release 7.2.1511 (Core) ，Linux version 3.10.0-327.el7.x86_64，gcc version 4.8.3 20140911 (Red Hat 4.8.3-9) (GCC) |

## 安装

### registry

这个是 docker 官方提供的仓库镜像，现在已经进入了`2.x`的时代，对应的仓库在 github 上并不是`docker-registry`，`docker-registry` 已经归档了，并且不进行维护了，所以目前`hub.docker` 上的 `registry` 对应在 github 上的仓库名字叫做 `docker/distribution`

安装 `registry`

```shell
docker run -d -p 5000:5000 -v `pwd`/data:/tmp/registry-dev --restart=always --name registry registry:2
```

```shell
CONTAINER ID        IMAGE                  COMMAND                  CREATED             STATUS              PORTS                    NAMES
15d7f8c43400        registry:2             "/entrypoint.sh /e..."   12 minutes ago      Up 50 seconds       0.0.0.0:5000->5000/tcp   registry
```

这个时候私有仓库镜像成功建立了，我们测试一下。

拉取镜像

```shell
docker pull busybox:latest
```

重新打tag

```shell
docker tag busybox:latest 192.168.8.171:5000/tonybai/busybox:latest
```

推送到指定仓库 , 结果发现推送 `失败`

```shell
[root@master registry]# docker push 192.168.8.171:5000/tonybai/busybox
The push refers to a repository [192.168.8.171:5000/tonybai/busybox]
Get https://192.168.8.171:5000/v1/_ping: http: server gave HTTP response to HTTPS client
```

那是因为我们的docker，并没有设置`不安全私有仓库白名单`

所以这个时候我们需要修改`/etc/docker/daemon.json`

```json
{
     "registry-mirrors": ["https://registry.docker-cn.com"],
     "insecure-registries": [
        "192.168.8.171:5000"
     ]
}
```

然后我们重启docker即可，容器会随之启动

```shell
systemctl restart docker
```

启动成功后，然后再推送一次.

```shell
[root@master registry]# docker rmi 10.10.105.71:5000/tonybai/busybox
Untagged: 10.10.105.71:5000/tonybai/busybox:latest
```

成功了，不过他告诉我我没有指定tags所以默认的他加上了`latest`标签。

### secure registry

- 自签名证书
- 证书服务提供商

这里，我们主要是用自签名证书，所以需要在每个拉取我们私有仓库的镜像的时候，都需要拥有我们证书才可以拉取

```
[root@master ~]# mkdir ~/openssl/certs/ && cd ~/openssl/certs/ && openssl req -newkey rsa:2048 -nodes -sha256 -keyout certs/domain.key -x509 -days 365 -out certs/domain.crt
Generating a 2048 bit RSA private key
.....+++
...................................................................................................................................................+++
writing new private key to 'certs/domain.key'
-----
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [XX]:CN
State or Province Name (full name) []:Guangdong
Locality Name (eg, city) [Default City]:Guangzhou
Organization Name (eg, company) [Default Company Ltd]:xxx
Organizational Unit Name (eg, section) []:xx
Common Name (eg, your name or your server's hostname) []:mcdockerhub.com
Email Address []:471113744@qq.com
```

由于我们的 `Common Name` 设置了 `mcdockerhub.com`，所以我们需要修改一下hosts（除非你有公网解析到这个IP）


```shell
vim /etc/hosts/

192.168.8.171 master mcdockerhub.com
```

移除之前我们创建的 `registy`，然后我们重新创建一个

```shell
docker stop registy && docker rm registy
```

```shell
docker run -d -p 5000:5000 --restart=always --name registry -v /root/openssl/data:/tmp/registry-dev -v /root/openssl/certs:/certs -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/domain.crt -e REGISTRY_HTTP_TLS_KEY=/certs/domain.key docker.io/registry:2
```

接着我们重新打一个对应registy的tag

```shell
docker tag docker.io/busybox mcdockerhub.com:5000/tonybai/busybox
```

推送镜像到域名仓库

```shell
[root@master ~]# docker push mcdockerhub.com:5000/tonybai/busybox
The push refers to a repository [mcdockerhub.com:5000/tonybai/busybox]
Get https://mcdockerhub.com:5000/v1/_ping: x509: certificate signed by unknown authority
```

我们发现`报错`了。这是因为 `没有把证书` 对应起来。

把证书放在docker请求的证书目录

```
mkdir -p /etc/docker/certs.d/mcdockerhub.com:5000 && cp ~/openssl/certs/domain.crt /etc/docker/certs.d/mcdockerhub.com:5000/ca.crt
```

再推送一次

```shell
[root@master ~]# docker push mcdockerhub.com:5000/tonybai/busybox
The push refers to a repository [mcdockerhub.com:5000/tonybai/busybox]
d1156b98822d: Pushed
latest: digest: sha256:4fe8827f51a5e11bb83afa8227cbccb402df840d32c6b633b7ad079bc8144100 size: 527
```

接着就是成功了。如果其他机器需要推送或者拉取的话，记得要把证书放在对应的机器的对应目录下，否则被视为没有被授权。