---
title: 【kubernetes】k8s-docker-for-mac-磁盘挂载
date: 2021-08-18 17:47:30
categories: [kubernetes]
tags: [kubernetes]
---

## 前言

上一次，我们说到了`docker-for-mac` 已经内置了最小化的k8s。我们在本地开发的时候，或多或少希望`yaml配置`是最接近线上环境的配置。

因此，上一次，教会了大家，如何在mac上开启nfs,把我们的pv和本地mac的nfs进行一个通信。

这一次，我们来聊聊`docker-for-mac`磁盘挂在的相关内容。

<!-- more -->

## 虚拟机

`Docker for Mac`是一个原生的苹果应用程序，被安装到 `/Application 目录`，安装时会创建 `/usr/local/bin` 目录下的 `docker、docker-compose` 符号链接。

`Docker for Mac` 使用通过 Hypervisor.framework 提供的轻量级的 xhyve 虚拟化技术
`Docker for Mac` `不使用` `docker-machine` 管理虚拟机
`Docker for Mac` `不通过 TCP 端口通信`，反而使用 `docker.sock` 套接字文件通信（实际上是将 /var/tmp 目录挂载到了虚拟机中，虚拟机在其中生成套接字文件）

但是尽管如此，你可以理解为还是存在虚拟机的。这个虚拟机的作用就是允许在macos上运行docker。

## docker for mac

![docker for mac 1](/images/k8s/docker-for-mac-1.png)

这个就是我们的`docker-for-mac`的桌面版客户端。

![docker for mac 2](/images/k8s/docker-for-mac-2.png)

根据上面这个图，我们可以发现，所有的镜像都存储在。

- `/Users/caiwenhui/Library/Containers/com.docker.docker/Data/vms/0/data` (记得修改为自己的路径，就是我这里的`caiwenhui`)

```shell
➜  ~ ll /Users/caiwenhui/Library/Containers/com.docker.docker/Data/vms/0/data
total 103652496
-rw-r--r--  1 caiwenhui  staff    96G  8 18 20:21 Docker.raw

➜  ~ head -n 10 /Users/caiwenhui/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw
�D��?���
        U�`�&3�Ѻ`1O�� �ha�ha��S�J�#`
                                     <�kD*�<O5K�VS�~~�/var/lib��B�uK����J�1�@
                                                                             ]�#`
���p��q  Z�]J,	)NL������w
)��%�
z?fw
    G/�%|gCԬ?f�u
                )
)�% �.?f
  �% |?f) �% ��?f)� (L � X %X i;�F!)D0 M %@�")� �� ֑	@#)� � �f�H$)" - :,�%)�
 �e LE��()"h �a ��SnU&43�%�C4k�?f �% { �% �D WA T қ                            �� ��v&)�" t� FW�D') }
�1 &� � �
       (A �� =�97 �; �&N � _Z˭� � ��
 �% F?f
      �0 �V��
           s
 �% ԇ �% X� �% s�?f �RiDX0�m�}�u �
                                  �@$���w?�  �% ��?f  �% ��?f. � Շ�
 �% MS?f
         W s �w� � ! �o�
  �% E�?f	  �% n�?f
```

我们这里可以看到，这个文件，占用了`96G`，就是我所分配的磁盘大小。并且这是一个经过了字节压缩的二进制文件。

![docker for mac 3](/images/k8s/docker-for-mac-3.png)

![docker for mac 4](/images/k8s/docker-for-mac-4.png)

这张图，算得上是我们今天的重点。

使用文件共享允许 Mac 上的本地目录与 Linux 容器共享。默认情况下`/Users`，`/Volume`、`/private`、`/tmp`和`/var/folders`目录是共享的。如果您的项目在此目录之外，则必须将其添加到列表中。否则，您可能会在运行时得到`Mounts denied`或`cannot start service`出错。

因此，我们可以看到在默认情况下，有几个目录是已经被共享的了。我们重点需要关注的是`/Users`目录，因为我们常常把我们的所有个人用户相关的东西，都会放在对应用户下，就我而言，我会把所有的代码都在 `/Users/caiwenhui/www` 下，这也意味着，我的所有代码，都将会被`虚拟机`同步到`linux系统`中，也正是因此，当你在MAC系统下，执行`docker run -v $(PWD):/www xxx`之类的命令的时候，你可以成功的挂载到容器中。**如果你把挂载的目录放在上述的几个目录之外**，docker命令将会`挂载失败`。

也是因为这个原因，你会发现，当你的代码，在下载大量依赖，或者在构建一堆索引的时候，或者你的`/Users`目录下有很多文件在变动的时候，你会发现你的`CPU`变成异常的高，而且会特别卡，可能你会觉得怎么那么卡。如果你不去查看哪个进程占用那么多cpu的话，你永远不会知道，其实大多数，显示出来都是docker的`虚拟机`占用的cpu为大头就是因为这个原因。

## 获取虚拟机shell

既然，我们知道了上述的共享文件了，那么我们就会想知道，我要怎么去看，怎么去调试，或者我有什么更深的理解呢？

其实是有的，例如，我想看看，整个虚拟化技术，都挂载了什么数据卷构成我们的文件系统。

我们知道`MacOS`上的`Docker Desktop for mac`实际上是在Linux虚拟机中运行的Docker容器，这对于macOS主机上使用Docker`多了一层虚拟化`。有些情况下，我们需要能够访问这个Linux虚拟机，以便实现一些`hack`操作。

### netcat

```shell
➜  ~ ll ~/Library/Containers/com.docker.docker/Data/debug-shell.sock
srwxr-xr-x  1 caiwenhui  staff     0B  8 16 21:31 /Users/caiwenhui/Library/Containers/com.docker.docker/Data/debug-shell.sock
```

我们可以看到，这里有一个名字叫`debug-shell.sock`的文件，这是一个可执行的sock文件。

使用 `nc` 命令连接Docker的`debug-shell socket`文件:

```shell
➜  ~ nc -U ~/Library/Containers/com.docker.docker/Data/debug-shell.sock
/ # ^[[49;5R
```

> 显示的提示符比较奇怪，不过不影响使用

我们使用 `df -h` 命令可以看到Docker虚拟机的存储挂载:

```shell
/ # ^[[49;5Rdf -h
df -h
Filesystem                Size      Used Available Use% Mounted on
overlay                   3.9G      4.0K      3.9G   0% /
tmpfs                     3.9G      8.0K      3.9G   0% /containers/onboot/000-dhcpcd/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/001-sysfs/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/002-sysctl/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/003-format/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/004-extend/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/005-mount/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/006-metadata/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/007-services0/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/008-services1/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/009-swap/tmp
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/010-mount-docker/tmp
/dev/vda1                94.2G     48.2G     41.2G  54% /containers/services
/dev/vda1                94.2G     48.2G     41.2G  54% /containers/services/docker
tmpfs                     3.9G      4.0K      3.9G   0% /containers/services/acpid/tmp
overlay                   3.9G      4.0K      3.9G   0% /containers/services/acpid/rootfs
tmpfs                     3.9G         0      3.9G   0% /containers/services/binfmt/tmp
overlay                   3.9G         0      3.9G   0% /containers/services/binfmt/rootfs
tmpfs                     3.9G      8.0K      3.9G   0% /containers/services/dhcpcd/tmp
overlay                   3.9G      8.0K      3.9G   0% /containers/services/dhcpcd/rootfs
tmpfs                     3.9G      4.0K      3.9G   0% /containers/services/diagnose/tmp
overlay                   3.9G      4.0K      3.9G   0% /containers/services/diagnose/rootfs
overlay                   3.9G      4.0K      3.9G   0% /containers/services/diagnose/rootfs
tmpfs                     3.9G         0      3.9G   0% /containers/onboot/011-bridge/tmp
tmpfs                    64.0M         0     64.0M   0% /dev
tmpfs                   796.2M    528.0K    795.7M   0% /run/resolvconf/resolv.conf
tmpfs                   796.2M    528.0K    795.7M   0% /run/config
tmpfs                   796.2M    528.0K    795.7M   0% /run/containerd
tmpfs                   796.2M    528.0K    795.7M   0% /run/guest-services
tmpfs                   796.2M    528.0K    795.7M   0% /run/host-services
tmpfs                   796.2M    528.0K    795.7M   0% /run/resolvconf/resolv.conf
tmpfs                     3.9G         0      3.9G   0% /sys/fs/cgroup
/dev/vda1                94.2G     48.2G     41.2G  54% /var/lib/containerd
/dev/vda1                94.2G     48.2G     41.2G  54% /var/lib/docker
tmpfs                   796.2M    528.0K    795.7M   0% /var/run
tmpfs                   796.2M    528.0K    795.7M   0% /var/run/linuxkit-containerd/containerd.sock
...
```

使用命令 `exit` 或者`^C` 可以退出这个shell

进入shell，可以执行 `. /etc/profile` 获得环境

### nsenter

使用nsenter从容器内部进入host主机的`名字空间(namespace)`，但是对文件系统是只读

另外一种巧妙的方法是运行一个debian容器，然后在这个`debian`容器中执行 `nsenter` 通过 `pid=host` 来实现进入到运行 `Docker4Mac` 的`mini VM`的进程空间，这样就相当于进入了macOS的Docker虚拟机

在这个运行的debian容器中通过 nsenter 进入到host主机，也就是Docker VM名字空间以后，就可以看到虚拟机的提示符:

```shell
➜  ~ docker run -it --rm --privileged --pid=host debian nsenter -t 1 -m -u -n -i bash
bash-5.0#
```

我们可以在这个Docker VM中执行网络检查

```shell
bash-5.0# ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 brd 127.255.255.255 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 02:50:00:00:00:01 brd ff:ff:ff:ff:ff:ff
    inet 192.168.65.3/24 brd 192.168.65.255 scope global dynamic noprefixroute eth0
       valid_lft 1576sec preferred_lft 136sec
    inet6 fe80::50:ff:fe00:1/64 scope link
       valid_lft forever preferred_lft forever
3: tunl0@NONE: <NOARP> mtu 1480 qdisc noop state DOWN group default qlen 1000
    link/ipip 0.0.0.0 brd 0.0.0.0
4: ip6tnl0@NONE: <NOARP> mtu 1452 qdisc noop state DOWN group default qlen 1000
    link/tunnel6 :: brd ::
5: services1@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 42:2f:8d:45:a3:03 brd ff:ff:ff:ff:ff:ff link-netns services
    inet 192.168.65.4 peer 192.168.65.5/32 scope global services1
       valid_lft forever preferred_lft forever
    inet6 fe80::402f:8dff:fe45:a303/64 scope link
       valid_lft forever preferred_lft forever
7: br-3a4b2ff7a5cb: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default
    link/ether 02:42:11:9a:3a:8f brd ff:ff:ff:ff:ff:ff
    inet 192.168.7.1/24 brd 192.168.7.255 scope global br-3a4b2ff7a5cb
       valid_lft forever preferred_lft forever
8: br-ef48d4809428: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default
    link/ether 02:42:10:cb:22:b6 brd ff:ff:ff:ff:ff:ff
    inet 172.18.0.1/16 brd 172.18.255.255 scope global br-ef48d4809428
       valid_lft forever preferred_lft forever
9: br-f6b05f844262: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default
    link/ether 02:42:f4:ec:b5:c4 brd ff:ff:ff:ff:ff:ff
    inet 172.19.0.1/16 brd 172.19.255.255 scope global br-f6b05f844262
       valid_lft forever preferred_lft forever
10: br-ff0c8e959ac0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default
    link/ether 02:42:48:7f:f8:bb brd ff:ff:ff:ff:ff:ff
    inet 192.168.110.1/24 brd 192.168.110.255 scope global br-ff0c8e959ac0
       valid_lft forever preferred_lft forever
11: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:b9:db:7e:59 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever
    inet6 fe80::42:b9ff:fedb:7e59/64 scope link
       valid_lft forever preferred_lft forever
...
```

因为信息比较多，我们重点关注几个网卡信息

```shell
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 02:50:00:00:00:01 brd ff:ff:ff:ff:ff:ff
    inet 192.168.65.3/24 brd 192.168.65.255 scope global dynamic noprefixroute eth0
       valid_lft 1576sec preferred_lft 136sec
    inet6 fe80::50:ff:fe00:1/64 scope link
       valid_lft forever preferred_lft forever
11: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:b9:db:7e:59 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever
    inet6 fe80::42:b9ff:fedb:7e59/64 scope link
       valid_lft forever preferred_lft forever
```

![docker for mac 5](/images/k8s/docker-for-mac-5.png)

上面的信息，结合来看，我们在`docker-for-mac`客户端设置了我们的虚拟机的网段 `192.168.65.0/24`，结合`eth0`和`docker0`这2个网卡信息，我们会发现，`eth0` 的 `192.168.65.3`, 就是我们这是的网段的信息，所以，这个虚拟机和macOS物理主机上对应的IP地址 `192.168.65.1` 对应，也就是说，如果我们使用 `NFS 方式`挂载物理主机上的NFS卷，访问的NFS服务器端地址就是这样获得的。

这里还可以看到在`Docker VM`上运行的`Docker网络`是 `172.17.xx.xx/16` ，是一个`NAT网络`，我们可以看到在`Docker VM端`分配的IP地址是 `172.17.0.1` 。这也验证了我们的`Docker VM`上实际上有`2个网络`。

- `192.168.65.x/24` => 和`物理主机macOS`连接的NAT网络，用于虚拟机
- `172.17.x.x/16` => 和`Docker0`连接的NAT网络，用于容器

在Docker容器中，通过两层NAT，依然可以访问外界Internet。不过，反过来，外部需要访问Docker容器就比较麻烦了，需要做`端口映射`。

## 挂载

我们前面说到了，当你通过 `docker run -v`的时候，你可以指定在`共享目录`下的所有文件下，进行挂载进去。那么我们反过来想一下，既然是共享目录的话，那么容器是如何做到查找这些目录的呢？

通过`mount -l`，我们可以看到挂载点。

```shell
bash-5.0# mount -l
rootfs on / type tmpfs (ro,relatime)
proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)
tmpfs on /run type tmpfs (rw,nosuid,nodev,noexec,relatime,size=815300k,mode=755)
tmpfs on /tmp type tmpfs (rw,nosuid,nodev,noexec,relatime,size=815300k)
tmpfs on /var type tmpfs (rw,nosuid,nodev,noexec,relatime,mode=755)
dev on /dev type devtmpfs (rw,nosuid,noexec,relatime,size=4008488k,nr_inodes=1002122,mode=755)
mqueue on /dev/mqueue type mqueue (rw,nosuid,nodev,noexec,relatime)
shm on /dev/shm type tmpfs (rw,nosuid,nodev,noexec,relatime)
devpts on /dev/pts type devpts (rw,nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=000)
sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)
securityfs on /sys/kernel/security type securityfs (rw,nosuid,nodev,noexec,relatime)
debugfs on /sys/kernel/debug type debugfs (rw,nosuid,nodev,noexec,relatime)
fusectl on /sys/fs/fuse/connections type fusectl (rw,nosuid,nodev,noexec,relatime)
pstore on /sys/fs/pstore type pstore (rw,nosuid,nodev,noexec,relatime)
none on /sys/fs/bpf type bpf (rw,nodev,relatime)
binfmt_misc on /proc/sys/fs/binfmt_misc type binfmt_misc (rw,nosuid,nodev,noexec,relatime)
cgroup_root on /sys/fs/cgroup type tmpfs (rw,nosuid,nodev,noexec,relatime,size=10240k,mode=755)
cpuset on /sys/fs/cgroup/cpuset type cgroup (rw,nosuid,nodev,noexec,relatime,cpuset)
cpu on /sys/fs/cgroup/cpu type cgroup (rw,nosuid,nodev,noexec,relatime,cpu)
cpuacct on /sys/fs/cgroup/cpuacct type cgroup (rw,nosuid,nodev,noexec,relatime,cpuacct)
blkio on /sys/fs/cgroup/blkio type cgroup (rw,nosuid,nodev,noexec,relatime,blkio)
memory on /sys/fs/cgroup/memory type cgroup (rw,nosuid,nodev,noexec,relatime,memory)
devices on /sys/fs/cgroup/devices type cgroup (rw,nosuid,nodev,noexec,relatime,devices)
freezer on /sys/fs/cgroup/freezer type cgroup (rw,nosuid,nodev,noexec,relatime,freezer)
net_cls on /sys/fs/cgroup/net_cls type cgroup (rw,nosuid,nodev,noexec,relatime,net_cls)
perf_event on /sys/fs/cgroup/perf_event type cgroup (rw,nosuid,nodev,noexec,relatime,perf_event)
net_prio on /sys/fs/cgroup/net_prio type cgroup (rw,nosuid,nodev,noexec,relatime,net_prio)
hugetlb on /sys/fs/cgroup/hugetlb type cgroup (rw,nosuid,nodev,noexec,relatime,hugetlb)
pids on /sys/fs/cgroup/pids type cgroup (rw,nosuid,nodev,noexec,relatime,pids)
...
```

可以看到，我们这里有大量的挂载点，这些挂载点，组合成了一个独立的文件系统，或者各种命名空间。

现在有一个需求。例如，我们知道在使用k8s的时候，当我们用`pv`的`type`为`hostPath`的时候，是可以做到持久化数据磁盘的，那么我能不能做到，数据存放在`Docker VM 非共享目录`中呢？

就是我的物理主机，并不希望同步这些数据。这些数据仅仅只需要存在`Docker VM`中就好了。

当然，这个场景就是我们经常说，我们想要看一些容器的配置或者目录的时候，会发现输出的路径，在我们的宿主机上找不到，为什么会这样子？难道是出错了吗？其实只是这些文件都在`Docker VM`中，其实就是因为这个原因导致的。只要我们进入到 `Docker VM`就可以看到这些文件。

例如，以我目前的例子为例子，我需要采集我本地所有`k8s-pods`的输出在终端的日志信息，我想通过`promtail`来进行日志采集，然后通过`loki`作为存储和查询服务器，再通过`grafna`来进行展示。我们的服务以前台的方式进行启动，所以我们那么首先我需要解决的第一个问题，就是pods的标准输出到哪里？后来发现`/var/log/pods/`。

```shell
bash-5.0# ls -l /var/log/pods/
total 0
drwxr-xr-x    3 root     root            60 Aug 18 09:05 default_dev-grafana-7cd4c89fd4-wdkpb_cf869741-be0d-44d2-b776-3239dd276069
drwxr-xr-x    3 root     root            60 Aug 18 09:05 default_dev-loki-statefulset-0_1d34dcac-a763-478a-b17b-addb082462ef
drwxr-xr-x    3 root     root            60 Aug 18 09:05 default_dev-loki-statefulset-1_c82d61e9-c66f-4b6a-960a-a8f7a1d5a8e2
drwxr-xr-x    3 root     root            60 Aug 18 09:05 default_dev-promtail-n6jgs_51afda31-be9c-4377-8167-8e29e991d9b0
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_coredns-558bd4d5db-g2m9h_67ec7c7f-2e48-4cd7-8298-86295073072b
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_coredns-558bd4d5db-jk9bp_b9d8b64f-dda8-426a-8f55-029298828333
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_etcd-docker-desktop_5d9d97b8d8daed31d6fd5c6d386c29c5
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_kube-apiserver-docker-desktop_6fcd2fd42808f86960df2a06a72d6dc0
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_kube-controller-manager-docker-desktop_bed77ee1871d9eabd1710836ad671f32
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_kube-proxy-4wbs6_8bece9c8-e5fb-41f5-8869-2d408e71ba31
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_kube-scheduler-docker-desktop_a52842863dff28cb2f7d4171a9f614a0
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_storage-provisioner_79a3e8e5-6a93-43c1-abf3-c916384a4018
drwxr-xr-x    3 root     root            60 Aug 16 13:32 kube-system_vpnkit-controller_3742d607-ea8f-43df-aecf-4f925accbc3e
```

我们随便找一个pods，去查看日志。

```shell
bash-5.0# tail -n 10 /var/log/pods/default_dev-grafana-7cd4c89fd4-wdkpb_cf869741-be0d-44d2-b776-3239dd276069/grafana/0.log
{"log":"{\"@level\":\"debug\",\"@message\":\"datasource: registering query type handler\",\"@timestamp\":\"2021-08-18T09:05:05.385825Z\",\"queryType\":\"node_graph\"}\n","stream":"stderr","time":"2021-08-18T09:05:05.3860495Z"}
{"log":"{\"@level\":\"debug\",\"@message\":\"datasource: registering query type fallback handler\",\"@timestamp\":\"2021-08-18T09:05:05.385855Z\"}\n","stream":"stderr","time":"2021-08-18T09:05:05.3860803Z"}
{"log":"t=2021-08-18T09:05:05+0000 lvl=info msg=\"HTTP Server Listen\" logger=http.server address=[::]:3000 protocol=http subUrl= socket=\n","stream":"stdout","time":"2021-08-18T09:05:05.3939314Z"}
{"log":"t=2021-08-18T09:07:52+0000 lvl=eror msg=\"Failed to look up user based on cookie\" logger=context error=\"user token not found\"\n","stream":"stdout","time":"2021-08-18T09:07:52.5402974Z"}
{"log":"t=2021-08-18T09:07:52+0000 lvl=info msg=\"Request Completed\" logger=context userId=0 orgId=0 uname= method=GET path=/dashboard/new status=302 remote_addr=192.168.65.3 time_ms=0 size=29 referer=\n","stream":"stdout","time":"2021-08-18T09:07:52.5403468Z"}
{"log":"t=2021-08-18T09:07:56+0000 lvl=info msg=\"Successful Login\" logger=http.server User=admin@localhost\n","stream":"stdout","time":"2021-08-18T09:07:56.6167821Z"}
{"log":"t=2021-08-18T09:08:00+0000 lvl=info msg=\"Request Completed\" logger=context userId=1 orgId=1 uname=admin method=GET path=/login status=302 remote_addr=192.168.65.3 time_ms=11 size=24 referer=\n","stream":"stdout","time":"2021-08-18T09:08:00.7292107Z"}
{"log":"t=2021-08-18T09:09:50+0000 lvl=info msg=\"Request Completed\" logger=context userId=1 orgId=1 uname=admin method=GET path=/api/datasources/proxy/1/loki/api/v1/query_range status=400 remote_addr=192.168.65.3 time_ms=2 size=57 referer=\"http://localhost:3000/dashboard/new?editPanel=2\u0026orgId=1\"\n","stream":"stdout","time":"2021-08-18T09:09:50.7530735Z"}
{"log":"t=2021-08-18T09:14:53+0000 lvl=eror msg=\"Data proxy error\" logger=data-proxy-log userId=1 orgId=1 uname=admin path=/api/datasources/proxy/1/loki/api/v1/label/filename/values remote_addr=192.168.65.3 referer=\"http://localhost:3000/d/UWO8RT7nk/new-dashboard-copy?editPanel=2\u0026viewPanel=2\u0026orgId=1\" error=\"http: proxy error: EOF\"\n","stream":"stdout","time":"2021-08-18T09:14:53.0497419Z"}
{"log":"t=2021-08-18T09:14:53+0000 lvl=eror msg=\"Request Completed\" logger=context userId=1 orgId=1 uname=admin method=GET path=/api/datasources/proxy/1/loki/api/v1/label/filename/values status=502 remote_addr=192.168.65.3 time_ms=79695 size=0 referer=\"http://localhost:3000/d/UWO8RT7nk/new-dashboard-copy?editPanel=2\u0026viewPanel=2\u0026orgId=1\"\n","stream":"stdout","time":"2021-08-18T09:14:53.0502414Z"}
```

现在，我们知道了日志是存储在这里了，那么我们就可以知道，在`Docker VM`中，我们只需要挂载`/var/log/pods`到我们的容器`promtail`中，然后进行采集再推送到`loki`，就可以通过`grafna`查询了。

这个思路是没问题的，那么我们再往深程度的角度想，那么这个时候，我们的`k8s-pv-type`应该填什么呢？刚才不是说了`hostPath`是可以持久化到本地吗？但是那是针对物理主机`macos`来说的，况且这个目录，我们并非在`Docker VM`之下，这就回到了我们上面说的，在`Docker VM`存在，在`物理主机`不存在的需求。

那么我们这个时候，其实还是可以使用`hostPath`的，理由很简单，因为k8s会识别路径，如果是在共享目录下的话，那么他会从共享目录的数据卷中找到对应的磁盘路径，如果不在共享目录下的，则从`Docker VM`中查找，因此，这就是解开了我们这个疑惑了。可以大胆的放心使用`hostPath`来创建`pv`资源。

最后，附上一张最终的效果图：

![docker-for-mac-6](/images/k8s/docker-for-mac-6.png)
