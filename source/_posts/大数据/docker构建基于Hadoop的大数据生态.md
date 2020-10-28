---
title: 【大数据】- docker构建基于Hadoop的大数据生态
date: 2020-06-16 18:07:40
categories: [大数据]
tags: [大数据，Hadoop]
---

## 前言

众所周知，hadoop的大数据生态的组件版本对依赖十分的繁杂，对此我们在如果需要用apache开源库来一点点堆起积木，有点繁琐
我们这个项目的目的只是为了更快更方便的构建大数据生态环境。
所以我们这里选择采用cdh的方式来构建大数据生态，但是由于我们希望在终端就部署好服务，而不需要客户端，所以这里就不选择用cmf

<!-- more -->

- [基于docker的cdh6的大数据生态](https://github.com/base-big-data)

> 在这里，你可以找到你需要的东西

- Hadoop
- Impala
- Hive
- Kudu

接下来，我会记录一下我在这个过程中所遇到的一些问题。

## 选择底层镜像

- [底层操作系统镜像](https://github.com/base-big-data/docker-centos-openjdk)

```dockerfile
FROM centos:7

LABEL maintainer="Caiwenhui <471113744@qq.com>"

ENV JAVA_HOME /usr/lib/jvm/java-openjdk

# 换阿里云源
RUN yum install -y wget;\
  wget -O /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo;\
  # 移除阿里已经不用的域名
  sed -i '/mirrors.aliyuncs.com/d' /etc/yum.repos.d/CentOS-Base.repo;\
  sed -i '/mirrors.cloud.aliyuncs.com/d' /etc/yum.repos.d/CentOS-Base.repo;\
  yum clean all; \
  yum makecache

# # 安装基础必备软件
RUN yum update -y; \
  yum intall -y deltarpm;\
  yum install -y java-1.8.0-openjdk-devel unzip curl vim python-setuptools sudo; \
  yum clean all;\
  yum makecache


CMD ["/bin/bash"]
```

在这里，我们基于的是centos7做操作系统镜像，并且在基础上，替换成了阿里云的yum的数据源，并且安装好了jdk8，方便后续部署服务

## 选择基础镜像

- [基于cdh6的基础镜像](https://github.com/base-big-data/docker-cdh6)

```dockerfile
FROM ccinn/centos-openjdk:latest

LABEL maintainer="Caiwenhui <471113744@qq.com>"

USER root

ENV CDH_VERSION 6.3.2

ADD cloudera-cdh6.repo /etc/yum.repos.d/
RUN rpm --import https://archive.cloudera.com/cdh6/$CDH_VERSION/redhat7/yum/RPM-GPG-KEY-cloudera;\
  yum makecache

WORKDIR /

CMD ["/bin/bash"]
```

在这里，我们的目录很简单，就是把`cloudera-cdh6.repo`放在yum的源中，方便我们通过yum安装服务，减少不必要的依赖问题

> 注意，我们这里选择的hadoop3的版本

## 构建hadoop镜像

- [基于基础镜像的hadoop服务](https://github.com/base-big-data/docker-cdh6-hadoop)

```dockerfile
FROM ccinn/cdh6:latest

LABEL maintainer="Caiwenhui <471113744@qq.com>"

USER root

ADD support.sh /support.sh

RUN source /support.sh;\
  loop_exec 'yum install -y hadoop'

WORKDIR /

CMD ["/bin/bash"]
```

### 问题1

```
Install  1 Package (+52 Dependent packages)

Total download size: 712 M
Installed size: 856 M
Downloading packages:
https://archive.cloudera.com/cdh6/6.3.2/redhat7/yum/RPMS/x86_64/hadoop-hdfs-3.0.0%2Bcdh6.3.2-1605554.el7.x86_64.rpm: [Errno 14] curl#18 - "transfer closed with 23278968 bytes remaining to read"
Trying other mirror.
https://archive.cloudera.com/cdh6/6.3.2/redhat7/yum/RPMS/x86_64/hadoop-3.0.0%2Bcdh6.3.2-1605554.el7.x86_64.rpm: [Errno 14] curl#18 - "transfer closed with 40971220 bytes remaining to read"
Trying other mirror.
https://archive.cloudera.com/cdh6/6.3.2/redhat7/yum/RPMS/noarch/hive-2.1.1%2Bcdh6.3.2-1605554.el7.noarch.rpm: [Errno 14] curl#18 - "transfer closed with 123435828 bytes remaining to read"
Trying other mirror.
```

我这里引入了一个`loop_exec`的函数，原因是因为国内的网络过慢，以及软件包“过大”，导致yum在安装包的时候，会导致传输中断，使得我们无法“一步”安装到位

所以这里我写了一个循环调用的函数，因为yum安装过程中是可以断点续传的，所以我利用这个函数来执行多几次这个命令即可，直到安装成功为止

> 一般我是3次安装完毕


### 问题2

我发现原来`hadoop`包是基础包而已，我们还要安装`hadoop-namenode`,`hadoop-datanode`，因此。我又手动在容器中调试了起来。

```shell
/usr/bin/hdfs --config /etc/hadoop/conf  namenode
```

```
[root@25b603a089cc /]# /usr/bin/hdfs --config /etc/hadoop/conf  namenode
2020-06-16 10:18:34,126 INFO namenode.NameNode: STARTUP_MSG:
/************************************************************
STARTUP_MSG: Starting NameNode
STARTUP_MSG:   host = 25b603a089cc/172.17.0.3
STARTUP_MSG:   args = []
STARTUP_MSG:   version = 3.0.0-cdh6.3.2
STARTUP_MSG:   classpath = /etc/hadoop/conf:/usr/lib/hadoop/lib/commons-lang3-3.7.jar:/usr/lib/hadoop/lib/commons-beanutils-1.9.4.jar:/usr/lib/hadoop/lib/log4j-1.2.17.jar:/usr/lib/hadoop/lib/commons-logging-1.1.3.jar:/usr/lib/hadoop/lib/re2j-1.1.jar:/usr/lib/hadoop/lib/jackson-core-asl-1.9.13.jar:/usr/lib/hadoop/lib/jettison-1.1.jar:/usr/lib/hadoop/lib/guava-11.0.2.jar:/usr/lib/hadoop/lib/javax.activation-api-1.2.0.jar:/usr/lib/hadoop/lib/paranamer-2.8.jar:/usr/lib/hadoop/lib/jetty-util-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/slf4j-log4j12.jar:/usr/lib/hadoop/lib/jsr311-api-1.1.1.jar:/usr/lib/hadoop/lib/azure-data-lake-store-sdk-2.2.9.jar:/usr/lib/hadoop/lib/jersey-servlet-1.19.jar:/usr/lib/hadoop/lib/jaxb-api-2.2.11.jar:/usr/lib/hadoop/lib/metrics-core-3.0.1.jar:/usr/lib/hadoop/lib/nimbus-jose-jwt-4.41.1.jar:/usr/lib/hadoop/lib/javax.servlet-api-3.1.0.jar:/usr/lib/hadoop/lib/protobuf-java-2.5.0.jar:/usr/lib/hadoop/lib/commons-math3-3.1.1.jar:/usr/lib/hadoop/lib/jersey-core-1.19.jar:/usr/lib/hadoop/lib/commons-compress-1.18.jar:/usr/lib/hadoop/lib/accessors-smart-1.2.jar:/usr/lib/hadoop/lib/woodstox-core-5.0.3.jar:/usr/lib/hadoop/lib/jetty-io-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/jackson-xc-1.9.13.jar:/usr/lib/hadoop/lib/jetty-xml-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/curator-recipes-2.12.0.jar:/usr/lib/hadoop/lib/jetty-servlet-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/commons-lang-2.6.jar:/usr/lib/hadoop/lib/audience-annotations-0.5.0.jar:/usr/lib/hadoop/lib/kerby-config-1.0.0.jar:/usr/lib/hadoop/lib/jetty-security-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/jetty-server-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/kerb-util-1.0.0.jar:/usr/lib/hadoop/lib/netty-3.10.6.Final.jar:/usr/lib/hadoop/lib/kerb-admin-1.0.0.jar:/usr/lib/hadoop/lib/jersey-json-1.19.jar:/usr/lib/hadoop/lib/jackson-databind-2.9.9.3.jar:/usr/lib/hadoop/lib/kerb-core-1.0.0.jar:/usr/lib/hadoop/lib/jackson-jaxrs-1.9.13.jar:/usr/lib/hadoop/lib/kerby-asn1-1.0.0.jar:/usr/lib/hadoop/lib/commons-configuration2-2.1.1.jar:/usr/lib/hadoop/lib/kerb-crypto-1.0.0.jar:/usr/lib/hadoop/lib/httpcore-4.4.6.jar:/usr/lib/hadoop/lib/log4j-core-2.8.2.jar:/usr/lib/hadoop/lib/json-smart-2.3.jar:/usr/lib/hadoop/lib/snappy-java-1.1.4.jar:/usr/lib/hadoop/lib/jackson-mapper-asl-1.9.13-cloudera.1.jar:/usr/lib/hadoop/lib/kerb-simplekdc-1.0.0.jar:/usr/lib/hadoop/lib/logredactor-2.0.7.jar:/usr/lib/hadoop/lib/avro.jar:/usr/lib/hadoop/lib/jackson-annotations-2.9.9.jar:/usr/lib/hadoop/lib/kerb-client-1.0.0.jar:/usr/lib/hadoop/lib/jersey-server-1.19.jar:/usr/lib/hadoop/lib/curator-client-2.12.0.jar:/usr/lib/hadoop/lib/commons-cli-1.2.jar:/usr/lib/hadoop/lib/jcip-annotations-1.0-1.jar:/usr/lib/hadoop/lib/kerb-server-1.0.0.jar:/usr/lib/hadoop/lib/kerby-xdr-1.0.0.jar:/usr/lib/hadoop/lib/kerb-common-1.0.0.jar:/usr/lib/hadoop/lib/htrace-core4-4.1.0-incubating.jar:/usr/lib/hadoop/lib/aws-java-sdk-bundle-1.11.271.jar:/usr/lib/hadoop/lib/kerby-util-1.0.0.jar:/usr/lib/hadoop/lib/jetty-webapp-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/stax2-api-3.1.4.jar:/usr/lib/hadoop/lib/slf4j-api-1.7.25.jar:/usr/lib/hadoop/lib/log4j-api-2.8.2.jar:/usr/lib/hadoop/lib/commons-io-2.6.jar:/usr/lib/hadoop/lib/kerby-pkix-1.0.0.jar:/usr/lib/hadoop/lib/curator-framework-2.12.0.jar:/usr/lib/hadoop/lib/gson-2.2.4.jar:/usr/lib/hadoop/lib/jsp-api-2.1.jar:/usr/lib/hadoop/lib/xz-1.6.jar:/usr/lib/hadoop/lib/zookeeper.jar:/usr/lib/hadoop/lib/jetty-http-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/wildfly-openssl-1.0.4.Final.jar:/usr/lib/hadoop/lib/jackson-core-2.9.9.jar:/usr/lib/hadoop/lib/kerb-identity-1.0.0.jar:/usr/lib/hadoop/lib/jaxb-impl-2.2.3-1.jar:/usr/lib/hadoop/lib/commons-net-3.1.jar:/usr/lib/hadoop/lib/jul-to-slf4j-1.7.25.jar:/usr/lib/hadoop/lib/asm-5.0.4.jar:/usr/lib/hadoop/lib/jsch-0.1.54.jar:/usr/lib/hadoop/lib/jsr305-3.0.0.jar:/usr/lib/hadoop/lib/commons-collections-3.2.2.jar:/usr/lib/hadoop/lib/httpclient-4.5.3.jar:/usr/lib/hadoop/lib/commons-codec-1.11.jar:/usr/lib/hadoop/.//parquet-format-javadoc.jar:/usr/lib/hadoop/.//hadoop-auth-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-jackson.jar:/usr/lib/hadoop/.//hadoop-azure-datalake.jar:/usr/lib/hadoop/.//parquet-format.jar:/usr/lib/hadoop/.//hadoop-aws-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//hadoop-azure-datalake-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-protobuf.jar:/usr/lib/hadoop/.//hadoop-annotations-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//hadoop-auth.jar:/usr/lib/hadoop/.//hadoop-aws.jar:/usr/lib/hadoop/.//hadoop-azure.jar:/usr/lib/hadoop/.//parquet-scala_2.11.jar:/usr/lib/hadoop/.//hadoop-nfs.jar:/usr/lib/hadoop/.//hadoop-annotations.jar:/usr/lib/hadoop/.//parquet-pig.jar:/usr/lib/hadoop/.//parquet-pig-bundle.jar:/usr/lib/hadoop/.//parquet-common.jar:/usr/lib/hadoop/.//parquet-hadoop-bundle.jar:/usr/lib/hadoop/.//hadoop-kms.jar:/usr/lib/hadoop/.//hadoop-kms-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-cascading.jar:/usr/lib/hadoop/.//hadoop-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-generator.jar:/usr/lib/hadoop/.//hadoop-azure-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-hadoop.jar:/usr/lib/hadoop/.//hadoop-common.jar:/usr/lib/hadoop/.//hadoop-common-tests.jar:/usr/lib/hadoop/.//parquet-avro.jar:/usr/lib/hadoop/.//hadoop-common-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop/.//parquet-format-sources.jar:/usr/lib/hadoop/.//parquet-column.jar:/usr/lib/hadoop/.//parquet-thrift.jar:/usr/lib/hadoop/.//parquet-encoding.jar:/usr/lib/hadoop/.//hadoop-nfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-cascading3.jar:/usr/lib/hadoop-hdfs/./:/usr/lib/hadoop-hdfs/lib/commons-lang3-3.7.jar:/usr/lib/hadoop-hdfs/lib/commons-beanutils-1.9.4.jar:/usr/lib/hadoop-hdfs/lib/log4j-1.2.17.jar:/usr/lib/hadoop-hdfs/lib/commons-logging-1.1.3.jar:/usr/lib/hadoop-hdfs/lib/re2j-1.1.jar:/usr/lib/hadoop-hdfs/lib/jackson-core-asl-1.9.13.jar:/usr/lib/hadoop-hdfs/lib/jettison-1.1.jar:/usr/lib/hadoop-hdfs/lib/guava-11.0.2.jar:/usr/lib/hadoop-hdfs/lib/javax.activation-api-1.2.0.jar:/usr/lib/hadoop-hdfs/lib/paranamer-2.8.jar:/usr/lib/hadoop-hdfs/lib/jetty-util-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jsr311-api-1.1.1.jar:/usr/lib/hadoop-hdfs/lib/jersey-servlet-1.19.jar:/usr/lib/hadoop-hdfs/lib/jaxb-api-2.2.11.jar:/usr/lib/hadoop-hdfs/lib/nimbus-jose-jwt-4.41.1.jar:/usr/lib/hadoop-hdfs/lib/javax.servlet-api-3.1.0.jar:/usr/lib/hadoop-hdfs/lib/protobuf-java-2.5.0.jar:/usr/lib/hadoop-hdfs/lib/okio-1.6.0.jar:/usr/lib/hadoop-hdfs/lib/commons-math3-3.1.1.jar:/usr/lib/hadoop-hdfs/lib/jersey-core-1.19.jar:/usr/lib/hadoop-hdfs/lib/commons-compress-1.18.jar:/usr/lib/hadoop-hdfs/lib/accessors-smart-1.2.jar:/usr/lib/hadoop-hdfs/lib/woodstox-core-5.0.3.jar:/usr/lib/hadoop-hdfs/lib/jetty-io-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jackson-xc-1.9.13.jar:/usr/lib/hadoop-hdfs/lib/jetty-xml-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/curator-recipes-2.12.0.jar:/usr/lib/hadoop-hdfs/lib/jetty-servlet-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/commons-lang-2.6.jar:/usr/lib/hadoop-hdfs/lib/json-simple-1.1.1.jar:/usr/lib/hadoop-hdfs/lib/avro-1.8.2-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/lib/audience-annotations-0.5.0.jar:/usr/lib/hadoop-hdfs/lib/kerby-config-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jetty-security-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jetty-server-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/kerb-util-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/zookeeper-3.4.5-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/lib/netty-3.10.6.Final.jar:/usr/lib/hadoop-hdfs/lib/kerb-admin-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jersey-json-1.19.jar:/usr/lib/hadoop-hdfs/lib/jackson-databind-2.9.9.3.jar:/usr/lib/hadoop-hdfs/lib/kerb-core-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jackson-jaxrs-1.9.13.jar:/usr/lib/hadoop-hdfs/lib/kerby-asn1-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/commons-configuration2-2.1.1.jar:/usr/lib/hadoop-hdfs/lib/kerb-crypto-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/httpcore-4.4.6.jar:/usr/lib/hadoop-hdfs/lib/json-smart-2.3.jar:/usr/lib/hadoop-hdfs/lib/snappy-java-1.1.4.jar:/usr/lib/hadoop-hdfs/lib/jackson-mapper-asl-1.9.13-cloudera.1.jar:/usr/lib/hadoop-hdfs/lib/kerb-simplekdc-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jackson-annotations-2.9.9.jar:/usr/lib/hadoop-hdfs/lib/kerb-client-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jersey-server-1.19.jar:/usr/lib/hadoop-hdfs/lib/curator-client-2.12.0.jar:/usr/lib/hadoop-hdfs/lib/commons-cli-1.2.jar:/usr/lib/hadoop-hdfs/lib/jcip-annotations-1.0-1.jar:/usr/lib/hadoop-hdfs/lib/kerb-server-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/kerby-xdr-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/kerb-common-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/htrace-core4-4.1.0-incubating.jar:/usr/lib/hadoop-hdfs/lib/kerby-util-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jetty-webapp-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/stax2-api-3.1.4.jar:/usr/lib/hadoop-hdfs/lib/commons-io-2.6.jar:/usr/lib/hadoop-hdfs/lib/kerby-pkix-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/curator-framework-2.12.0.jar:/usr/lib/hadoop-hdfs/lib/commons-daemon-1.0.13.jar:/usr/lib/hadoop-hdfs/lib/gson-2.2.4.jar:/usr/lib/hadoop-hdfs/lib/leveldbjni-all-1.8.jar:/usr/lib/hadoop-hdfs/lib/xz-1.6.jar:/usr/lib/hadoop-hdfs/lib/jetty-http-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/okhttp-2.7.5.jar:/usr/lib/hadoop-hdfs/lib/jetty-util-ajax-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jackson-core-2.9.9.jar:/usr/lib/hadoop-hdfs/lib/kerb-identity-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jaxb-impl-2.2.3-1.jar:/usr/lib/hadoop-hdfs/lib/commons-net-3.1.jar:/usr/lib/hadoop-hdfs/lib/asm-5.0.4.jar:/usr/lib/hadoop-hdfs/lib/jsch-0.1.54.jar:/usr/lib/hadoop-hdfs/lib/jsr305-3.0.0.jar:/usr/lib/hadoop-hdfs/lib/commons-collections-3.2.2.jar:/usr/lib/hadoop-hdfs/lib/httpclient-4.5.3.jar:/usr/lib/hadoop-hdfs/lib/commons-codec-1.11.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-nfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-nfs.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-httpfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-httpfs.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-examples-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-openstack.jar:/usr/lib/hadoop-mapreduce/.//hadoop-aliyun.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-core.jar:/usr/lib/hadoop-mapreduce/.//hadoop-extras-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-uploader.jar:/usr/lib/hadoop-mapreduce/.//hadoop-openstack-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-distcp.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs-plugins-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-sls.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-uploader-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-kafka.jar:/usr/lib/hadoop-mapreduce/.//hadoop-datajoin-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//netty-buffer-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//netty-common-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-mapreduce/.//hadoop-gridmix-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//jdom-1.1.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-examples.jar:/usr/lib/hadoop-mapreduce/.//hadoop-kafka-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//netty-codec-http-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-rumen-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-app.jar:/usr/lib/hadoop-mapreduce/.//hadoop-extras.jar:/usr/lib/hadoop-mapreduce/.//hadoop-streaming-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//lz4-java-1.5.0.jar:/usr/lib/hadoop-mapreduce/.//aliyun-sdk-oss-2.8.3.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-app-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-datajoin.jar:/usr/lib/hadoop-mapreduce/.//azure-storage-5.4.0.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-nativetask-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient.jar:/usr/lib/hadoop-mapreduce/.//hadoop-distcp-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs-plugins.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-shuffle-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-aliyun-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-common.jar:/usr/lib/hadoop-mapreduce/.//kafka-clients-2.2.1-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//ojalgo-43.0.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-shuffle.jar:/usr/lib/hadoop-mapreduce/.//hadoop-gridmix.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient-tests.jar:/usr/lib/hadoop-mapreduce/.//netty-resolver-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-resourceestimator-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-rumen.jar:/usr/lib/hadoop-mapreduce/.//azure-keyvault-core-0.8.0.jar:/usr/lib/hadoop-mapreduce/.//netty-codec-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-nativetask.jar:/usr/lib/hadoop-mapreduce/.//netty-transport-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-sls-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-resourceestimator.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archives.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archives-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//netty-handler-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-core-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archive-logs.jar:/usr/lib/hadoop-mapreduce/.//zstd-jni-1.3.8-1.jar:/usr/lib/hadoop-mapreduce/.//hadoop-streaming.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archive-logs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/lib/jackson-jaxrs-json-provider-2.9.9.jar:/usr/lib/hadoop-yarn/lib/guice-servlet-4.0.jar:/usr/lib/hadoop-yarn/lib/jackson-module-jaxb-annotations-2.9.9.jar:/usr/lib/hadoop-yarn/lib/jersey-client-1.19.jar:/usr/lib/hadoop-yarn/lib/objenesis-1.0.jar:/usr/lib/hadoop-yarn/lib/guice-4.0.jar:/usr/lib/hadoop-yarn/lib/jackson-jaxrs-base-2.9.9.jar:/usr/lib/hadoop-yarn/lib/metrics-core-3.0.1.jar:/usr/lib/hadoop-yarn/lib/java-util-1.9.0.jar:/usr/lib/hadoop-yarn/lib/fst-2.50.jar:/usr/lib/hadoop-yarn/lib/javax.inject-1.jar:/usr/lib/hadoop-yarn/lib/geronimo-jcache_1.0_spec-1.0-alpha-1.jar:/usr/lib/hadoop-yarn/lib/json-io-2.5.1.jar:/usr/lib/hadoop-yarn/lib/HikariCP-java7-2.4.12.jar:/usr/lib/hadoop-yarn/lib/bcprov-jdk15on-1.60.jar:/usr/lib/hadoop-yarn/lib/ehcache-3.3.1.jar:/usr/lib/hadoop-yarn/lib/bcpkix-jdk15on-1.60.jar:/usr/lib/hadoop-yarn/lib/aopalliance-1.0.jar:/usr/lib/hadoop-yarn/lib/jersey-guice-1.19.jar:/usr/lib/hadoop-yarn/lib/mssql-jdbc-6.2.1.jre7.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-applicationhistoryservice-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-registry-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-tests-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-common.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-sharedcachemanager-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-client-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-applicationhistoryservice.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-unmanaged-am-launcher-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-resourcemanager.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-common.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-resourcemanager-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-timeline-pluginstorage.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-distributedshell.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-tests.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-router-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-client.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-web-proxy-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-sharedcachemanager.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-web-proxy.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-router.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-api-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-nodemanager-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-registry.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-distributedshell-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-timeline-pluginstorage-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-api.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-unmanaged-am-launcher.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-nodemanager.jar
STARTUP_MSG:   build = http://github.com/cloudera/hadoop -r 9aff20de3b5ecccf3c19d57f71b214fb4d37ee89; compiled by 'jenkins' on 2019-11-08T13:49Z
STARTUP_MSG:   java = 1.8.0_252
************************************************************/
2020-06-16 10:18:34,143 INFO namenode.NameNode: registered UNIX signal handlers for [TERM, HUP, INT]
2020-06-16 10:18:34,296 INFO namenode.NameNode: createNameNode []
2020-06-16 10:18:34,497 INFO impl.MetricsConfig: Loaded properties from hadoop-metrics2.properties
2020-06-16 10:18:34,709 INFO impl.MetricsSystemImpl: Scheduled Metric snapshot period at 10 second(s).
2020-06-16 10:18:34,709 INFO impl.MetricsSystemImpl: NameNode metrics system started
2020-06-16 10:18:34,764 INFO namenode.NameNode: fs.defaultFS is file:///
2020-06-16 10:18:34,972 ERROR namenode.NameNode: Failed to start namenode.
java.lang.IllegalArgumentException: Invalid URI for NameNode address (check fs.defaultFS): file:/// has no authority.
	at org.apache.hadoop.hdfs.DFSUtilClient.getNNAddress(DFSUtilClient.java:646)
	at org.apache.hadoop.hdfs.DFSUtilClient.getNNAddressCheckLogical(DFSUtilClient.java:675)
	at org.apache.hadoop.hdfs.DFSUtilClient.getNNAddress(DFSUtilClient.java:637)
	at org.apache.hadoop.hdfs.server.namenode.NameNode.getRpcServerAddress(NameNode.java:562)
	at org.apache.hadoop.hdfs.server.namenode.NameNode.loginAsNameNodeUser(NameNode.java:693)
	at org.apache.hadoop.hdfs.server.namenode.NameNode.initialize(NameNode.java:713)
	at org.apache.hadoop.hdfs.server.namenode.NameNode.<init>(NameNode.java:950)
	at org.apache.hadoop.hdfs.server.namenode.NameNode.<init>(NameNode.java:929)
	at org.apache.hadoop.hdfs.server.namenode.NameNode.createNameNode(NameNode.java:1653)
	at org.apache.hadoop.hdfs.server.namenode.NameNode.main(NameNode.java:1720)
2020-06-16 10:18:34,983 INFO util.ExitUtil: Exiting with status 1: java.lang.IllegalArgumentException: Invalid URI for NameNode address (check fs.defaultFS): file:/// has no authority.
2020-06-16 10:18:34,988 INFO namenode.NameNode: SHUTDOWN_MSG:
/************************************************************
SHUTDOWN_MSG: Shutting down NameNode at 25b603a089cc/172.17.0.3
************************************************************/
```

我以前台的方式启动服务，发现服务并没有启动成功，他告诉我检查`fs.defaultFS`参数


```
[root@25b603a089cc /]# cat /etc/hadoop/conf/core-site.xml
<?xml version="1.0"?>
<!--
  Licensed to the Apache Software Foundation (ASF) under one or more
  contributor license agreements.  See the NOTICE file distributed with
  this work for additional information regarding copyright ownership.
  The ASF licenses this file to You under the Apache License, Version 2.0
  (the "License"); you may not use this file except in compliance with
  the License.  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>

<configuration>
</configuration>
```

于是我发现原来这个core-site文件默认是什么配置都没有的。于是我需要手动加上一些配置。

在这里顺带说明一下配置信息。

具体的参数配置请参见 >> [hadoop3-默认配置参数](https://www.stefaanlippens.net/hadoop-3-default-ports.html) <<<

在hadoop集群中，需要配置的文件主要包括四个，分别是`core-site.xml`、`hdfs-site.xml`、`mapred-site.xml`和`yarn-site.xml`，这四个文件分别是对不同组件的配置参数，主要内容如下表所示：

| 配置文件名 | 配置对象            | 主要内容 |
| -------- | ------------- | ----- |
| core-site.xml   | 集群全局参数	 | 用于定义系统级别的参数，如HDFS  URL、Hadoop的临时目录等 |
| hdfs-site.xml    | HDFS参数 | 如名称节点和数据节点的存放位置、文件副本的个数、文件读取权限等 |
| mapred-site.xml    | Mapreduce参数 | 包括JobHistory Server和应用程序参数两部分，如reduce任务的默认个数、任务所能够使用内存的默认上下限等 |
| yarn-site.xml    | 集群资源管理系统参数 | 配置 ResourceManager，NodeManager 的通信端口，web监控端口等 |

搭建集群配置时重要参数：

core-site.xml

| 参数名 | 默认值            | 参数解释 |
| -------- | ------------- | ----- |
| fs.defaultFS   | file:///	 | 文件系统主机和端口 |
| io.file.buffer.size    | 4096 | 流文件的缓冲区大小 |
| hadoop.tmp.dir    | /tmp/hadoop-${user.name} | 临时文件夹 |

hdfs-site.xml

| 参数名 | 默认值            | 参数解释 |
| -------- | ------------- | ----- |
| dfs.namenode.secondary.http-address   | 0.0.0.0:50090	 | 定义HDFS对应的HTTP服务器地址和端口 |
| dfs.namenode.name.dir  | file://${hadoop.tmp.dir}/dfs/name | 定义DFS的名称节点在本地文件系统的位置 |
| dfs.datanode.data.dir | file://${hadoop.tmp.dir}/dfs/data | 定义DFS数据节点存储数据块时存储在本地文件系统的位置 |
| dfs.replication | 3 | 缺省的块复制数量 |
| dfs.webhdfs.enabled | true | 是否通过http协议读取hdfs文件，如果选是，则集群安全性较差 |

mapred-site.xml

| 参数名 | 默认值            | 参数解释 |
| -------- | ------------- | ----- |
| mapreduce.framework.name   | local | 取值local、classic或yarn其中之一，如果不是yarn，则不会使用YARN集群来实现资源的分配 |
| mapreduce.jobhistory.address  | 0.0.0.0:10020 | 定义历史服务器的地址和端口，通过历史服务器查看已经运行完的Mapreduce作业记录 |
| mapreduce.jobhistory.webapp.address | 0.0.0.0:19888 | 定义历史服务器web应用访问的地址和端口 |

yarn-site.xml

| 参数名 | 默认值            | 参数解释 |
| -------- | ------------- | ----- |
| yarn.resourcemanager.address | 0.0.0.0:8032 | ResourceManager 提供给客户端访问的地址。客户端通过该地址向RM提交应用程序，杀死应用程序等 |
| yarn.resourcemanager.scheduler.address  | 0.0.0.0:8030 | ResourceManager提供给ApplicationMaster的访问地址。ApplicationMaster通过该地址向RM申请资源、释放资源等 |
| yarn.resourcemanager.resource-tracker.address | 0.0.0.0:8031 | ResourceManager 提供给NodeManager的地址。NodeManager通过该地址向RM汇报心跳，领取任务等 |
| yarn.resourcemanager.webapp.address | 0.0.0.0:8088 | ResourceManager对web 服务提供地址。用户可通过该地址在浏览器中查看集群各类信息 |
| yarn.nodemanager.aux-services |  | 通过该配置项，用户可以自定义一些服务，例如Map-Reduce的shuffle功能就是采用这种方式实现的，这样就可以在NodeManager上扩展自己的服务。 |


基于以上信息。

整理一份配置如下：

core-site.xml

```xml
<configuration>
        <property>
                <name>fs.defaultFS</name>
                <value>hdfs://0.0.0.0:8020</value>
        </property>
        <property>
                <name>hadoop.proxyuser.hue.hosts</name>
                <value>*</value>
        </property>
        <property>
                <name>hadoop.proxyuser.hue.groups</name>
                <value>*</value>
        </property>
        <property>
                <name>io.compression.codecs</name>
                <value>org.apache.hadoop.io.compress.SnappyCodec</value>
        </property>
</configuration>
```

hdfs-site.xml

```xml
<configuration>
  <property>
     <name>dfs.namenode.name.dir</name>
     <value>file:///var/lib/hadoop-hdfs/cache/hdfs/dfs/name</value>
  </property>
  <!-- CLOUDERA-BUILD: CDH-64745. -->
  <property>
    <name>cloudera.erasure_coding.enabled</name>
    <value>true</value>
  </property>
</configuration>
```

接着，我们尝试启动服务。


```
[root@25b603a089cc /]# sudo /usr/bin/hdfs --config /etc/hadoop/conf namenode
2020-06-16 15:55:52,251 INFO namenode.NameNode: STARTUP_MSG:
/************************************************************
STARTUP_MSG: Starting NameNode
STARTUP_MSG:   host = 25b603a089cc/172.17.0.3
STARTUP_MSG:   args = []
STARTUP_MSG:   version = 3.0.0-cdh6.3.2
STARTUP_MSG:   classpath = /etc/hadoop/conf:/usr/lib/hadoop/lib/commons-lang3-3.7.jar:/usr/lib/hadoop/lib/commons-beanutils-1.9.4.jar:/usr/lib/hadoop/lib/log4j-1.2.17.jar:/usr/lib/hadoop/lib/commons-logging-1.1.3.jar:/usr/lib/hadoop/lib/re2j-1.1.jar:/usr/lib/hadoop/lib/jackson-core-asl-1.9.13.jar:/usr/lib/hadoop/lib/jettison-1.1.jar:/usr/lib/hadoop/lib/guava-11.0.2.jar:/usr/lib/hadoop/lib/javax.activation-api-1.2.0.jar:/usr/lib/hadoop/lib/paranamer-2.8.jar:/usr/lib/hadoop/lib/jetty-util-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/slf4j-log4j12.jar:/usr/lib/hadoop/lib/jsr311-api-1.1.1.jar:/usr/lib/hadoop/lib/azure-data-lake-store-sdk-2.2.9.jar:/usr/lib/hadoop/lib/jersey-servlet-1.19.jar:/usr/lib/hadoop/lib/jaxb-api-2.2.11.jar:/usr/lib/hadoop/lib/metrics-core-3.0.1.jar:/usr/lib/hadoop/lib/nimbus-jose-jwt-4.41.1.jar:/usr/lib/hadoop/lib/javax.servlet-api-3.1.0.jar:/usr/lib/hadoop/lib/protobuf-java-2.5.0.jar:/usr/lib/hadoop/lib/commons-math3-3.1.1.jar:/usr/lib/hadoop/lib/jersey-core-1.19.jar:/usr/lib/hadoop/lib/commons-compress-1.18.jar:/usr/lib/hadoop/lib/accessors-smart-1.2.jar:/usr/lib/hadoop/lib/woodstox-core-5.0.3.jar:/usr/lib/hadoop/lib/jetty-io-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/jackson-xc-1.9.13.jar:/usr/lib/hadoop/lib/jetty-xml-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/curator-recipes-2.12.0.jar:/usr/lib/hadoop/lib/jetty-servlet-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/commons-lang-2.6.jar:/usr/lib/hadoop/lib/audience-annotations-0.5.0.jar:/usr/lib/hadoop/lib/kerby-config-1.0.0.jar:/usr/lib/hadoop/lib/jetty-security-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/jetty-server-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/kerb-util-1.0.0.jar:/usr/lib/hadoop/lib/netty-3.10.6.Final.jar:/usr/lib/hadoop/lib/kerb-admin-1.0.0.jar:/usr/lib/hadoop/lib/jersey-json-1.19.jar:/usr/lib/hadoop/lib/jackson-databind-2.9.9.3.jar:/usr/lib/hadoop/lib/kerb-core-1.0.0.jar:/usr/lib/hadoop/lib/jackson-jaxrs-1.9.13.jar:/usr/lib/hadoop/lib/kerby-asn1-1.0.0.jar:/usr/lib/hadoop/lib/commons-configuration2-2.1.1.jar:/usr/lib/hadoop/lib/kerb-crypto-1.0.0.jar:/usr/lib/hadoop/lib/httpcore-4.4.6.jar:/usr/lib/hadoop/lib/log4j-core-2.8.2.jar:/usr/lib/hadoop/lib/json-smart-2.3.jar:/usr/lib/hadoop/lib/snappy-java-1.1.4.jar:/usr/lib/hadoop/lib/jackson-mapper-asl-1.9.13-cloudera.1.jar:/usr/lib/hadoop/lib/kerb-simplekdc-1.0.0.jar:/usr/lib/hadoop/lib/logredactor-2.0.7.jar:/usr/lib/hadoop/lib/avro.jar:/usr/lib/hadoop/lib/jackson-annotations-2.9.9.jar:/usr/lib/hadoop/lib/kerb-client-1.0.0.jar:/usr/lib/hadoop/lib/jersey-server-1.19.jar:/usr/lib/hadoop/lib/curator-client-2.12.0.jar:/usr/lib/hadoop/lib/commons-cli-1.2.jar:/usr/lib/hadoop/lib/jcip-annotations-1.0-1.jar:/usr/lib/hadoop/lib/kerb-server-1.0.0.jar:/usr/lib/hadoop/lib/kerby-xdr-1.0.0.jar:/usr/lib/hadoop/lib/kerb-common-1.0.0.jar:/usr/lib/hadoop/lib/htrace-core4-4.1.0-incubating.jar:/usr/lib/hadoop/lib/aws-java-sdk-bundle-1.11.271.jar:/usr/lib/hadoop/lib/kerby-util-1.0.0.jar:/usr/lib/hadoop/lib/jetty-webapp-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/stax2-api-3.1.4.jar:/usr/lib/hadoop/lib/slf4j-api-1.7.25.jar:/usr/lib/hadoop/lib/log4j-api-2.8.2.jar:/usr/lib/hadoop/lib/commons-io-2.6.jar:/usr/lib/hadoop/lib/kerby-pkix-1.0.0.jar:/usr/lib/hadoop/lib/curator-framework-2.12.0.jar:/usr/lib/hadoop/lib/gson-2.2.4.jar:/usr/lib/hadoop/lib/jsp-api-2.1.jar:/usr/lib/hadoop/lib/xz-1.6.jar:/usr/lib/hadoop/lib/zookeeper.jar:/usr/lib/hadoop/lib/jetty-http-9.3.25.v20180904.jar:/usr/lib/hadoop/lib/wildfly-openssl-1.0.4.Final.jar:/usr/lib/hadoop/lib/jackson-core-2.9.9.jar:/usr/lib/hadoop/lib/kerb-identity-1.0.0.jar:/usr/lib/hadoop/lib/jaxb-impl-2.2.3-1.jar:/usr/lib/hadoop/lib/commons-net-3.1.jar:/usr/lib/hadoop/lib/jul-to-slf4j-1.7.25.jar:/usr/lib/hadoop/lib/asm-5.0.4.jar:/usr/lib/hadoop/lib/jsch-0.1.54.jar:/usr/lib/hadoop/lib/jsr305-3.0.0.jar:/usr/lib/hadoop/lib/commons-collections-3.2.2.jar:/usr/lib/hadoop/lib/httpclient-4.5.3.jar:/usr/lib/hadoop/lib/commons-codec-1.11.jar:/usr/lib/hadoop/.//parquet-format-javadoc.jar:/usr/lib/hadoop/.//hadoop-auth-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-jackson.jar:/usr/lib/hadoop/.//hadoop-azure-datalake.jar:/usr/lib/hadoop/.//parquet-format.jar:/usr/lib/hadoop/.//hadoop-aws-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//hadoop-azure-datalake-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-protobuf.jar:/usr/lib/hadoop/.//hadoop-annotations-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//hadoop-auth.jar:/usr/lib/hadoop/.//hadoop-aws.jar:/usr/lib/hadoop/.//hadoop-azure.jar:/usr/lib/hadoop/.//parquet-scala_2.11.jar:/usr/lib/hadoop/.//hadoop-nfs.jar:/usr/lib/hadoop/.//hadoop-annotations.jar:/usr/lib/hadoop/.//parquet-pig.jar:/usr/lib/hadoop/.//parquet-pig-bundle.jar:/usr/lib/hadoop/.//parquet-common.jar:/usr/lib/hadoop/.//parquet-hadoop-bundle.jar:/usr/lib/hadoop/.//hadoop-kms.jar:/usr/lib/hadoop/.//hadoop-kms-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-cascading.jar:/usr/lib/hadoop/.//hadoop-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-generator.jar:/usr/lib/hadoop/.//hadoop-azure-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-hadoop.jar:/usr/lib/hadoop/.//hadoop-common.jar:/usr/lib/hadoop/.//hadoop-common-tests.jar:/usr/lib/hadoop/.//parquet-avro.jar:/usr/lib/hadoop/.//hadoop-common-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop/.//parquet-format-sources.jar:/usr/lib/hadoop/.//parquet-column.jar:/usr/lib/hadoop/.//parquet-thrift.jar:/usr/lib/hadoop/.//parquet-encoding.jar:/usr/lib/hadoop/.//hadoop-nfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop/.//parquet-cascading3.jar:/usr/lib/hadoop-hdfs/./:/usr/lib/hadoop-hdfs/lib/commons-lang3-3.7.jar:/usr/lib/hadoop-hdfs/lib/commons-beanutils-1.9.4.jar:/usr/lib/hadoop-hdfs/lib/log4j-1.2.17.jar:/usr/lib/hadoop-hdfs/lib/commons-logging-1.1.3.jar:/usr/lib/hadoop-hdfs/lib/re2j-1.1.jar:/usr/lib/hadoop-hdfs/lib/jackson-core-asl-1.9.13.jar:/usr/lib/hadoop-hdfs/lib/jettison-1.1.jar:/usr/lib/hadoop-hdfs/lib/guava-11.0.2.jar:/usr/lib/hadoop-hdfs/lib/javax.activation-api-1.2.0.jar:/usr/lib/hadoop-hdfs/lib/paranamer-2.8.jar:/usr/lib/hadoop-hdfs/lib/jetty-util-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jsr311-api-1.1.1.jar:/usr/lib/hadoop-hdfs/lib/jersey-servlet-1.19.jar:/usr/lib/hadoop-hdfs/lib/jaxb-api-2.2.11.jar:/usr/lib/hadoop-hdfs/lib/nimbus-jose-jwt-4.41.1.jar:/usr/lib/hadoop-hdfs/lib/javax.servlet-api-3.1.0.jar:/usr/lib/hadoop-hdfs/lib/protobuf-java-2.5.0.jar:/usr/lib/hadoop-hdfs/lib/okio-1.6.0.jar:/usr/lib/hadoop-hdfs/lib/commons-math3-3.1.1.jar:/usr/lib/hadoop-hdfs/lib/jersey-core-1.19.jar:/usr/lib/hadoop-hdfs/lib/commons-compress-1.18.jar:/usr/lib/hadoop-hdfs/lib/accessors-smart-1.2.jar:/usr/lib/hadoop-hdfs/lib/woodstox-core-5.0.3.jar:/usr/lib/hadoop-hdfs/lib/jetty-io-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jackson-xc-1.9.13.jar:/usr/lib/hadoop-hdfs/lib/jetty-xml-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/curator-recipes-2.12.0.jar:/usr/lib/hadoop-hdfs/lib/jetty-servlet-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/commons-lang-2.6.jar:/usr/lib/hadoop-hdfs/lib/json-simple-1.1.1.jar:/usr/lib/hadoop-hdfs/lib/avro-1.8.2-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/lib/audience-annotations-0.5.0.jar:/usr/lib/hadoop-hdfs/lib/kerby-config-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jetty-security-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jetty-server-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/kerb-util-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/zookeeper-3.4.5-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/lib/netty-3.10.6.Final.jar:/usr/lib/hadoop-hdfs/lib/kerb-admin-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jersey-json-1.19.jar:/usr/lib/hadoop-hdfs/lib/jackson-databind-2.9.9.3.jar:/usr/lib/hadoop-hdfs/lib/kerb-core-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jackson-jaxrs-1.9.13.jar:/usr/lib/hadoop-hdfs/lib/kerby-asn1-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/commons-configuration2-2.1.1.jar:/usr/lib/hadoop-hdfs/lib/kerb-crypto-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/httpcore-4.4.6.jar:/usr/lib/hadoop-hdfs/lib/json-smart-2.3.jar:/usr/lib/hadoop-hdfs/lib/snappy-java-1.1.4.jar:/usr/lib/hadoop-hdfs/lib/jackson-mapper-asl-1.9.13-cloudera.1.jar:/usr/lib/hadoop-hdfs/lib/kerb-simplekdc-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jackson-annotations-2.9.9.jar:/usr/lib/hadoop-hdfs/lib/kerb-client-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jersey-server-1.19.jar:/usr/lib/hadoop-hdfs/lib/curator-client-2.12.0.jar:/usr/lib/hadoop-hdfs/lib/commons-cli-1.2.jar:/usr/lib/hadoop-hdfs/lib/jcip-annotations-1.0-1.jar:/usr/lib/hadoop-hdfs/lib/kerb-server-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/kerby-xdr-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/kerb-common-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/htrace-core4-4.1.0-incubating.jar:/usr/lib/hadoop-hdfs/lib/kerby-util-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jetty-webapp-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/stax2-api-3.1.4.jar:/usr/lib/hadoop-hdfs/lib/commons-io-2.6.jar:/usr/lib/hadoop-hdfs/lib/kerby-pkix-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/curator-framework-2.12.0.jar:/usr/lib/hadoop-hdfs/lib/commons-daemon-1.0.13.jar:/usr/lib/hadoop-hdfs/lib/gson-2.2.4.jar:/usr/lib/hadoop-hdfs/lib/leveldbjni-all-1.8.jar:/usr/lib/hadoop-hdfs/lib/xz-1.6.jar:/usr/lib/hadoop-hdfs/lib/jetty-http-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/okhttp-2.7.5.jar:/usr/lib/hadoop-hdfs/lib/jetty-util-ajax-9.3.25.v20180904.jar:/usr/lib/hadoop-hdfs/lib/jackson-core-2.9.9.jar:/usr/lib/hadoop-hdfs/lib/kerb-identity-1.0.0.jar:/usr/lib/hadoop-hdfs/lib/jaxb-impl-2.2.3-1.jar:/usr/lib/hadoop-hdfs/lib/commons-net-3.1.jar:/usr/lib/hadoop-hdfs/lib/asm-5.0.4.jar:/usr/lib/hadoop-hdfs/lib/jsch-0.1.54.jar:/usr/lib/hadoop-hdfs/lib/jsr305-3.0.0.jar:/usr/lib/hadoop-hdfs/lib/commons-collections-3.2.2.jar:/usr/lib/hadoop-hdfs/lib/httpclient-4.5.3.jar:/usr/lib/hadoop-hdfs/lib/commons-codec-1.11.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-nfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-nfs.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-httpfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-httpfs.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-native-client-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-tests.jar:/usr/lib/hadoop-hdfs/.//hadoop-hdfs-client.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-examples-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-openstack.jar:/usr/lib/hadoop-mapreduce/.//hadoop-aliyun.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-core.jar:/usr/lib/hadoop-mapreduce/.//hadoop-extras-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-uploader.jar:/usr/lib/hadoop-mapreduce/.//hadoop-openstack-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-distcp.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs-plugins-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-sls.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-uploader-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-kafka.jar:/usr/lib/hadoop-mapreduce/.//hadoop-datajoin-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//netty-buffer-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//netty-common-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient-3.0.0-cdh6.3.2-tests.jar:/usr/lib/hadoop-mapreduce/.//hadoop-gridmix-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//jdom-1.1.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-examples.jar:/usr/lib/hadoop-mapreduce/.//hadoop-kafka-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//netty-codec-http-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-rumen-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-app.jar:/usr/lib/hadoop-mapreduce/.//hadoop-extras.jar:/usr/lib/hadoop-mapreduce/.//hadoop-streaming-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//lz4-java-1.5.0.jar:/usr/lib/hadoop-mapreduce/.//aliyun-sdk-oss-2.8.3.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-app-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-datajoin.jar:/usr/lib/hadoop-mapreduce/.//azure-storage-5.4.0.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-nativetask-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient.jar:/usr/lib/hadoop-mapreduce/.//hadoop-distcp-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs-plugins.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-shuffle-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-aliyun-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-common.jar:/usr/lib/hadoop-mapreduce/.//kafka-clients-2.2.1-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//ojalgo-43.0.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-shuffle.jar:/usr/lib/hadoop-mapreduce/.//hadoop-gridmix.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-hs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-jobclient-tests.jar:/usr/lib/hadoop-mapreduce/.//netty-resolver-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-resourceestimator-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-rumen.jar:/usr/lib/hadoop-mapreduce/.//azure-keyvault-core-0.8.0.jar:/usr/lib/hadoop-mapreduce/.//netty-codec-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-nativetask.jar:/usr/lib/hadoop-mapreduce/.//netty-transport-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-sls-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-resourceestimator.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archives.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archives-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//netty-handler-4.1.17.Final.jar:/usr/lib/hadoop-mapreduce/.//hadoop-mapreduce-client-core-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archive-logs.jar:/usr/lib/hadoop-mapreduce/.//zstd-jni-1.3.8-1.jar:/usr/lib/hadoop-mapreduce/.//hadoop-streaming.jar:/usr/lib/hadoop-mapreduce/.//hadoop-archive-logs-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/lib/jackson-jaxrs-json-provider-2.9.9.jar:/usr/lib/hadoop-yarn/lib/guice-servlet-4.0.jar:/usr/lib/hadoop-yarn/lib/jackson-module-jaxb-annotations-2.9.9.jar:/usr/lib/hadoop-yarn/lib/jersey-client-1.19.jar:/usr/lib/hadoop-yarn/lib/objenesis-1.0.jar:/usr/lib/hadoop-yarn/lib/guice-4.0.jar:/usr/lib/hadoop-yarn/lib/jackson-jaxrs-base-2.9.9.jar:/usr/lib/hadoop-yarn/lib/metrics-core-3.0.1.jar:/usr/lib/hadoop-yarn/lib/java-util-1.9.0.jar:/usr/lib/hadoop-yarn/lib/fst-2.50.jar:/usr/lib/hadoop-yarn/lib/javax.inject-1.jar:/usr/lib/hadoop-yarn/lib/geronimo-jcache_1.0_spec-1.0-alpha-1.jar:/usr/lib/hadoop-yarn/lib/json-io-2.5.1.jar:/usr/lib/hadoop-yarn/lib/HikariCP-java7-2.4.12.jar:/usr/lib/hadoop-yarn/lib/bcprov-jdk15on-1.60.jar:/usr/lib/hadoop-yarn/lib/ehcache-3.3.1.jar:/usr/lib/hadoop-yarn/lib/bcpkix-jdk15on-1.60.jar:/usr/lib/hadoop-yarn/lib/aopalliance-1.0.jar:/usr/lib/hadoop-yarn/lib/jersey-guice-1.19.jar:/usr/lib/hadoop-yarn/lib/mssql-jdbc-6.2.1.jre7.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-applicationhistoryservice-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-registry-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-tests-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-common.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-sharedcachemanager-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-client-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-applicationhistoryservice.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-unmanaged-am-launcher-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-resourcemanager.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-common.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-resourcemanager-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-timeline-pluginstorage.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-distributedshell.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-tests.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-router-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-client.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-common-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-web-proxy-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-sharedcachemanager.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-web-proxy.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-router.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-api-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-nodemanager-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-registry.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-distributedshell-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-timeline-pluginstorage-3.0.0-cdh6.3.2.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-api.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-applications-unmanaged-am-launcher.jar:/usr/lib/hadoop-yarn/.//hadoop-yarn-server-nodemanager.jar
STARTUP_MSG:   build = http://github.com/cloudera/hadoop -r 9aff20de3b5ecccf3c19d57f71b214fb4d37ee89; compiled by 'jenkins' on 2019-11-08T13:49Z
STARTUP_MSG:   java = 1.8.0_252
************************************************************/
2020-06-16 15:55:52,271 INFO namenode.NameNode: registered UNIX signal handlers for [TERM, HUP, INT]
2020-06-16 15:55:52,438 INFO namenode.NameNode: createNameNode []
2020-06-16 15:55:52,671 INFO impl.MetricsConfig: Loaded properties from hadoop-metrics2.properties
2020-06-16 15:55:52,908 INFO impl.MetricsSystemImpl: Scheduled Metric snapshot period at 10 second(s).
2020-06-16 15:55:52,909 INFO impl.MetricsSystemImpl: NameNode metrics system started
2020-06-16 15:55:52,970 INFO namenode.NameNode: fs.defaultFS is hdfs://0.0.0.0:8020
2020-06-16 15:55:52,977 INFO namenode.NameNode: Clients are to use 0.0.0.0:8020 to access this namenode/service.
2020-06-16 15:55:53,268 INFO util.JvmPauseMonitor: Starting JVM pause monitor
2020-06-16 15:55:53,317 INFO hdfs.DFSUtil: Starting Web-server for hdfs at: http://0.0.0.0:9870
2020-06-16 15:55:53,363 INFO util.log: Logging initialized @2085ms
2020-06-16 15:55:53,573 INFO server.AuthenticationFilter: Unable to initialize FileSignerSecretProvider, falling back to use random secrets.
2020-06-16 15:55:53,606 INFO http.HttpRequestLog: Http request log for http.requests.namenode is not defined
2020-06-16 15:55:53,629 INFO http.HttpServer2: Added global filter 'safety' (class=org.apache.hadoop.http.HttpServer2$QuotingInputFilter)
2020-06-16 15:55:53,635 INFO http.HttpServer2: Added filter static_user_filter (class=org.apache.hadoop.http.lib.StaticUserWebFilter$StaticUserFilter) to context hdfs
2020-06-16 15:55:53,635 INFO http.HttpServer2: Added filter static_user_filter (class=org.apache.hadoop.http.lib.StaticUserWebFilter$StaticUserFilter) to context static
2020-06-16 15:55:53,635 INFO http.HttpServer2: Added filter static_user_filter (class=org.apache.hadoop.http.lib.StaticUserWebFilter$StaticUserFilter) to context logs
2020-06-16 15:55:53,697 INFO http.HttpServer2: Added filter 'org.apache.hadoop.hdfs.web.AuthFilter' (class=org.apache.hadoop.hdfs.web.AuthFilter)
2020-06-16 15:55:53,700 INFO http.HttpServer2: addJerseyResourcePackage: packageName=org.apache.hadoop.hdfs.server.namenode.web.resources;org.apache.hadoop.hdfs.web.resources, pathSpec=/webhdfs/v1/*
2020-06-16 15:55:53,738 INFO http.HttpServer2: Jetty bound to port 9870
2020-06-16 15:55:53,747 INFO server.Server: jetty-9.3.25.v20180904, build timestamp: 2018-09-04T21:11:46Z, git hash: 3ce520221d0240229c862b122d2b06c12a625732
2020-06-16 15:55:53,858 INFO handler.ContextHandler: Started o.e.j.s.ServletContextHandler@7bba5817{/logs,file:///var/log/hadoop-hdfs/,AVAILABLE}
2020-06-16 15:55:53,859 INFO handler.ContextHandler: Started o.e.j.s.ServletContextHandler@75437611{/static,file:///usr/lib/hadoop-hdfs/webapps/static/,AVAILABLE}
2020-06-16 15:55:54,026 INFO handler.ContextHandler: Started o.e.j.w.WebAppContext@20bd8be5{/,file:///usr/lib/hadoop-hdfs/webapps/hdfs/,AVAILABLE}{/hdfs}
2020-06-16 15:55:54,041 INFO server.AbstractConnector: Started ServerConnector@24105dc5{HTTP/1.1,[http/1.1]}{0.0.0.0:9870}
2020-06-16 15:55:54,041 INFO server.Server: Started @2764ms
2020-06-16 15:55:54,394 WARN namenode.FSNamesystem: Only one image storage directory (dfs.namenode.name.dir) configured. Beware of data loss due to lack of redundant storage directories!
2020-06-16 15:55:54,395 WARN namenode.FSNamesystem: Only one namespace edits storage directory (dfs.namenode.edits.dir) configured. Beware of data loss due to lack of redundant storage directories!
2020-06-16 15:55:54,533 INFO namenode.FSEditLog: Edit logging is async:true
2020-06-16 15:55:54,560 INFO namenode.FSNamesystem: KeyProvider: null
2020-06-16 15:55:54,563 INFO namenode.FSNamesystem: fsLock is fair: true
2020-06-16 15:55:54,564 INFO namenode.FSNamesystem: Detailed lock hold time metrics enabled: false
2020-06-16 15:55:54,583 INFO namenode.FSNamesystem: fsOwner             = root (auth:SIMPLE)
2020-06-16 15:55:54,583 INFO namenode.FSNamesystem: supergroup          = supergroup
2020-06-16 15:55:54,583 INFO namenode.FSNamesystem: isPermissionEnabled = true
2020-06-16 15:55:54,584 INFO namenode.FSNamesystem: HA Enabled: false
2020-06-16 15:55:54,683 INFO common.Util: dfs.datanode.fileio.profiling.sampling.percentage set to 0. Disabling file IO profiling
2020-06-16 15:55:54,712 INFO blockmanagement.DatanodeManager: dfs.block.invalidate.limit: configured=1000, counted=60, effected=1000
2020-06-16 15:55:54,713 INFO blockmanagement.DatanodeManager: dfs.namenode.datanode.registration.ip-hostname-check=true
2020-06-16 15:55:54,722 INFO blockmanagement.BlockManager: dfs.namenode.startup.delay.block.deletion.sec is set to 000:00:00:00.000
2020-06-16 15:55:54,723 INFO blockmanagement.BlockManager: The block deletion will start around 2020 Jun 16 15:55:54
2020-06-16 15:55:54,727 INFO util.GSet: Computing capacity for map BlocksMap
2020-06-16 15:55:54,727 INFO util.GSet: VM type       = 64-bit
2020-06-16 15:55:54,732 INFO util.GSet: 2.0% max memory 876.5 MB = 17.5 MB
2020-06-16 15:55:54,732 INFO util.GSet: capacity      = 2^21 = 2097152 entries
2020-06-16 15:55:54,760 INFO blockmanagement.BlockManager: dfs.block.access.token.enable = false
2020-06-16 15:55:54,771 INFO Configuration.deprecation: No unit for dfs.namenode.safemode.extension(30000) assuming MILLISECONDS
2020-06-16 15:55:54,772 INFO blockmanagement.BlockManagerSafeMode: dfs.namenode.safemode.threshold-pct = 0.9990000128746033
2020-06-16 15:55:54,772 INFO blockmanagement.BlockManagerSafeMode: dfs.namenode.safemode.min.datanodes = 0
2020-06-16 15:55:54,772 INFO blockmanagement.BlockManagerSafeMode: dfs.namenode.safemode.extension = 30000
2020-06-16 15:55:54,772 INFO blockmanagement.BlockManager: defaultReplication         = 3
2020-06-16 15:55:54,772 INFO blockmanagement.BlockManager: maxReplication             = 512
2020-06-16 15:55:54,773 INFO blockmanagement.BlockManager: minReplication             = 1
2020-06-16 15:55:54,773 INFO blockmanagement.BlockManager: maxReplicationStreams      = 2
2020-06-16 15:55:54,773 INFO blockmanagement.BlockManager: redundancyRecheckInterval  = 3000ms
2020-06-16 15:55:54,773 INFO blockmanagement.BlockManager: encryptDataTransfer        = false
2020-06-16 15:55:54,773 INFO blockmanagement.BlockManager: maxNumBlocksToLog          = 1000
2020-06-16 15:55:54,841 INFO namenode.FSDirectory: GLOBAL serial map: bits=24 maxEntries=16777215
2020-06-16 15:55:54,878 INFO util.GSet: Computing capacity for map INodeMap
2020-06-16 15:55:54,878 INFO util.GSet: VM type       = 64-bit
2020-06-16 15:55:54,879 INFO util.GSet: 1.0% max memory 876.5 MB = 8.8 MB
2020-06-16 15:55:54,879 INFO util.GSet: capacity      = 2^20 = 1048576 entries
2020-06-16 15:55:54,880 INFO namenode.FSDirectory: ACLs enabled? false
2020-06-16 15:55:54,880 INFO namenode.FSDirectory: POSIX ACL inheritance enabled? true
2020-06-16 15:55:54,880 INFO namenode.FSDirectory: XAttrs enabled? true
2020-06-16 15:55:54,881 INFO namenode.NameNode: Caching file names occurring more than 10 times
2020-06-16 15:55:54,891 INFO snapshot.SnapshotManager: Loaded config captureOpenFiles: true, skipCaptureAccessTimeOnlyChange: false, snapshotDiffAllowSnapRootDescendant: true
2020-06-16 15:55:54,903 INFO util.GSet: Computing capacity for map cachedBlocks
2020-06-16 15:55:54,903 INFO util.GSet: VM type       = 64-bit
2020-06-16 15:55:54,905 INFO util.GSet: 0.25% max memory 876.5 MB = 2.2 MB
2020-06-16 15:55:54,905 INFO util.GSet: capacity      = 2^18 = 262144 entries
2020-06-16 15:55:54,925 INFO metrics.TopMetrics: NNTop conf: dfs.namenode.top.window.num.buckets = 10
2020-06-16 15:55:54,925 INFO metrics.TopMetrics: NNTop conf: dfs.namenode.top.num.users = 10
2020-06-16 15:55:54,925 INFO metrics.TopMetrics: NNTop conf: dfs.namenode.top.windows.minutes = 1,5,25
2020-06-16 15:55:54,938 INFO namenode.FSNamesystem: Retry cache on namenode is enabled
2020-06-16 15:55:54,938 INFO namenode.FSNamesystem: Retry cache will use 0.03 of total heap and retry cache entry expiry time is 600000 millis
2020-06-16 15:55:54,943 INFO util.GSet: Computing capacity for map NameNodeRetryCache
2020-06-16 15:55:54,944 INFO util.GSet: VM type       = 64-bit
2020-06-16 15:55:54,944 INFO util.GSet: 0.029999999329447746% max memory 876.5 MB = 269.3 KB
2020-06-16 15:55:54,944 INFO util.GSet: capacity      = 2^15 = 32768 entries
2020-06-16 15:55:54,978 INFO common.Storage: Lock on /var/lib/hadoop-hdfs/cache/hdfs/dfs/name/in_use.lock acquired by nodename 2029@25b603a089cc
2020-06-16 15:55:55,028 INFO namenode.FileJournalManager: Recovering unfinalized segments in /var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current
2020-06-16 15:55:55,084 INFO namenode.FileJournalManager: Finalizing edits file /var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current/edits_inprogress_0000000000000000001 -> /var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current/edits_0000000000000000001-0000000000000000001
2020-06-16 15:55:55,121 INFO namenode.FSImage: Planning to load image: FSImageFile(file=/var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current/fsimage_0000000000000000000, cpktTxId=0000000000000000000)
2020-06-16 15:55:55,282 INFO namenode.FSImageFormatPBINode: Loading 1 INodes.
2020-06-16 15:55:55,349 INFO namenode.FSImageFormatProtobuf: Loaded FSImage in 0 seconds.
2020-06-16 15:55:55,350 INFO namenode.FSImage: Loaded image for txid 0 from /var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current/fsimage_0000000000000000000
2020-06-16 15:55:55,350 INFO namenode.FSImage: Reading org.apache.hadoop.hdfs.server.namenode.RedundantEditLogInputStream@5674e1f2 expecting start txid #1
2020-06-16 15:55:55,351 INFO namenode.FSImage: Start loading edits file /var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current/edits_0000000000000000001-0000000000000000001 maxTxnsToRead = 9223372036854775807
2020-06-16 15:55:55,355 INFO namenode.RedundantEditLogInputStream: Fast-forwarding stream '/var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current/edits_0000000000000000001-0000000000000000001' to transaction ID 1
2020-06-16 15:55:55,390 INFO namenode.FSImage: Edits file /var/lib/hadoop-hdfs/cache/hdfs/dfs/name/current/edits_0000000000000000001-0000000000000000001 of size 1048576 edits # 1 loaded in 0 seconds
2020-06-16 15:55:55,390 INFO namenode.FSNamesystem: Need to save fs image? false (staleImage=false, haEnabled=false, isRollingUpgrade=false)
2020-06-16 15:55:55,392 INFO namenode.FSEditLog: Starting log segment at 2
2020-06-16 15:55:55,519 INFO namenode.NameCache: initialized with 0 entries 0 lookups
2020-06-16 15:55:55,519 INFO namenode.FSNamesystem: Finished loading FSImage in 569 msecs
2020-06-16 15:55:55,917 INFO namenode.NameNode: RPC server is binding to 0.0.0.0:8020
2020-06-16 15:55:55,939 INFO ipc.CallQueueManager: Using callQueue: class java.util.concurrent.LinkedBlockingQueue queueCapacity: 1000 scheduler: class org.apache.hadoop.ipc.DefaultRpcScheduler
2020-06-16 15:55:55,965 INFO ipc.Server: Starting Socket Reader #1 for port 8020
2020-06-16 15:55:56,404 INFO namenode.FSNamesystem: Registered FSNamesystemState, ReplicatedBlocksState and ECBlockGroupsState MBeans.
2020-06-16 15:55:56,423 INFO namenode.LeaseManager: Number of blocks under construction: 0
2020-06-16 15:55:56,448 INFO blockmanagement.BlockManager: initializing replication queues
2020-06-16 15:55:56,449 INFO hdfs.StateChange: STATE* Leaving safe mode after 0 secs
2020-06-16 15:55:56,449 INFO hdfs.StateChange: STATE* Network topology has 0 racks and 0 datanodes
2020-06-16 15:55:56,449 INFO hdfs.StateChange: STATE* UnderReplicatedBlocks has 0 blocks
2020-06-16 15:55:56,469 INFO blockmanagement.BlockManager: Total number of blocks            = 0
2020-06-16 15:55:56,469 INFO blockmanagement.BlockManager: Number of invalid blocks          = 0
2020-06-16 15:55:56,469 INFO blockmanagement.BlockManager: Number of under-replicated blocks = 0
2020-06-16 15:55:56,469 INFO blockmanagement.BlockManager: Number of  over-replicated blocks = 0
2020-06-16 15:55:56,470 INFO blockmanagement.BlockManager: Number of blocks being written    = 0
2020-06-16 15:55:56,471 INFO hdfs.StateChange: STATE* Replication Queue initialization scan for invalid, over- and under-replicated blocks completed in 22 msec
2020-06-16 15:55:56,536 INFO ipc.Server: IPC Server Responder: starting
2020-06-16 15:55:56,543 INFO ipc.Server: IPC Server listener on 8020: starting
2020-06-16 15:55:56,554 INFO namenode.NameNode: NameNode RPC up at: 0.0.0.0/0.0.0.0:8020
2020-06-16 15:55:56,561 INFO namenode.FSNamesystem: Starting services required for active state
2020-06-16 15:55:56,561 INFO namenode.FSDirectory: Initializing quota with 4 thread(s)
2020-06-16 15:55:56,581 INFO namenode.FSDirectory: Quota initialization completed in 19 milliseconds
name space=1
storage space=0
storage types=RAM_DISK=0, SSD=0, DISK=0, ARCHIVE=0
2020-06-16 15:55:56,595 INFO blockmanagement.CacheReplicationMonitor: Starting CacheReplicationMonitor with interval 30000 milliseconds
^C2020-06-16 15:56:01,491 ERROR namenode.NameNode: RECEIVED SIGNAL 2: SIGINT
2020-06-16 15:56:01,496 INFO namenode.NameNode: SHUTDOWN_MSG:
/************************************************************
SHUTDOWN_MSG: Shutting down NameNode at 25b603a089cc/172.17.0.3
************************************************************/
```

发现namenode启动成功。

```
[root@25b603a089cc /]# netstat -anp
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:9870            0.0.0.0:*               LISTEN      1872/java
tcp        0      0 0.0.0.0:8020            0.0.0.0:*               LISTEN      1872/java
tcp        0      0 172.17.0.3:36568        151.101.108.167:443     TIME_WAIT   -
tcp        0      0 172.17.0.3:43778        202.104.186.227:80      TIME_WAIT   -
tcp        0      0 172.17.0.3:43774        202.104.186.227:80      TIME_WAIT   -
```

并且看到了8020他的rpc端口已经启动，9870就是web的端口。

接着，我们就可以在浏览器看到服务启动完毕了。

浏览器输入：`http://localhost:9870/`

![hadoop-namenode-webui](/images/大数据/hadoop-namenode.png)

至此，大数据服务namenode容器安装完毕.

接着，我们继续部署我们的datanode服务。为了调试方便，我在同一个容器中部署datanode

```
yum install -y hadoop-hdfs-datanode
```

安装完毕之后，再启动服务

```
[root@9ba32201bb25 /]# netstat -anp
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:8020            0.0.0.0:*               LISTEN      917/java
tcp        0      0 127.0.0.11:39643        0.0.0.0:*               LISTEN      -
tcp        0      0 0.0.0.0:9864            0.0.0.0:*               LISTEN      990/java
tcp        0      0 0.0.0.0:9866            0.0.0.0:*               LISTEN      990/java
tcp        0      0 0.0.0.0:9867            0.0.0.0:*               LISTEN      990/java
tcp        0      0 127.0.0.1:38411         0.0.0.0:*               LISTEN      990/java
tcp        0      0 0.0.0.0:9870            0.0.0.0:*               LISTEN      917/java
tcp        0      0 172.24.0.2:42042        113.96.181.216:80       TIME_WAIT   -
tcp        0      0 172.24.0.2:8020         172.24.0.2:58574        ESTABLISHED 917/java
tcp        0      0 172.24.0.2:58574        172.24.0.2:8020         ESTABLISHED 990/java
udp        0      0 127.0.0.11:54498        0.0.0.0:*
```

这里我们可以看到除了8020/9870这2个是namenode的端口之外，其他端口都是datanode节点的端口。

我们在`hdfs-site.xml`中添加了如下配置

```
<property>
	 <name>dfs.datanode.data.dir</name>
	 <value>file:///var/lib/hadoop-hdfs/cache/hdfs/dfs/data</value>
</property>
```

再调整dockerfile。最终如下。

```
FROM ccinn/cdh6:latest

LABEL maintainer="Caiwenhui <471113744@qq.com>"

USER root

ADD support.sh /support.sh
ADD conf/core-site.xml /etc/hadoop/conf/
ADD conf/hdfs-site.xml /etc/hadoop/conf/
ADD conf/mapred-site.xml /etc/hadoop/conf/
ADD bin/run.sh /bin/

RUN source /support.sh;\
  loop_exec 'yum install -y hadoop-hdfs-namenode hadoop-hdfs-datanode'

RUN mkdir -p var/lib/hadoop-hdfs/cache/hdfs/dfs/name;\
  mkdir -p var/lib/hadoop-hdfs/cache/hdfs/dfs/data;

WORKDIR /

# 9870 namenode's http
# 9864 datanode's http

EXPOSE 9870 9864

CMD ["/bin/run.sh"]
```

浏览器输入：`http://localhost:9864/`

![hadoop-datanode-webui](/images/大数据/hadoop-datanode.png)

## 构建hive镜像

- [基于基础镜像的hive服务](https://github.com/base-big-data/docker-cdh6-hive)

前面，我们说到hadoop的生态组件是个繁杂的依赖关系，版本搞不对，经常会出现服务起不来的问题。

当我们不想用cdh给我们选择好的组件的时候，记得需要自己梳理好版本关系。

[hive下载前的版本依赖说明-查看hadoop和hive版本的关系](http://hive.apache.org/downloads.html)

[由于我们用的cdh6的源，所以我直接yum安装，这里hive的版本为2.1.1](https://archive.cloudera.com/cdh6/6.3.2/redhat7/yum/RPMS/noarch/)

```dockerfile
FROM ccinn/cdh6:latest

LABEL maintainer="Caiwenhui <471113744@qq.com>"

USER root

ADD bin/support.sh /bin/
ADD bin/run.sh /bin/

# 安装元数据存储服务 postgres
RUN source /bin/support.sh;\
  loop_exec 'yum install -y hive hive-metastore postgresql-jdbc' ;\
  ln -s /usr/share/java/postgresql-jdbc.jar /usr/lib/hive/lib/postgresql-jdbc.jar

ADD conf/hive-site.xml /etc/hive/conf/

WORKDIR /

CMD ["/bin/run.sh"]
```

这里我们使用`postgresql`作为我们的元数据存储服务，所以我们安装了一个`postgresql-jdbc`，并且需要把jar包放在hive服务加载的环境变量下。

## 构建用于hive镜像的postgres镜像


- [构建用于hive镜像的postgres镜像](https://github.com/base-big-data/docker-cdh6-hive-postgresql)

```dockerfile
FROM postgres:9

LABEL maintainer="Caiwenhui <471113744@qq.com>"

COPY cdh6-hive-postgres /cdh6-hive-postgres

COPY init-hive-db.sh /docker-entrypoint-initdb.d/init-user-db.sh

# 因为schema内部用了相对地址加载关联的sql，所以这里的工作目录需要指定为脚本当前目录
WORKDIR /cdh6-hive-postgres
```

整个dockerfile很简单，我们的用户和密码都是使用了了`hive`。


## 构建impala镜像

- [构建impala镜像](https://github.com/base-big-data/docker-cdh6-impala)

```dockerfile
FROM ccinn/cdh6:latest

LABEL maintainer="Caiwenhui <471113744@qq.com>"

USER root

ADD bin/support.sh /bin/
ADD bin/run.sh /bin/

RUN source /bin/support.sh;\
  loop_exec 'yum install -y impala impala-server impala-shell impala-catalog impala-state-store' ;

WORKDIR /

CMD ["/bin/bash"]
```

在这里，需要注意的是，我们的impala服务启动是有关联顺序问题的。

- 1⃣️ impala-state-store
- 2⃣️ impala-catalog
- 3⃣️ impala-server(impalad)

![impala-shell](/images/大数据/impala.png)

到此，我们整套大数据`OLAP`的体系设施，算是基本完成了。其实到hive已经算ok了。但是大家其实可以看到，我这里到计算引擎并没有使用`hiveserver2`。这里到`hive只是用了metastore`。

也因此，这个hive到metastore，目前来说仅仅只是`为了服务impala`用到。
