---
title: 【Git】- 利用git-hook实现自动化部署
date: 2018-03-12 11:03:37
categories: [Git]
tags: [Git, Linux]
---

## 要求

实现 git push 直接完成代码部署到服务器的目录
实现方式

利用 git 的 hooks 中的`post-receiv`e 来实现代码提交完成之后的动作。将仓库指定一个`--work-tree`然后进行检出操作`checkout --force`
目录结构

我自己的项目结构是这样的，每一个仓库对应一个项目，例如 public/wx 项目对应 repo/wx.git 仓库

```
.
├── public
│   └── wx // 这是我们的web代码部署目录
│       ├── index.php
│       ├── test2.php
│       ├── test3.php
│       └── test.php
└── repo // 这个是我们的仓库目录
    └── wx.git // 这个对应wx项目的仓库
        ├── branches
        ├── config
        ├── description
        ├── HEAD
        ├── hooks // post-receive钩子代码写在这里面
        ├── index
        ├── info
        ├── objects
        └── refs
```

再看下 hooks 文件目录

```
.
├── applypatch-msg.sample
├── commit-msg.sample
├── post-commit.sample
├── post-receive
├── post-receive.sample
├── post-update.sample
├── pre-applypatch.sample
├── pre-commit.sample
├── prepare-commit-msg.sample
├── pre-rebase.sample
└── update.sample
```

我们将 post-receive.sample 复制一份 post-receive，并且编写代码如下

## 指定我的代码检出目录

```shell
DIR=/www/public/wx
git --work-tree=${DIR} clean -fd
# 直接强制检出
git --work-tree=${DIR} checkout --force
```

## 如何生成目录

上面看到的 repo 目录中的 wx.git 实际上是一个裸仓库，我们用下面的命令来生成这样一个仓库。

```
cd /www/repo
git init --bare wx.git
```

对于代码部署目录和仓库我们已经通过 post-receive 进行了关联了，因为我们一旦将代码 push 到仓库，那么会自动检出到 publish/wx 目录下。

## 远程部署

在本地电脑上，我们添加远程仓库

```
git init
git remote add origin root@xxx.xxx.xxx.xxx:/www/repo/wx.git
```

这个时候我们添加了远程仓库，那么我们来测试下 push 操作

```
touch index.php
git add .
git commit -m 'test'
git push
```

可能会提示一个--set-upstream，直接执行下就好了。执行完之后我们登陆服务器，会发现文件已经出现在 public/wx/index.php

## 注意点

- 如果我们没有配置 ssh 免密码登陆的话，我们需要在 push 代码的时候输入密码
- 如果我们添加的远程仓库不是 root@xxx.xxx.xx.xx，例如是 abc@xx.xx.xx.xx，那么我们要确保 abc 用户对 wx.git 目录下的文件有 777 权限。

### 新增仓库

- 需要登陆远程服务器进行初始化 repo_name.git 仓库
- 需要手动创建 public/repo_name 文件夹，并且修改权限为 777
- 需要重新编写 hooks/post-recieve 文件，修改里面的 DIR 路径为 public/repo_name
