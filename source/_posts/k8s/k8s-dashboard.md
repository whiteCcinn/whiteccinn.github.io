---
title: 【kubernetes】dashboard
date: 2019-06-12 17:00:30
categories: [kubernetes]
tags: [kubernetes]
---

## 前言

[dashboard](https://github.com/kubernetes/dashboard)

dashboard 是一款基于容器的监控 k8s 集群情况的一个仪表盘项目

本文中使用的版本为：v1.10.1

<!-- more -->

## 安装

从国内找到版本对应的镜像，拉取到本地并且重命名镜像

```shell
docker pull gcrxio/kubernetes-dashboard-amd64:v1.10.1 && docker tag gcrxio/kubernetes-dashboard-amd64:v1.10.1 k8s.gcr.io/kubernetes-dashboard-amd64:v1.10.1 && docker rmi gcrxio/kubernetes-dashboard-amd64:v1.10.1
```

然后下载对应版本的 yaml，保存在  本地，不以补丁的形式更新，我们用配置式的方式来创建 pods

```shell
wget https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml
```

接下来，我们要至少修改 1 个细节

- service 中添加 {"spec":{"type":"NodePort"}}/{"spec":{"ports":{"nodePort":30001}}}

> 如果不指定 nodeport 的话，会随机分配一个 30000 以上的端口

```yaml
# ------------------- Dashboard Service ------------------- #

kind: Service
apiVersion: v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kube-system
spec:
  type: NodePort
  ports:
    - port: 443
      targetPort: 8443
      nodePort: 30001
  selector:
    k8s-app: kubernetes-dashboard
```

完整的模板如下：

```yaml
# Copyright 2017 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# ------------------- Dashboard Secret ------------------- #

apiVersion: v1
kind: Secret
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard-certs
  namespace: kube-system
type: Opaque

---
# ------------------- Dashboard Service Account ------------------- #

apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kube-system

---
# ------------------- Dashboard Role & Role Binding ------------------- #

kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: kubernetes-dashboard-minimal
  namespace: kube-system
rules:
  # Allow Dashboard to create 'kubernetes-dashboard-key-holder' secret.
  - apiGroups: ['']
    resources: ['secrets']
    verbs: ['create']
    # Allow Dashboard to create 'kubernetes-dashboard-settings' config map.
  - apiGroups: ['']
    resources: ['configmaps']
    verbs: ['create']
    # Allow Dashboard to get, update and delete Dashboard exclusive secrets.
  - apiGroups: ['']
    resources: ['secrets']
    resourceNames:
      ['kubernetes-dashboard-key-holder', 'kubernetes-dashboard-certs']
    verbs: ['get', 'update', 'delete']
    # Allow Dashboard to get and update 'kubernetes-dashboard-settings' config map.
  - apiGroups: ['']
    resources: ['configmaps']
    resourceNames: ['kubernetes-dashboard-settings']
    verbs: ['get', 'update']
    # Allow Dashboard to get metrics from heapster.
  - apiGroups: ['']
    resources: ['services']
    resourceNames: ['heapster']
    verbs: ['proxy']
  - apiGroups: ['']
    resources: ['services/proxy']
    resourceNames: ['heapster', 'http:heapster:', 'https:heapster:']
    verbs: ['get']

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: kubernetes-dashboard-minimal
  namespace: kube-system
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: kubernetes-dashboard-minimal
subjects:
  - kind: ServiceAccount
    name: kubernetes-dashboard
    namespace: kube-system

---
# ------------------- Dashboard Deployment ------------------- #

kind: Deployment
apiVersion: apps/v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kube-system
spec:
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      k8s-app: kubernetes-dashboard
  template:
    metadata:
      labels:
        k8s-app: kubernetes-dashboard
    spec:
      containers:
        - name: kubernetes-dashboard
          image: k8s.gcr.io/kubernetes-dashboard-amd64:v1.10.1
          ports:
            - containerPort: 8443
              protocol: TCP
          args:
            - --auto-generate-certificates
            # Uncomment the following line to manually specify Kubernetes API server Host
            # If not specified, Dashboard will attempt to auto discover the API server and connect
            # to it. Uncomment only if the default does not work.
            # - --apiserver-host=http://my-address:port
          volumeMounts:
            - name: kubernetes-dashboard-certs
              mountPath: /certs
              # Create on-disk volume to store exec logs
            - mountPath: /tmp
              name: tmp-volume
          livenessProbe:
            httpGet:
              scheme: HTTPS
              path: /
              port: 8443
            initialDelaySeconds: 30
            timeoutSeconds: 30
      volumes:
        - name: kubernetes-dashboard-certs
          secret:
            secretName: kubernetes-dashboard-certs
        - name: tmp-volume
          emptyDir: {}
      serviceAccountName: kubernetes-dashboard
      # Comment the following tolerations if Dashboard must not be deployed on master
      tolerations:
        - key: node-role.kubernetes.io/master
          effect: NoSchedule

---
# ------------------- Dashboard Service ------------------- #

kind: Service
apiVersion: v1
metadata:
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kube-system
spec:
  type: NodePort
  ports:
    - port: 443
      targetPort: 8443
      nodePort: 30001
  selector:
    k8s-app: kubernetes-dashboard
```

```shell
kubectl apply -f kubernetes-dashboard.yaml --record
```

等一会就可以了

```
[root@master ~]# kubectl get pods -n kube-system
NAME                                    READY   STATUS    RESTARTS   AGE
kubernetes-dashboard-5f7b999d65-s2lgq   1/1     Running   0          17h
```

然后我们看一下对应等网络端口监听

```shell
[root@master ~]# netstat -anp | grep 30001
tcp6       0      0 :::30001                :::*                    LISTEN      27609/kube-proxy
```

```shell
[root@master ~]# kubectl get svc -n kube-system
NAME                   TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                  AGE
kubernetes-dashboard   NodePort    10.104.204.139   <none>        443:30001/TCP            17h
```

发现也生效了。

> 注意：我们访问的时候是通过<NodeIP：NodePort>的方式来访问，而且必须是`https`的形式

在浏览器输入如下信息

```shell
https://192.168.8.171:30001
```

就会进入到登录页面.

![登录面板](/images/k8s/dashboard.png)

> 这里有一些人会说谷歌浏览器登录不了，目前没遇到这个问题，暂时不太了解这个情况。

这里，可以通过 kube-config 文件来登录或者通过 token 来登录

## 登录

认证有两种方式

- Token
- Kubeconfig

### Token

```shell
kubectl -n kube-system describe $(kubectl -n kube-system get secret -n kube-system -o name | grep namespace) | grep token
```

用这个命令，我们可以看到 token 的信息，手动复制出来使用

```shell
[root@master ~]# kubectl -n kube-system describe $(kubectl -n kube-system get secret -n kube-system -o name | grep namespace) | grep token
Name:         namespace-controller-token-ghvr9
Type:  kubernetes.io/service-account-token
token:      eyJhbGciOiJSUzI1NiIsImtpZCI6IiJ9.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJuYW1lc3BhY2UtY29udHJvbGxlci10b2tlbi1naHZyOSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJuYW1lc3BhY2UtY29udHJvbGxlciIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6IjczZTg5OGJjLTgxMzEtMTFlOS1hNTdhLTAwNTA1NjlkMGYzMCIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDprdWJlLXN5c3RlbTpuYW1lc3BhY2UtY29udHJvbGxlciJ9.S4nPVa2-JAmRX_yVtoA9sR-JAnmLF5XdqQwrPmtQiohswyHWaAtEJyCF5wc8SIQmXbqn3XpeGNMLcyGd5xfAR4pIG0ljk5z6zoDc18M0Icnx5If0hxs4fWrhSNYYfzK7YnYOe_cjlydhbgTQ0vJoAXMURnX5dLFuNcp8QNaesNNnapZS2GPrjRYLNHw_WyCyU4i_tIwfiHW4ktrGD8SuX5g564gDZ9Xdee4CVHFveWNOrgWkV63n0fy8eNu9S6QpTsRb32M3MaZwlsp-2SFzcJbmAUj3ZiJ8KuBmZtBF249007SxiGwWzP3YQ5sXU38orSf8n-Spv5r-7ZHIzt0brw
```

```shell
eyJhbGciOiJSUzI1NiIsImtpZCI6IiJ9.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJuYW1lc3BhY2UtY29udHJvbGxlci10b2tlbi1naHZyOSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJuYW1lc3BhY2UtY29udHJvbGxlciIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6IjczZTg5OGJjLTgxMzEtMTFlOS1hNTdhLTAwNTA1NjlkMGYzMCIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDprdWJlLXN5c3RlbTpuYW1lc3BhY2UtY29udHJvbGxlciJ9.S4nPVa2-JAmRX_yVtoA9sR-JAnmLF5XdqQwrPmtQiohswyHWaAtEJyCF5wc8SIQmXbqn3XpeGNMLcyGd5xfAR4pIG0ljk5z6zoDc18M0Icnx5If0hxs4fWrhSNYYfzK7YnYOe_cjlydhbgTQ0vJoAXMURnX5dLFuNcp8QNaesNNnapZS2GPrjRYLNHw_WyCyU4i_tIwfiHW4ktrGD8SuX5g564gDZ9Xdee4CVHFveWNOrgWkV63n0fy8eNu9S6QpTsRb32M3MaZwlsp-2SFzcJbmAUj3ZiJ8KuBmZtBF249007SxiGwWzP3YQ5sXU38orSf8n-Spv5r-7ZHIzt0brw
```

在登录页面，输入这个 token，即可进入到仪表盘内部

### Kubeconfig

只需要在 kubeadm 生成的 `admin.conf` 文件末尾加上刚刚获取的 token 就可以了

```shell
- name: kubernetes-admin
  user:
    client-certificate-data: xxxxxxxx
    client-key-data: xxxxxx
    token: "在这里加上token"
```

## 内部系统结果图

这样子算是完成了基本的部署和处理

![仪表盘](/images/k8s/dashboard-in.png)
