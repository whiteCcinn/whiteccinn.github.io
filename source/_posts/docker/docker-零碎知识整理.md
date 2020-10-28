---
title: 【Docker】零碎知识整理
date: 2020-06-10 10:28:30
categories: [Docker]
tags: [Docker]
---

## 前言

虽然自己对docker有了一定了解了，但是有一些比较零碎对知识点，一直没整理，所以现在用一篇文章来记录下一些零碎点知识点，方便自己查阅

<!-- more -->

## DOCKER 给运行中的容器添加映射端口

```SHELL
➜  ~ docker ps
CONTAINER ID        IMAGE                             COMMAND                  CREATED             STATUS                PORTS                    NAMES
8eed84e6b307        golang:1.14.2                     "bash"                   3 weeks ago         Up 4 days                                      msource
241a499c7061        garethflowers/svn-server:latest   "/usr/bin/svnserve -…"   5 weeks ago         Up 6 days (healthy)   0.0.0.0:3690->3690/tcp   svn
```

## 方法1

1. 把现有的容器commit成一个新的images
2. 再基于这个images run一个新的容器，这个时候带上端口映射规则即可

> 优点就是不需要涉及太多底层的东西，遵循docker的默认提供的API操作即可

### 方法2

修改底层配置文件

```shell
docker inspect `svn` | grep IPAddress
```

实例：

```shell
[
    {
        "Id": "241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5",
        "Created": "2020-05-05T01:40:40.8904321Z",
        "Path": "/usr/bin/svnserve",
        "Args": [
            "--daemon",
            "--foreground",
            "--root",
            "/var/opt/svn"
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 1893,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2020-06-04T01:01:15.928217933Z",
            "FinishedAt": "2020-06-04T01:01:13.970497593Z",
            "Health": {
                "Status": "healthy",
                "FailingStreak": 0,
                "Log": [
                    {
                        "Start": "2020-06-10T03:19:51.4613637Z",
                        "End": "2020-06-10T03:19:51.5609883Z",
                        "ExitCode": 0,
                        "Output": "tcp        0      0 0.0.0.0:3690            0.0.0.0:*               LISTEN      \n"
                    },
                    {
                        "Start": "2020-06-10T03:20:21.5325319Z",
                        "End": "2020-06-10T03:20:21.6352731Z",
                        "ExitCode": 0,
                        "Output": "tcp        0      0 0.0.0.0:3690            0.0.0.0:*               LISTEN      \n"
                    },
                    {
                        "Start": "2020-06-10T03:20:51.6086611Z",
                        "End": "2020-06-10T03:20:51.7427852Z",
                        "ExitCode": 0,
                        "Output": "tcp        0      0 0.0.0.0:3690            0.0.0.0:*               LISTEN      \n"
                    },
                    {
                        "Start": "2020-06-10T03:21:21.7182145Z",
                        "End": "2020-06-10T03:21:21.8185606Z",
                        "ExitCode": 0,
                        "Output": "tcp        0      0 0.0.0.0:3690            0.0.0.0:*               LISTEN      \n"
                    },
                    {
                        "Start": "2020-06-10T03:21:51.7906908Z",
                        "End": "2020-06-10T03:21:51.8788176Z",
                        "ExitCode": 0,
                        "Output": "tcp        0      0 0.0.0.0:3690            0.0.0.0:*               LISTEN      \n"
                    }
                ]
            }
        },
        "Image": "sha256:cc28899d5b9077f49f22494074e1197ef4af59d0a1ddca636f57c3b1dc3289d3",
        "ResolvConfPath": "/var/lib/docker/containers/241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5/hostname",
        "HostsPath": "/var/lib/docker/containers/241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5/hosts",
        "LogPath": "/var/lib/docker/containers/241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5/241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5-json.log",
        "Name": "/svn",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "",
        "ExecIDs": null,
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {}
            },
            "NetworkMode": "default",
            "PortBindings": {
                "3690/tcp": [
                    {
                        "HostIp": "",
                        "HostPort": "3690"
                    }
                ]
            },
            "RestartPolicy": {
                "Name": "always",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "CapAdd": null,
            "CapDrop": null,
            "Capabilities": null,
            "Dns": [],
            "DnsOptions": [],
            "DnsSearch": [],
            "ExtraHosts": null,
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": null,
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "ConsoleSize": [
                0,
                0
            ],
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 0,
            "NanoCpus": 0,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": [],
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": [],
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "KernelMemory": 0,
            "KernelMemoryTCP": 0,
            "MemoryReservation": 0,
            "MemorySwap": 0,
            "MemorySwappiness": null,
            "OomKillDisable": false,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/asound",
                "/proc/acpi",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "LowerDir": "/var/lib/docker/overlay2/1e550f38444220f2853beac87489c7d717e24ac60cd9c64fe67e5571d01d7aee-init/diff:/var/lib/docker/overlay2/c9d13c35fbce9cce4b87c4c9f8e3a1fa335c495806c9aa28e9c85b01a7425f6f/diff:/var/lib/docker/overlay2/f0d6ab7fcc03bb7f98dd26452fd413e0db8b5b4fdc491fdef13aa8064f6d2b44/diff:/var/lib/docker/overlay2/9b3dba47a78414d42c011724a52ea1b25df7939c1db9746d8582c9c48ce80643/diff",
                "MergedDir": "/var/lib/docker/overlay2/1e550f38444220f2853beac87489c7d717e24ac60cd9c64fe67e5571d01d7aee/merged",
                "UpperDir": "/var/lib/docker/overlay2/1e550f38444220f2853beac87489c7d717e24ac60cd9c64fe67e5571d01d7aee/diff",
                "WorkDir": "/var/lib/docker/overlay2/1e550f38444220f2853beac87489c7d717e24ac60cd9c64fe67e5571d01d7aee/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [
            {
                "Type": "volume",
                "Name": "c3a499500757570063073552298c2c6a2973351692eb91d9e3437944aeb79e6a",
                "Source": "/var/lib/docker/volumes/c3a499500757570063073552298c2c6a2973351692eb91d9e3437944aeb79e6a/_data",
                "Destination": "/var/opt/svn",
                "Driver": "local",
                "Mode": "",
                "RW": true,
                "Propagation": ""
            }
        ],
        "Config": {
            "Hostname": "241a499c7061",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": false,
            "AttachStderr": false,
            "ExposedPorts": {
                "3690/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            ],
            "Cmd": [
                "/usr/bin/svnserve",
                "--daemon",
                "--foreground",
                "--root",
                "/var/opt/svn"
            ],
            "Healthcheck": {
                "Test": [
                    "CMD-SHELL",
                    "netstat -ln | grep 3690 || exit 1"
                ]
            },
            "Image": "garethflowers/svn-server:latest",
            "Volumes": {
                "/var/opt/svn": {}
            },
            "WorkingDir": "/var/opt/svn",
            "Entrypoint": null,
            "OnBuild": null,
            "Labels": {
                "org.label-schema.build-date": "2020-02-13T21:46:23Z",
                "org.label-schema.description": "SVN Server",
                "org.label-schema.docker.cmd": "docker run --detach --publish 3690:3690 --volume :/var/opt/svn garethflowers/svn-server",
                "org.label-schema.name": "svn-server",
                "org.label-schema.schema-version": "1.0",
                "org.label-schema.url": "https://subversion.apache.org",
                "org.label-schema.vcs-ref": "d622ac5",
                "org.label-schema.vcs-url": "https://github.com/garethflowers/docker-svn-server",
                "org.label-schema.vendor": "garethflowers",
                "org.label-schema.version": "1.3.3"
            }
            ...
```

我们关注一下，这个容器的id。

如果是linux系统下的，我们可以这样子操作。

```shell

cd /var/lib/docker/241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5 #这里是CONTAINER ID
vi hostconfig.json
如果之前没有端口映射, 应该有这样的一段:

```
"PortBindings":{"3690/tcp":[{"HostIp":"","HostPort":"3690"}]}

## 格式化后

"PortBindings": {
    "3690/tcp": [
        {
            "HostIp": "",
            "HostPort": "3690"
        }
    ]
},
```

增加一个映射, 这样写:

```
"PortBindings":{"3690/tcp":[{"HostIp":"","HostPort":"3690"}],"3306/tcp":[{"HostIp":"","HostPort":"3307"}]}
```

前一个数字是容器端口, 后一个是宿主机端口.
而修改现有端口映射更简单, 把端口号改掉就行.

记得要重启docker服务，否则配置会被覆盖回去
```

如果是再mac系统下操作的话，由于`docker for mac`的本质是通过一个小型虚拟机操作的，所以需要先进入到虚拟机中

docker for mac 的内容默认在 `~/Library/Containers/com.docker.docker/`

我们找到 `~/Library/Containers/com.docker.docker/Data/vms/0/tty`

通过 `screen tty` 进入到虚拟机，这个时候你就可以看到`/var/lib/docker/241a499c7061a70ce20216d6e2310d851e8dcc41b4072727a16c752c4463a8a5` 这里路径了

> 退出到时候记得用`control+a k`到组合方式退出

```
docker-desktop:~# cat /var/lib/docker/containers/241a499c7061a70ce20216d6e2310d8
51e8dcc41b4072727a16c752c4463a8a5/hostconfig.json
{"Binds":null,"ContainerIDFile":"","LogConfig":{"Type":"json-file","Config":{}},"NetworkMode":"default","PortBindings":{"3690/tcp":[{"HostIp":"","HostPort":"3690"}]},"RestartPolicy":{"Name":"always","MaximumRetryCount":0},"AutoRemove":false,"VolumeDriver":"","VolumesFrom":null,"CapAdd":null,"CapDrop":null,"Capabilities":null,"Dns":[],"DnsOptions":[],"DnsSearch":[],"ExtraHosts":null,"GroupAdd":null,"IpcMode":"private","Cgroup":"","Links":null,"OomScoreAdj":0,"PidMode":"","Privileged":false,"PublishAllPorts":false,"ReadonlyRootfs":false,"SecurityOpt":null,"UTSMode":"","UsernsMode":"","ShmSize":67108864,"Runtime":"runc","ConsoleSize":[0,0],"Isolation":"","CpuShares":0,"Memory":0,"NanoCpus":0,"CgroupParent":"","BlkioWeight":0,"BlkioWeightDevice":[],"BlkioDeviceReadBps":null,"BlkioDeviceWriteBps":null,"BlkioDeviceReadIOps":null,"BlkioDeviceWriteIOps":null,"CpuPeriod":0,"CpuQuota":0,"CpuRealtimePeriod":0,"CpuRealtimeRuntime":0,"CpusetCpus":"","CpusetMems":"","Devices":[],"DeviceCgroupRules":null,"DeviceRequests":null,"KernelMemory":0,"KernelMemoryTCP":0,"MemoryReservation":0,"MemorySwap":0,"MemorySwappiness":null,"OomKillDisable":false,"PidsLimit":null,"Ulimits":null,"CpuCount":0,"CpuPercent":0,"IOMaximumIOps":0,"IOMaximumBandwidth":0,"MaskedPaths":["/proc/asound","/proc/acpi","/proc/kcore","/proc/keys","/proc/latency_stats","/proc/timer_list","/proc/timer_stats","/proc/sched_debug","/proc/scsi","/sys/firmware"],"ReadonlyPaths":["/proc/bus","/proc/fs","/proc/irq","/proc/sys","/proc/sysrq-trigger"]}
```
