---
title: 【rust】序列化框架serde
date: 2021-04-13 10:43:43
categories: [rust]
tags: [rust]
---

# 前言

Rust 中有一个 99%的程序员或许都会用到的组件，那就是序列化组件: serde。

众所周知，rust的静态语言，所以这让我们在序列化上繁琐了很多，但是有了serde，它帮助我们更好的序列化结构体，生产对应的数据。它实现了各种`声明宏` 以及 `过程宏` 来协助我们序列化。

围绕着`serde`，也有很多衍生的子组件，例如`serde-json`, `serde-yaml`, `serde-qs` 等等。

由于我目前在开发 `gitlab-rs`，在生成对应的query_string 以及form的数据的时候，就比较棘手。

所以我在`gitlab-rs` 生成的过程宏中，借助了 `seder` 出色的序列化生态来完成功能。

<!-- more -->

## 目前围绕serde支持的序列化的数据格式组件有：

- [JSON]，许多HTTP api都使用的JavaScript对象符号。
- [Bincode]，一个紧凑的二进制格式，用于伺服渲染的IPC
引擎。
- [CBOR]，一种简洁的二进制对象表示，专为小消息大小设计
而不需要版本协商。
- [YAML]，一个自称对人类友好的配置语言，其实不是
标记语言。
- [MessagePack]，一个高效的二进制格式，类似于一个紧凑的JSON。
- [TOML]， [Cargo]使用的最小配置格式。
- [Pickle]， Python世界中常见的格式。
-[罗恩]，一个生锈的符号。
—[BSON]， MongoDB使用的数据存储和网络传输格式。
- [Avro]，在Apache Hadoop中使用的二进制格式，支持schema
定义。
- [JSON5]，一个JSON的超集，包括一些来自ES5的产品。
-[明信片]，一个不\_std和嵌入式系统友好的紧凑二进制格式。
—[URL]查询字符串，格式为x-www-form-urlencoded。
- [Envy]，一种将环境变量反序列化为锈蚀结构的方法。
*(反序列化)*
- [Envy Store]，一种反序列化[AWS Parameter Store]参数到Rust的方法
结构体。*(反序列化)*
- [S-expressions]， Lisp使用的代码和数据的文本表示形式
语言的家庭。
- [D-Bus]的二进制线格式。
- [FlexBuffers]，谷歌的FlatBuffers 0 -copy的无模式表兄弟
序列化格式。
- [Bencode]，在BitTorrent协议中使用的一个简单的二进制格式。
—[DynamoDB Items]， [rusoto_dynamodb]用来传输数据的格式
和DynamoDB。
- [Hjson]，一个JSON的语法扩展，围绕人类阅读和编辑而设计。*(反序列化)*

[JSON]: https://github.com/serde-rs/json
[Bincode]: https://github.com/servo/bincode
[CBOR]: https://github.com/pyfisch/cbor
[YAML]: https://github.com/dtolnay/serde-yaml
[MessagePack]: https://github.com/3Hren/msgpack-rust
[TOML]: https://github.com/alexcrichton/toml-rs
[Pickle]: https://github.com/birkenfeld/serde-pickle
[RON]: https://github.com/ron-rs/ron
[BSON]: https://github.com/zonyitoo/bson-rs
[Avro]: https://github.com/flavray/avro-rs
[JSON5]: https://github.com/callum-oakley/json5-rs
[URL]: https://docs.rs/serde_qs
[Postcard]: https://github.com/jamesmunns/postcard
[Envy]: https://github.com/softprops/envy
[Envy Store]: https://github.com/softprops/envy-store
[Cargo]: http://doc.crates.io/manifest.html
[AWS Parameter Store]: https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html
[S-expressions]: https://github.com/rotty/lexpr-rs
[D-Bus]: https://docs.rs/zvariant
[FlexBuffers]: https://github.com/google/flatbuffers/tree/master/rust/flexbuffers
[Bencode]: https://github.com/P3KI/bendy
[DynamoDB Items]: https://docs.rs/serde_dynamo
[rusoto_dynamodb]: https://docs.rs/rusoto_dynamodb
[Hjson]: https://github.com/Canop/deser-hjson

### 最简单的一个实例

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let point = Point { x: 1, y: 2 };

    // Convert the Point to a JSON string.
    let serialized = serde_json::to_string(&point).unwrap();

    // Prints serialized = {"x":1,"y":2}
    println!("serialized = {}", serialized);

    // Convert the JSON string back to a Point.
    let deserialized: Point = serde_json::from_str(&serialized).unwrap();

    // Prints deserialized = Point { x: 1, y: 2 }
    println!("deserialized = {:?}", deserialized);
}
```

```shell
/Users/caiwenhui/.cargo/bin/cargo run --color=always --package serde_test --bin serde_test
    Finished dev [unoptimized + debuginfo] target(s) in 0.01s
     Running `target/debug/serde_test`
serialized = {"x":1,"y":2}
deserialized = Point { x: 1, y: 2 }
```

### 属性

serde-device种支持 `3种` 属性，分别是:

- 容器属性  用于结构体或者枚举
- 字体属性  用于枚举的变体
- 字段属性  用于结构体或者枚举种的字段 

> 字体属性 仅 用于枚举

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]  // <-- this is a container attribute
struct S {
    #[serde(default)]  // <-- this is a field attribute
    f: i32,
    s_e: E
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename = "e")]  // <-- this is also a container attribute
enum E {
    #[serde(rename = "a")]  // <-- this is a variant attribute
    A(String),
}

fn main() {
    let point_s = S { f: 1 , s_e: E::A(String::from("inner-enum"))};
    // Convert the Point to a JSON string.
    let serialized_a = serde_json::to_string(&point_s).unwrap();

    println!("serialized_a: {}", serialized_a);

    let point_e = E::A(String::from("my-enum"));
    // Convert the Point to a JSON string.
    let serialized_e = serde_json::to_string(&point_e).unwrap();

    println!("serialized_e: {}", serialized_e)
}
```

```shell
/Users/caiwenhui/.cargo/bin/cargo run --color=always --package serde_test --bin serde_test
    Finished dev [unoptimized + debuginfo] target(s) in 0.01s
     Running `target/debug/serde_test`
serialized_a: {"f":1,"s_e":{"a":"inner-enum"}}
serialized_e: {"a":"my-enum"}
```

既然我们知道了serde有种类型的属性，具体都有哪些属性，大家一定也感兴趣。

#### 容器属性(Container attributes)

##### #[serde(rename = "name")]

`#[serde(rename = "name")]`

序列化和反序列化的时候用一个名字来代替Rust结构体的名字

当然，也允许独立设置和分别设置:

- `#[serde(rename(serialize = "ser_name"))]`
- `#[serde(rename(deserialize = "de_name"))]`
- `#[serde(rename(serialize = "ser_name", deserialize = "de_name"))]`

##### #[serde(rename_all = "...")] 

`#[serde(rename_all = "...")]`

根据给定的大小写约定重命名所有字段（如果这是一个结构）或变量（如果这是一个枚举）。可能的值是`"lowercase"`,
  `"UPPERCASE"`, `"PascalCase"`, `"camelCase"`, `"snake_case"`,
  `"SCREAMING_SNAKE_CASE"`, `"kebab-case"`, `"SCREAMING-KEBAB-CASE"`。

顾名思义，这个容器属性主要是允许你定义驼峰，蛇形等序列化以及反序列化的字段

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]  // <-- this is a container attribute
#[serde(rename_all = "UPPERCASE")]
struct S {
    #[serde(default)]  // <-- this is a field attribute
    f: i32,
    hello_world: E
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename = "e")]  // <-- this is also a container attribute
enum E {
    #[serde(rename = "a")]  // <-- this is a variant attribute
    A(String),
}

fn main() {
    let point_s = S { f: 1 , hello_world: E::A(String::from("inner-enum"))};
    // Convert the Point to a JSON string.
    let serialized_a = serde_json::to_string(&point_s).unwrap();

    // normal output => serialized_a: {"f":1,"hello_world":{"a":"inner-enum"}}
    println!("serialized_a: {}", serialized_a);
}
```

```shell
/Users/caiwenhui/.cargo/bin/cargo run --color=always --package serde_test --bin serde_test
    Finished dev [unoptimized + debuginfo] target(s) in 0.02s
     Running `target/debug/serde_test`
serialized_a: {"F":1,"HELLO_WORLD":{"a":"inner-enum"}}
```



##### #[serde(deny_unknown_fields)]

遇到未知字段时，在反序列化期间始终会出错。当此属性不存在时，默认情况下，对于诸如JSON之类的自描述格式，未知字段将被忽略。


```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
struct S {
    #[serde(default)]
    f: i32,
}

fn main() {
    let s = r#"
    {"f":1,"s_e":{"a":"inner-enum"}}
    "#;

    let uns: S = serde_json::from_str(&s).unwrap();

    println!("un: {:?}", uns);
}
```

```shell
/Users/caiwenhui/.cargo/bin/cargo run --color=always --package serde_test --bin serde_test
    Finished dev [unoptimized + debuginfo] target(s) in 0.02s
     Running `target/debug/serde_test`
un: S { f: 1}
```

可以看到成功输出。如果没有匹配到字段到话会自动忽略。但是如果你希望严格到匹配的话。那么就可以加上此容器属性.



```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
struct S {
    #[serde(default)]
    f: i32,
}

fn main() {
    let s = r#"
    {"f":1,"s_e":{"a":"inner-enum"}}
    "#;

    let uns: S = serde_json::from_str(&s).unwrap();

    println!("un: {:?}", uns);
}
```

```shell
/Users/caiwenhui/.cargo/bin/cargo run --color=always --package serde_test --bin serde_test
    Finished dev [unoptimized + debuginfo] target(s) in 0.02s
     Running `target/debug/serde_test`
thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: Error("unknown field `s_e`, expected `f` or `s_e`", line: 2, column: 44)', src/main.rs:34:43
stack backtrace:
   0: rust_begin_unwind
             at /rustc/e1884a8e3c3e813aada8254edfa120e85bf5ffca/library/std/src/panicking.rs:495:5
   1: core::panicking::panic_fmt
             at /rustc/e1884a8e3c3e813aada8254edfa120e85bf5ffca/library/core/src/panicking.rs:92:14
   2: core::option::expect_none_failed
             at /rustc/e1884a8e3c3e813aada8254edfa120e85bf5ffca/library/core/src/option.rs:1268:5
   3: core::result::Result<T,E>::unwrap
             at /Users/caiwenhui/.rustup/toolchains/stable-x86_64-apple-darwin/lib/rustlib/src/rust/library/core/src/result.rs:973:23
   4: serde_test::main
             at ./src/main.rs:34:18
   5: core::ops::function::FnOnce::call_once
             at /Users/caiwenhui/.rustup/toolchains/stable-x86_64-apple-darwin/lib/rustlib/src/rust/library/core/src/ops/function.rs:227:5
note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.
```

可以看到这里会报错.

##### #[serde(tag = "type")]

该属性只适用于枚举体，具体用法详见:[ enum representations ](https://github.com/serde-rs/serde-rs.github.io/blob/master/_src/enum-representations.md)

##### #[serde(tag = "t", content = "c")]

该属性只适用于枚举体，具体用法详见:[ enum representations ](https://github.com/serde-rs/serde-rs.github.io/blob/master/_src/enum-representations.md)

##### #[serde(untagged)]

该属性只适用于枚举体，具体用法详见:[ enum representations ](https://github.com/serde-rs/serde-rs.github.io/blob/master/_src/enum-representations.md)


## serde

## serde-qs


