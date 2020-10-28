![](http://ow4den6a4.bkt.clouddn.com/docs06.png)

<p align="center">
<img alt="version" src="https://img.shields.io/badge/version-1.0-757575.svg?style=flat-square">
<a href="https://staunchkai.com"><img alt="Author" src="https://img.shields.io/badge/author-StaunchKai-red.svg?style=flat-square"/></a>
<a href="https://hexo.io"><img alt="Hexo" src="https://img.shields.io/badge/hexo-3.0+-0e83cd.svg?style=flat-square"/></a>
<a href="https://nodejs.org/"><img alt="node.js" src="https://img.shields.io/badge/node.js-6.0%2B-43853d.svg?style=flat-square"/></a>
</p>

# hexo-theme-staunch
Staunch is a responsive theme [Hexo](https://hexo.io/), based on Hexo 3.0 + is made, it is my first time to make Hexo theme, is also the first time I make contact, there is insufficient place, please point out, I will correct them

# Contents
- [Demo 演示](#demo)
- [Installation 安装](#installation)
- [Docs 文档](#docs) | [中文文档](http://staunchkai.com/docs.html)
- [License 许可证](#license)

# Demo
- [StaunchKai's Blog](https://staunchkai.com)

# Installation

##Installation Theme
```bash
git clone https://github.com/staunchkai/hexo-theme-staunch.git themes/staunch
```

## Update
``` bash
cd themes/miho
git pull
```

## Dependency installation
**Local Search**
```bash
npm install --save hexo-generator-search
```

Change theme field in Hexo root's `_config.yml` file.
```
search:
  path: search.xml
  field: post
```

# Docs | [中文文档](http://staunchkai.com/docs.html)
Modify settings in `themes/miho/_config.yml`，Please use it as needed.

```
# hexo-theme-staunch
# https://github.com/staunchkai/hexo-theme-staunch

# Primary colour | 主色调
# default: #eb4334 | 默认值
theme_color: ''

# Favicon of your site | 网站icon
favicon: /favicon.ico

# Hero
# avatar | 头像
avatar: /img/avatar.png
# address | 地址
address: YunNan, China
# job | 职业
job: Student

# Menus | 导航栏菜单
menu:
  Home: /
  Archives: /archives/
  # Delete this row if you don't want categories in your header nav bar
  # 如果不想在导航栏显示分类，删除此行
  Categories:

# Social setting, use to display social information | 社交设置，用来展示社交信息
# name:
#   url: //staunchkai.com   Url, absolute or relative path | 链接，绝对或相对路径
#   icon: fab fa-github     Select the content in the class | 填入 class 中的内容
# for more icons, please see https://fontawesome.com/icons?d=gallery&m=free
social:
  github:
    url: //github.com/staunchkai
    icon: fab fa-github
  envelope:
    url: //staunchkai.com
    icon: fas fa-envelope
  qq: 
    url: //staunchkai.com
    icon: fab fa-qq
  twitter:
    url: //twitter.com/staunchkai
    icon: fab fa-twitter

# Notice | 公告
# If not used, don't fill in | 如果不使用，留空即可
# 使用 Html 标签 <li>内容</li> 发布一条公告
# Publish a notice using the Html tag <li> content </li>
notice: 
  <li>Staunch 主题正式发布！主题下载：<a href="https://github.com/staunchkai/hexo-theme-staunch" target="_blank">Staunch 主题</a></li>
  <li>Staunch 正式文档发布，<a href="//staunchkai.com/docs.html">点击查看</a></li>

# Links | 友链
# name:                         Name | 名字
#   url: //staunckai.com        Url, absolute or relative path | 链接，绝对或相对路径
#   avatar: /img/avatar.png     avatar | 头像
links:
  StaunchKai: 
    url: //staunchkai.com
    avatar: /img/avatar.png

# Count | 统计
# busuanzi | 不蒜子
count:
  enable: true # if not used, change this to 'false' | 如果不使用，将此项改为 'false'
  site_pv: true # 总访问量
  site_uv: true # 总访客数
  # Execute before using article statistics 'npm i --save hexo-wordcount'
  # 使用文章统计之前先执行 'npm i --save hexo-wordcount'
  post_sum: true # 文章总数
  word_sum: true # 总字数

# Excerpt length | 摘录长度
excerpt_length: 80

# Reward | 文章赞赏
reward:
  enable: true # if not used, change this to 'false' | 如果不使用，将此项改为 ‘false’
  title: "请我吃包辣条！"
  alipay: # Picture url | 二维码地址
  wxpay:  # Picture url | 二维码地址

# Share | 分享
# Currently only supported "qq, weibo, facebook, twitter, googleplus, telegram"
# 目前仅支持 "qq, weibo, facebook, twitter, googleplus, telegram"
share:
  qq: true
  weibo: true
  facebook: true
  twitter: true
  googleplus: true
  telegram: true

# Comment | 评论
# either-or | 两者只能选择一个

# Valine
# 详情查看 https://valine.js.org/quickstart.html
valine: 
    on: true # if not used, change this to 'false' | 如果不使用，将此项改为 'false'
    appId: #appID
    appKey: #appKey
    notify: true
    verify: false
    placeholder: Please leave your footprints
    avatar: ''
    avatar_cdn: https://gravatar.loli.net/avatar/ # avatar CDN address, default gravatar.loli.net
    pageSize: 10 # comments of one page
    
# Disqus
disqus: false #disqus_shortname
    
# Copyright Information | 版权信息
copyright: Copyright © 2018 StaunchKai. All rights reserved

# google analytics | google 分析
google_analytics:

# 百度分析，输入key值
baidu_analytics:
```

## Social Settings
` icon ` fill in for Fontawesome‘s  class name, such as:
```html
<i class="fab fa-github"></i>
```
```
social:
  github:
    url: //github.com/staunchkai
    icon: fab fa-github
```

## Notice
Each announcement, use `li` label reference, using Html.Such as:
```html
<li>This is the first announcement</li>
<li>This is the second announcement</li>
```

## Count
```
count:
  enable: true
  site_pv: true
  site_uv: true
  post_sum: true
  word_sum: true
```
`enable` as main switch, set to `false` is not enabled.
`site_pv` Total website visits
`site_uv` Total visitors to the site
`post_sum`、`word_sum` The total number of articles and the total number of words respectively，Please install the
```
npm i --save hexo-wordcount
```

## excerpt
Excerpts are in three ways:
- **post.description：** In the article ` Front - matter ` add the description attribute
```md
title: excerpt
description: 'This is the summary shown on the home page'
---
```
- **post.excerpt：** add:
```
<!-- more -->
```
- **excerpt_length：** 
```
# Excerpt length | 摘录长度
excerpt_length: 80
```
> The priority order of the three options is: `post.description` > `post.excerpt` > `excerpt_length`

## Share
Since this is of little use, only a few listed options are currently supported, which can be reduced or not added. Please contact me if you need

```
share:
  qq: true
  weibo: true
  facebook: true
  twitter: true
  googleplus: true
  telegram: true
```

## Comment
Due to Staunch the theme in the early stages, at present only use ` Valine ` and `disqus`, if necessary can contact me, about ` Valine ` more [to see](https://valine.js.org/quickstart.html), please.
```
valine: 
    on: true # if not used, change this to 'false' | 如果不使用，将此项改为 'false'
    appId: #appID
    appKey: #appKey
    notify: true
    verify: false
    placeholder: Please leave your footprints
    avatar: ''
    avatar_cdn: https://gravatar.loli.net/avatar/ # avatar CDN address, default gravatar.loli.net
    pageSize: 10 # comments of one page
    
disqus: false #disqus_shortname
```

## Contents
Need the article ` Front - matter ` add toc attributes
```
title: post
toc: true
---
```

# Writing
## Front-matter
```
---
title:          // article title
urlname:        // article link
date:           // article date
categories:     // article classification
tags:           // article tag
thumbnail:      // article thumbnail
toc: true       // article toc
description:    // article summary
---
```

## [Picture](http://staunchkai.com/docs.html#%E5%9B%BE%E7%89%87)

# License
[![license](https://img.shields.io/github/license/staunchkai/hexo-theme-staunch.svg?style=flat-square)](https://github.com/staunchkai/hexo-theme-staunch/blob/master/LICENSE)
