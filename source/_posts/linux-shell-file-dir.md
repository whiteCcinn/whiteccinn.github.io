---
title: 【Linux命令】- 文件及目录管理
date: 2018-02-27 16:04:00
categories: [Linux]
tags: [Linux, Shell]
---

## 创建和删除

- 创建：`mkdir`
- 删除：`rm`
- 删除目录（递归+强制）：`rm -rf dir`
- 删除文件（强制） `rm -f file`
- 删除统一后缀 `rm *log`(等价于：`find ./ -name "*log" -exec rm -f {}`，`find ./ -name "*.log" -exec rm -f {} \;`)(注意，`\;`必须加，否则报错)
- 移动：mv file
- 复制（目录）：cp（-r） file[dir]

查看当前目录下的文件个数

`find ./ | wc -l`

复制目录：

<!-- more -->

`cp -r source_dir dest_dir`

## 目录切换

- 跳转：`cd`
- 切换到上一个工作目录：`cd -`
- 切换到 home 目录：`cd ~`
- 显示当前目录：`pwd`

## 列出目录项

- 现实当前目录下的所有文件：`ls`
- 按时间排序降序，以列表的方式现实目录项：`ls -lrt`（l：列表，t：时间升序，r：排列反序）
- 显示隐藏目录、列表显示方式、分页显示（限制 12 行）：`ls -al | more -12`
- 给每项文件前面增加一个 id 编号：`ls -l | cat -n`

## 查看文件内容

- 查看前面的内容(n 默认 10)：`head [-n] <file>`
- 查看后面的内容(n 默认 10)：`tail [-n] <file>`
- 查看 2 个文件的差别：`diff <file1> <file2>`

## 文件与目录权限修改

- 改变文件的拥有者：`chown`
- 改变文件读、写、执行等属性：`chmod`
- 递归子目录修改：`chown -R tuxapp source/`
- 增加脚本可执行权限： `chmod a+x myscript`

## 给文件增加别名（软链接/硬链接）

```shell
ln cc ccAgain :硬连接；删除一个，将仍能找到；
ln -s cc ccTo :符号链接(软链接)；删除源，另一个无法使用；（后面一个ccTo 为新建的文件）
```

## 重定向

- 重定向标准输出到文件：`cat foo > foo.txt`
- 重定向标准错误到文件：`cat foo 2> foot.txt`
- 重定向标准输出到标准错误：`cat foo 1>&2`
- 重定向标准错误到标准输出：`cat foo 2>&1`
- 重定向标准输出到标准错误到同一个文件：`cat foo 1>&2 foo.txt` 或者(也不能说或者，只是效果一样) `cat foo &> foo.txt`
- 清空文件：`:> foo.php`
- 追加内容到文件：`echo a >> foo.php`
- 覆盖内容到文件：`echo a > foo.php`

## 综合应用

查找 record.log 中包含 AAA，但不包含 BBB 的记录的总数:

```
# record.log
AAABBBCCC
AAACCC
BBBCCC
CCC
AAA
BBB
```

`cat record.log | grep "AAA" | grep -v "BBB" | wc -l`
