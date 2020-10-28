---
title: linux の动态库
date: 2017-06-19 14:24:00
categories: [Linux]
tags: [Linux]
---

## 1. /lib 和 /usr/lib 的区别

/lib 里面给的是 root 和内核所需`so(动态库)`或者`a(静态)`之类的库文件，而/usr/lib 是普通用户能够使用的。

Linux 的程序有两种模式，这个你应该知道，是`用户模式`和`内核模式`，和这个也是有关系的，不再冗述。

简单说,/lib 是内核级的,/usr/lib 是系统级的,/usr/local/lib 是用户级的.

/lib/ — 包含许多被 /bin/ 和 /sbin/ 中的程序使用的库文件。目录 /usr/lib/ 中含有更多用于用户程序的库文件。/lib 目录下放置的是/bin 和/sbin 目录下程序所需的库文件。/lib 目录下的文件的名称遵循下面的格式：

```
libc.so.*
ld*
```

<!-- more -->

仅仅被/usr 目录下的程序所使用的共享库不必放到/lib 目录下。只有/bin 和/sbin 下的程序所需要的库有必要放到/lib 目录下。实际上，libm.so.\*类型的库文件如果被是/bin 和/sbin 所需要的，也可以放到/usr/lib 下。

- /bin/ — 用来贮存用户命令。目录 /usr/bin 也被用来贮存用户命令。

- /sbin/ — 许多系统命令（例如 shutdown）的贮存位置。目录 /usr/sbin 中也包括了许多系统命令。

- /root/ — 根用户（超级用户）的主目录。

- /mnt/ — 该目录中通常包括系统引导后被挂载的文件系统的挂载点。譬如，默认的光盘挂载点是 /mnt/cdrom/.

- /boot/ — 包括内核和其它系统启动期间使用的文件。

- /lost+found/ — 被 fsck 用来放置零散文件（没有名称的文件）。

- /lib/ — 包含许多被 /bin/ 和 /sbin/ 中的程序使用的库文件。目录 /usr/lib/ 中含有更多用于用户程序的库文件。

- /dev/ — 贮存设备文件。

- /etc/ — 包含许多配置文件和目录。

- /var/ — 用于贮存 variable（或不断改变的）文件，例如日志文件和打印机假脱机文件。

- /usr/ — 包括与系统用户直接有关的文件和目录，例如应用程序及支持它们的库文件。

- /proc/ — 一个虚拟的文件系统（不是实际贮存在磁盘上的），它包括被某些程序使用的系统信息。

- /initrd/ — 用来在计算机启动时挂载 initrd.img 映像文件的目录以及载入所需设备模块的目录。

警告

不要删除 /initrd/ 目录。如果你删除了该目录后再重新引导 Red Hat Linux 时，你将无法引导你的计算机。

- /tmp/ — 用户和程序的临时目录。 /tmp 给予所有系统用户读写权。

- /home/ — 用户主目录的默认位置。

- /opt/ — 可选文件和程序的贮存目录。该目录主要被第三方开发者用来简易地安装和卸装他们的软件包。

## 2.ldconfig

> ldconfig 是一个动态链接库管理命令，其目的为了让动态链接库为系统所共享。

### 2.1 ldconfig 的主要用途：

默认搜寻/lilb 和/usr/lib，以及配置文件/etc/ld.so.conf 内所列的目录下的库文件。

搜索出可共享的动态链接库，库文件的格式为：lib**\*.so.**，进而创建出动态装入程序(ld.so)所需的连接和缓存文件。

缓存文件默认为/etc/ld.so.cache，该文件保存已排好序的动态链接库名字列表。

ldconfig 通常在系统启动时运行，而当用户安装了一个新的动态链接库时，就需要手工运行这个命令。

### 2.2 ldconfig 需要注意的地方：

往/lib 和/usr/lib 里面加东西，是不用修改/etc/ld.so.conf 文件的，但是添加完后需要调用下 ldconfig，不然添加的 library 会找不到。

如果添加的 library 不在/lib 和/usr/lib 里面的话，就一定要修改/etc/ld.so.conf 文件，往该文件追加 library 所在的路径，然后也需要重新调用下 ldconfig 命令。比如在安装 MySQL 的时候，其库文件/usr/local/mysql/lib，就需要追加到/etc/ld.so.conf 文件中。命令如下：

```
echo "/usr/local/mysql/lib" >> /etc/ld.so.conf

ldconfig -v | grep mysql
```

如果添加的 library 不在/lib 或/usr/lib 下，但是却没有权限操作写/etc/ld.so.conf 文件的话，这时就需要往 export 里写一个全局变量 LD_LIBRARY_PATH，就可以了。
