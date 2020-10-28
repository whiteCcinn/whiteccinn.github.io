---
title: rust-for-docker
date: 2019-04-02 20:49:59
categories: [Rust]
tags: [Rust]
---

# 说明

今天，我们开始学习一下 Rust，希望将来在公司可以推广 Rust 语言，并且用 Rust 语言做更多的事情。

在此， 进入我们的入学篇。

## Rust for Docker

拉取最新版本的 Rust

```sh
docker pull rust:latest
```

由于官方上的命令有点问题，并且我希望我有一个交互的终端环境，所以，经过修改后，进入 Rust 容器的命令如下：

```
docker run -it --rm -e "USER=$(whoami)" -e "RUST_BACKTRACE=1" -v "$PWD":/usr/src/myapp -w /usr/src/myapp rust:latest bash
```

- USER: cargo 打包的时候会用这个命名
- RUST_BACKTRACE：终端调试的时候，会打印出错误栈

进入到容器后，我们创建属于我们的第一个项目：Hello，World

利用 Rust 的包管理工具：Cargo 进行开发和编译

```
cargo new hello_world

// car new --lib <package_name> 这个是创建类库的命令，暂时用不到，所以忽略先
```

<!-- more -->

然后创建好了之后。可以看到 目录结构如下：

- src：需要开发的源码目录
- target: 利用 `cargo build` 运行之后的结果

tree 结构如下：

```sh
.
├── Cargo.lock
├── Cargo.toml
├── src
│   └── main.rs
└── target
    └── debug
        ├── build
        ├── deps
        │   ├── hello_world-fe752e96abed129f
        │   └── hello_world-fe752e96abed129f.d
        ├── examples
        ├── hello_world
        ├── hello_world.d
        ├── incremental
        │   └── hello_world-a3apxnpw89q3
        │       ├── s-fax5vd6s7z-mo2l8f-2iq1v3vohkxfu
        │       │   ├── 1lpqxcu6kfhnj0ty.o
        │       │   ├── 1z70i4nrjlg4y6gh.o
        │       │   ├── 2qa4nktsifidbpri.o
        │       │   ├── 3k2rwqf2cnq9zjxc.o
        │       │   ├── 4is0vkl128fgpc6l.o
        │       │   ├── dep-graph.bin
        │       │   ├── g5tl0es1ce46vid.o
        │       │   ├── query-cache.bin
        │       │   └── work-products.bin
        │       └── s-fax5vd6s7z-mo2l8f.lock
        └── native
```

在这里，我们可以执行执行二进制文件：

```
./target/debug/hello_world
```

结果如下：

```
root@66c4794c7528:/usr/src/myapp/hello_world# ./target/debug/hello_world
Hello, world
```

或者利用 cargo 运行启动:

```
cargo run
```

结果如下:

```
root@66c4794c7528:/usr/src/myapp/hello_world# cargo run
    Finished dev [unoptimized + debuginfo] target(s) in 0.06s
     Running `target/debug/hello_world`
Hello, world!
```

到此为止，我们的第一章节 Hello World 完成了，接下来要积累点才可以了
