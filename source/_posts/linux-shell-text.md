---
title: 【Linux命令】- 文本处理
date: 2018-02-27 17:29:00
categories: [Linux]
tags: [Linux, Shell]
---

## find 文件查找

find 默认是会把所有目录和文件都一起输出，除非加了`type -f`，此时就只会输出文件，`type -d`，此时就只会输出目录

查找 txt 和 pdf 文件

```shell
find ./ \( -name "*.php" -o -name "*.p" \)
find ./ \( -name "*.php" -or -name "*.p" \)
// 同时包含命名
find ./ \( -name "*.php" -and -name "*.p" \)
```

正则方式查找.txt 和.pdf

```shell
find ./ -regex ".*\(php\|p\)"
```

- iregex：忽略大小写的正则

否定参数，查找所有非 txt 文件

```shell
find ./ -name "*.txtx"
```

指定搜索深度,打印出当前目录的文件（深度为 1，默认为 1）:

```shell
find ./ -maxdepth 1 -type f
```

<!-- more -->

---

## 定制搜索

- 按类型搜索

```shell
find . -type d -print  //只列出所有目录
```

- -type f 文件 / l 符号链接 / d 目录

find 支持的文件检索类型可以区分普通文件和符号链接、目录等，但是二进制文件和文本文件无法直接通过 find 的类型区分出来；

- 按大小搜索：
  w 字 k M G
  寻找大于 2k 的文件

```shell
find . -type f -size +2k
```

按权限查找

```shell
find . -type f -perm 644 -print //找具有可执行权限的所有文件
```

按用户查找

```shell
find . -type f -user weber -print// 找用户weber所拥有的文件
```

- 执行动作（强大的 exec）
  将当前目录下的所有权变更为 weber::

```shell
find . -type f -user root -exec chown weber {} \;
```

注：{}是一个特殊的字符串，对于每一个匹配的文件，{}会被替换成相应的文件名；

将找到的文件全都 copy 到另一个目录::

```shell
find . -type f -mtime +10 -name "*.txt" -exec cp {} OLD \;
```

---

## grep 文本搜索

```shell
grep match_patten file // 默认访问匹配行
```

常用参数

- -o 只输出匹配的文本行 **VS** -v 只输出没有匹配的文本行
- -c 统计文件中包含文本的次数
  grep -c "text" filename
- -n 打印匹配的行号
- -i 搜索时忽略大小写
- -l 只打印文件名
- -A 打印搜索到目标的前几行
- -B 打印搜索到目标的后几行
- -C 打印搜索到目标的前后几行

在多级目录中对文本递归搜索(程序员搜代码的最爱）

```shell
// 在多级目录下搜索文本内容包含class的，并且打印行数，并且显示前后3行
grep "class" . -R -n -C 3
```

综合应用：将日志中的所有带 where 条件的 sql 查找查找出来

```shell
cat *sql.log | tr [a-z] [A-Z] | grep "FROM" | grep "WHERE" > temp.log
```

---

## xargs 命令行参数转换

单行输出

```shell
cat file.txt | xargs
```

单行之后再以 n 个元素为一行

```shell
cat file.txt | -n 2
```

xargs 参数说明

- -d 定义定界符 （默认为空格 多行的定界符为 \n）
- -n 指定输出为多行
- -I {} 指定替换字符串，这个字符串在 xargs 扩展时会被替换掉,用于待执行的命令需要多个参数时
- -0：指定\0 为输入定界符

---

## sort 排序

- -n 按数字进行排序 VS -d 按字典序进行排序
- -r 逆序排序
- -k N 指定按第 N 列排序
- -R 随机排列
- -f 忽略大小写
- -b 忽略前置无用

```shell
// 升序排列
sort a.p

// 随机排列
sort -R a.p
```

## uniq 重复行操作

- -d 只显示重复行
- -u 只显示不重复的行
- -c 覆盖重复，但是显示每行记录的重复数，默认为：1
- -i 忽略大小写

可指定每行中需要比较的重复内容：-s 开始位置 -w 比较字符数

```shell
sort unsort.txt | uniq
```

## tr sed 简化版

注意[set1]和[set2]是单字符一对一替换

PS：关键是默认是单字符操作，除非加了-s

- -d 删除某些字符
- -s 删除某个字符串
- -c 获取文本中指定的字符

```shell
    echo 12345 | tr '0-9' '9876543210' //加解密转换，替换对应字符

    cat text| tr '\t' ' '  //制表符转空格
```

tr 中可用各种字符类：

    * alnum：字母和数字
    * alpha：字母
    * digit：数字
    * space：空白字符
    * lower：小写
    * upper：大写
    * cntrl：控制（非可打印）字符
    * print：可打印字符

使用方法：`tr [:class:] [:class:]`

```shell
// 小写替换成大写
tr '[:lower:]' '[:upper:]'
```

## sed 文本替换利器

格式：

```
sed [options] '[command]<content>[command2]' file
```

options：

- -i：替换原本的内容

command：

- s：替换文本:
  - s/{text}/{replatce_text}/[command2]

command2：

- g：全局匹配

- Ng：N = \d：从第 N 列开始逐行匹配

```shell
echo sksksksksksk | sed 's/sk/SK/2g'
skSKSKSKSKSK
```

- d：删除操作

```shell
删除空白行：

sed '/^$/d' file

删除文件的第2行：

sed '2d' file

删除文件的第2行到末尾所有行：

sed '2,$d' file
```
