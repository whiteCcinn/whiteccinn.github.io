---
title: 【DevOps】自定义git凭据存取器
date: 2021-08-02 14:35:30
categories: [DevOps]
tags: [DevOps]
---

## 前言

最近，在处理公司到代码仓库，公司由`gitbucket`迁移到`gitlab`后，业务项目拉取私有`vcs`的代码依赖包的方式发生了改变。

以前可能是一个“权限较大”的用户，拥有多个项目组的访问权限，所以可以访问私有的`vcs`的代码。

但是迁移到gitlab之后，每个group下，owner都可以针对这个group生成对应都`deploy-key`，所以变成了一个group下一个deploy-key。

这就意味着，我们都`go/php/node`项目，在拉取不同项目都依赖包都时候，需要把`git-credential`的账号信息切换。

<!-- more -->

## git-build-in

Git 有一个内部接口,用于存储和检索系统特定助手的证书,以及提示用户输入用户名和密码。`git-credential` 命令向脚本开放了这个接口,脚本可以像 Git 一样检索、存储或提示用户输入凭证。这个可脚本接口的设计与内部的 C API 一样,请参见 `credential.h` 以了解更多的概念背景。

git-credential在命令行上使用“操作”选项（ fill ， approve 或 reject 之一），并在stdin上读取凭据描述（请参阅`INPUT / OUTPUT FORMAT`）。

如果操作为 fill ，则git-credential将尝试通过读取配置文件，联系任何已配置的凭据帮助程序或提示用户来向描述中添加“用户名”和“密码”属性。然后将凭证描述的用户名和密码属性与已经提供的属性一起打印到stdout。

如果操作被 `approve` ，则git-credential会将描述发送给任何已配置的凭据帮助器，该帮助器可以存储该凭据以供以后使用。

如果该操作被 `reject` ，则git-credential会将描述发送给任何已配置的凭据帮助器，这些帮助器可能会删除所有与该描述匹配的存储凭据。

如果操作是 `approve 或 reject` ，则不应发出任何输出。

## Git

我们知道，在`window`和`mac`下，分别对应的多凭据管理器，分别是`git credential for window` 和 `oschinakey`，可以做到精确的记录下我们的所有凭据。但是在linux下就只有
`build-in(内置)`的存取器，分别是 `cache`, `store` 。

经过实现，在`.gitconfig`默认的配置的情况下，每次都会只读取 `.git-credential` 的第一行数据，如果不正确，则触发 git 的 `build-in` 的 `reject` 方法，清理掉这一行的凭据，这使得我们在多凭据下无法正常的工作。我们需要`.git-credentital`能根据`vcs`的地址特点，例如根据`group`来识别凭据。为了实现这一点，我们就需要借助`自定义存取器`。

## 自定义存储器

要实现自定义存储器，就需要知道他是什么东西，和怎么实现。

`自定义存储器`允许你用`任何语言`来编写，你用`c/c++/python/php/java/go/rust/erlang`等等的语言写都是可以的，只需要程序能直接运行，并且符合`输入/输出格式`和在`PATH`的系统环境下能找到的情况下，都是可行的。我记得`git-scm`的例子采用的是ruby的写法，但是由于考虑到`python2`一般是每个系统都自带的，我们也采用了`python2`的写法来实现一个`根据组织来智能区分git账号和密码的自定义存取器`

这里，我们可以记住，把自定义存储器想像成一个`管道(pipe)`的概念，有`输入端`，也有`输出端`，他们都有自己对应的规则（协议/格式）。

### 输入/输出格式

git credential 在其`标准输入/输出`中读取或写入（取决于使用的操作）`凭证信息`。此信息可以对应于 `git credential` 将为其获取登录信息的密钥（例如主机，协议，路径），也可以`对应`于将要获取的实际凭证数据（用户名/密码）。

凭证分为一组命名属性，`每行一个属性`。每个属性均由键值对指定，并以 `= （等号）分隔`，后跟`换行符`。

密钥可以包含除 = ，换行符或NUL之外的任何字节。该值可以包含除换行符或NUL之外的任何字节。

在这两种情况下,所有的字节都按原样处理(即没有引号,也不能传输带有换行或NUL的值)。属性列表以空行或文件末尾结束。

Git了解以下属性。

- protocol 将使用凭证的协议（例如 https ）。

- host 网络凭证的远程主机名,包括指定的端口号(如 "example.com:8088")。如果指定了端口号,则包括端口号(例如 "example.com:8088")。

- path 凭据将使用的路径。例如，对于访问远程https资源库，这将是服务器上资源库的路径。(只有开启了`useHttpPath=true`的情况下，输入格式才会携带这个参数)

- username 凭据的用户名（如果已经有）（例如，来自URL，配置，用户或先前运行的帮助程序）。

- password 凭据的密码（如果我们要求将其存储）。

- url 当 git credential 读取此特殊属性时，该值将解析为URL，并被视为已读取其组成部分（例如， url=https://example.com 的行为就好像 protocol=https 和 host=example.com 已提供）。这可以帮助呼叫者避免自己解析URL。

> 请注意，指定协议是强制性的，并且如果URL未指定主机名（例如，“ cert：/// path / to / file”），则凭证将包含其主机名属性，其值为空字符串。

### 实战

了解了`输入/输出格式`后。我们通过实战例子来说明。

```shell
# git-credential.example
https://caiwenhui:testpass@gitlab.mingchao.com/group1
https://caiwenhui:testpass2@gitlab.mingchao.com/group2
https://caiwenhui:testpass3@gitlab.mingchao.com/group3
```

以下文件，命名为 `git-credential-mc`

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Date    : 2021-07-30 10:58:53
# @Author  : caiwenhui
# @Version : 1.0
import os
import re
import sys

import argparse

parser = argparse.ArgumentParser(description="get credentials by https://gitlab.mimgchao.com/{group}",
                                 prog='git-credential-mc',
                                 usage='%(prog)s [options] <action>')
parser.add_argument('-f', '--file', help='Specify path for backing store', required=True, default="~/.git-credentials",
                    type=str)
parser.add_argument('action', metavar="action", help='just support <get>')


class CredentialsHelper:

    def __init__(self, credential_file=''):
        self.inputs = dict()
        self.file = credential_file

    def _input(self):
        while True:
            line = sys.stdin.readline()
            if line.strip() == '':
                break
            k, v = line.strip().split('=', 2)
            self.inputs[k] = v

        # 需要开启useHttpPath = true
        if self.inputs['path'] is None:
            sys.exit(1)

        # 解析path参数
        self.inputs['group'] = self.inputs['path'].split('/')[0]

    def _output(self):
        with open(self.file, 'r') as f:
            lines = f.readlines()
            for line in lines:
                m = re.match(r'^(?P<protocol>.*?)://(?P<username>.*?):(?P<password>.*?)@(?P<host>.*)/(?P<group>.*)$',
                             line)
                gd = m.groupdict()
                if self.inputs['protocol'] == gd['protocol'] and self.inputs['host'] == gd['host'] and self.inputs[
                    'group'] == gd['group']:
                    sys.stdout.write('protocol={protocol}\n'.format(protocol=gd['protocol']))
                    sys.stdout.write('host={host}\n'.format(host=gd['host']))
                    sys.stdout.write('username={username}\n'.format(username=gd['username']))
                    sys.stdout.write('password={password}\n'.format(password=gd['password']))
                    break
            sys.stdout.flush()

    def execute(self):
        self._input()
        self._output()


if __name__ == '__main__':
    if len(sys.argv) <= 1:
        parser.print_help()
        sys.exit(0)
    args = parser.parse_args()
    if args.action != "get":
        sys.exit(0)
    if not os.path.exists(args.file):
        sys.exit(0)
    credentialsHelper = CredentialsHelper(credential_file=args.file)
    credentialsHelper.execute()
```

直接运行下，脚本输出如下：

```shell
➜  python git:(master) ./git-credential-mc
usage: git-credential-mc [options] <action>

get credentials by https://gitlab.mimgchao.com/{group}

positional arguments:
  action                just support <get>

optional arguments:
  -h, --help            show this help message and exit
  -f FILE, --file FILE  Specify path for backing store
```

我们来模拟git的一个输入过程，然后让自定义存储器输出正确的输出格式告诉git凭据要用的账号密码：

```shell
➜  python git-credential-mc -f git-credential.example  get
protocol=https
host=gitlab.mingchao.com
path=group1/repo1.git

protocol=https
host=gitlab.mingchao.com
username=caiwenhui
password=testpass

➜  python git-credential-mc -f git-credential.example  get
protocol=https
host=gitlab.mingchao.com
path=group2/repo1.git

protocol=https
host=gitlab.mingchao.com
username=caiwenhui
password=testpass2
```

这里，我们看到，我们根据不同的`group`，已经返回了不同的账号密码了。达到这个效果，我们的自定义读取器就算是完成了。但是系统化的整理起来，还需要把这个脚本，放在`PATH`路径下，并且，并且记得必须以`git-credential-*`来命令程序的文件名。因为git源码的credential模块中的源码读取自定义规则存储器就是这样子调用外部程序的。

### 配置git

```
git config --global credential.https://gitlab.mingchao.com.useHttpPath true
git config --global credential.https://gitlab.mingchao.com.helper "mc --file ~/.git-credential.example"
```

这样子，git就可以针对`https://gitlab.mingchao.com`的时候，采用`git-credential-mc`的程序来读取凭据。达到我们的`多组/多凭据`的情况下`正确`的`读取账号和密码`。

这里只是一个简单的用法，后续如果有复杂的用法，都可以扩展这个自定义存取器，十分的灵活。

## 参考资料：

- https://github.com/git/git
- https://git-scm.com/book/zh/v2/Git-%E5%B7%A5%E5%85%B7-%E5%87%AD%E8%AF%81%E5%AD%98%E5%82%A8
- https://revs.runtime-revolution.com/extending-git-with-ruby-874fddffd069