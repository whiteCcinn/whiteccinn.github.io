---
title: 【kubernetes】nginx-ingress
date: 2019-06-04 11:28:30
categories: [kubernetes]
tags: [kubernetes]
---

## 前言

Ingress 是一个负载均衡的东西，其主要用来解决使用 NodePort 暴露 Service 的端口时 Node IP 会漂移的问题。同时，若大量使用 NodePort 暴露主机端口，管理会非常混乱。

好的解决方案就是让外界通过域名去访问 Service，而无需关心其 Node IP 及 Port。那为什么不直接使用 Nginx？这是因为在 K8S 集群中，如果每加入一个服务，我们都在 Nginx 中添加一个配置，其实是一个重复性的体力活，只要是重复性的体力活，我们都应该通过技术将它干掉。

Ingress 就可以解决上面的问题，其包含两个组件 Ingress Controller 和 Ingress：

- Ingress （将 Nginx 的配置抽象成一个 Ingress 对象，每添加一个新的服务只需写一个新的 Ingress 的 yaml 文件即可）
- Ingress Controller （将新加入的 Ingress 转化成 Nginx 的配置文件并使之生效）

<!-- more -->

- 集群内部访问
  - ClusterIp
- 集群外访问：
  - NodePort
  - Loadbalancer （云服务商）
  - Ingress

## Ingress-nginx

[Ingress-nginx](https://github.com/kubernetes/ingress-nginx)

在我写这篇文章的时候，`ingress-nginx` 到最新版本为：`0.24.1`，但是秉承着稳定的想法，本次我们使用`0.20.0`作为我们的版本

由于我们服务器并没有翻墙，所以找了国内的几个镜像下载，重新打 tag

```shell
docker pull registry.cn-qingdao.aliyuncs.com/kubernetes_xingej/defaultbackend-amd64:1.5 && docker pull registry.cn-qingdao.aliyuncs.com/kubernetes_xingej/nginx-ingress-controller:0.20.0 && docker tag registry.cn-qingdao.aliyuncs.com/kubernetes_xingej/defaultbackend-amd64:1.5 k8s.gcr.io/defaultbackend-amd64:1.5 && docker tag registry.cn-qingdao.aliyuncs.com/kubernetes_xingej/nginx-ingress-controller:0.20.0 quay.io/kubernetes-ingress-controller/nginx-ingress-controller:0.20.0
```

接下来，我们去到 `ingress-nginx` 找到 对应 `0.20.0`的版本，下载 k8s 配置文件。

[Ingress-nginx(v0.20.0)](https://github.com/kubernetes/ingress-nginx/tree/nginx-0.20.0/deploy)

我们只需要关注 `mandatory.yaml` 即可

```shell
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/nginx-0.20.0/deploy/mandatory.yaml
```

我们需要修改重点需要修改

- hostNetwork: true (用户使得容器的网络 namespace 和宿主机的 namespace，通过暴露宿 node 节点的 80 端口来作为 ingress 入口节点端口)

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ingress-nginx

---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: default-http-backend
  labels:
    app.kubernetes.io/name: default-http-backend
    app.kubernetes.io/part-of: ingress-nginx
  namespace: ingress-nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: default-http-backend
      app.kubernetes.io/part-of: ingress-nginx
  template:
    metadata:
      labels:
        app.kubernetes.io/name: default-http-backend
        app.kubernetes.io/part-of: ingress-nginx
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: default-http-backend
          # Any image is permissible as long as:
          # 1. It serves a 404 page at /
          # 2. It serves 200 on a /healthz endpoint
          image: k8s.gcr.io/defaultbackend-amd64:1.5
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
              scheme: HTTP
            initialDelaySeconds: 30
            timeoutSeconds: 5
          ports:
            - containerPort: 8080
          resources:
            limits:
              cpu: 10m
              memory: 20Mi
            requests:
              cpu: 10m
              memory: 20Mi

---
apiVersion: v1
kind: Service
metadata:
  name: default-http-backend
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: default-http-backend
    app.kubernetes.io/part-of: ingress-nginx
spec:
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app.kubernetes.io/name: default-http-backend
    app.kubernetes.io/part-of: ingress-nginx

---
kind: ConfigMap
apiVersion: v1
metadata:
  name: nginx-configuration
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx

---
kind: ConfigMap
apiVersion: v1
metadata:
  name: tcp-services
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx

---
kind: ConfigMap
apiVersion: v1
metadata:
  name: udp-services
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nginx-ingress-serviceaccount
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx

---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRole
metadata:
  name: nginx-ingress-clusterrole
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
rules:
  - apiGroups:
      - ''
    resources:
      - configmaps
      - endpoints
      - nodes
      - pods
      - secrets
    verbs:
      - list
      - watch
  - apiGroups:
      - ''
    resources:
      - nodes
    verbs:
      - get
  - apiGroups:
      - ''
    resources:
      - services
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - 'extensions'
    resources:
      - ingresses
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - ''
    resources:
      - events
    verbs:
      - create
      - patch
  - apiGroups:
      - 'extensions'
    resources:
      - ingresses/status
    verbs:
      - update

---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: Role
metadata:
  name: nginx-ingress-role
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
rules:
  - apiGroups:
      - ''
    resources:
      - configmaps
      - pods
      - secrets
      - namespaces
    verbs:
      - get
  - apiGroups:
      - ''
    resources:
      - configmaps
    resourceNames:
      # Defaults to "<election-id>-<ingress-class>"
      # Here: "<ingress-controller-leader>-<nginx>"
      # This has to be adapted if you change either parameter
      # when launching the nginx-ingress-controller.
      - 'ingress-controller-leader-nginx'
    verbs:
      - get
      - update
  - apiGroups:
      - ''
    resources:
      - configmaps
    verbs:
      - create
  - apiGroups:
      - ''
    resources:
      - endpoints
    verbs:
      - get

---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: RoleBinding
metadata:
  name: nginx-ingress-role-nisa-binding
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: nginx-ingress-role
subjects:
  - kind: ServiceAccount
    name: nginx-ingress-serviceaccount
    namespace: ingress-nginx

---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRoleBinding
metadata:
  name: nginx-ingress-clusterrole-nisa-binding
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: nginx-ingress-clusterrole
subjects:
  - kind: ServiceAccount
    name: nginx-ingress-serviceaccount
    namespace: ingress-nginx

---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: nginx-ingress-controller
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: ingress-nginx
      app.kubernetes.io/part-of: ingress-nginx
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ingress-nginx
        app.kubernetes.io/part-of: ingress-nginx
      annotations:
        prometheus.io/port: '10254'
        prometheus.io/scrape: 'true'
    spec:
      serviceAccountName: nginx-ingress-serviceaccount
      hostNetwork: true
      containers:
        - name: nginx-ingress-controller
          imagePullPolicy: IfNotPresent
          image: quay.io/kubernetes-ingress-controller/nginx-ingress-controller:0.20.0
          args:
            - /nginx-ingress-controller
            - --default-backend-service=$(POD_NAMESPACE)/default-http-backend
            - --configmap=$(POD_NAMESPACE)/nginx-configuration
            - --tcp-services-configmap=$(POD_NAMESPACE)/tcp-services
            - --udp-services-configmap=$(POD_NAMESPACE)/udp-services
            - --publish-service=$(POD_NAMESPACE)/ingress-nginx
            - --annotations-prefix=nginx.ingress.kubernetes.io
          securityContext:
            capabilities:
              drop:
                - ALL
              add:
                - NET_BIND_SERVICE
            # www-data -> 33
            runAsUser: 33
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
          ports:
            - name: http
              containerPort: 80
            - name: https
              containerPort: 443
          livenessProbe:
            failureThreshold: 3
            httpGet:
              path: /healthz
              port: 10254
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          readinessProbe:
            failureThreshold: 3
            httpGet:
              path: /healthz
              port: 10254
              scheme: HTTP
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1

---

```

修改完毕之后，我们就可以执行这个 yaml

```shell
kubectl apply -f mandatory.yaml
```

```shell
[root@master 20]# kubectl get pods -n ingress-nginx
NAME                                        READY   STATUS    RESTARTS   AGE
default-http-backend-5c9bb94849-fhlt8       1/1     Running   0          39h
nginx-ingress-controller-84d5b54fdf-2hxbh   1/1     Running   0          39h
```

这里我们看到了有 2 个 pod 了，其中一个是默认的 http 请求端口，这个 pod 里面的服务的作用是，当没有一个 rule 匹配到 ingress 的时候，就会被分发到这个 pod 上，然后返回 `404` 到相关信息

![default-backend-404.png](/images/k8s/default-backend-404.png)

接下来，我们需要配置我们自己的后端服务了，以 `nginx服务` 为例子: `nginx.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-nginx
  labels:
    app: my-nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-nginx
  template:
    metadata:
      labels:
        app: my-nginx
    spec:
      containers:
        - name: my-nginx
          image: nginx:1.7.9
          ports:
            - containerPort: 80

---
apiVersion: v1
kind: Service
metadata:
  name: my-nginx
spec:
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
  selector:
    app: my-nginx
```

这个部署文件中，里面设置了 2 种 kind，分别是 Deployment，主要是用于设置和容器相关的信息，另外一个是 Service，主要是用于设置服务暴露端口和集群内部服务转发相关的信息。

Deployment：这里我们可以看到我的配置是 `nginx:1.7.9` 为基础镜像，并且容器暴露的端口为 80 端口
Service：这里我们可以看到我的配置是 `spec.ports[].port = 80`，`spec.ports[].targetPort = 80(这个不设置的话也可以，默认和port一致)`。

这样子，我们的一个基础的 nginx 服务就设置完毕了。

接下里，我们需要设置`ingress` 配置，文件名为：`nginx-ingress.yaml`

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ingress-mynginx
  annotations:
    kubernetes.io/ingress.class: 'nginx'
spec:
  rules:
    - host: k8s-nginx.mingchao.com
      http:
        paths:
          - path:
            backend:
              serviceName: my-nginx
              servicePort: 80
```

这里，我们可以看到，我绑定了 `k8s-nginx.mingchao.com` 这个`host(serviceName)(域名)` 指向了后端服务名字叫 `my-nginx`，并且端口为 `80` 的服务。其实这里就是指向了我们刚才设置的 `nginx服务`

我们启动一下这个配置

```shell
kubectl apply -f nginx-ingress.yaml
```

我们可以看到结果：

```shell
[root@master nginx]# kubectl get ingress
NAME              HOSTS                    ADDRESS   PORTS   AGE
ingress-mynginx   k8s-nginx.mingchao.com             80      16h
```

发现这个 Ingress 已经生效了。由于我们是在本地测试，并没有用公网的域名，所以公网的 DNS 是找到我们的域名，所以我们需要做本地 Host，打开 `/etc/hosts` 文件，进行添加 host 之后，我们就可以用浏览器打开了。

但是这里为了偷懒，我直接用 curl 指定 host 的方法访问试试，结果如下

> 记得，访问的是 `node` 节点

```shell
[root@master nginx]# curl -v http://192.168.8.174 -H 'host: k8s-nginx.mingchao.com'
* About to connect() to 192.168.8.174 port 80 (#0)
*   Trying 192.168.8.174...
* Connected to 192.168.8.174 (192.168.8.174) port 80 (#0)
> GET / HTTP/1.1
> User-Agent: curl/7.29.0
> Accept: */*
> host: k8s-nginx.mingchao.com
>
< HTTP/1.1 200 OK
< Server: nginx/1.15.5
< Date: Fri, 07 Jun 2019 01:51:22 GMT
< Content-Type: text/html
< Content-Length: 612
< Connection: keep-alive
< Vary: Accept-Encoding
< Last-Modified: Tue, 23 Dec 2014 16:25:09 GMT
< ETag: "54999765-264"
< Accept-Ranges: bytes
<
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
    body {
        width: 35em;
        margin: 0 auto;
        font-family: Tahoma, Verdana, Arial, sans-serif;
    }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>

<p>For online documentation and support please refer to
<a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at
<a href="http://nginx.com/">nginx.com</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
* Connection #0 to host 192.168.8.174 left intact
```

这个时候，其实我们就可以发现，已经访问成功了，就这样子，通过 `ingress-nginx` 这个组件修改 `hostNetwork = true`，我们可以轻松实现，通过域名访问 80 端口从而转发到我们后端的任意一种后端服务

![k8s-nginx.mingchao.com](/images/k8s/k8s-nginx.mingchao.com.png)

这样子，我们的 ingress-nginx 基本就算是完成了。
