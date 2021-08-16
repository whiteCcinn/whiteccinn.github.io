---
title: 【kubernetes】k8s-pv-nfs-for-mac
date: 2021-08-16 14:18:30
categories: [kubernetes]
tags: [kubernetes]
---

## 前言

docker-for-mac 现在已经内置了k8s，我们可以轻松的开启这个功能，然后就可以通过kubectl来执行我们的k8s的命令来对容器资源进行管理。

但是有一个比较头疼的点，那就是我们的pv资源。我们平时用docker的时候，有一些信息例如，日志之类的，需要持久化下来，这个时候，这个日志文件持久化会和容器所在的物理机在同一个机器下，因此，并不能很好的做到“存”，“算”分离的目的。并且没办法利用了网络上的其他资源。

再者就是还有一种情况就是，我需要利用k8s部署一些基础服务，例如mysql，例如redis，这些基础数据都是需要持久化的，因此，和物理机器强行绑定在一起的话，下次数据在哪个数据卷都不清楚了，更没办法重新回复数据，这是一个很严重的问题。

所以我们这里的pv，不能简单的使用`hostPath`或者`local`类型，根据服务器上用的比较多的或许是自己搭建一个`nfs` 服务器，因此，我们也希望在本地开发的时候定义资源文件`的yaml`也是用`nfs`来作为我们的`pv-type`。

但是也因此，我们需要在mac上开启一个`nfs-server`。尝试过[docker-nfs-server](https://github.com/ehough/docker-nfs-server)，但是由于mac系统的架构问题，无法顺利的运行起来，需要处理modpre模块，处理那么多内核的东西不太合理。

<!-- more -->

## built-in-nfs

后来查阅资料，发现了原来我们的macos，内置了nfs，我们只需要添加对应的配置和开启服务即可，十分的方便。

### 配置文件

这个文件默认是不存在的，需要我们手动去创建和添加里面的内容，不熟悉nfs的朋友需要去看一下nfs的配置文件。

```shell
sudo vim /etc/exports
## 追加以下文件到文件中
/Users/caiwenhui/nas_a -alldirs -maproot=caiwenhui:staff
```

其中的含义是:

- /Users/caiwenhui/nas_a 指定共享目录
- -alldirs 共享目录下的所有目录
- -maproot 把client端的caiwenhui用户映射为MacOS上的root，client端的staff组映射为MacOS上的wheel (gid=0) 组

### 检查配置是否正确

```shell
sudo nfsd checkexports
```

如果都正确的话，默认什么都不会输出。如果存在问题的话，则会弹出错误配置信息。

### /etc/nfs.conf

如果k8s需要运用nfs，还需要添加一行：

```
nfs.server.mount.require_resv_port = 0
```

### 服务命令

```shell
sudo nfsd start # 启动服务
sudo nfsd stop # 停止服务
sudo nfsd restart # 重启服务
sudo nfsd status # 查看状态
sudo nfsd enable # 开机自启
sudo nfsd disable # 禁止开机自启
```

### 查看配置是否生效

`showmount -e`

```
➜  ~ showmount -e
Exports list on localhost:
/Users/caiwenhui/nas_a              Everyone
```

这里，可以看到，我们挂在的数据卷已经生效，并且是everyone(任何网段，任何用户)都可以进行`读写`。因为是本地开发，所以这么设置最方便，如果是服务器上的，就需要针对特定的网段或者ip以及user了。详情查看nfs配置。

### 本地测试

> 这一步你大可不必测试，因为是第一次，所以我想先确保nfs的服务的正常。

```shell
## 创建client角色的目录，就是被挂载的目录
mkdir /Users/caiwenhui/nas_a2

## 模拟client挂载nfs数据卷命令
sudo mount -t nfs -o nolock,nfsvers=3,vers=3 127.0.0.1:/Users/caiwenhui/nas_a /Users/caiwenhui/nas_a2
```

这里的意思是：

- 挂载类型：nfs
- 采用nfs-v3协议: nfsvers=3,vers=3
- nfs-server的目录: 127.0.0.1:/Users/caiwenhui/nas_a （这个就是我们`showmount -e`查看到的路径）
- nfs-client的目录：/Users/caiwenhui/nas_a2

挂载成功之后，尝试在client目录添加文件

```shell
touch /Users/caiwenhui/nas_a2/hello
```

查看server目录是否有文件同步

```shell
ls /Users/caiwenhui/nas_a
hello
```

这个时候会发现nas_a目录下，自动多了一个`hello`的文件

取消挂在，可以在`finder中直接弹出挂载`，或者`使用如下命令`即可。

```shell
umount /Users/caiwenhui/nas_a2
```

这个时候你再去看 `/Users/caiwenhui/nas_a2` 目录下，`hello`文件不见了，但是`/Users/caiwenhui/nas_a/hello`依旧存在。

## k8s中测试nfs

### NFS PersistentVolume

前面我们已经在mac上启动了一个NFS服务，现在通过在k8s上创建一个PersistentVolume来使用NFS。

创建一个PV，编辑配置文件`nfs-pv-1.yaml`，内容如下：

```yaml
➜  ~ cat nfs-pv-1.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfspv1
spec:
  mountOptions:
    - nfsvers=3
    - nolock
  capacity:
    storage: 2Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Recycle
  storageClassName: nfs
  nfs:
    path: /Users/caiwenhui/nas_a
    server: docker.for.mac.host.internal
```

nfs相关的配置：
- nfsvers=3 使用v3协议
- 路径就是nfs上的目录
- 注意这里，我们的服务器ip，如果不能明确的目前现在的网络通信情况的下，请使用`docker.for.mac.host.internal`

申请资源PV。

```shell
kubectl apply -f nfs-pv-1.yaml
```

查看资源状态。

```shell
➜  ~ kubectl get pv
NAME     CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS     CLAIM   STORAGECLASS   REASON   AGE
nfspv1   2Gi        RWO            Recycle          Available           nfs                     13h
```

STATUS为`Available`表示nfspv1就绪，可以被PVC申请。

### PersistentVolumeClaim

下面创建PVC，编辑nfs-pvc-1.yaml文件

```yaml
➜  ~ cat nfs-pvc-1.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nfspvc1 
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: nfs 
```

申请资源PVC。

```shell
kubectl apply -f nfs-pvc-1.yaml 
```

查看pvc状态/查看pv状态。

```shell
➜  ~ kubectl get pvc
NAME      STATUS   VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
nfspvc1   Bound    nfspv1   10Gi       RWO            nfs            85s

➜  ~ kubectl get pv
NAME     CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM             STORAGECLASS   REASON   AGE
nfspv1   2Gi        RWO            Recycle          Bound    default/nfspvc1   nfs                     13h
```

这里，我们可以看到 `status = bound`，代表此时`pv`和`pvc`已经绑定在一起了。这样子我们就可以把`pod`和`pvc`绑定。

### Pod

编辑pod1.yaml

```yaml
➜  ~ cat pod1.yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod1
spec:
  containers:
    - name: mypod1
      image: busybox
      args:
      - /bin/sh
      - -c
      - sleep 30000
      volumeMounts:
      - mountPath: "/mydata"
        name: mydata
  volumes:
    - name: mydata
      persistentVolumeClaim:
        claimName: nfspvc1
```

申请资源pod

```
kubectl apply -f pod1.yaml
```

查看pod状态

```
➜  ~ kubectl describe pod
Name:         mypod1
Namespace:    default
Priority:     0
Node:         docker-desktop/192.168.65.4
Start Time:   Mon, 16 Aug 2021 01:07:01 +0800
Labels:       <none>
Annotations:  <none>
Status:       Running
IP:           10.1.0.6
IPs:
  IP:  10.1.0.6
Containers:
  mypod1:
    Container ID:  docker://0351e0c89fb94a3a1c8888939c641fc7b9b48d1f915f3653ca0ac188c50ae242
    Image:         busybox
    Image ID:      docker-pullable://busybox@sha256:0f354ec1728d9ff32edcd7d1b8bbdfc798277ad36120dc3dc683be44524c8b60
    Port:          <none>
    Host Port:     <none>
    Args:
      /bin/sh
      -c
      sleep 30000
    State:          Running
      Started:      Mon, 16 Aug 2021 01:07:08 +0800
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /mydata from mydata (rw)
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-pftwg (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
Volumes:
  mydata:
    Type:       PersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)
    ClaimName:  nfspvc1
    ReadOnly:   false
  kube-api-access-pftwg:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    ConfigMapOptional:       <nil>
    DownwardAPI:             true
QoS Class:                   BestEffort
Node-Selectors:              <none>
Tolerations:                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:                      <none>
```

我们看到`Mounts`相关的内容已经挂载正确，并且容器也正确在运行了。我们对挂载好的数据卷操作。

```shell
kubectl exec mypod1 touch /mydata/hello2
```

这个时候我们在本地的nfs-server的目录`/Users/caiwenhui/nas_a` 查看一下是否多了`hello2`的文件

```shell
ls /Users/caiwenhui/nas_a
hello hello2
```

这个时候，我们看到，hello2被成功创建，pod能正确的访问的pv挂载链接本地nfs-server了。
