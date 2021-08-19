---
title: 【kubernetes】k8s-glp
date: 2021-08-16 22:45:30
categories: [kubernetes]
tags: [kubernetes]
---

## 前言

我们经常有一些日志采集的需求，采集完毕之后，希望有一个中心WebUi来方便的查看很多不同节点，不同服务的日志。

按照传统的方式，一般都是会采用`ELK`,就是`elasticsearch+logstash+kibana`，但是由于`JVM`对资源的消耗太大，加上`ES`是通过全文搜索的方式需要进行倒排索引的分词，所以这些功能几乎是用不上，我们查询日志一般都可以通过定制常规的`label`信息，然后搜索即可，大可不必进行分词的行为。尽管后续又由于`logstash`的资源占用过大问题，作者又利用go语言开发出了`filebeat`，来辅助日志采集体系，后续加入了某公司之后，被集成到了`beats`的项目中，因为也可以交`efk/ebk`，都可以。


鉴于这一点，随之而来的就是`GLP`，就是`grafna+loki+promtail`。这是一套完全基于go语言生态写的，更贴近云原生。一套体系都是经过`grafna lab`云原生孕育而生。资源占用少，效率高，能够解决痛点，天生支持k8s等等特性。都让他成为新的崛起之秀。

<!-- more -->

## grafna


### depployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: grafana
  name: grafana
spec:
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      securityContext:
        fsGroup: 472
        supplementalGroups:
          - 0
      containers:
        - name: grafana
          image: grafana/grafana:7.5.2
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http-grafana
              protocol: TCP
          readinessProbe:
            failureThreshold: 3
            httpGet:
              path: /robots.txt
              port: 3000
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 30
            successThreshold: 1
            timeoutSeconds: 2
          livenessProbe:
            failureThreshold: 3
            initialDelaySeconds: 30
            periodSeconds: 10
            successThreshold: 1
            tcpSocket:
              port: 3000
            timeoutSeconds: 1
          resources:
            requests:
              cpu: 250m
              memory: 750Mi
          volumeMounts:
            - mountPath: /var/lib/grafana
              name: grafana-pv
      volumes:
        - name: grafana-pv
          persistentVolumeClaim:
            claimName: grafana-pvc
```

### pvc

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: grafana-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

### service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: grafana
spec:
  ports:
    - port: 3000
      protocol: TCP
      targetPort: http-grafana
  selector:
    app: grafana
  sessionAffinity: None
  type: LoadBalancer
```

## loki

### config-map

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
data:
  loki-config.yml: |
    auth_enabled: false

    server:
      http_listen_port: 3100

    ingester:
      lifecycler:
        address: 127.0.0.1
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
        final_sleep: 0s
      chunk_idle_period: 5m
      chunk_retain_period: 30s

    schema_config:
      configs:
      - from: 2020-05-15
        store: boltdb
        object_store: filesystem
        schema: v11
        index:
          prefix: index_
          period: 168h

    storage_config:
      boltdb:
        directory: /tmp/loki/index

      filesystem:
        directory: /tmp/loki/chunks

    limits_config:
      enforce_metric_name: false
      reject_old_samples: true
      reject_old_samples_max_age: 168h
```

### pvc

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: loki-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

### service

```yaml
kind: Service
apiVersion: v1
metadata:
  name: loki
spec:
  ports:
    - port: 3100
      targetPort: http-loki
  selector:
    app: loki
```

### statefulet

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: loki-statefulset
spec:
  selector:
    matchLabels:
      app: loki
  replicas: 2
  serviceName: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
        - name: loki
          image: grafana/loki:2.3.0
          imagePullPolicy: IfNotPresent
          args:
            - -config.file=/mnt/config/loki-config.yml
          ports:
            - containerPort: 3100
              name: http-loki
          volumeMounts:
            - mountPath: /tmp/loki
              name: storage-volume
            - mountPath: /mnt/config
              name: config-volume
          securityContext:
            runAsUser: 0
            runAsGroup: 0
      volumes:
        - name: storage-volume
          persistentVolumeClaim:
            claimName: loki-pvc
        - name: config-volume
          configMap:
            name: loki-config
            items:
              - key: loki-config.yml
                path: loki-config.yml
```

## promtail

### config-map

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: promtail-config
  namespace: default
data:
  promtail-config.yml: |
    server:
      http_listen_port: 9080
      grpc_listen_port: 0

    positions:
      filename: /tmp/positions.yaml

    # clients:
    # - url: http://dev-loki:3100/loki/api/v1/push

    scrape_configs:
    - job_name: containers
      static_configs:
      - targets:
        - localhost
        labels:
          log_from: static_pods
          __path__: /var/log/pods/*/*/*.log
      pipeline_stages:
      - docker: {}
      - match:
          selector: '{log_from="static_pods"}'
          stages:
          - regex:
              source: filename
              expression: "(?:pods)/(?P<namespace>\\S+?)_(?P<pod>\\S+)-\\S+?-\\S+?_\\S+?/(?P<container>\\S+?)/"
          - labels:
              namespace:
              pod:
              container:
      - match:
          selector: '{namespace!~"(default|kube-system)"}'
          action: drop
          drop_counter_reason: no_use
```

### daemonest

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      containers:
        - name: promtail
          image: grafana/promtail:2.3.0
          imagePullPolicy: IfNotPresent
          args:
            - -config.file=/mnt/config/promtail-config.yml
            - -client.url=http://dev-loki:3100/loki/api/v1/push
            - -client.external-labels=hostname=$(NODE_NAME)
          ports:
            - containerPort: 9080
              name: http-promtail
          volumeMounts:
            - mountPath: /var/lib/docker/containers
              name: containers-volume
            - mountPath: /var/log/pods
              name: pods-volume
            - mountPath: /mnt/config
              name: config-volume
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          securityContext:
            runAsUser: 0
            runAsGroup: 0
      volumes:
        - name: containers-volume
          hostPath:
            path: /var/lib/docker/containers
        - name: pods-volume
          hostPath:
            path: /var/log/pods
        - name: config-volume
          configMap:
            name: promtail-config
            items:
              - key: promtail-config.yml
                path: promtail-config.yml
      tolerations:
        - key: node-role.kubernetes.io/master
          operator: Exists
          effect: NoSchedule
```

### service

```yaml
kind: Service
apiVersion: v1
metadata:
  name: promtail
spec:
  ports:
    - port: 9080
      targetPort: http-promtail
  selector:
    app: promtail
```

这些详情的参数就不解释的，这就是一整套`GLP`的k8s的部署文件。由于我这里是采用`kustomize`来部署的。所以会有多层结构。

```shell
➜  kustomize git:(main) tree
.
├── base
│   ├── grafna
│   │   ├── deployment.yaml
│   │   ├── kustomization.yml
│   │   ├── pvc.yaml
│   │   └── service.yaml
│   ├── kustomization.yml
│   ├── loki
│   │   ├── config-map.yaml
│   │   ├── kustomization.yml
│   │   ├── pvc.yaml
│   │   ├── service.yaml
│   │   └── statefulset.yaml
│   └── promtail
│       ├── config-map.yaml
│       ├── daemonset.yaml
│       ├── kustomization.yml
│       └── service.yaml
└── overlays
    ├── dev
    │   ├── kustomization.yml
    │   └── patch.yaml
    └── prod
        ├── kustomization.yml
        └── patch.yaml
```

一整套的运行就是:

```yaml
➜  kustomize git:(main) kustomize build overlays/dev
apiVersion: v1
data:
  promtail-config.yml: |
    server:
      http_listen_port: 9080
      grpc_listen_port: 0

    positions:
      filename: /tmp/positions.yaml

    # clients:
    # - url: http://dev-loki:3100/loki/api/v1/push

    scrape_configs:
    - job_name: containers
      static_configs:
      - targets:
        - localhost
        labels:
          log_from: static_pods
          __path__: /var/log/pods/*/*/*.log
      pipeline_stages:
      - docker: {}
      - match:
          selector: '{log_from="static_pods"}'
          stages:
          - regex:
              source: filename
              expression: "(?:pods)/(?P<namespace>\\S+?)_(?P<pod>\\S+)-\\S+?-\\S+?_\\S+?/(?P<container>\\S+?)/"
          - labels:
              namespace:
              pod:
              container:
      - match:
          selector: '{namespace!~"(default|kube-system)"}'
          action: drop
          drop_counter_reason: no_use
kind: ConfigMap
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-promtail-config
  namespace: default
---
apiVersion: v1
data:
  loki-config.yml: |
    auth_enabled: false

    server:
      http_listen_port: 3100

    ingester:
      lifecycler:
        address: 127.0.0.1
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
        final_sleep: 0s
      chunk_idle_period: 5m
      chunk_retain_period: 30s

    schema_config:
      configs:
      - from: 2020-05-15
        store: boltdb
        object_store: filesystem
        schema: v11
        index:
          prefix: index_
          period: 168h

    storage_config:
      boltdb:
        directory: /tmp/loki/index

      filesystem:
        directory: /tmp/loki/chunks

    limits_config:
      enforce_metric_name: false
      reject_old_samples: true
      reject_old_samples_max_age: 168h
kind: ConfigMap
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-loki-config
---
apiVersion: v1
kind: Service
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-grafana
spec:
  ports:
  - port: 3000
    protocol: TCP
    targetPort: http-grafana
  selector:
    app: amyris
    org: unknow-x
    variant: dev
  sessionAffinity: None
  type: LoadBalancer
---
apiVersion: v1
kind: Service
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-loki
spec:
  ports:
  - port: 3100
    targetPort: http-loki
  selector:
    app: amyris
    org: unknow-x
    variant: dev
---
apiVersion: v1
kind: Service
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-promtail
spec:
  ports:
  - port: 9080
    targetPort: http-promtail
  selector:
    app: amyris
    org: unknow-x
    variant: dev
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-grafana-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-loki-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-grafana
spec:
  selector:
    matchLabels:
      app: amyris
      org: unknow-x
      variant: dev
  template:
    metadata:
      annotations:
        note: Hello, I am dev!
      labels:
        app: amyris
        org: unknow-x
        variant: dev
    spec:
      containers:
      - image: grafana/grafana:7.5.2
        imagePullPolicy: IfNotPresent
        livenessProbe:
          failureThreshold: 3
          initialDelaySeconds: 30
          periodSeconds: 10
          successThreshold: 1
          tcpSocket:
            port: 3000
          timeoutSeconds: 1
        name: grafana
        ports:
        - containerPort: 3000
          name: http-grafana
          protocol: TCP
        readinessProbe:
          failureThreshold: 3
          httpGet:
            path: /robots.txt
            port: 3000
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 30
          successThreshold: 1
          timeoutSeconds: 2
        resources:
          requests:
            cpu: 250m
            memory: 750Mi
        volumeMounts:
        - mountPath: /var/lib/grafana
          name: grafana-pv
      securityContext:
        fsGroup: 472
        supplementalGroups:
        - 0
      volumes:
      - name: grafana-pv
        persistentVolumeClaim:
          claimName: dev-grafana-pvc
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-loki-statefulset
spec:
  replicas: 2
  selector:
    matchLabels:
      app: amyris
      org: unknow-x
      variant: dev
  serviceName: dev-loki
  template:
    metadata:
      annotations:
        note: Hello, I am dev!
      labels:
        app: amyris
        org: unknow-x
        variant: dev
    spec:
      containers:
      - args:
        - -config.file=/mnt/config/loki-config.yml
        image: grafana/loki:2.3.0
        imagePullPolicy: IfNotPresent
        name: loki
        ports:
        - containerPort: 3100
          name: http-loki
        securityContext:
          runAsGroup: 0
          runAsUser: 0
        volumeMounts:
        - mountPath: /tmp/loki
          name: storage-volume
        - mountPath: /mnt/config
          name: config-volume
      volumes:
      - name: storage-volume
        persistentVolumeClaim:
          claimName: dev-loki-pvc
      - configMap:
          items:
          - key: loki-config.yml
            path: loki-config.yml
          name: dev-loki-config
        name: config-volume
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  annotations:
    note: Hello, I am dev!
  labels:
    app: amyris
    org: unknow-x
    variant: dev
  name: dev-promtail
spec:
  selector:
    matchLabels:
      app: amyris
      org: unknow-x
      variant: dev
  template:
    metadata:
      annotations:
        note: Hello, I am dev!
      labels:
        app: amyris
        org: unknow-x
        variant: dev
    spec:
      containers:
      - args:
        - -config.file=/mnt/config/promtail-config.yml
        - -client.url=http://dev-loki:3100/loki/api/v1/push
        - -client.external-labels=hostname=$(NODE_NAME)
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        image: grafana/promtail:2.3.0
        imagePullPolicy: IfNotPresent
        name: promtail
        ports:
        - containerPort: 9080
          name: http-promtail
        securityContext:
          runAsGroup: 0
          runAsUser: 0
        volumeMounts:
        - mountPath: /var/lib/docker/containers
          name: containers-volume
        - mountPath: /var/log/pods
          name: pods-volume
        - mountPath: /mnt/config
          name: config-volume
      tolerations:
      - effect: NoSchedule
        key: node-role.kubernetes.io/master
        operator: Exists
      volumes:
      - hostPath:
          path: /var/lib/docker/containers
        name: containers-volume
      - hostPath:
          path: /var/log/pods
        name: pods-volume
      - configMap:
          items:
          - key: promtail-config.yml
            path: promtail-config.yml
          name: dev-promtail-config
        name: config-volume
```

采用 `kustomize build overlays/dev | kubectl apply -f -` 来运行我们的`dev`环境的k8s所有的服务。


这里就是我希望利用k8s的`glp`来采集我的所有的pods在标准输出的所有的日志信息，做一个汇总和日志中心查询的web-ui。

![docker-for-mac-6](/images/k8s/docker-for-mac-6.png)
