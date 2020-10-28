---
title: 【Linux命令】diff - colordiff
date: 2018-10-25 19:44:00
categories: [Linux]
tags: [Linux, Shell]
---

## 前言

我们经常用 git 的客户端来对比文件差异，或者用一下其他的对比文件的差异的软件，例如常用的 Beyond Compare，但是如果我们不想借助其他的工具，用 linux 自带的命令要如何实现呢。

这里和大家说一下 `diff` 命令

## 使用

diff 分析两个文件，并输出两个文件的不同的行。diff 的输出结果表明需要对一个文件做怎样的操作之后才能与第二个文件相匹配。diff 并不会改变文件的内容，但是 diff 可以输出一个 ed 脚本来应用这些改变。
现在让我们来看一下 diff 是如何工作的，假设有两个文件：

<!-- more -->

```
//file1.txt
I need to buy apples.
I need to run the laundry.
I need to wash the dog.
I need to get the car detailed.

//file2.txt
I need to buy apples.
I need to do the laundry.
I need to wash the car.
I need to get the dog detailed.

我们使用diff比较他们的不同：
diff file1.txt file2.txt

输出如下结果：
2,4c2,4
< I need to run the laundry.
< I need to wash the dog.
< I need to get the car detailed.
---
> I need to do the laundry.
> I need to wash the car.
> I need to get the dog detailed.
```

我们来说明一下该输出结果的含义，要明白 diff 比较结果的含义，我们必须牢记一点，diff 描述两个文件不同的方式是告诉我们怎么样改变第一个文件之后与第二个文件匹配。我们看看上面的比较结果中的第一行 2,4c2,4 前面的数字 2,4 表示第一个文件中的行，中间有一个字母 c 表示需要在第一个文件上做的操作(a=add,c=change,d=delete)，后面的数字 2,4 表示第二个文件中的行。

2,4c2,4 的含义是：第一个文件中的第[2,4]行(注意这是一个闭合区间，包括第 2 行和第 4 行)需要做出修改才能与第二个文件中的[2,4]行相匹配。
接下来的内容则告诉我们需要修改的地方，前面带 < 的部分表示左边文件的第[2,4]行的内容，而带> 的部分表示右边文件的第[2,4]行的内容，中间的 --- 则是两个文件内容的分隔符号。

## 模式

- Normal （默认）
- Context（计算机模式）【-c】
- Unified （类似 github）【-u】
- Gui (类似于客户端) 【-y】

## diff 还提供了一些有用的参数来控制比较行为与输出结果，一些常用的参数如下：

- -b --ignore-space-change 忽略空格，如果两行进行比较，多个连续的空格会被当作一个空格处理，同时会忽略掉行尾的空格差异。

- -w --ignore-all-space 忽略所有空格，忽略范围比-b 更大，包括很多不可见的字符都会忽略。

- -B 忽略空白行。

- -y 输出两列，一个文件一列，有点类似 GUI 的输出外观了，这种方式输出更加直观。

- -W 大写 W，当指定-y 的时候设置列的宽度，默认是 130

- -x, --exclude=PAT 比较目录的时候排除指定 PAT 模式的文件名的比较

- -i, --ignore-case 忽略两个文件中大小写的不同

- -e 将比较的结果保存成一个 ed 脚本，之后 ed 程序可以执行该脚本文件，从而将 file1 修改成与 file2 的内容相同，这一般在 patch 的时候有用。

- -r 如果比较两个目录，-r 参数会比较其下同名的子目录

- -q 输出结果中，只指出两个文件不同，而不输出两个文件具体内容的比较，这在比较两个目录的时候很好用。我们只需要知道两个目录下那些文件做了修改，而不需要知道每个文件具体修改了那些内容。特别是当两个目录文件很多的时候。

`diff -e 1.txt 2.txt > script.txt` 这样就是生成了一个 ed 可以执行的脚本文件 script.txt，生成脚本文件之后我们还需要做一个操作， 在脚本文件末尾添加 ed 的 write 指令，只需要执行`echo "w" >>script.txt` 将 w 指令附加到脚本文件的最后一行即可。
那么如何应用该脚本文件呢，可以这样使用：
`ed - 1.txt < script.txt`
注意中间的 – 符号表示从标准输入中读取，而 < script.txt 则重定向 script.txt 的内容到标准输入。这样执行之后 1.txt 的内容将与 2.txt 完全相同。
