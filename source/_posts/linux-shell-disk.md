---
title: 【Linux命令】- 磁盘管理
date: 2018-02-28 14:15:00
categories: [Linux]
tags: [Linux, Shell]
---

## df 查看磁盘空间

- -h 友好的方式显示（默认是 bytes）

```shell
df -h
```

## du 查看目录所占空间大小

- -s 递归目录总和
- -h 友好的方式显示（默认是 bytes）

```shell
du -sh
```

<!-- more -->

查看当前目录所有“文件（包含目录）”的大小，并且按照大到小排序，显示前 3 个

```shell
du -s * | sort -nr | head -3

or

du -s * | sort -n | tail -3
```

## 打包/压缩

打包是将多个文件归并到一个文件::

```shell
tar -cvf etc.tar /etc <==仅打包，不压缩!
```

- -c :打包选项
- -v :显示打包进度
- -f :使用档案文件
  注：有的系统中指定参数时不需要在前面加上-，直接使用 tar xvf

## 压缩

```shell
gzip demo.txt
```

## 解包

- -z 解压 gz 文件
- -j 解压 bz2 文件
- -J 解压 xz 文件

```shell
tar -xvf  demo.tar
```

```
常用：
tar -zxvf demo.tar
```

## 总结

查看磁盘空间 df -h

查看目录大小 du -sh

打包 tar -cvf

解包 tar -xvf(z/j/J)

压缩 gzip

解压缩 gunzip bzip
