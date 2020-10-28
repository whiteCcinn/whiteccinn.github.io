---
title: 【C语言】- Makefile
date: 2019-07-08 10:11:09
categories: [C语言]
tags: [C语言]
---

## 前言

什么是 makefile？或许很多 Winodws 的程序员都不知道这个东西，因为那些 Windows 的 IDE 都为你做了这个工作，但我觉得要作一个好的和 professional 的程序员，makefile 还是要懂。这就好像现在有这么多的 HTML 的编辑器，但如果你想成为一个专业人士，你还是要了解 HTML 的标识的含义。特别在 Unix 下的软件编译，你就不能不自己写 makefile 了，`会不会写 makefile，从一个侧面说明了一个人是否具备完成大型工程的能力`。因为，makefile 关系到了整个工程的编译规则。一个工程中的源文件不计数，其按类型、功能、模块分别放在若干个目录中，makefile 定义了一系列的规则来指定，哪些文件需要先编译，哪些文件需要后编译，哪些文件需要重新编译，甚至于进行更复杂的功能操作，因为 makefile 就像一个 Shell 脚本一样，其中也可以执行操作系统的命令。`makefile 带来的好处就是——“自动化编译”`，一旦写好，只需要一个 make 命令，整个工程完全自动编译，极大的提高了软件开发的效率。make 是一个命令工具，是一个解释 makefile 中指令的命令工具，一般来说，大多数的 IDE 都有这个命令，比如：Delphi 的 make，Visual C++的 nmake，Linux 下 GNU 的 make。可见，makefile 都成为了一种在工程方面的编译方法。

> 其实在我眼中，感觉 makefile 文件其实就是等于一个 shell 文件，用于处理“自动化”的内容，只不过它是由 C 语言程序本身解析的。

<!-- more -->

## Makefile 书写命令

### 显示命令

通常，make 会把其要执行的命令行在命令执行前输出到屏幕上。当我们用`“@”字符在命令行前`，那么，这个命令将不被 make 显示出来，最具代表性的例子是，我们用这个功能来像屏幕显示一些信息。如：

```makefile
@echo 正在编译 XXX 模块......
```

当 make 执行时，会输出“正在编译 XXX 模块......”字串，但不会输出命令，如果没有“@”，那么，make 将输出：

```makefile
echo 正在编译 XXX 模块......

正在编译 XXX 模块......
```

如果 make 执行时，带入 make 参数`“-n”或“--just-print”`，那么其`只是显示命令，但不会执行命令`，这个功能很有利于我们`调试我们的 Makefile`，看看我们书写的命令是执行起来是什么样子的或是什么顺序的。

而 make 参数`“-s”或“--slient”`则是`全面禁止命令的显示`。

> 类似于 bash -x 一样

### 命令执行

当依赖目标新于目标时，也就是当规则的目标需要被更新时，make 会一条一条的执行其后的命令。需要注意的是，如果你要让上一条命令的结果应用在下一条命令时，你应该使用分号分隔这两条命令。比如你的第一条命令是 cd 命令，你希望第二条命令得在 cd 之后的基础上运行，那么你就`不能把这两条命令写在两行上，而应该把这两条命令写在一行上，用分号分隔`。

错误例子：

```makefile
exec:
  cd /home/ccinn
  pwd
```

正确例子:

```makefile
exec:
  cd /home/ccinn; pwd
```

### 命令出错

每当命令运行完后，make 会检测每个命令的返回码，如果命令返回成功，那么 make 会执行下一条命令，当规则中所有的命令成功返回后，这个规则就算是成功完成了。如果一个规则中的某个命令出错了（命令退出码非零），那么 make 就会终止执行当前规则，这将有可能终止所有规则的执行。

有些时候，命令的出错并不表示就是错误的。例如 mkdir 命令，我们一定需要建立一个目录，如果目录不存在，那么 mkdir 就成功执行，万事大吉，如果目录存在，那么就出错了。我们之所以使用 mkdir 的意思就是一定要有这样的一个目录，于是我们就不希望 mkdir 出错而终止规则的运行。

为了做到这一点，`忽略命令的出错`，我们可以在 Makefile 的命令行前`加一个减号“-”（在 Tab 键之后）`，标记为`不管命令出不出错都认为是成功的`。如：

```makefile
build:
  -mdkir /home/ccinn
```

还有一个全局的办法是，给 make 加上`“-i”或是“--ignore-errors”参数`，那么，Makefile 中所有命令都会忽略错误。而如果一个规则是以`“.IGNORE”作为目标`的，那么这个规则中的所有命令将会忽略错误。这些是`不同级别的防止命令出错的方法`，你可以根据你的不同喜欢设置。

还有一个要提一下的 make 的参数的是`“-k”或是“--keep-going”`，这个参数的意思是，`如果某规则中的命令出错了，那么就终目该规则的执行，但继续执行其它规则`。

### 嵌套执行 make

在一些大的工程中，我们会把我们不同模块或是不同功能的源文件放在不同的目录中，我们可以在每个目录中都书写一个该目录的 Makefile，这有利于让我们的 Makefile 变得更加地简洁，而不至于把所有的东西全部写在一个 Makefile 中，这样会很难维护我们的 Makefile，这个技术对于我们模块编译和分段编译有着非常大的好处。

例如，我们有一个子目录叫 subdir，这个目录下有个 Makefile 文件，来指明了这个目录下文件的编译规则。那么我们`总控的 Makefile` 可以这样书写：

```makefile
subsystem:
  cd subdir && $(MAKE)
```

其等价于：

```makefile
subsystem:
  $(MAKE) -C subdir
```

定义\$(MAKE)宏变量的意思是，也许我们的 make 需要一些参数，所以定义成一个变量比较利于维护。这两个例子的意思都是先进入“subdir”目录，然后执行 make 命令。

我们把这个 Makefile 叫做“总控 Makefile”，`总控 Makefile 的变量可以传递到下级的 Makefile 中（如果你显示的声明），但是不会覆盖下层的 Makefile 中所定义的变量，除非指定了“-e”参数。`

如果你要传递变量到下级 Makefile 中，那么你可以使用这样的声明：

```makefile
export<variable ...>
```

如果你不想让某些变量传递到下级 Makefile 中，那么你可以这样声明：

```makefile
unexport<variable ...>
```

#### 示例一：

```makefile
export variable = value
```

其等价于：

```makefile
variable = value

export variable
```

其等价于：

```makefile
export variable := value
```

其等价于：

```makefile
variable := value

export variable
```

#### 示例二：

```makefile
export variable += value
```

其等价于：

```makefile
variable += value

export variable
```

`如果你要传递所有的变量，那么，只要一个export就行了`。后面什么也不用跟，表示传递所有的变量。

需要注意的是，有两个变量，一个是 `SHELL`，一个是`MAKEFLAGS`，这两个变量不管你是否 export，其总是要传递到下层 Makefile 中，`特别是 MAKEFILES 变量，其中包含了 make 的参数信息`，如果我们执行“总控 Makefile”时有 make 参数或是在上层 Makefile 中定义了这个变量，那么 MAKEFILES 变量将会是这些参数，并会传递到下层 Makefile 中，这是一个系统级的环境变量。

但是 make 命令中的有几个参数并不往下传递，它们是“-C”,“-f”,“-h”“-o”和“-W”（有关 Makefile 参数的细节将在后面说明），`如果你不想往下层传递参数`，那么，你可以这样来：

```makefile
subsystem:
  cd subdir && $(MAKE) MAKEFLAGS=
```

如果你定义了环境变量 MAKEFLAGS，那么你得确信其中的选项是大家都会用到的，如果其中有“-t”,“-n”,和“-q”参数，那么将会有让你意想不到的结果，或许会让你异常地恐慌。

还有一个在“嵌套执行”中比较有用的参数，`“-w”或是“--print-directory”会在 make 的过程中输出一些信息`，让你看到目前的工作目录。比如，如果我们的下级 make 目录是“/home/ccinn/gnu/make”，如果我们使用“make -w”来执行，那么当进入该目录时，我们会看到：

```makefile
make: Entering directory `/home/ccinn/gnu/make'.
```

而在完成下层 make 后离开目录时，我们会看到：

```makefile
make: Leaving directory `/home/ccinn/gnu/make'
```

当你使用“-C”参数来指定 make 下层 Makefile 时，“-w”会被自动打开的。

> 如果参数中有“-s”（“--slient”）或是“--no-print-directory”，那么，“-w”总是失效的。
