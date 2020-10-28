---
title: 【kubernetes】测试集群部署
date: 2019-05-28 11:28:30
categories: [kubernetes, Docker]
tags: [kubernetes]
---

## 前言

为了在公司推广 docker 和 k8s，方便我们开发人员去更好的维护自己的对应的生产环境
目前用 k8s 构建我们自己的测试环境，用于接口测试和功能测试专用。
本文记录一下集群部署的情况

<!-- more -->

## 机器准备

最小化分布式集群安装，一台master，一台node。后续可以调整为多master，解决单点问题，node的话也可以增加以加入集群。

| hostname | IP            | 配置  | 操作系统                                                                                                                       |
| -------- | ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| matser   | 192.168.8.171 | 4核8G | CentOS Linux release 7.2.1511 (Core)，Linux version 3.10.0-327.el7.x86_64，gcc version 4.8.3 20140911 (Red Hat 4.8.3-9) (GCC)  |
| node1    | 192.168.8.174 | 4核8G | CentOS Linux release 7.2.1511 (Core) ，Linux version 3.10.0-327.el7.x86_64，gcc version 4.8.3 20140911 (Red Hat 4.8.3-9) (GCC) |

## 安装k8s集群

### 检查各机器防火墙状态

```shell
systemctl list-unit-files | grep firewalld.service
```

如果防火墙的状态是 `enabled` 的话，暂时先关闭防火墙，为了不影响我们的测试部署

关闭防火墙 && 禁止随开机启动

```shell
systemctl stop firewalld.service && systemctl disable firewalld.service
```

### 关闭各机器上的SELINUX

```shell
setenforce 0 && sed -i 's/SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config
```

### 同步各机器时间差

```shell
yum install -y ntpdate && ntpdate -u ntp.api.bz
```

### 修改各个机器的hostname和hosts文件

修改 `etc/hosts`

```shell
master_ip=192.168.8.171;node1_ip=192.168.8.174;echo -e "\n${master_ip} master\n${node1_ip} node1" >> /etc/hosts
```

修改 `master` 的 `hostname`

```shell
hostnamectl set-hostname master 
```

修改 `node1` 的 `hostname`

```shell
hostnamectl set-hostname node1 
```

### 配置相关的yum仓库

#### 配置阿里云docker-ce仓库

```shell
wget https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo -O  /etc/yum.repos.d/docker-ce.repo
```

#### 配置阿里云k8s仓库

```shell
cat > /etc/yum.repos.d/kubernetes.repo << EOF
[kubernetes]
name=Kubernetes Repo
baseurl=https://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64/
gpgcheck=1
gpgkey=https://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
enable=1
EOF
```

### 安装docker kubelet kubeadm kubectl

当前最新版：`1.14.2`

为了稳定性考虑，目前暂时考虑最新版的前一个版本`1.14.1`

| kubeadm                 | kubectl                 | kubelet                 |
| ----------------------- | ----------------------- | ----------------------- |
| kubeadm-1.14.1-0.x86_64 | kubectl-1.14.1-0.x86_64 | kubelet-1.14.1-0.x86_64 |

由于利用kubeadm部署集群，查看kubeadm所有版本，因为kuadm和kubectl和kubelet都要对应好版本，所以如果版本不对应的话，可能需要降级或者升级操作

```shell
yum list --showduplicates | grep kubeadm
```

```shell
yum install -y docker kubelet-1.14.1-0 kubeadm-1.14.1-0 kubectl-1.14.1-0
``` 

```shell
rpm -qa | grep kubeadm && rpm -qa | grep kubelet && rpm -qa | grep kubectl
```

### 修改系统内核参数

由于docker随后会大量的操作iptables，所有nf-call的值要设置为1，尽量不使用swap

```shell
cat > /etc/sysctl.d/k8s-sysctl.conf <<EOF
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
vm.swappiness = 0
EOF
```

刷新内核配置参数

```shell
sysctl --system
```

查看参数信息

```shell
cat /proc/sys/net/bridge/bridge-nf-call-iptables
```

### 设置随开机启动

```shell
systemctl enable docker && systemctl enable kubelet
```

### 设置kubelet忽略swap

```shell
echo 'KUBELET_EXTRA_ARGS="--fail-swap-on=false"' > /etc/sysconfig/kubelet
```

### 关闭swap

```shell
swapoff -a
```

### 启动docker

```shell
systemctl start docker
``` 

确保docker已启动

```shell
systemctl status docker
```

### 下载k8s核心组件镜像

由于k8s的镜像在谷歌云，所以我们需要在国内的镜像源中获取镜像，下面是为从国内镜像源中找到的镜像源，后续，我们可以做一个我们自己的私有仓库，保存这里镜像

```shell
cat > deploy.sh <<EOF
#/usr/bin/env bash

## k8s-core
images=(
    kube-proxy:v1.14.1
    kube-apiserver:v1.14.1
    kube-controller-manager:v1.14.1
    kube-scheduler:v1.14.1
    etcd:3.3.10
    pause:3.1
)
for imageName in \${images[@]}; do
    docker pull mirrorgooglecontainers/\${imageName}
    docker tag mirrorgooglecontainers/\${imageName} k8s.gcr.io/\${imageName}
    docker rmi mirrorgooglecontainers/\${imageName}
done

## k8s-network-manager
images=(
    coredns:1.3.1
)
for imageName in \${images[@]}; do
  docker pull coredns/\${imageName}
  docker tag coredns/\${imageName} k8s.gcr.io/\${imageName}
  docker rmi coredns/\${imageName}
done
	

## k8s-web-ui
## docker pull gcrxio/kubernetes-dashboard-amd64:v1.10.1 && docker tag gcrxio/kubernetes-dashboard-amd64:v1.10.1 k8s.gcr.io/kubernetes-dashboard-amd64:v1.10.1 && docker rmi gcrxio/kubernetes-dashboard-amd64:v1.10.1

## nginx-ingress-controller
## docker pull bitnami/nginx-ingress-controller:0.24.1 && docker tag bitnami/nginx-ingress-controller:0.24.1 quay.io/kubernetes-ingress-controller/nginx-ingress-controller:0.24.1 && docker rmi bitnami/nginx-ingress-controller:0.24.1
EOF
```

```shell
chmod +x deploy.sh
```

执行 `deploy.sh` 脚本

等待下载安装，完毕之后，查看一下镜像是否已经下载好了

```shell
[root@master ~]# docker images
REPOSITORY                           TAG                 IMAGE ID            CREATED             SIZE
k8s.gcr.io/kube-proxy                v1.14.1             20a2d7035165        7 weeks ago         82.1 MB
k8s.gcr.io/kube-apiserver            v1.14.1             cfaa4ad74c37        7 weeks ago         210 MB
k8s.gcr.io/kube-scheduler            v1.14.1             8931473d5bdb        7 weeks ago         81.6 MB
k8s.gcr.io/kube-controller-manager   v1.14.1             efb3887b411d        7 weeks ago         158 MB
k8s.gcr.io/coredns                   1.3.1               eb516548c180        4 months ago        40.3 MB
k8s.gcr.io/etcd                      3.3.10              2c4adeb21b4f        5 months ago        258 MB
k8s.gcr.io/pause                     3.1                 da86e6ba6ca1        17 months ago       742 kB
```
下载好了之后，我们就开始部署我们的k8s集群

### 初始化k8s-matser

在 `master` 节点初始化操作

```shell
kubeadm init --kubernetes-version=v1.14.1 --pod-network-cidr=10.244.0.0/16 --ignore-preflight-errors=Swap
```

过程如下：

```shell
[init] Using Kubernetes version: v1.14.1
[preflight] Running pre-flight checks
[preflight] Pulling images required for setting up a Kubernetes cluster
[preflight] This might take a minute or two, depending on the speed of your internet connection
[preflight] You can also perform this action in beforehand using 'kubeadm config images pull'
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Activating the kubelet service
[certs] Using certificateDir folder "/etc/kubernetes/pki"
[certs] Generating "ca" certificate and key
[certs] Generating "apiserver" certificate and key
[certs] apiserver serving cert is signed for DNS names [master kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local] and IPs [10.96.0.1 192.168.8.171]
[certs] Generating "apiserver-kubelet-client" certificate and key
[certs] Generating "front-proxy-ca" certificate and key
[certs] Generating "front-proxy-client" certificate and key
[certs] Generating "etcd/ca" certificate and key
[certs] Generating "etcd/server" certificate and key
[certs] etcd/server serving cert is signed for DNS names [master localhost] and IPs [192.168.8.171 127.0.0.1 ::1]
[certs] Generating "etcd/healthcheck-client" certificate and key
[certs] Generating "etcd/peer" certificate and key
[certs] etcd/peer serving cert is signed for DNS names [master localhost] and IPs [192.168.8.171 127.0.0.1 ::1]
[certs] Generating "apiserver-etcd-client" certificate and key
[certs] Generating "sa" key and public key
[kubeconfig] Using kubeconfig folder "/etc/kubernetes"
[kubeconfig] Writing "admin.conf" kubeconfig file
[kubeconfig] Writing "kubelet.conf" kubeconfig file
[kubeconfig] Writing "controller-manager.conf" kubeconfig file
[kubeconfig] Writing "scheduler.conf" kubeconfig file
[control-plane] Using manifest folder "/etc/kubernetes/manifests"
[control-plane] Creating static Pod manifest for "kube-apiserver"
[control-plane] Creating static Pod manifest for "kube-controller-manager"
[control-plane] Creating static Pod manifest for "kube-scheduler"
[etcd] Creating static Pod manifest for local etcd in "/etc/kubernetes/manifests"
[wait-control-plane] Waiting for the kubelet to boot up the control plane as static Pods from directory "/etc/kubernetes/manifests". This can take up to 4m0s
[apiclient] All control plane components are healthy after 25.053527 seconds
[upload-config] storing the configuration used in ConfigMap "kubeadm-config" in the "kube-system" Namespace
[kubelet] Creating a ConfigMap "kubelet-config-1.14" in namespace kube-system with the configuration for the kubelets in the cluster
[upload-certs] Skipping phase. Please see --experimental-upload-certs
[mark-control-plane] Marking the node master as control-plane by adding the label "node-role.kubernetes.io/master=''"
[mark-control-plane] Marking the node master as control-plane by adding the taints [node-role.kubernetes.io/master:NoSchedule]
[bootstrap-token] Using token: f1agmt.o01kvgt0slzlj7y6
[bootstrap-token] Configuring bootstrap tokens, cluster-info ConfigMap, RBAC Roles
[bootstrap-token] configured RBAC rules to allow Node Bootstrap tokens to post CSRs in order for nodes to get long term certificate credentials
[bootstrap-token] configured RBAC rules to allow the csrapprover controller automatically approve CSRs from a Node Bootstrap Token
[bootstrap-token] configured RBAC rules to allow certificate rotation for all node client certificates in the cluster
[bootstrap-token] creating the "cluster-info" ConfigMap in the "kube-public" namespace
[addons] Applied essential addon: CoreDNS
[addons] Applied essential addon: kube-proxy

Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 192.168.8.171:6443 --token f1agmt.o01kvgt0slzlj7y6 \
    --discovery-token-ca-cert-hash sha256:a6bc1cbed5084d136237f7bfb469f82c3dfbfbdef0f967602d015b5fb5a6447d
```

需要用到kubectl的用户都需要执行如下命令

```shell
mkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config && sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

### 安装网络组件-flannel

这个时候可以看一下master节点的状态

```shell
[root@master ~]# kubectl get nodes
NAME     STATUS     ROLES    AGE   VERSION
master   NotReady   master   15h   v1.14.1
```

```shell
[root@master ~]# kubectl describe nodes master
Name:               master
Roles:              master
Labels:             beta.kubernetes.io/arch=amd64
                    beta.kubernetes.io/os=linux
                    kubernetes.io/arch=amd64
                    kubernetes.io/hostname=master
                    kubernetes.io/os=linux
                    node-role.kubernetes.io/master=
Annotations:        kubeadm.alpha.kubernetes.io/cri-socket: /var/run/dockershim.sock
                    node.alpha.kubernetes.io/ttl: 0
                    volumes.kubernetes.io/controller-managed-attach-detach: true
CreationTimestamp:  Tue, 28 May 2019 18:14:37 +0800
Taints:             node.kubernetes.io/not-ready:NoExecute
                    node-role.kubernetes.io/master:NoSchedule
                    node.kubernetes.io/not-ready:NoSchedule
Unschedulable:      false
Conditions:
  Type             Status  LastHeartbeatTime                 LastTransitionTime                Reason                       Message
  ----             ------  -----------------                 ------------------                ------                       -------
  MemoryPressure   False   Wed, 29 May 2019 09:15:07 +0800   Tue, 28 May 2019 18:14:28 +0800   KubeletHasSufficientMemory   kubelet has sufficient memory available
  DiskPressure     False   Wed, 29 May 2019 09:15:07 +0800   Tue, 28 May 2019 18:14:28 +0800   KubeletHasNoDiskPressure     kubelet has no disk pressure
  PIDPressure      False   Wed, 29 May 2019 09:15:07 +0800   Tue, 28 May 2019 18:14:28 +0800   KubeletHasSufficientPID      kubelet has sufficient PID available
  Ready            False   Wed, 29 May 2019 09:15:07 +0800   Tue, 28 May 2019 18:14:28 +0800   KubeletNotReady              runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:docker: network plugin is not ready: cni config uninitialized
Addresses:
  InternalIP:  192.168.8.171
  Hostname:    master
Capacity:
 cpu:                4
 ephemeral-storage:  51175Mi
 hugepages-2Mi:      0
 memory:             8009192Ki
 pods:               110
Allocatable:
 cpu:                4
 ephemeral-storage:  48294789041
 hugepages-2Mi:      0
 memory:             7906792Ki
 pods:               110
System Info:
 Machine ID:                 fae837ec0d8a402ab8085d2e0ae4624f
 System UUID:                421D57E8-3C84-52D4-17F1-7D87F3BF8FF8
 Boot ID:                    b6c7d535-ad5f-41b1-9636-4e46e96adaf0
 Kernel Version:             3.10.0-957.el7.x86_64
 OS Image:                   CentOS Linux 7 (Core)
 Operating System:           linux
 Architecture:               amd64
 Container Runtime Version:  docker://1.13.1
 Kubelet Version:            v1.14.1
 Kube-Proxy Version:         v1.14.1
PodCIDR:                     10.244.0.0/24
Non-terminated Pods:         (5 in total)
  Namespace                  Name                              CPU Requests  CPU Limits  Memory Requests  Memory Limits  AGE
  ---------                  ----                              ------------  ----------  ---------------  -------------  ---
  kube-system                etcd-master                       0 (0%)        0 (0%)      0 (0%)           0 (0%)         14h
  kube-system                kube-apiserver-master             250m (6%)     0 (0%)      0 (0%)           0 (0%)         14h
  kube-system                kube-controller-manager-master    200m (5%)     0 (0%)      0 (0%)           0 (0%)         14h
  kube-system                kube-proxy-nz9h6                  0 (0%)        0 (0%)      0 (0%)           0 (0%)         15h
  kube-system                kube-scheduler-master             100m (2%)     0 (0%)      0 (0%)           0 (0%)         14h
Allocated resources:
  (Total limits may be over 100 percent, i.e., overcommitted.)
  Resource           Requests    Limits
  --------           --------    ------
  cpu                550m (13%)  0 (0%)
  memory             0 (0%)      0 (0%)
  ephemeral-storage  0 (0%)      0 (0%)
Events:              <none>
```

我们看到这里告诉我们网络插件并没有准备好。所以我们接下来安装网络插件

```shell
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

过一会儿我们再来看一下节点的信息

```shell
[root@master ~]# kubectl get nodes
NAME     STATUS   ROLES    AGE   VERSION
master   Ready    master   16h   v1.14.1
```

发现我们的 `master`节点已经是 `Ready` 状态了。

### 加入node工作节点

还记得我们再初始化master的时候有，有如下提示：

```shell
Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 192.168.8.171:6443 --token f1agmt.o01kvgt0slzlj7y6 \
    --discovery-token-ca-cert-hash sha256:a6bc1cbed5084d136237f7bfb469f82c3dfbfbdef0f967602d015b5fb5a6447d
```

这个需要我们在`node` 节点执行的命令，一定要保存好，以后扩展node节点的时候，都要用这个 `token` 和 `discovery-token-ca-cert-hash`

在`node1`的机器上执行如下命令

```shell
kubeadm join 192.168.8.171:6443 --token f1agmt.o01kvgt0slzlj7y6 \
    --discovery-token-ca-cert-hash sha256:a6bc1cbed5084d136237f7bfb469f82c3dfbfbdef0f967602d015b5fb5a6447d
```

过程如下
```shell
[preflight] Running pre-flight checks
[preflight] Reading configuration from the cluster...
[preflight] FYI: You can look at this config file with 'kubectl -n kube-system get cm kubeadm-config -oyaml'
[kubelet-start] Downloading configuration for the kubelet from the "kubelet-config-1.14" ConfigMap in the kube-system namespace
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Activating the kubelet service
[kubelet-start] Waiting for the kubelet to perform the TLS Bootstrap...

This node has joined the cluster:
* Certificate signing request was sent to apiserver and a response was received.
* The Kubelet was informed of the new secure connection details.

Run 'kubectl get nodes' on the control-plane to see this node join the cluster.
```

在 `master` 的机器上执行如下命令

```shell
[root@master ~]# kubectl get nodes
NAME     STATUS   ROLES    AGE     VERSION
master   Ready    master   16h     v1.14.1
node1    Ready    <none>   2m39s   v1.14.1
```

发现node1节点已经加入进来了，并且状态已经是 `Ready`

```shell
[root@master ~]# kubectl get pods -n kube-system -o wide
NAME                             READY   STATUS    RESTARTS   AGE     IP              NODE     NOMINATED NODE   READINESS GATES
coredns-fb8b8dccf-cr7t4          1/1     Running   0          16h     10.244.0.2      master   <none>           <none>
coredns-fb8b8dccf-hn5kh          1/1     Running   0          16h     10.244.0.3      master   <none>           <none>
etcd-master                      1/1     Running   0          16h     192.168.8.171   master   <none>           <none>
kube-apiserver-master            1/1     Running   0          16h     192.168.8.171   master   <none>           <none>
kube-controller-manager-master   1/1     Running   0          16h     192.168.8.171   master   <none>           <none>
kube-flannel-ds-amd64-27cts      1/1     Running   0          3m29s   192.168.8.174   node1    <none>           <none>
kube-flannel-ds-amd64-wk4c9      1/1     Running   0          91m     192.168.8.171   master   <none>           <none>
kube-proxy-mfjlr                 1/1     Running   0          3m29s   192.168.8.174   node1    <none>           <none>
kube-proxy-nz9h6                 1/1     Running   0          16h     192.168.8.171   master   <none>           <none>
kube-scheduler-master            1/1     Running   0          16h     192.168.8.171   master   <none>           <none>
```

这里我们可以看到所有的k8s组件pods都已经准备就绪，到此位置，一个`master`一个`node`的k8s已经部署完毕。

## 遇到的坑

### SELinux is not supported with the overlay2 graph driver on this kernel

意思是：

此linux的内核中的SELinux不支持 overlay2 graph driver ，解决方法有两个，要么启动一个新内核，要么就在docker里禁用selinux，--selinux-enabled=false

打开docker配置文件

`vim /etc/sysconfig/docker`

```shell
OPTIONS='--selinux-enabled --log-driver=journald --signature-verification=false'
if [ -z "${DOCKER_CERT_PATH}" ]; then
    DOCKER_CERT_PATH=/etc/docker
fi
```

改为如下:

```shell
OPTIONS='--selinux-enabled=false --log-driver=journald --signature-verification=false'
if [ -z "${DOCKER_CERT_PATH}" ]; then
    DOCKER_CERT_PATH=/etc/docker
fi
```

改完之后再启动docker即可。

### [kubelet-check] connection refused

[kubelet-check] The HTTP call equal to 'curl -sSL http://localhost:10255/healthz' failed with error: Get http://localhost:10255/healthz: dial tcp [::1]:10255: connection refused

初始化过程中，master初始化的过程中，发现总是在校验kubelet服务的时候失败，会报如上内容。

查看`kubelet`服务是否启动了

```shell
systemctl status kubelet
```

发现服务是没有启动的。

由于没有详细的信息，所以执行如下命令：

```shell
journalctl -xeu kubelet
```

得到如下结果：

```
Failed to find subsystem mount for required subsystem: pid
```

我们的 `cgroup` 不支持 `pids`，所以运行不起来。

查看当前系统支持哪些subsystem

```shell
cat /proc/cgroups
#subsys_name    hierarchy       num_cgroups     enabled
cpuset  5       11      1
cpu     4       104     1
cpuacct 4       104     1
memory  6       104     1
devices 3       104     1
freezer 2       11      1
net_cls 8       11      1
blkio   9       104     1
perf_event      10      11      1
hugetlb 7       11      1
```

发现确实没有`pids`。查看当前系统内核。

```
uname -r
3.10.0-327.el7.x86_64
```

这个内核正是开头所说的内核版本。那我们只能升级内核版本了。看一下有什么内核版本可以升级。

```shell
yum list kernel.x86_64 --showduplicates | sort -r
* updates: ap.stykers.moe
Loading mirror speeds from cached hostfile
Loaded plugins: fastestmirror, langpacks
kernel.x86_64                   3.10.0-957.el7                         base     
kernel.x86_64                   3.10.0-957.5.1.el7                     updates  
kernel.x86_64                   3.10.0-957.1.3.el7                     updates  
kernel.x86_64                   3.10.0-957.10.1.el7                    updates  
kernel.x86_64                   3.10.0-327.el7                         @anaconda
Installed Packages
 * extras: mirrors.huaweicloud.com
 * epel: mirrors.aliyun.com
 * elrepo: mirrors.tuna.tsinghua.edu.cn
 * base: ap.stykers.moe
Available Packages
```

```shell
yum install kernel-3.10.0-957.el7.x86_64 -y
```

CentOS 7使用grub2作为引导程序，查看有哪些内核选项

```shell
cat /boot/grub2/grub.cfg |grep menuentry  ##查看有哪些内核选项
if [ x"${feature_menuentry_id}" = xy ]; then
  menuentry_id_option="--id"
  menuentry_id_option=""
export menuentry_id_option
menuentry 'CentOS Linux (3.10.0-957.el7.x86_64) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-3.10.0-327.el7.x86_64-advanced-7787952f-c2d4-4216-ae09-5188e7fd88b8' {
menuentry 'CentOS Linux (3.10.0-327.el7.x86_64) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-3.10.0-327.el7.x86_64-advanced-7787952f-c2d4-4216-ae09-5188e7fd88b8' {
menuentry 'CentOS Linux (0-rescue-d918a8d2df0e481a820b4e5554fed3b5) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-0-rescue-d918a8d2df0e481a820b4e5554fed3b5-advanced-7787952f-c2d4-4216-ae09-5188e7fd88b8' {
```

查看默认启动内核

```shell
grub2-editenv list
```

重启系统，更换内核版本

```shell
reboot
```

重启后在查看内核版本换了没，subsystem中是否有pids

```shell
uname -r
```

```shell
cat /proc/cgroups
#subsys_name    hierarchy       num_cgroups     enabled
cpuset  5       11      1
cpu     4       110     1
cpuacct 4       110     1
memory  3       110     1
devices 6       110     1
freezer 7       11      1
net_cls 2       11      1
blkio   10      110     1
perf_event      8       11      1
hugetlb 9       11      1
pids    11      110     1
net_prio        2       11      1
```

ok，这个时候支持了pids，所以这个时候，这个问题就解决了。

### 每次重启都需要关闭swap

```
swapoff -a
```
