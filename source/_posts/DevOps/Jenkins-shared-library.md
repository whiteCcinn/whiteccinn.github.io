---
title: 【DevOps】Jenkins-shared-library 实战
date: 2020-07-10 17:35:30
categories: [DevOps]
tags: [DevOps]
---

## 前言

最近公司用了 `jenkins` 做为 `CI/CD` 的工具，`jenkins`是什么，我就不和大家详细说明了。

今天主要讲的是 `jenkins` 的 `pipeline`，旧版的 jenkins 我不太了解，但是听说这个 pipeline 是新出的。

今天要讲的也不单单是`pipeline`，更是有强力干货`share-library`相关的内容。

<!-- more -->

## Jenkinsfile

目前我们的 jenkins 服务用过`普通的pipeline`和 `多分支的pipeline`，其主要区别就是`多分支pipeline`更加灵活一些，能够让我们少做一些逻辑处理。
但是这引入了一个问题，那就是我们的`jenkins`，必须存在与对应的分支中，也因此，pipeline 的流程变成了代码管理，并且由于我们存在多个项目，那么将会有`项目数 * 2(master/pre-develop)` 那么多的 jenkins 需要管理，于是就导致了我们有很多这种冗余的写法，这还不是最糟糕的，最糟糕的是如果我们需要修改一些通用的内容的时候，就需要一个个去修改，这绝对是灾难级别的需求。

## Shared-library

幸好，或许 jenkins 已经考虑到了这种情况的出现，给我们提供了`shared-library`，在共享库的存在下，我们可以写一些自定义的定制功能。但是这不是没有代价的，代价就是你需要了解`groovy`这门语言，这是`java`的派生语言，提供了弱类型的语法，让写 groovy 脚本的变得更加轻松简单，但是也因此，groovy 和 java 的语法常常可以混在一起写，显得有点杂乱。

但是有总比没有好，我们把共享库分成了 2 个库，分别是`resource-libraries`，`jenkins-shard-library`。

- `resource-libraries`
  - 这个资源共享库定义了我们需要部署不同的配置资源信息，主要是对应`libraryResource`这个 api 来加载资源
- `jenkins-shard-library`
  - 这个共享库定义了我们需要的通用方法，例如部署流程已经需要统一对外的 api

### resource-libraries

目前，我们的资源库目录结构如下，基本不存在 src 目录，这也意味者这个库不存在独特的`类`代码，只有统一对外开放的`vars`，整个库对外开放的 api 只有一个`mresource_load`方法，核心作用就是加载`resources`目录中的个项目的配置。由于可能会存在不同组之间的相同项目名，所以我们以`组/项目`为目录切分资源配置文件，文件以`yaml`格式为统一标准。

```
➜  resource-libraries git:(master) tree
.
├── README.MD
├── resources
│   ├── GamePlatform
│   │   └── mcfx-admin.yaml
│   ├── mc-game-admin
│   │   └── om.yaml
│   └── mc-webapp
│       └── testing-tools.yaml
├── tests
│   └── test_mresource_load.groovy
└── vars
    └── mresource_load.groovy
```

基本结构如下：

```
➜  resource-libraries git:(master) cat resources/mc-webapp/testing-tools.yaml
type: 'normal'

git_credentials_id: 'basedev-git-account'

common: &common
  directory: '/data/webapp/testing-tools'
  deploy_ssh_id: 'basedev_tp_normal'

debug:
  address: '192.168.8.29:61618'
  <<: *common
production:
  address: '192.168.8.93:61618'
  <<: *common
```

```
➜  resource-libraries git:(master) cat resources/mc-game-admin/om.yaml
type: job_name

git_credentials_id: 'basedev_24_om'
debug_address: &debug_address '192.168.8.47:61618'
release_address: &release_address '192.168.8.47:61618'
deploy_ssh_id: &deploy_ssh_id 'basedev_tp_normal'

basedev-m24-om:
  debug:
    address: *debug_address
    directory: '/data/m24/web/om_debug'
    deploy_ssh_id: *deploy_ssh_id
  production:
    address: *release_address
    directory: '/data/m24/web/om'
    deploy_ssh_id: *deploy_ssh_id
```

- (\*)type
  - normal 普通模式
  - job_name job_name 模式。对于一个代码仓库，需要分项目部署的我们定义为 job_name 模式，这个的好处就是不同的项目可以以同一份配置文件进行不同的配置管理
- (\*)git_credentials_id
  - 这是 checkout 下来的 git 唯一凭证 id
- common
  - 这个是推荐但是非必须存在的结构，这里存放一些我们在下面定义的一些通用配置来减少冗余
- 支持的环境
  - debug
  - reviews
  - production
- 环境必填的属性如下
  - address (ip+port)
    - 支持 string
    - 支持 list
  - directory 代码部署目录
    - 支持 string
    - 支持 list
  - deploy_ssh_id
    - 部署代码到服务的 ssh 的唯一凭证 id

由以上构成我们的配置文件的格式。

### jenkins-shard-library

这个共享库直接影响到我们的 jenkinsfile 的写法，这是直接作用与 jenkinsfile 的共享库，先来一个目前 jenkinsfile 的写法：

```jenkinsfile
def link = 'https://xxx.com/mc-webapp/testing-tools'

mpipeline{
    repo=link
    script=this
}

import xxx.jenkins.LaravelPipeline
def larvaelPipeline = new LaravelPipeline(this)

node {
    larvaelPipeline.preBuild().build().debug().reviews().production().execute()
}
```

这就是目前的 jenkinsfile 的写法，可以看到这个 jenkinsfile 没有定制的东西，除了一个`link`仓库链接之外，其他都是公用的内容。
接下来说一下`jenkinsfile-dsl`

这个东西也就是我们在 jenkinsfile 中看到的`mpipeline`的结构体，这个是由于我们这个库提供的一个`dsl结构`，并非原始 jenkinsfile 提供的
所有的 jenkinsfile 必须存在这个`dsl`，并且需要写在流程的头部，以确保 jenkinsfile 的初始化对应的事情（checkout+环境变量+关键字加载）

目前，封装了一个基于`laravel`项目的 pipeline 操作类，用这个类来进行流程的统一创建管理。最后我们在 `node`结构中进行流程的 api 调用。

```
➜  jenkins-shard-library git:(master)   tree
.
├── Jenkinsfile.example
├── README.MD
├── jars
│   └── groovy-cps-1.1.jar
├── resources
├── src
│   └── xxx
│       └── xxx
│           └── jenkins
│               ├── Constant.groovy
│               ├── Deploy.groovy
│               ├── Git.groovy
│               ├── LaravelPipeline.groovy
│               ├── MPipeline.groovy
│               ├── MetlNotify.groovy
│               ├── Repo.groovy
│               └── SummaryNotify.groovy
├── tests
│   ├── RepoTest.groovy
│   └── classfiles
│       └── xxx
│           └── xxx
│               └── jenkins
│                   ├── Constant.class
│                   ├── Git.class
│                   ├── MPipeline.class
│                   ├── MetlNotify.class
│                   ├── Repo.class
│                   └── SummaryNotify.class
└── vars
    ├── mpipeline.groovy
    └── notify.groovy
```

详细的就不多做讲解，只说一些重要的，LaravelPipeline 对外提供的 api 有：

- preBuild()
  - 构建前需要做的事情，例如`发送通知任务开始`
- build(isParallel = true)
  - 构建过程，参数`isParallel = true`是否并行构建
- deployment(def sshId = null)
  - 部署 api，主要是把 debug，reviews，production 写在了一起
- customDeploy(def closure = {})
  - 自定义部署流程，参数是一个回调函数，需要参考共享库的写法
- debug(def sshId)
  - 如果是对应的分支，那么将会部署到 debug 环境
- reviews(def sshId)
  - 如果是对应的分支，那么将会部署到 reviews 环境
- production(def sshId)
  - 如果是对应的分支，那么将会部署到 production 环境
- show()
  - 这是一个用于查看构建流程的方法，并不会真正运行各个结构的 stage 里面的内容。但是可以看到节点连线图
- execute(def config = [show: false])
  - 这是一个启动执行的方法，如果传入了参数 show=true，那么该方法等于 show 方法

对于全局关键字的提供有：

- mpipeline
  - 用于初始化整个部署流程，其中包含了 checkout 和环境变量等的初始化
- notify
  - 用于发送通知

最终的效果如下：

![流程节点图](/images/CI-CD/流程节点图.png)
