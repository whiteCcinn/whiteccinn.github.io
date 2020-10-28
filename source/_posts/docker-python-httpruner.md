---
title: docker-python-httpruner
date: 2018-08-22 19:56:00
categories: [Docker, Python, 测试]
tags: [Docker, Python, 测试, jsonschema]
---

# Httprunner

最近，由于某些原因，了解到了 httprunner。

先贴上我的本次文章的主题：

- 支持 docker 环境

- 支持 jsonschema

- 粗略封装成了应用型框架

- import python-file 的时候，请写基于项目根目录的路径

目标：
[[Github:httprunner-docker]](https://github.com/whiteCcinn/httprunner-docker)

[[HubDocker:httprunner-docker]](https://hub.docker.com/r/ccinn/httprunner-docker)

## <!-- more -->

## 前言

源自于：
[[httprunner]](http://cn.httprunner.org/ 'httprunner')

![](https://usblog.crazylaw.cn/usr/uploads/2018/08/852562228.png)

可以看到，它是一个由 python 写的测试框架。

HttpRunner 是一款面向 HTTP(S) 协议的通用测试框架，只需编写维护一份 YAML/JSON 脚本，即可实现自动化测试、性能测试、线上监控、持续集成等多种测试需求。

作为一名后端语言开发人员，python 能力不算太强，一边写，一遍学习。在本机上开发上遇到了各种瓶颈，可以说是看得懂和自己写是二回事。于是，这里可以把我当作一个测试新手人员，和大家一起记录学习的过程。

首先，我选择了 pycharm 这一款 JB 的产品作为我的 ide。

我发现它有一些智能的地方，比如自带 python 等环境，但是这也是致命麻烦的地方（可能是我孤陋寡闻了），就是想着如果我有一个项目，用到 httprunner 作为测试框架，那么我的目录不固定，我要到处引入 `__init__.py`的文件，显得很痛苦。而且，python 我所了解到的是 3.x 和 2.x 还是有一些区别的。

默认它安装的是 2.x，但是作为开发人员，在学习的过程中，当然期待是最新的，后续，由于需求的原因，我又去看了一下 2.x 和 3.x 兼容的问题，但是这里就不做叙述了。

我们大家平时用的环境比较多的是 2 中，一种是`window`，一种是`maxOS`，万一我在 ide 环境下运行得好好的，去到我的生成环境却无法运行了怎么办？或者说，想要模拟服务器上运行的话，或者方便移植的话，怎么处理？答案是：`docker`。是的，我们可以用 docker 来解决这个问题。

但是我翻看了一下`httprunner`的官方，并没有提供出`docker`文件，于是那好吧，那我就自己撸一个吧，再加上参考了几个文章，构建出了一套`基于httprunner的测试开发框架`，整套体系就在我的 github 中，大家可以去看看。

项目目录结构如下：

```
├── .env                             ## demo所使用的环境变量
├── .env.example
├── Dockerfile                    ## 本项目的Dockerfile
├── README.MD
├── config
│   ├── demo_data.ini            ## 可变数据的设置
│   └── test_data.ini              ## 多个可变数据的设置
├── docker-entrypoint.sh      ## Dockerfile的入口点
├── jsonschemas                  ## 用于支持json-schema
│   └── demo-jsonschema
│       └── user.schema.json
├── lib                          ## 存放自己测试框架所需要用到的类库（例如生成token的算法）
├── parameters                      ## 用于解析ini数据
│   ├── common.py
│   └── header.py
├── reports                            ## 报告默认生成的地方
│   └── 1534933506.html
├── requirements.txt             ## 项目初始化依赖安装列表
├── run-all.sh                        ## 大家批量运行用例写的一个十分简单的shell脚本
├── testcases                        ## （重点）存放我们的用例
│   ├── debugtalk.py
│   └── demo.json
└── util                               ## 本项目官方所用的工具类和自定义公共函数
    ├── common_config.py
    ├── env.py
    ├── function.py
    └── validation_json_schema.py
```

这里，我在上面已经大致写了每个目录所干什么的了。

---

## 起步

你需要安装好 docker，docker 作为虚拟化技术，建议大家都多学学。即使是测试的同学，也要积极拥抱各种前沿的技术哦。加油～！

### 1. 安装 docker

略过....

### 2. 下载项目

```
git clone https://github.com/whiteCcinn/httprunner-docker.git
```

### 3. 进入项目

```
cd httprunner-docker
```

### 4. 编译 dockerfile 生成项目镜像

```
docker build -t httprunner .
```

### 5. 通过镜像运行容器代替 httprunner

```
docker run -it --rm -v "$PWD":/usr/src/myapp httprunner
```

为了帮助不熟悉 docker 的同学在这里强调一下参数

- `-it` 让 docker 容器拥有交互的能力。（重要的是加了这个参数，你可以通过 `/bin/sh` 进入容器执行也是可以的，而且加了这个参数，容器内部的`颜色样式`才会被打印出来，不然会全部白色，十分难以辨别 ）

- `--rm` 可以理解为临时创建一个容器，容器运行结束后便会自行销毁，这个大家可以不用理解，但是加了这个参数字面的意思就是它不会重复 new 很多随机命名的容器。

- `-v` 这个是 docker 中相对来说比较重要的命令，用了这个命令，你的 docker 容器和你的本机目录将会变成共享卷，通俗一点就是加了这个命令，你新加的用例 json 文件，才会和 docker 容器里面的目录同步，并且你所生成的测试报告，才可以在本地直接访问。由于我们是在项目下执行的，所以我们用`$PWD`命令来快速获取当前目录的路径，然后映射到我们的容器里面的路径`/usr/src/myapp`（因为我们的 docker 项目的工作路径就是在这里，这个不需要修改）

- `httprunner` 这个就是我们刚才用`docker build -t httprunner .`打印出来的`httprunner`的名字。

### 6. 结果

大家可以看到，这个时候，默认的，我们可以看到`hrun`提供给我们的命令提示信息。具体的大家，可以观看 httprunner 官方文档。

---

## 运行官方 demo

执行如下命令:

```
docker run -it --rm -v "$PWD":/usr/src/myapp httprunner ./testcases/demo.json
```

这里可以看到，我们的官方 demo 成功运行了，并且生成的测试报告就在`reports`目录中。

可以看到，demo 中，运行了 2 个用例。

- `/user - use jsonschema` （该用例运用了 jsonschema 来校验具体数据是否正常）

- `/favicon.ico - not use jsonschema` （该用例没有用 jsonschema 来校验具体数据，仅仅用了 httprunner 提供的校验）

并且我们可以看到，用到 `json-schema` 来作为校验的时候，我们的 `Validators` 中 `jsonschema_error`为空的时候，就是代表数据信息通过了`json-schema`的校验。

#### 尝试一下不通过 json-schema 的结果

```
    "message": {
      "$id": "#/properties/message",
      "type": "string",                          ## 把这里改成"object"
      "title": "The Message Schema",
      "default": "",
      "examples": [
        "Requires authentication"
      ],
      "pattern": "^(.*)$"
    },
```

终端：

这里可以我们可以看到终端会抛出一丢`红色的错误信息`。

我们提取一段关键信息

```
ERROR    validate: jsonschema_error equals (str)	==> fail
Traceback (most recent call last):
jsonschema.exceptions.ValidationError: 'Requires authentication' is not of type 'object'

Failed validating 'type' in schema['properties']['message']:
    {'$id': '#/properties/message',
     'default': '',
     'examples': ['Requires authentication'],
     'pattern': '^(.*)$',
     'title': 'The Message Schema',
     'type': 'object'}
```

这段信息告诉我们，message 不是 object 类型，所以报错了。

测试报告的结果：

这里我们看到这个测试报告，变成了我们所期待的错误的样子，并且也可以具体的信息。

---

## 总结

## start

```
docker build -t httprunner .
```

##### 运行单独测试用例：

```
docker run -it --rm -v "$PWD":/usr/src/myapp httprunner testcases/you-json-file.json

docker run -it --rm -v "$PWD":/usr/src/myapp httprunner ./testcases/you-json-file.json

docker run -it --rm -v "$PWD":/usr/src/myapp httprunner hrun testcases/you-json-file.json
```

##### 批量运行：

```
docker run -it --rm -v "$PWD":/usr/src/myapp httprunner run-all.sh
```

##### 进入容器内部操作：

```
docker run -it --rm -v "$PWD":/usr/src/myapp httprunner /bin/sh
```

本项目的命令都做了兼容处理，避免了一些命令错误，请大家放心使用，作为一名开发人员，希望本文章对大家的测试有所帮助。如果使用过程中遇到问题，环境在本 github 项目中提 issue。

我也相当于是个测试新手，大家觉得文章好的话，记得在 github 给项目 Star 一个哦。

后续，我会针对 httprunner 开发者模式，进行研究，看看 httprunner 还可以怎么优化。接下来大家一起期待吧～
