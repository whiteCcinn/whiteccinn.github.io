---
title: 【DevOps】Jenkins的share-libraries明朝的运用
date: 2020-11-10 16:44:30
categories: [DevOps]
tags: [DevOps, Jenkins]
---

## 前言

本次我们不从Jenkins的部署架构和具体配置说明，我们主要围绕 `jenkinsfile` 的内部来讲解。

<!-- more -->

## Jenkinsfile

目前我们的 jenkins 服务用过`普通的pipeline`和 `多分支的pipeline`，其主要区别就是`多分支pipeline`更加灵活一些，能够让我们少做一些逻辑处理。
但是这引入了一个问题，那就是我们的`jenkins`，必须存在与对应的分支中，也因此，pipeline 的流程变成了代码管理，并且由于我们存在多个项目，那么将会有`项目数 * 2(master/pre-develop)` 那么多的 jenkins 需要管理，于是就导致了我们有很多这种冗余的写法，这还不是最糟糕的，最糟糕的是如果我们需要修改一些通用的内容的时候，就需要一个个去修改，这绝对是灾难级别的需求。

Jenkinsfile的实现分为`2`种，分别是`声明式pipeline`和`脚本式pipeline`，这2种各有优缺点

jenkins需要做的事情，可以概括为如下几种：

1. 拉取代码
2. 版本管理
3. 单元测试
4. 构建部署
5. 通知结果

### 声明式pipeline

可以为我们提供`关键字` 和 `顺序结构`来辅助我们完成如上的5个阶段。

但是他的缺点也是明显的，就是`不能很灵活`根据自己的想法去做处理逻辑。

还有一种情况是比较蛋疼的，例如项目A和项目B，独立维护一个jenkinsfile，但是其实项目A和项目B的jenkinsfile其实是一致的，如果某一条要优化这个jenkinsfile的部署逻辑了。那么项目B和项目A都需要一起处理，无法实现`复用`的概念，并没有提供`抽象`的概念，不利于维护。

对于一些`相对简单，没有太复杂流程`的构建过程来说，声明式一定是大家的首要选择。

### 脚本式pipeline

可以给我们提供类似于写代码脚本的方式来组织部署逻辑，我把`脚本式pipeline`定义为`升级版的声明式pipeline`。

虽然脚本式的pipeline可以给我们提供灵活的部署逻辑，但是依旧无法解决我们的`复用`的问题。

我们需要把这种能`复用`的东西放在同一个地方进行统一管理，类似于`依赖库`的概念，独立与jenkinsfile之外的一种存在。于是乎，这便有了`jenkins-shard-libaray`。

## Jenkins-shard-libaray

这是一个jenkins中的共享类库，只需要在jenkinsfile中对其引入，就可以引用共享库的代码，从而实现我们的`复用`。

但是有一点是这个共享库，需要我们储备点`groovy`语言的知识，因为他是用groovy作为"外挂"的方式加载运行的。

我们在写共享库的时候，`必须` 依照要有2个基本目录，否则jenkins无法类库。

- src (必要，核心代码)
- vars (非必要，声明自己的语法)
- resources (非必要，配置存放的目录)

```shell
./
├── Jenkinsfile.example                                   jenkinsfile的DEMO样式
├── README.MD
├── jars
│   ├── groovy-cps-1.1.jar
│   └── pipeline-model-definition-1.7.1.jar
├── resources                                              配置文件和基础库分开管理了，所以这里不会存在静态资源文件
├── src
│   └── com
│       └── company
│           └── jenkins
│               ├── BasePipeline.groovy                    基础管道
│               ├── CommonPipeline.groovy                  公共管道
│               ├── Constant.groovy                        常量类
│               ├── Deploy.groovy                          部署基类
│               ├── Git.groovy                             git相关的操作类
│               ├── GolangPipeline.groovy                  golang项目管道
│               ├── LaravelPipeline.groovy                 laravel项目管道
│               ├── MPipeline.groovy                       初始化类
│               ├── MetlNotify.groovy                      用于发送通知的类
│               ├── Repo.groovy                            用于实例化代码仓库信息
│               ├── SummaryNotify.groovy                   用于结构化通知内容的类
│               └── deployments                            具体的部署类
│                   ├── AbstractDeployment.groovy          抽象部署类
│                   ├── BaseDeployment.groovy              基础部署类
│                   ├── DefaultDeployment.groovy           默认部署类
│                   └── GolangDeployment.groovy            Go部署类
├── tests                                                  单元测试目录
│   ├── RepoTest.groovy
│   └── classfiles
│       └── com
│           └── company
│               └── jenkins
│                   ├── Constant.class
│                   ├── Git.class
│                   ├── MPipeline.class
│                   ├── MetlNotify.class
│                   ├── Repo.class
│                   └── SummaryNotify.class
└── vars                                                   全局函数定义目录
    ├── mpipeline.groovy                                   自定义入口语法糖
    └── notify.groovy                                      定义通知全局调用函数
```

### Jenkinsfile

```Jenkinsfile
mpipeline{
    script=this
}

import com.company.jenkins.LaravelPipeline
def laravelPipeline = new LaravelPipeline(this)

node {
    laravelPipeline.preBuild().build().debug().reviews().production().execute()
}
```

这是一个最基本的jenkinsfile的demo。我们把他分为2个部分。

```
# 第一部分
mpipeline{
    script=this
}
```

```
# 第二部分
import com.company.jenkins.LaravelPipeline
def laravelPipeline = new LaravelPipeline(this)

node {
    laravelPipeline.preBuild().build().debug().reviews().production().execute()
}
```

这2个部分各司其职。

第一部分 `mpipeline` 的语法糖，来自于我们`vars/mpipeline.groovy`文件，这是我们自定义的语法糖。

```
import com.company.jenkins.*

/**
 *
 * @param body
 *      repo 代码仓库地址 default: null
 *      autoCheckout 是否需要自动checkout代码，default: true
 * @return
 */
def call(body) {
    def config = [:]
    body.resolveStrategy = Closure.DELEGATE_FIRST
    body.delegate = config
    body()

    config.repo = config.repo ?: null
    config.script = config.script ?: null
    config.autoCheckout = config.autoCheckout ?: true

    if (config.script == null) {
        throw new Exception("<script=this>是必填参数")
    }

    if (config.repo == null) {
        config.repo =  config.script.scm.getUserRemoteConfigs()[0].getUrl()
    }

    node {
        def mpipe = new MPipeline(config.script, config.repo)
        mpipe.initializeResources()
        def credentialsId = config.credentialsId ?: config.script.gitCredentialsId

        if (config.autoCheckout) {
            stage("Checkout") {
                // git clone repo
                git credentialsId: credentialsId, url: mpipe.repo.getGitLink(), branch: env.BRANCH_NAME
            }
        }

        mpipe.initializeEnvironment()
    }

    return this
}
```

这个语法糖做的内容定义了 `mpipeline` 做的内容，其中有三个有效参数 `repo`, `script`, `autoCheckout`，分别的意思是代表`该任务下的操作仓库地址`，`当前任务上下文`, `是否自动拉取代码`。其中 `script`参数为必填参数，其他2个都是选填参数，其都存在默认值。这个`script`必填的原因是因为一定要从jenkinsfile把对象传递进来，否则作用域有所不同。因为我们在第二部分要把这个对象继续传递下去，因为他携带了贯穿整个任务的上下文。

我们这里看到了 `node` 结构块，这是因为在`脚本式pipeline`中，他其实也是jenkins内置的一个自定义语法糖，所以他可以直接被嵌入在我们的代码中。因为我们这里实例化了共享库中的`Mpipeline类`，所以需要在 `node` 结构块中编写代码。

在这一块，我们可以看到，我们做了3件事


```
+--------------------------------------+                +--------------------------------+              +----------------------------------------------------+
|                                      |                |                                |              |                                                    |
|  1. Initialize the custom resource   +--------------->+   2. Pull the warehouse code   +------------->+   3. Initialize the custom environment variable    |
|                                      |                |                                |              |                                                    |
+--------------------------------------+                +--------------------------------+              +----------------------------------------------------+
```

- 初始化自定义资源（接下来要说的resource-libaray共享库）

- 拉取仓库代码（这是jenkins自带的一个git插件，调用git函数，加上一些参数，就会拉取代码到一个目录，如果目录不存在，则会创建）

- 初始化自定义环境变量

初始化自定义资源的代码如下：

```
/**
 * 初始化资源库
 */
def initializeResources() {
    this.script.mresource_load([
            script: this.script,
            groupRepo: this.getRepoGroupRepo(),
            shortJobName: this.getShortName(),
            host: this.getHost()
    ])

    return this
}
```

这里，我们可以看到我们通过上下文变量，调用了 `mresource_load` 函数，这个是我们在 `resource-libaray共享库` 定义的函数，用于加载对应仓库的具体资源配置用，相关参数依旧会加载到上下文之中。

自定义环境变量部分代码如下：

```
/**
 * 初始化环境变量
 */
def initializeEnvironment() {
    this.initBaseEnv().initEnvDependGit().initEnvDependRepo()

    return this
}

def initBaseEnv() {
    // SHORT_JOB_NAME
    this.script.env.SHORT_JOB_NAME = this.getShortName()

    // 是否仅仅显示stage节点而不执行内容
    this.script.mStageShow = false

    return this
}

def initEnvDependGit() {
    // COMMIT_ID
    this.script.env.COMMIT_ID = this.git.commitId()
    // COMMIT_AUTHOR
    this.script.env.COMMIT_AUTHOR = this.git.commitAuthor()
    // COMMIT_TIME
    this.script.env.COMMIT_TIME = this.git.commitTime()
    // COMMIT_COMMENT
    this.script.env.COMMIT_COMMENT = this.git.commitMessage()

    return this
}

def initEnvDependRepo() {
    // REPO
    this.script.env.REPO = this.repo.getRepo()
    // REPOSITORY
    this.script.env.REPOSITORY = this.repo.getFullRepoString()
    // Notify
    this.script.env.COMMIT_ID_PATH = this.repo.getCommitIdHostPath()
    // REPOSITORY_LINK
    this.script.env.REPOSITORY_LINK = this.repo.getGitLink()
    // REPOSITORY_GROUP
    this.script.env.REPOSITORY_GROUP = this.repo.getGroup()
    // REPOSITORY_GROUP_REPO
    this.script.env.REPOSITORY_GROUP_REPO = this.getRepoGroupRepo()

    return this
}
```

这个，我们把环境变量也拆分封装到对应的方法了，分别是git相关的环境变量和仓库信息的环境变量等等。

接下来，我们看下 `第二部分` 的代码。

```
# 第二部分
import com.company.jenkins.LaravelPipeline
def laravelPipeline = new LaravelPipeline(this)

node {
    laravelPipeline.preBuild().build().testing().debug().reviews().production().execute()
}
```

这里，我们import进来了Laravel的具体实现管道，并且实例化这个对象，传入了当前上下文对象。

并且在下面的node结构中，调用laravelpipeline对象的相关封装方法。

经过我们对部署流程的抽象和统一，我们的部署流程大致分为 `5个阶段`。分别如下：


```
+-----------------------------+
|  1. Pre-construction phase  |
+------------+----------------+
             |
             |             +-----------------------+
             +------------>+2. Construction phase  +------------------+
                           +-----------------------+                  |
                                                                      |
                                                                      |
                                                +---------------------v-----------------------------+
                                        +-------+3. Deployment development environment phase (Debug)|
                                        |       +---------------------------------------------------+
                                        |
                                        v
                           +------------+---------------------------------------+
             +-------------+4. Grayscale Environment Deployment Stage（ reviews） |
             |             +----------------------------------------------------+
             |
+------------v----------------------------------------------+
| 5. Deployment of production environment phase（ prodution） |
+-----------------------------------------------------------+

```

- 预构建阶段
- 构建阶段
- 部署开发环境阶段（debug）
- 部署灰度环境阶段（reviews）
- 部署生产环境阶段（production）


因此，我们把所有的仓库jenkinsfile都按照这样子的不是来写，这样子就可以做到，当我们需要修改部署的内容的时候，代码仓库的jenkinsfile不需要做任务变动，只需要修改我们的共享库即可。

部分代码如下：

```
def preBuild() {
    def callback = {
        this.startNotify()
    }

    def apiName = 'preBuild'
    this.addCallback(apiName, callback)

    return this
}

def build(isParallel = true) {
    def callback = {
        this.script.stage('Build') {
            if (isParallel) {
                def stages = [failFast: true]

                stages["Composer Install"] = this.composerInstall()
                stages["Client Build"] = this.clientBuild()
                this.script.parallel stages
            } else {
                this.composerInstall()()
                this.clientBuild()()
            }
        }
    }

    def apiName = 'build'
    this.addCallback(apiName, callback)

    return this
}
```

这里看到，我们几乎所有的代码都会通过回调函数来编写的，所以，我们在实际调用的时候，必须加上 `execute()` 方法来实际触发链式过程。

因为在我们这个例子中，laravel是php的项目，默认情况下，我们是有前端和后端的代码。分别是`composer依赖`，`npm依赖`。

由于这2个部分的依赖，他们是没有相关性的，所以，我们在设计上，默认是支持 `并发` 执行的，所以我们这里调用了jenkins的一个内置函数 `parallel`来实现并发。实际效果如下展示：

```
                          +-----------------------+
                          | +------------------+  |
                          | | Composer Install |  |
                          | +------------------+  |
                          |                       |
                          |                       |
+----------------+        |                       |
|   pre-build    +------->+        build          |
+----------------+        |                       |
                          |                       |
                          |                       |
                          | +------------------+  |
                          | | Client Build     |  |
                          | +------------------+  |
                          |                       |
                          +-----------------------+

```

以npm依赖安装为例子：

```
public npmInstall(def packageFile = 'client/package.json', def clientDir = 'client', def version = 'latest') {
    def md5File = "${packageFile}.md5"
    def callback = { isChange ->
        this.script.echo "package.json是否有变化:${isChange}"
        this.script.echo "是否强制编译前端资源:${this.script.params.isBuild}"
        if (isChange || this.script.params.isBuild) {
            this.script.docker.image("jenkins_docker_node:${version}").inside('--dns-opt=ndots:5 -v $HOME/.npm:/root/.npm') {
                ...
            }
        }
    }

    this.checkChangeFile(packageFile, md5File, callback)
}
```

另外在composer和npm依赖安装的过程中，我们做了一些细节上的优化，例如，我们会检测`package.json`以及`composer.json`，如果这2个文件没有变化的话，则不会更新依赖。避免了每次构建都需要去检查更新依赖包。
另外由于我们的jenkisn环境本身也是一个jenkins的docker容器，所以我们的jenkins环境下是不会存在`php`以及`node`的环境，所以我们这个时候，在安装依赖的时候，借助了上下文中的 `docker.image` 关键字来构建一个容器来触发我们的依赖安装。

接下来就是部署相关的内容了，我们以部署 `production` 环境来举例子

```
def production(def map = [
        sshId      : null,
        deployClass: null
]) {
    def callback = {
        if (map['sshId'] == null) {
            map['sshId'] = this.getValue('deploySshId')
        }
        if (map['deployClass'] == null) {
            map['deployClass'] = this.getDeployClass()
        }

        map['pipeline'] = this

        this.deploy.production(map)
    }

    def apiName = 'production'
    this.addCallback(apiName, callback)

    return this
}
```

如果不指定 `sshId` 和 `deployClass` 的话，都会存在默认值。由于我们整个过程都是通过回调的方式调用的（其实类似于中间件），所以我们这里的多了一个 `map[pipeline] = this` 的代码，意义在于把当前上下文传递进具体的部署类。


```
def production(def map = [
        sshId      : null,
        deployClass: null,
        pipeline   : null
]) {

    def keyword = 'production'
    this.script.stage('Production Deploy') {
        if (this.git.isMasterBranch() && this.script.currentResources[keyword].enabled != false) {

            // 注入参数
            def tags = this.git.tagsList()

            def buildParameters = [
                    [
                            '$class'    : 'ChoiceParameter',
                            choiceType  : 'PT_SINGLE_SELECT',
                            description : '''
选择构建类型：
auto_deploy - 自动发布（直接发布最新代码）        
deploy - 指定版本发布
rollback - 版本回滚发布
''',
                            filterLength: 1,
                            filterable  : false,
                            name        : 'buildType',
                            randomName  : 'choice-parameter-69483043309720',
                            script      : [
                                    '$class'      : 'GroovyScript',
                                    fallbackScript: [
                                            classpath: [],
                                            sandbox  : true,
                                            script   : 'return["unknow"]'
                                    ],
                                    script        : [
                                            classpath: [],
                                            sandbox  : true,
                                            script   : 'return["auto_deploy", "deploy", "rollback"]',
                                    ]
                            ]
                    ],
                    [
                            '$class'    : 'ChoiceParameter',
                            choiceType  : 'PT_SINGLE_SELECT',
                            description : '''
选择Tag标签：
auto_deploy时该参数无效
''',
                            filterLength: 20,
                            filterable  : true,
                            name        : 'buildTag',
                            randomName  : 'choice-parameter-69483043309721',
                            script      : [
                                    '$class'      : 'GroovyScript',
                                    fallbackScript: [
                                            classpath: [],
                                            sandbox  : true,
                                            script   : 'return["unknow"]'
                                    ],
                                    script        : [
                                            classpath: [],
                                            sandbox  : true,
                                            script   : "return [${tags}]",
                                    ]
                            ]
                    ]
            ]

            if (!this.script.mStageShow) {
                this.script.notify '请确认是否发布到生产环境？'

                this.script.timeout(time: 10, unit: 'MINUTES') {
                    try {
                        this.script.input '请确认是否要发布到生产环境？'
                    } catch (e) {
                        map['pipeline'].parameters += buildParameters
                        throw e
                    }

                    def updateHistoryFile = 'UPDATE_HISTORY'
                    def currentTag

                    if (this.script.params.buildType == 'deploy' || this.script.params.buildType == 'rollback') {
                        // 发布指定tag
                        this.script.sh "git checkout ${this.script.params.buildTag}"
                        this.script.currentBuild.description = "【指定发布】Tag: ${this.script.params.buildTag}"
                        if (this.script.params.buildType == 'rollback') {
                            this.script.currentBuild.description = "【回滚】Tag: ${this.script.params.buildTag}"
                        }
                        currentTag = this.script.params.buildTag
                    } else {
                        // 开始打tag
                        ...
                            try {
                                def tagRes
                                if (link.startsWith("http")) {
                                    // gitbucket
                                    ...
                                    }
                                } else {
                                    // gitlab
                                    ...
                                }
                                if (tagRes['exitCode'] > 0 && !tagRes['stdout'].contains('already exists')) {
                                    throw new Exception(tagRes['stdout'])
                                }
                            } catch (e) {
                                throw e
                            }
                            this.script.sh "tee ${preCommitIdFile} <<< ${this.git.commitId()}"

                            currentTag = nextTag

                            // 最新tag加入下拉框
                            buildParameters[1]['script']['script']['script'] = "return [\"${currentTag}\",${tags}]"
                        }
                    }
                    ...
                    this.script.currentBuild.description = "【自动发布】Tag: ${currentTag}"
                    this.publishDeployment(keyword)(map['sshId'], map['deployClass'])
                    ...
                }
            } else {
                this.script.echo 'Production Deploy Show'
            }

            map['pipeline'].parameters += buildParameters
        } else {
            Utils.markStageSkippedForConditional(this.script.env.STAGE_NAME)
        }
    }

    return this
}
```

这里，我们再说明一下我们的自动化流程。

- 1. 提交feature代码

- 2. 合并到pre-develop分支，触发jenkins任务构建更新debug环境代码

- 3. 最终合并到master分支，触发jenkins任务，如果代码有变化则对最新的master代码进行打tag，构建更新production环境代码

基于以上几点，我们就可以很直观的看到部署production类的时候，我们会检测master的代码，如果存在变化则进行打tag。然后再调用具体的部署逻辑。其中 `this.script.currentResources[keyword].enabled` 是来自于我们的 `resource-libaray` 的配置。

```
abstract class AbstractDeployment {

    /**
     * 打包逻辑
     * @return
     */
    abstract def parallelBefore(def packFiles, def packExclude)

    /**
     * 并行逻辑
     * @param ip
     * @param port
     * @param directory
     * @return
     */
    abstract def parallel(def ip, def port, def directory, def backupExclude)
}
```

我们的抽象具体部署类存在2个必须实现的抽象方法，分别是 `parallelBefore`, `parallel`。

- parallelBefore：并发部署前做的事情
- parallel：并发部署到多台目标机器上

## resources-libraries

资源共享库

对外提供一个全局的函数 `mresource_load`，内部提供给上下文关键字拿到当前项目，当前环境的对应的部署内容信息。

```
├── README.MD
├── resources
│   ├── git.xxxx.com
│   │   ├── repo-group1
│   │   │   ├── a.yaml
│   │   │   └── b.yaml
│   │   └── repo-group2
│   │       └── c.yaml
│   └── gitlab.xxx.com
│       ├── repo-group3
│       │   ├── d.yaml
│       │   └── e.yaml
│       └── repo-group4
│           ├── f.yaml
│           └── g.yaml
├── tests
│   └── test_mresource_load.groovy
└── vars
    └── mresource_load.groovy
```

我们看到我们的基本结构和上一个 `jenkins-shard-libraries` 十分的类似，区别在于 `resources-libraries` 不存在 `src` 目录，但是 `resources` 全部都存在资源配置。

资源存放的目录，结构目录规则为 `<FQDN>/<group>/<repo>`，对应git仓库。

资源库采用`yaml`格式。目前支持的key有：

- type(normal|job_name)
    - normal   常规项目，不区分项目
    - job_name 区分项目，一套仓库，多个项目区分部署

- debug 内测环境
    - address   ip:port
    - directory 代码目录路径
    - deploy_ssh_id 部署的凭证
    - execute_user 执行的用户，目前仅仅在GolangPipline有效
    - ssh_username 部署代码的ssh的账号，目前在GolangPipline仅调试用

- reviews 灰度环境
    - enabled:  false  跳过reviews步骤
    - address   ip:port
    - directory 代码目录路径
    - deploy_ssh_id 部署的凭证
    - execute_user 执行的用户，目前仅仅在GolangPipline有效
    - ssh_username 部署代码的ssh的账号，目前在GolangPipline仅调试用【非必填，默认采用deploy_ssh_id的信息】

- production 生产环境
    - address   ip:port
    - directory 代码目录路径
    - deploy_ssh_id 部署的凭证
    - branch    生产环境对应的分支 【非必填】
    - execute_user 执行的用户，目前仅仅在GolangPipline有效【非必填】
    - ssh_username 部署代码的ssh的账号，目前在GolangPipline仅调试用【非必填，默认采用deploy_ssh_id的信息】


附加在上下文的变量：

- script.currentResources
- script.gitCredentialsId
- script.buildCredentialsId

具体的yaml配置格式的demo

```
type: 'normal'

git_credentials_id: 'git_credentials_id'

common: &common
  deploy_ssh_id: 'deploy_ssh_id'

environment:
  debug:
    <<: *common
    address:
      - '2.2.2.2:22'
      - '1.1.1.1:22'
    directory:
      '2.2.2.2:22': '/a'
      '1.1.1.1:22': '/b'

  reviews:
    <<: *common
    address: '3.3.3.3:22'
    directory: '/c'

  production:
    <<: *common
    address: '4.4.4.4:22'
    directory: '/d'
```

这是基本的配置文件，我们借助了yaml的灵活性，配置出尽可能简洁，可复用的项。
我们还有更加灵活的配置和格式，具体参考以下代码：


```
@Grab('org.yaml:snakeyaml:1.26')
import org.yaml.snakeyaml.*

def call(def config = [script: null, groupRepo: null, shortJobName: null, host: null]) {

    def script = config.script
    def groupRepo = config.groupRepo
    def shortJobName = config.shortJobName
    def host = config.host

    if (groupRepo == null) {
        groupRepo = script.env.REPOSITORY_GROUP_REPO
    }
    if (shortJobName == null) {
        shortJobName = script.env.SHORT_JOB_NAME
    }
    if (host == null) {
        host = "git.xxxx.com"
    }

    configFile = host + '/' + groupRepo + '.yaml'
    Yaml yaml = new Yaml()
    String resourceString = libraryResource(configFile)
    Map<String, Object> obj = yaml.load(resourceString)
    obj.type = obj.type ?: null


    def resource = [:]
    def git_credentials_id = ''
    def build_credentials_id = ''

    if (obj.type == 'job_name') {
        String pointJobName = shortJobName
        for (item in obj) {
            if (item.key == pointJobName) {
                def value = item.value
                for (it1 in value) {
                    if (it1.key == 'git_credentials_id') {
                        git_credentials_id = it1.value
                        continue
                    }
                    if (it1.key == 'build_credentials_id') {
                        build_credentials_id = it1.value
                        continue
                    }
                    if (it1.key == 'environment') {
                        // 兼容 address，String && List
                        for (it in it1.value) {
                            for (values in it.value) {
                                if (values instanceof Map.Entry) {
                                    if (values.key == 'address') {
                                        if (values.value instanceof String) {
                                            values.value = [values.value]
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (it1.key == 'environment') {
                        // 兼容 directory
                        for (it in it1.value) {
                            for (values in it.value) {
                                if (values instanceof Map.Entry) {
                                    if (values.key == 'directory') {
                                        if (values.value instanceof String) {
                                            def dir = values.value
                                            values.value = [:]
                                            for (def addr in it.value.address) {
                                                values.value[addr] = dir
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                resource = value

                break
            }
        }
    } else {  // job.type == normal
        resource = obj
        resource.remove('type')

        // 兼容 address，String && List
        for (item in resource.environment) {
            for (values in item.value) {
                if (values instanceof Map.Entry) {
                    if (values.key == 'address') {
                        if (values.value instanceof String) {
                            values.value = [values.value]
                        }
                    }
                }
            }
        }

        // 兼容 directory
        for (item in resource.environment) {
            for (values in item.value) {
                if (values instanceof Map.Entry) {
                    if (values.key == 'directory') {
                        if (values.value instanceof String) {
                            def dir = values.value
                            values.value = [:]
                            for (def addr in item.value.address) {
                                values.value[addr] = dir
                            }
                        }
                    }
                }
            }
        }

        git_credentials_id = resource.git_credentials_id
        build_credentials_id = resource.build_credentials_id
    }

    def environment = resource.environment

    script.currentResources = environment ?: [:]
    script.gitCredentialsId = git_credentials_id ?: null
    script.buildCredentialsId = build_credentials_id ?: null
}
```

以上就是我们的jenkins对共享库应用场景了，后续也会随着服务器对架构而升级优化改变。
