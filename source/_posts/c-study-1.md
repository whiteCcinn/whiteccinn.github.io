---
title: C语言 入门实录 一
date: 2017-01-21 11:01:00
categories: C
tags: [C, 学习记录]
---

## 开始

在 linux vim 下建立一个 `Hello World` 程序

我们意气风发的写下：

```C
-Hello_World.c-

#include <stdio.h>

int main()
{
  printf("Hello world! \n");

  return 0;
}

```

<!-- more -->

通过 gcc 来编译 C 代码

`gcc Hello_World.c -o Hello_World`

生成可执行文件，大小相差 8kb

运行可执行文件

`./Hello_World`

## 备注

- 所有的 C 语言程序都需要包含 main() 函数。 代码从 main() 函数开始执行。

- /_ ... _/ 用于注释说明。

- printf() 用于格式化输出到屏幕。printf() 函数在 "stdio.h" 头文件中声明。

- stdio.h 是一个头文件 (标准输入输出头文件) and #include 是一个预处理命令，用来引入头文件。 当编译器遇到 printf() 函数时，如果没有找到 stdio.h 头文件，会发生编译错误。

- return 0; 语句用于表示退出程序。
