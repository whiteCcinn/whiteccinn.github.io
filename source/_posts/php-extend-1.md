---
title: PHP7扩展开发のHello Wold
date: 2017-02-10 11:47:00
categories: PHP
tags: [PHP, PHP扩展]
---

## 简介

想要突破自我，必须深入了解 PHP，今天我们讲讲 PHP 扩展的开发，此路长长，需要多多积累 C 语言的知识，废话不多说，直入主题。

## 资源

先去 github 上下载 PHP 的源码，搜索 php-src

https://github.com/php/php-src

<!-- more -->

## 开始

1.在 PHP 源码包里面，里面有一个 ext，和 Zend 目录，Zend 目录就是我们的 PHP 源码的所有头文件和执行文件，ext 则是我们存放扩展的目录。日后必读 Zend。目前只需要关注 ext。

```sh
cd ext
```

在 `ext` 目录下可以看到很多 PHP 源码帮我们扩展好的一些扩展，例如 `curl`,`xml`,`pdo` 等等。我们现在要关注的是 `ext-skel` 工具。它可以帮我们生成扩展的标准目录格式。

```sh
./ext-skel --help
```

1.`extname` 参数为我们需要自定义的扩展名称

```sh
./ext-skel --extname=hello_world
```

以上代码会自动为你创建扩展名字叫`hello_world`的标准目录。

创建完毕之后

```sh
cd hello_world
```

目前，我们需要关注的文件只有两个，分别是`config.m4`,`hello_world.c`

这个`config.m4`目录是我们生成编译文件的配置文件。

```sh
vim config.m4
```

修改完毕之后，保存退出。

接下来就是我们的重点文件了，`hello_world.c`

```sh
vim hello_world.c

#以下是vim搜索命令zend_module_entry
/zend_module_entry
```

查看到如下部分：

这个函数就是我们扩展的入口文件。现在我们暂时用不上。

我们需要关心的 `zend_function_entry` 这个函数会初始化我们的自定义函数，也就是我们接下来的`Hello_World()`。

我们在`zend_function_entry` 里面写入一行代码:

```PHP
PHP_FE(Hello_World,NULL)
```

第一个参数为函数的名称，第二参数为传入函数的参数。

好了，定义完要初始化的函数之后，我们就要去写函数了。

找个空白的地方插入以下代码

```PHP
PHP_FUNCTION(Hello_World)
{
  php_printf("I'm PHP's ext function Hello_World"); /* this function php_printf Zend Engine defined*/

  RETURN_TRUE;                                      /* this const var also with top*/
}
```

保存退出

```sh
phpize
./configure
make && make install
```

```
ll modules/
```

ok，完成了 90%了。

剩下的就是把这个 so 文件，添加到`php.ini`里面吧。

`Good Luck!`
