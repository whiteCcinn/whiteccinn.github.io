---
title: 【Redis】- 事务和Lua脚本
date: 2020-06-02 10:46:51
categories: [Redis]
tags: [Redis]
---

## 前言

Redis 我们用的蛮多的了，但是一直也没有整理什么资料，刚好今天要处理一下，顺便一下相关的事务和 lua 脚本的内容，由于管道(pipeline)不在这次原子性问题当中，所以我们就不加进来比较说明了。

<!-- more -->

## 说明

Redis 的原子性问题，在一直高并发的场景下，是一个需要重视的问题，否则原子性不满足将会导致业务逻辑出现问题。

在这里，我们常用解决原子性问题的一般都是用 redis 自带的命令，例如 brpoplpush 之类的命令

但是我们可能需要更多的组合成一个原子性操作

因此，这里会有 2 种选择，分别如下：

- 事务
- lua 脚本

### 事务

redis 事务提供了一种“将多个命令打包， 然后一次性、按顺序地执行”的机制， 并且事务在执行的期间不会主动中断

我们可以通过 MULTI 命令开启一个事务，类似于 mysql 的 BEGIN TRANSACTION 语句

在该语句之后执行的命令都将被视为事务之内的操作

最后我们可以通过执行 `EXEC/DISCARD` 命令来提交/回滚该事务内的所有操作

这两个 Redis 命令可被视为等同于关系型数据库中的 COMMIT/ROLLBACK 语句

服务器在执行完事务中的所有命令之后， 才会继续处理其他客户端的其他命令

被执行的命令要么全部都被执行，要么一个也不执行，并且事务执行过程中不会被其他工作打断

一个 redis 事务从开始到执行会经历以下三个阶段：

![redis事务流程](/images/Redis/redis事务.png)

#### 开始事务 -- MULTI

multi 命令让客户端从非事务状态切换到事务状态

#### 命令入队

如果客户端处于非事务状态下，那么所有发送给服务端的命令都会立即被服务器执行，而如果客户端处于事务状态下，那么所有命令都还不会立即执行，而是被发送到一个事务队列中，返回 QUEUED，表示入队成功

事务队列是一个数组， 每个数组项是都包含三个属性

- cmd -- 要执行的命令
- argv -- 命令的参数
- argc -- 参数个数

例如，我们执行以下两个命令：

```redis
127.0.0.1:6379> SET msg "hello caiwenhui"
QUEUED
127.0.0.1:6379> GET msg
QUEUED
```

redis server 将创建以下事务队列：

| index | cmd | argv                       | argc |
| ----- | --- | -------------------------- | ---- |
| 0     | SET | ["msg", "hello caiwenhui"] | 2    |
| 1     | GET | ["msg"]                    | 1    |

#### 执行事务

如果客户端正处于事务状态， 那么当 EXEC 命令执行时， 服务器根据客户端所保存的事务队列， 以先进先出（FIFO）的方式执行事务队列中的命令

然后将执行命令所得的结果以 FIFO 的顺序保存到一个回复队列中

例如，当我们执行上述两个命令后执行 EXEC 命令，将会创建如下回复队列：

| index | 类型              | 内容         |
| ----- | ----------------- | ------------ |
| 0     | status code reply | OK           |
| 1     | bulk reply        | "hello moto" |

```redis
127.0.0.1:6379> multi
OK
127.0.0.1:6379> SET msg "hello caiwenhi"
QUEUED
127.0.0.1:6379> GET msg
QUEUED
127.0.0.1:6379> EXEC
1) OK
1) hello caiwenhui
```

### WATCH

Watch 命令用于监视一个(或多个) key ，如果在事务执行之前这个(或这些) key 被其他命令所改动，那么事务将被打断

WATCH 命令只能在客户端进入事务状态之前执行， 在事务状态下发送 WATCH 命令会引发错误

redis 中保存了一个 watched_keys 字典，字典的键是这个数据库被监视的键，而字典的值则是一个链表，链表中保存了所有监视这个键的客户端

每当一个客户端执行 WATCH 命令，对应的 key 指向的链表中就会增加该客户端的节点

![redis-watch-key](/images/Redis/redis-watch-key.png)

图意味着，key1 正在被 client1 和 client2 两个客户端监视着，key2 被 client3 监视着，key3 被 client4 监视着

一旦对数据库键空间进行的修改成功执行，multi.c 的 touchWatchedKey 函数都会被调用，他的工作就是遍历上述字典中该 key 所对应的整个链表的所有节点，打开每一个 WATCH 该 key 的 client 的 REDIS_DIRTY_CAS 选项

当客户端发送 EXEC 命令触发事务执行时，服务器会对客户端状态进行检查，如果客户端的 REDIS_DIRTY_CAS 选项已经被打开，那么说明被客户端监视的键至少有一个已经被修改，事务安全性已经被破坏，则服务端直接向客户端返回空回复，表示事务执行失败

当一个客户端结束它的事务时，无论事务是成功执行，还是失败， watched_keys 字典中和这个客户端相关的资料都会被清除

### redis 事务的特性

- 如果在执行 exec 之前事务中断了，那么所有的命令都不会执行
- 如果某个命令语法错误，不仅会导致该命令入队失败，整个事务都将无法执行
- 如果执行了 exec 命令之后，那么所有的命令都会按序执行
- 当 redis 在执行命令时，如果出现了错误，那么 redis 不会终止其它命令的执行，这是与关系型数据库事务最大的区别，redis 事务不会因为某个命令执行失败而回滚

### redis 事务的缺陷

#### 不满足原子性

与关系型数据库的事务不同，redis 事务是不满足原子性的，一个事务执行过程中，其他事务或 client 是可以对相应的 key 进行修改的

想要避免这样的并发性问题就需要使用 WATCH 命令，但是通常来说，必须经过仔细考虑才能决定究竟需要对哪些 key 进行 WATCH 加锁

额外的 WATCH 会增加事务失败的可能，而缺少必要的 WATCH 又会让我们的程序产生竞争条件

#### 后执行的命令无法依赖先执行命令的结果

由于事务中的所有命令都是互相独立的，在遇到 exec 命令之前并没有真正的执行，所以我们无法在事务中的命令中使用前面命令的查询结果

我们唯一可以做的就是通过 watch 保证在我们进行修改时，如果其它事务刚好进行了修改，则我们的修改停止，然后应用层做相应的处理

#### 事务中的每条命令都会与 redis 服务器进行网络交互

redis 事务开启之后，每执行一个操作返回的都是 queued，这里就涉及到客户端与服务器端的多次交互

明明是需要一次批量执行的 n 条命令，还需要通过多次网络交互，显然非常浪费

> 这个就是为什么会有 pipeline 的原因，减少 RTT 的时间

## redis 事务缺陷的解决 -- Lua

Lua 是一个小巧的脚本语言，有标准 C 编写，几乎在所有操作系统和平台上都可以编译运行

一个完整的 Lua 解释器不过 200k，在目前所有脚本引擎中，Lua 的速度是最快的，这一切都决定了 Lua 是作为嵌入式脚本的最佳选择

redis 2.6 版本之后也内嵌了一个 Lua 解释器，可以用于一些简单的事务与逻辑运算

### Redis 内嵌 Lua 的优势

#### 在服务端实现业务逻辑

按照我们上面介绍的，redis 事务执行中，每一条指令之间是相互独立的，我们无法让后面的操作依赖前面命名的结果，这就让整个事务仅仅成为了一个命令集合，在命令之间我们完全无法做任何事

但是，Lua 作为一个脚本语言，可以拥有分支、循环等语法结构，可以进行业务逻辑的编写

#### 原子性

由于 Lua 脚本是提交到 Redis server 进行一次性执行的，整个执行过程中不会被其他任何工作打断，其它任何脚本或者命令都无法执行,也就不会引起竞争条件，从而本身就实现了事务的原子性

但是，这同样会引起一个问题，正如官方文档所说的，正是由于 script 执行的原子性，`所以我们不要在 script 中执行过长开销的程序，否则会验证影响其它请求的执行`

#### 可复用

所有 Lua 脚本都是可重用的，这样就减少了网络开销

- EVAL script numkeys key[key ...] arg [arg…]
- EVALSHA sha1
- SCRIPT LOAD script
- SCRIPT EXISTS sha1

##### EVAL

```redis
EVAL script numkeys key [key ...] arg [arg ...]
```

| 参数          | 描述                                           |
| ------------- | ---------------------------------------------- |
| script        | 一段 Lua 脚本或 Lua 脚本文件所在路径及文件名   |
| numkeys       | Lua 脚本对应参数数量                           |
| key [key ...] | Lua 中通过全局变量 KEYS 数组存储的传入参数     |
| arg [arg ...] | Lua 中通过全局变量 ARGV 数组存储的传入附加参数 |

```redis
EVAL "return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}" 2 key1 key2 first second
1) "key1"
2) "key2"
3) "first"
4) "second"
```

![redis-lua](/images/Redis/redis-lua.png)

##### SCRIPT LOAD 与 EVALSHA 命令

对于不立即执行的 Lua 脚本，或需要重用的 Lua 脚本，可以通过 SCRIPT LOAD 提前载入 Lua 脚本，这个命令会立即返回对应的 SHA1 校验码

当需要执行函数时，通过 EVALSHA 调用 SCRIPT LOAD 返回的 SHA1 即可

```redis
SCRIPT LOAD "return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}"
"232fd51614574cf0867b83d384a5e898cfd24e5a"

EVALSHA "232fd51614574cf0867b83d384a5e898cfd24e5a" 2 key1 key2 first second
1) "key1"
2) "key2"
3) "first"
4) "second"
```

#### 通过 Lua 脚本执行 redis 命令

在 Lua 脚本中，只要使用 redis.call 传入 redis 命令就可以直接执行

```
eval "return redis.call('set',KEYS[1],'bar')" 1 foo     --等同于在服务端执行 set foo bar
```

#### 使用 Lua 脚本实现访问频率限制

```lua
--
-- KEYS[1] 要限制的ip
-- ARGV[1] 限制的访问次数
-- ARGV[2] 限制的时间
--

local key = "rate.limit:" .. KEYS[1]
local limit = tonumber(ARGV[1])
local expire_time = ARGV[2]

local is_exists = redis.call("EXISTS", key)
if is_exists == 1 then
    if redis.call("INCR", key) > limit then
        return 0
    else
        return 1
    end
else
    redis.call("SET", key, 1)
    redis.call("EXPIRE", key, expire_time)
    return 1
end
```
