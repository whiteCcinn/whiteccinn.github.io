---
title: 【数据库开发】msource
date: 2021-03-27 01:16:43
categories: [数据结构,数据库]
tags: [TiDB, RocketDB, Kafka, SQL]
---

# 前言

`CAP`原则又称CAP定理，指的是在一个分布式系统中，`一致性（Consistency）`、`可用性（Availability）`、`分区容错性（Partition tolerance）`。CAP 原则指的是，这三个要素最多只能同时实现两点，不可能三者兼顾。

`msource` 是我们的一个 `数据源组件`，我们所有的大数据ETL服务都构建在此之上，所以我们msource可以说是所有业务系统的核心。他维护着一个稳定，可靠，高性能的数据传输机制。让我们 `业务层` 中可以做各种操作，同步，异步等等。

msource 的角色我大体分为了2种：

- spout （数据推送组件)
- db （数据存储组件）

![ spout和db的关系 ](/images/数据库/spout_db_relation.png)

在这个图中，我们可以看到，db可以独立出来应用，他不依赖于spout。spout默认的传输机制是我们golang中的channel模式，但是它可以选择使用db模式。

# MSOURCE_DB

## RockesDB的基础知识

rocksdb 我们知道他是支持WAL（Write Ahead Log）的，一般的log文件中通常包括 `redo log` 和 `undo log`。其实这不仅仅是rocksdb独有的，这是一种可靠性的保证，像mysql一样有这种机制，也是分为`redo log`, `undo log`, `binlog`，区别就在于 `binlog` 属于逻辑日志，`redo log`和`undo log`属于物理日志。

rocksdb是facebook开发的一个`kv存储引擎`。他的机构模式是基于`LSM`的。基于LSM的架构都需要经过一个叫 `Compaction`  过程，通常Compaction涉及到三个放大因子。

Compaction需要在三者之间做取舍。

- 写放大 （Write Amplification）
- 读放大（Read Amplification）
- 空间放大 （Space Amplification）


后台的 compaction 来减少读放大（减少 SST 文件数量）和空间放大（清理过期数据），但也因此带来了写放大（Write Amplification）的问题。

### Compaction

#### 写放大

假设每秒写入10MB的数据，但观察到硬盘的写入是30MB/s，那么写放大就是3。写分为`立即写`和`延迟写`，比如`redo log`是立即写，传统基于B-Tree数据库`刷脏页`和`LSM Compaction`是延迟写。`redo log`使用`direct IO`写时至少以512字节对齐，假如log记录为100字节，磁盘需要写入512字节，写放大为5。

> DirectIO是直接操作IO，不经过BufferIO。
> BufferIO也称为标准IO，两个系统调用实现的：read() 和 write()。BufferIO用了操作系统内核的页缓存，保护了磁盘，减少读盘的次数，提高了读取速度。但是由于使用了页缓存，它是处于内核空间的，无法被用户直接操作，所以需要经历一次数据拷贝复制。
> DirectIO 数据均直接在用户地址空间的缓冲区和磁盘之间直接进行传输，中间少了页缓存的支持。读写数据的时候获得更好的性能。使用直接 I/O 读写数据必须要注意缓冲区对齐。

#### 读放大

对应于一个简单query需要读取硬盘的次数。比如一个简单query读取了5个页面，发生了5次IO，那么读放大就是 5。假如B-Tree的非叶子节点都缓存在内存中，point read-amp 为1，一次磁盘读取就可以获取到Leaf Block；short range read-amp 为1~2，1~2次磁盘读取可以获取到所需的Leaf Block。

操作需要从新到旧（从上到下）一层一层查找，直到找到想要的数据。这个过程可能需要`不止一次 I/O`。特别是 range query 的情况，影响很明显。

#### 空间放大

假设我需要存储10MB数据，但实际硬盘占用了30MB，那么空间放大就是3。有比较多的因素会影响空间放大，比如在Compaction过程中需要临时存储空间，空间碎片，Block中有效数据的比例小，旧版本数据未及时删除等等。

所有的写入都是顺序写 `append-only` 的，不是 `in-place update`，所以过期数据不会马上被清理掉。

### LSM 树

LSM 树的设计思想非常朴素, 它的原理是把一颗大树拆分成N棵小树， 它首先写入到内存中（内存没有寻道速度的问题，随机写的性能得到大幅提升），在内存中构建一颗有序小树，随着小树越来越大，内存的小树会flush到磁盘上。磁盘中的树定期可以做 merge 操作，合并成一棵大树，以优化读性能【读数据的过程可能需要从内存 memtable 到磁盘 sstfile 读取多次，称之为读放大】。RocksDB 的 LSM 体现在多 level 文件格式上，最热最新的数据尽在 L0 层，数据在内存中，最冷最老的数据尽在 LN 层，数据在磁盘或者固态盘上。

![ LSM合并过程 ](/images/数据库/log_structured_merge_tree.png)

### Rocksdb

RocksDB的三种基本文件格式是 `memtable` / `sstfile` / `logfile`，`memtable` 是一种内存文件数据系统，新写数据会被写进 `memtable`，部分请求内容会被写进 `logfile`。`logfile` 是一种有利于顺序写的文件系统。`memtable` 的内存空间被填满之后，会有一部分老数据被转移到 `sstfile` 里面，这些数据对应的 `logfile` 里的 `log` 就会被安全删除

单独的 Get/Put/Delete 是原子操作，要么成功要么失败，不存在中间状态。

如果需要进行批量的 Get/Put/Delete 操作且需要操作保持原子属性，则可以使用 WriteBatch。

![ LSM合并过程0 ](/images/数据库/L0.png)

L0 -> L1

![ LSM合并过程1 ](/images/数据库/L1.png)

L1 -> L2

![ LSM合并过程2 ](/images/数据库/L2.png)

L1 -> L2

![ 写入过程 ](/images/数据库/write_process.png)

可以看到主要的三个组成部分，内存结构`memtable`，类似事务日志角色的`WAL文件`，持久化的`SST文件`。

数据会放到内存结构`memtable`，当`memtable`的数据大小超过阈值(write_buffer_size)后，会`新生成一个memtable`继续写，将前一个memtable保存为`只读memtable`。当只读memtable的数量超过阈值后，会将`所有的只读memtable`合并并flush到磁盘生成一个`SST文件`。

这里的SST属于level0， level0中的每个SST有序，可能会有交叉。写入WAL文件是`可选的`，用来`恢复未写入到磁盘的memtable`。

memtable如其名为一种内存的数据结构。通过设置memtable的大小、总大小来控制何时flush到SST文件。大部分格式的memtable不支持并发写入，并发调用依然会依次写入。目前仅支持`skiplist`。

```yaml
rocksdb:
  options:
    # 如果数据库不存在是否自动建立
    # default: false
    create.if.missing: true
    # 如果数据库已经存在是否直接抛出异常
    # default: false
    error.if.exists: false
    # default: false
    paranoid.checks: false
    # 日志等级
    # Debug = 0/Info  = 1/Warn  = 2/Error = 3/Fatal = 4
    info.log.level: 3
    # 最佳值是内核（cpu）数
    # 默认RocksDB只使用一个后台线程进行flush和compaction
    # default: 1
    increase.parallelism: 4
    # 是否允许并发写入memtabe，目前仅支持skiplist
    # default: false
    allow.concurrent.memtable.writes: false
    # 更大的值可以提高性能，特别是在批量加载时
    # 此外，更大的写缓冲区在下次打开数据库时将导致更长的恢复时间
    write.buffer.size: 64 * 1024 * 1024
    # 最大写缓冲区数, 当一个写缓冲区被刷新到存储时，新的写操作可以继续到另一个写缓冲区
    # default: 2
    max.write.buffer.number: 4
    min.write.buffer.number.to.merge: 1
    max.open.files: 1000
    max.file.opening.threads: 16
    # 数据压缩方式
    # No = 0/ Snappy = 1 / ZLib = 2 / Bz2 = 3 / LZ4 = 4 / LZ4HC = 5 / Xpress = 6 / ZSTD = 7
    compression: 1
    # 设置数据库的level的数量
    # 默认值为7层
    num.levels: 7
    # level-0 触发合并的的文件数条件
    level0.file.num.compaction.trigger: 4
    # level-0 放慢写入速度的文件数条件
    level0.slowdown.writes.trigger: 8
    # level-0 停止写入的文件数条件
    level0.stop.writes.trigger: 12
    # 尝试从mem到sst的最大级别
    max.mem.compaction.level: 2
    # 目标文件基础大小
    # 如果 target_file_size_base是2MB,
    # target_file_size_multiplier是10，
    # 那么第1级的每个文件都是2MB
    # 第2级的每个文件是20MB
    # 第3级的每个文件是200MB
    target.file.size.base: &target_file_size_base 2 * 1024 * 1024
    # 目标基础文件倍数
    target.file.size.multiplier: 1
    # 所在level所有文件总大小
    # 例如，max_bytes_for_level_base为20MB,
    # max_bytes_for_level_multiplier为10，则第1级的总数据大小为20MB
    # 第2级的总文件大小为200MB
    # 第3级的总文件大小为2GB
    # default: 10M
    max.bytes.for.level.base: 10 * 1024 * 1024
    # 目标所在level总文件大小
    # default: 10
    max.bytes.for.level.multiplier: 10.0
    level.compaction.dynamic.level.bytes: false
    # 一次性最大打压缩字节
    # Default: target.file.size.base * 25
    max.compaction.bytes: *target_file_size_base * 25
    # 软限制：当需要压缩的估计字节数超过这个阈值时，所有的写都会被减速到至少 delayed_write_rate
    # default: 64GB
    soft.pending.compaction.bytes.limit: 64 * 1024 * 1024 * 1024
    # 硬限制：当需要压缩的估计字节数超过这个阈值时，所有的写都停止
    # default: 256GB
    hard.pending.compaction.bytes.limit: 256 * 1024 * 1024 * 1024
    # 是否使用fsync刷盘
    # default: false
    use.fsync: false
    # 指定数据库的日志目录的绝对路径，如果为空则和数据放在同一个目录
    # default: empty
    db.log.dir: ""
    # 指定数据库的WAL(预写入日志)的目录的绝对路径，如果为空则和数据放在同一个目录
    wal.dir: ""
    # 设置过期文件被删除的周期
    # 通过压缩过程超出作用域的文件在每次压缩时仍然会被自动删除，不管这个设置是什么
    # default: 6 hours
    delete.obsolete.files.period.micros: 6 * 60 * 60 * 1000 * 1000
    # 设置后台任务的最大并发数，作用与低优先级线程池
    # default: 1
    max.background.compactions: 2
    # 高优先级线程池的后台 memtable 的 flush 任务的最大并发数
    # 默认所有任务都在低优先级池
    # default: 0
    max.background.flushes: 0
    # 设置日志文件的最大大小，如果日志文件大于这个值将会被创建一个新的日志文件
    # 如果等于0，则日志只会写入一个日志文件
    # default: 0
    max.log.file.size: 0
    # 日志文件滚动的时间(以秒为单位)，日志按一定时间轮转
    # default: 0 (禁用状态)
    log.file.time.to.roll: 24 * 60 * 60
    # 最多保留的日志文件数
    # default: 1000
    keep.log.file.num: 30
    # 软速率限制
    # 当任何level的压缩分数超过soft_rate_limit时，put被延迟0-1毫秒。当 等于 0.0时，此参数将被忽略
    # soft_rate_limit <= hard_rate_limit。如果此约束不存在，RocksDB将设置soft_rate_limit = hard_rate_limit
    # default: 0.0(禁用状态)
    soft.rate.limit: 0.0
    # 硬速率限制
    # 当任何level的压缩分数超过hard_rate_limit时，put每次延迟1ms。当 小于等于 1.0 时，此参数被忽略
    # default: 0.0(禁用状态)
    hard.rate.limit: 0.0
    # 设置当强制执行hard_rate_limit时，put被停止的最大时间, 0 = 没有限制
    # default: 1000
    rate.limit.delay.max.milliseconds: 1000
    # 设置最大清单文件大小，直到滚动为止, 会删除旧的清单文件
    # 默认值:MAX_INT，这样滚动就不会发生
    max.manifest.file.size: 1<<64 - 1
    # 设置表缓存使用的分片数量
    # default: 4
    table.cache.numshardbits: 4
    # 设置扫描过程中的计数限制
    # 在表的LRU缓存数据回收时，严格遵循LRU是低效的，因为这块内存不会真正被释放，除非它的refcount降到零。
    # 相反，进行两次传递:第一次传递将释放refcount = 1的项，如果在扫描该参数指定的元素数量后没有足够的空间释放，将按LRU顺序删除项
    # default: 16
    table.cache.remove.scan.count.limit: 16
    # default: 0 (自动计算一个合适的值)
    arena.block.size: 0
    # 启用/禁用自动压缩
    # default: false
    disable.auto.compactions: false
    # 设置 Wal 的恢复模式
    # TolerateCorruptedTailRecordsRecovery = 0 / AbsoluteConsistencyRecovery = 1
    # PointInTimeRecovery = 2 / SkipAnyCorruptedRecordsRecovery = 3
    # default: 0
    w.a.l.recovery.mode: 0
    # 设置wal的ttl时间
    # 有2个值影响 归档的 wal 是否会被删除
    # 1。如果两者都设置为0，日志将被尽快删除，并且不会进入存档。
    # 2。如果wal_ttl_seconds为0,wal_size_limit_mb不为0，则每10分钟检查一次WAL文件，如果总大小大于wal_size_limit_mb，则从最早的文件开始删除，直到满足size_limit。所有的空文件将被删除。
    # 3。如果wal_ttl_seconds不为0,wall_size_limit_mb为0，那么每个wal_ttl_seconds / 2都会检查WAL文件，比wal_ttl_seconds老的文件会被删除。
    # 4。如果两个都不是0，则每10分钟检查一次WAL文件，并且两个检查都将在ttl优先的情况下执行。
    # default: 0
    w.a.l.ttl.seconds: 0
    # 设置WAL大小限制，单位为MB
    # 如果WAL文件的总大小大于wal_size_limit_mb，则从最早的文件开始删除，直到满足size_limit值为止
    # default: 0
    wal.size.limit.mb: 0
    # 允许管道写入
    # default: false
    enable.pipelined.write: false
    # 设置预分配(通过fallocate) manifest文件的字节数
    # 默认值是4mb，这对于减少随机IO以及防止预分配大量数据的挂载(例如xfs的allocsize选项)过度分配是合理的
    # default: 4mb
    manifest.preallocation.size: 1024 * 1024 * 4
    # 当memtable被刷新到存储中时[启用|禁用] 清除 [重复\被删除]的 键
    # default: true
    purge.redundant.kvs.while.flush: true
    # 开启/关闭sst表的mmap读功能
    # default: false
    allow.mmap.reads: false
    # 开启/关闭sst表的mmap写功能
    # default: false
    allow.mmap.writes: false
    # 启用/禁用读操作的直接I/O模式(O_DIRECT)
    # default: false
    use.direct.reads: false
    # 启用/禁用后台flush和compaction的直接I/O模式(O_DIRECT)
    # 当为true时，new_table_reader_for_compaction_inputs被强制为true。
    # default: false
    use.direct.i.o.for.flush.and.compaction: false
    # [开启|禁用] 子进程继承打开的文件
    # default: true
    is.fd.close.on.exec: true
    # [启用|禁用]在恢复时跳过日志损坏错误(如果客户端可以丢失最近的更改)
    # default: false
    skip.log.error.on.recovery: false
    # 设置统计转储周期，以秒为单位
    # default: 3600 (1 hour)
    stats.dump.period.sec: 3600
    # 当打开sst文件时，是否会提示底层文件系统文件访问模式是随机的
    # default: true
    advise.random.on.open: true
    # 设置所有列族写入磁盘之前在memtables中建立的数据量。
    # 这与write_buffer_size不同，后者强制对单个memtable进行限制
    # default: 0(禁用)
    db.write.buffer.size: 0
    # 压缩启动后的文件访问模式
    # NoneCompactionAccessPattern = 0, NormalCompactionAccessPattern = 1
    # SequentialCompactionAccessPattern = 2, WillneedCompactionAccessPattern = 3
    # default: NormalCompactionAccessPattern
    access.hint.on.compaction.start: 1
    # 启用/禁用自适应互斥锁，它在求助于内核之前在用户空间旋转
    # 当互斥锁不是严重竞争时，可以减少上下文切换。但是，如果互斥对象是热的，最终可能会浪费旋转时间
    # default: false
    use.adaptive.mutex: false
    # 允许操作系统在后台异步写入文件时增量同步文件到磁盘
    # 对每写一个bytes_per_sync发出一个请求。
    # default: 0(禁用)
    bytes.per.sync: 0
    # 设置压缩样式
    # LevelCompactionStyle = 0 / UniversalCompactionStyle = 1 / FIFOCompactionStyle = 2
    # default: LevelCompactionStyle
    compaction.style: 0
    # 指定迭代->Next()是否按顺序跳过具有相同user-key的键
    # 这个数字指定在重寻之前将被连续跳过的键数(与userkey相同)
    # default: 8
    max.sequential.skip.in.iterations: 8
    #[启用|禁用]线程安全的就地更新
    # default: false
    inplace.update.support: false
    # 用于就地更新的锁的数量
    # default: 0, ，如果 inplace_update_support = true ，则为 10000
    inplace.update.num.locks: 0
    # 设置memtable使用的arena的大页大小
    # 如果<=0，它不会从大页分配，而是从malloc分配。用户有责任为它预留巨大的页面以供分配。
    # 例如:sysctl -w vm.nr_hugepages=20
    # 参见linux doc Documentation/vm/hugetlbpage.txt
    # 如果没有足够的空闲大页，它会退回到malloc
    # 通过SetOptions() API动态更改
    memtable.huge.page.size: 0
    # 设置布隆过滤器的指针位置
    # 控制bloom filter探针的位置，以提高缓存遗漏率。
    # 该选项仅适用于memtable前缀bloom和plain前缀bloom。
    # 它本质上限制了每个bloom filter检查可以触及的缓存线的最大数量。
    # 设置为0时，此优化被关闭。这个数目不应该大于探测的数目。
    # 这个选项可以提高内存工作负载的性能，但应该小心使用，因为它可能会导致更高的误报率。
    # default: 0
    bloom.locality: 0
    # 设置memtable中一个键的最大连续合并操作数
    # default: 0 (禁用状态)
    max.successive.merges: 0
    # 开启统计
    # default: 无参数，false代表不启动，true则会调用对应的api
    enable.statistics: false
    # 预加载数据库为了批量加载
    # 所有数据将在0级没有任何自动压缩
    # 建议在从数据库读取数据之前手动调用CompactRange(NULL, NULL)，否则读取速度会非常慢
    # default: 无参数，false代表不启动，true则会调用对应的api
    prepare.for.bulk.load: false
    # 设置一个MemTableRep，它由一个向量支持
    # 在迭代时，向量被排序，这对于迭代非常少且读操作开始后通常不执行写操作的工作负载非常有用
    # default: 无参数，false代表不启动，true则会调用对应的api
    memtable.vector.rep: false
    # 如果不存在列族是否自动建立
    # default: true
    create.if.missing.column.families: true
```

## SQL-AST的支持

我们的db希望能做到与语言无关，不仅仅是我们的目前的golang，就算是php也可以用到本地持久化的方式的话，就需要借助`RPC协议`或者`特定DSL`来实现，但是既然是数据库，这里优先选择了以`sql语法`来管理数据。

那么我们就需要拿到`sql`的抽象语法树(`sql-ast`)，拿到`sql-ast`之后，我们就可以拿到我们所需要的信息去`hit data`。

[Pingcap-parser](github.com/pingcap/parser)

这里我们用到了pingcap公司的`parser`库，该库同样是`TiDB`的sql解析库，借助该库，我们可以很方便的拿到`sql-ast`

```go
package main

import (
	"fmt"
	"github.com/pingcap/parser"
	_ "github.com/pingcap/parser/test_driver"
)

type visitor struct {
	table  string
	fields []string
}

func (v *visitor) Enter(in ast.Node) (out ast.Node, skipChildren bool) {
	//fmt.Printf("Enter: %T\n", in)
	switch n := in.(type) {
	case *ast.SelectStmt:
	case *ast.FieldList:
	case *ast.SelectField:
	case *ast.ColumnNameExpr:
		//fmt.Printf("Enter: %v\n", n.Name)
	case *ast.ColumnName:
		//v.fields = append(v.fields, n.Name.L)
	case *ast.TableName:
		//v.table = n.Name.L
	case *ast.BinaryOperationExpr:
		//fmt.Printf("Enter: %v\n", n.Op)
	case *ast.Join:
		//fmt.Printf("Enter: %v\n", n.Left)
	}

	return in, false
}

func (v *visitor) Leave(in ast.Node) (out ast.Node, ok bool) {
	fmt.Printf("Leave: %T\n", in)

	switch n := in.(type) {
	case *ast.SelectStmt:
	case *ast.FieldList:
	case *ast.SelectField:
	case *ast.ColumnNameExpr:
	case *ast.ColumnName:
	case *ast.TableName:
		v.table = n.Name.L
	case *ast.BinaryOperationExpr:
		//fmt.Printf("Leave: %v\n", n.L)
	}

	return in, true
}

func main() {
	p := parser.New()

	sql := "SELECT emp_no, first_name, last_name " +
		"FROM employees " +
		"where id='Aamodt' and (create_time > 0 or last_name ='caiwenhui')"
	stmtNodes, _, err := p.Parse(sql, "", "")

	if err != nil {
		fmt.Printf("parse error:\n%v\n%s", err, sql)
		return
	}
	
	for _, stmtNode := range stmtNodes {
		v := visitor{}
		stmtNode.Accept(&v)
		fmt.Printf("%v\n", v)
	}
}
```

这里用到了`github.com/pingcap/parser/test_driver` 的原因是因为该库和tidb的driver存在依赖关系，tidb在设计的时候，并未做到很好的分离，所以当其他项目需要使用该库的时候，需要引入这个驱动。

```go
// Visitor visits a Node.
type Visitor interface {
	// Enter is called before children nodes are visited.
	// The returned node must be the same type as the input node n.
	// skipChildren returns true means children nodes should be skipped,
	// this is useful when work is done in Enter and there is no need to visit children.
	Enter(n Node) (node Node, skipChildren bool)
	// Leave is called after children nodes have been visited.
	// The returned node's type can be different from the input node if it is a ExprNode,
	// Non-expression node must be the same type as the input node n.
	// ok returns false to stop visiting.
	Leave(n Node) (node Node, ok bool)
}
```

并且这里，我们看到有一个结构体`visitor`，该结构体就是用来访问`ast`用的，因为 `tidb`的`parser库` 和`阿里巴巴` 的 `druid sql` 类似，都是采用 访问器的方式来遍历 `ast`的，所以我们只需要定义好我们的访问器，那么就可以访问对应的结构数据。
至于访问器的接口如上图，只有2个API，一个是 `Enter(n Node) (node Node, skipChildren bool)`，另外一个是 `Leave(n Node) (node Node, ok bool)` 。2个接口返回的第二个参数分别定义为 `是否跳过剩下的节点`, `是否成功退出节点`。

### interface在这里的应用

在parser中，大量运用了interface, 充分的给我们的展示了golang的`组合`特性。

例如：

```go
// Node is the basic element of the AST.
// Interfaces embed Node should have 'Node' name suffix.
type Node interface {
	// Restore returns the sql text from ast tree
	Restore(ctx *format.RestoreCtx) error
	// Accept accepts Visitor to visit itself.
	// The returned node should replace original node.
	// ok returns false to stop visiting.
	//
	// Implementation of this method should first call visitor.Enter,
	// assign the returned node to its method receiver, if skipChildren returns true,
	// children should be skipped. Otherwise, call its children in particular order that
	// later elements depends on former elements. Finally, return visitor.Leave.
	Accept(v Visitor) (node Node, ok bool)
	// Text returns the original text of the element.
	Text() string
	// SetText sets original text to the Node.
	SetText(text string)
}

// SelectStmt represents the select query node.
// See https://dev.mysql.com/doc/refman/5.7/en/select.html
type SelectStmt struct {
	dmlNode
	resultSetNode

	// SelectStmtOpts wraps around select hints and switches.
	*SelectStmtOpts
	// Distinct represents whether the select has distinct option.
	Distinct bool
	// From is the from clause of the query.
	From *TableRefsClause
	// Where is the where clause in select statement.
	Where ExprNode
	// Fields is the select expression list.
	Fields *FieldList
	// GroupBy is the group by expression list.
	GroupBy *GroupByClause
	// Having is the having condition.
	Having *HavingClause
	// WindowSpecs is the window specification list.
	WindowSpecs []WindowSpec
	// OrderBy is the ordering expression list.
	OrderBy *OrderByClause
	// Limit is the limit clause.
	Limit *Limit
	// LockTp is the lock type
	LockTp SelectLockType
	// TableHints represents the table level Optimizer Hint for join type
	TableHints []*TableOptimizerHint
	// IsAfterUnionDistinct indicates whether it's a stmt after "union distinct".
	IsAfterUnionDistinct bool
	// IsInBraces indicates whether it's a stmt in brace.
	IsInBraces bool
	// QueryBlockOffset indicates the order of this SelectStmt if counted from left to right in the sql text.
	QueryBlockOffset int
	// SelectIntoOpt is the select-into option.
	SelectIntoOpt *SelectIntoOption
}

func splitWhere(where ast.ExprNode) []ast.ExprNode {
	var conditions []ast.ExprNode
	switch x := where.(type) {
	case nil:
	case *ast.BinaryOperationExpr:
		if x.Op == opcode.LogicAnd {
			conditions = append(conditions, splitWhere(x.L)...)
			conditions = append(conditions, splitWhere(x.R)...)
		} else {
			conditions = append(conditions, x)
		}
	case *ast.ParenthesesExpr:
		conditions = append(conditions, splitWhere(x.Expr)...)
	default:
		conditions = append(conditions, where)
	}
	return conditions
}

```

`ast.Node` 是ast的基础接口，所有的节点都需要在此之上实现自己的功能。其他接口同理，一环扣一环，设计得十分巧妙。


## KEY-VALUE的编码规则

DB 对每个表分配一个 TableID，每一个索引都会分配一个 IndexID，每一行分配一个 RowID， 其中 DbId/TableID 在整个集群内唯一，IndexID/RowID 在表内唯一，这些 ID 都是 int64 类型。

其中细节如下：

database 编码成 Key-Value pair：

```
Key: metaPrefix(+)databasePrefix{dbID}
Value: database struct json marshal
```

database indexed 编码成 Key-Value pair：

```
Key: metaPrefix(+)databasePrefix_indexPrefix{database_name}
Value: dbID
```

table 编码成 Key-Value pair：

```
Key: metaPrefix(+)tablePrefix{dbID}_recordPrefixSep{tableID}
Value: table struct json marshal
```

table indexed 编码成 Key-Value pair：

```
Key: metaPrefix(+)tablePrefix{dbID}_indexPrefix{databaseId}{table_name}
Value: tableID
```

每行数据按照如下规则进行编码成 Key-Value pair：

```
Key: databasePrefix{dbID}_tablePrefix{tableID}_recordPrefixSep{rowID}
Value: [col1, col2, col3, col4]
```

对于 Unique Index 数据，会按照如下规则编码成 Key-Value pair：

```
Key: databasePrefix{dbID}_tablePrefix{tableID}_indexPrefixSep{indexID}_indexedColumnsValue
Value: rowID
```

Index 数据还需要考虑 Unique Index 和非 Unique Index 两种情况，对于 Unique Index，可以按照上述编码规则。 但是对于非 Unique Index，通过这种编码并不能构造出唯一的 Key，因为同一个
Index 的 `databasePrefix{dbID}_tablePrefix{tableID}_indexPrefixSep{indexID} `都一样，可能有多行数据的 ColumnsValue 是一样的.

对于 "非" Unique Index 的编码做了一点调整：

```
Key: databasePrefix{dbID}_tablePrefix{tableID}_indexPrefixSep{indexID}_indexedColumnsValue_{rowID}
Value: null
```

对应的标识符如下定义：

```go
var (
	databasePrefix  = []byte{'d'}
	tablePrefix     = []byte{'t'}
	recordPrefixSep = []byte("_r")
	indexPrefixSep  = []byte("_i")
	metaPrefix      = []byte{'m'}
	sepPrefix       = []byte{'_'}

	mdPrefix  = append(metaPrefix, databasePrefix...)
	mdiPrefix = append(append(metaPrefix, databasePrefix...), indexPrefixSep...)
	mtPrefix  = append(metaPrefix, tablePrefix...)
	mtiPrefix = append(append(metaPrefix, tablePrefix...), indexPrefixSep...)
)

const (
	idLen                = 8
	sepPrefixLen         = 1
	prefixLen            = databasePrefixLength + idLen /*dbID*/ + sepPrefixLen + tablePrefixLength + idLen /*tableID*/ + recordPrefixSepLength
	uniqPrefixLen        = databasePrefixLength + idLen /*dbID*/ + sepPrefixLen + tablePrefixLength + idLen /*tableID*/ + indexPrefixSepLength + idLen /*indexID*/ + sepPrefixLen /* +indexedColumnsValue */
	indexPrefixLen       = databasePrefixLength + idLen /*dbID*/ + sepPrefixLen + tablePrefixLength + idLen /*tableID*/ + indexPrefixSepLength + idLen /*indexID*/ + sepPrefixLen + sepPrefixLen
	indexPrefixLenWithID = databasePrefixLength + idLen /*dbID*/ + sepPrefixLen + tablePrefixLength + idLen /*tableID*/ + indexPrefixSepLength + idLen /*indexID*/ + sepPrefixLen + sepPrefixLen + idLen
	// RecordRowKeyLen is public for calculating avgerage row size.
	RecordRowKeyLen       = prefixLen + idLen /*handle*/
	tablePrefixLength     = 1
	databasePrefixLength  = 1
	recordPrefixSepLength = 2
	indexPrefixSepLength  = 2
	metaPrefixLength      = 1
	mdPrefixLen           = metaPrefixLength + databasePrefixLength
	mdiPrefixLen          = mdPrefixLen + indexPrefixSepLength
	mtPrefixLen           = metaPrefixLength + tablePrefixLength
	mtiPrefixLen          = mtPrefixLen + indexPrefixSepLength
)
```
我们把rowkey的编码规则来看

```go
// EncodeRowKey encodes the table id and record handle into a kv.Key
// EncodeRowKey databasePrefix{dbID}_tablePrefix{tableID}_recordPrefixSep{rowID}
func EncodeRowKey(databaseId, tableID, rowId int64) kv.Key {
	buf := make([]byte, 0, prefixLen+idLen /*rowId*/)
	buf = append(buf, databasePrefix...)
	buf = append(buf, EncodeIdBuf(databaseId)...)
	buf = append(buf, sepPrefix...)
	buf = append(buf, tablePrefix...)
	buf = append(buf, EncodeIdBuf(tableID)...)
	buf = append(buf, recordPrefixSep...)
	buf = append(buf, EncodeIdBuf(rowId)...)

	return buf
}

func EncodeIdBuf(id int64) kv.Key {
	var buf = make([]byte, 8)
	binary.BigEndian.PutUint64(buf[:], uint64(id))

	return buf
}

func DecodeIdBuf(b []byte) int64 {
	return int64(binary.BigEndian.Uint64(b))
}
```

这里我们通过`EncodeRowKey(databaseId, tableID, rowId int64) kv.Key` 来生成数据的`row-key`，我们利用`make([]byte,0, len)` 的方式预申请内存的方式，后面再通过append的方式往 `slice` 中不断追加字节，当遇到`int64`的数据的时候，我们会调用`EncodeIdBuf(id int64) kv.Key` 来把int64转换为 `大端(网络字节序)` 的二进制字节。最后一个row-key就生成了。


### database 编码

```go
type database struct {
	Id   int64
	Name string
}

// createDatabaseHandle Create database
func (s *Store) createDatabaseHandle(result *Result, stmt *ast.CreateDatabaseStmt) {
	indexedKey := etccodec.EncodeDatabaseMetaIndexedKey([]byte(stmt.Name))
	rdb := rocksdb.Load().(*Rocksdb)
	slice, err := rdb.Get(rdb.NewDefaultReadOptions(), indexedKey)

	if err != nil {
		errorlog(UnexpectErrorCategory{}, UnknowRCode)
		result.Record(UnknowRCode, nil)
		return
	}

	if slice.Exists() {
		if !stmt.IfNotExists {
			errorlog(UnexpectErrorCategory{}, DatabaseExistsRCode)
			result.Record(DatabaseExistsRCode, nil)
		} else {
			result.Success()
		}
		return
	}

	dbId, err := getDatabaseId()
	if err != nil {
		msg := fmt.Sprintf("get database id failed, err: %s", err)
		errorlog(UnexpectErrorCategory{}, msg)
		result.Record(CreateDatabaseFailedRCode, &msg)
		return
	}
	db := &database{
		Id:   dbId,
		Name: stmt.Name,
	}
	var buf = etccodec.EncodeIdBuf(dbId)
	key := etccodec.EncodeDatabaseMetaKey(dbId)
	value, err := json.Marshal(db)
	if err != nil {
		msg := fmt.Sprintf("marshal database error, err: %s", err)
		errorlog(UnexpectErrorCategory{}, msg)
		result.Record(CreateDatabaseFailedRCode, &msg)
		return
	}

	err = rdb.Put(key, value)
	if err != nil {
		msg := fmt.Sprintf("rocksdb put metadata failed, err: %s", err)
		errorlog(UnexpectErrorCategory{}, msg)
		result.Record(CreateDatabaseFailedRCode, &msg)
		return
	}
	err = rdb.Put(indexedKey, buf)
	if err != nil {
		msg := fmt.Sprintf("rocksdb put indexed failed, err: %s", err)
		errorlog(UnexpectErrorCategory{}, msg)
		result.Record(CreateDatabaseFailedRCode, &msg)
		return
	}
	debugf(NormalDebugCategory{}, "create database [%s]", db)
	result.Success()
}
```

这里，我们借助 `create database stmt` 来的处理方法来看看 `db Key-Value pair` 的处理逻辑。
我们看到这里，我们通过一个`stmt.Name` 来拿到数据库的名，并且调用` etccodec.EncodeDatabaseMetaIndexedKey([]byte(stmt.Name))` 方法来创建符合`metaPrefix(+)databasePrefix_indexPrefix{database_name}` 索引的key，然后判断是否存在所以索引来判断后续的逻辑。
我们通过一个 `getDatabaseId()` 方法来获取一个全局的数据库id，并且初始化`type database struct`，然后我们调用了 `etccodec.EncodeDatabaseMetaKey(dbid)` 来对key进行生成，也就是上面所列出来的 `metaPrefix(+)databasePrefix{dbID}`, 接下来就是`value`的生成，这里的value比较直接，就是`json.marshal`来处理后的字节。然后我们把数据`put` 到`rocksdb`就结束了，索引数据也是如此，不过索引存储的dbid。

> table的编码也类似

如果对其他的`stmt`，例如`insert stmt/delete stmt`具体的逻辑感兴趣的话，可以查阅源码，但是类似差不多。

todo : 画图

## COUNTER计数器-发号器

这里我们需要讲一下`counter`，因为我们所有的数据都会有`row_id`，并且我们在`create table`的时候也有`AUTO_INCREMENT`的列，这个时候，我们也是需要一个ID发号器。

目前常见的发号器实现方案如下：

- 1.  UUID
- 2. snowflake
- 3. 数据库生成
- 4. 美团的Leaf（基于数据库）

### UUID

UUID(Universally Unique Identifier)的标准型式包含`32个16进制`数字，以连字号分为`五段`，形式为`8-4-4-4-12`的36个字符，示例：`550e8400-e29b-41d4-a716-446655440000`，到目前为止业界一共有5种方式生成UUID，详情见IETF发布的UUID规范 [A Universally Unique IDentifier (UUID) URN Namespace](https://www.ietf.org/rfc/rfc4122.txt)

![ UUID ](/images/数据库/uuid.png)

> 由于他的无序性，不符合我们所期待的增长序列，所以抛弃

### 类snowflake方案

这种方案大致来说是一种以划分命名空间（UUID也算，由于比较常见，所以单独分析）来生成ID的一种算法，这种方案把64-bit分别划分成多段，分开来标示机器、时间等，比如在snowflake中的64-bit分别表示如下图所示：

![ snowflake ](/images/数据库/snowflake.png)

> 生成繁琐，由多个指令码组成，并且我们不需要用到分布式，这个还对本地的时间有强依赖，不够简洁

### 基于数据库的

基于数据库的其实就是利用自增的自增机制+发号机制的组合，但是由于我们这里不基于数据库，所以给予数据库的基本也不考虑，但是其中的发号机制可以参考。例如：预分配机制。

### 自己的发号器

```go
package msource

import (
	"fmt"
	"gitlab.mingchao.com/basedev-deps/gorocksdb"
	"os"
	"os/signal"
	"reflect"
	"strconv"
	"syscall"
	"time"
)

type counter struct {
	*gorocksdb.ReadOptions

	IdKey []byte

	GroupId string

	idChan chan int64

	sig chan os.Signal
}

func (c *counter) UnmarshalJSON(data []byte) (err error) {
	c.IdKey = data[1 : len(data)-1]

	turboNew(c)

	return
}

func (c *counter) MarshalJSON() ([]byte, error) {
	b := make([]byte, 0, len(c.IdKey)+2)
	b = append(b, '"')
	b = append(b, c.IdKey...)
	b = append(b, '"')
	return b, nil
}

func (c *counter) String() string {
	t := reflect.TypeOf(c).Elem()
	v := reflect.ValueOf(c).Elem()
	p := fmt.Sprintf("%s {", t.Name())
	for i := 0; i < v.NumField(); i++ {
		if v.Field(i).CanInterface() {
			if v.Field(i).Kind() == reflect.Slice {
				p += fmt.Sprintf("\n\t %s(%s): %s", t.Field(i).Name, t.Field(i).Type, string(v.Field(i).Bytes()))
			} else {
				p += fmt.Sprintf("\n\t %s(%s): %v", t.Field(i).Name, t.Field(i).Type, v.Field(i).Interface())
			}
		}
	}
	p += "\n}"

	return p
}

func NewCounter(prefix string) *counter {
	return newCounter(prefix)
}

func newCounter(prefix string, args ...interface{}) *counter {
	c := new(counter)
	if len(args) > 0 {
		c.GroupId = args[0].(string)
	}
	c.IdKey = []byte(fmt.Sprintf("%s:%s", prefix, c.GroupId))

	turboNew(c)

	return c
}

func turboNew(c *counter) {
	ct := custom.Load().(*Custom)
	c.idChan = make(chan int64, ct.IdStep)
	c.sig = make(chan os.Signal, 1)
	c.ReadOptions = gorocksdb.NewDefaultReadOptions()
	signal.Notify(c.sig, syscall.SIGINT, syscall.SIGTERM)

	c.sender()
}

func (c *counter) sender() {
	go func() {
		ct := custom.Load().(*Custom)
		for {
			select {
			case <-c.sig:
				close(c.idChan)
				return
			default:
				if len(c.idChan) < ct.IdStep/10 {
					rdb := rocksdb.Load().(*Rocksdb)
					if c.ReadOptions == nil {
						c.ReadOptions = gorocksdb.NewDefaultReadOptions()
					}
					slice, err := rdb.Get(c.ReadOptions, c.getIdKey())
					if err != nil {
						fatal(UnexpectErrorCategory{"counter sender error"}, err)
					} else {
						var idStr string
						if slice.Exists() && slice.Size() > 0 {
							idStr = string(slice.Data())
						} else {
							idStr = "0"
						}

						cid, err := strconv.ParseInt(idStr, 10, 64)
						if err != nil {
							fatal(UnexpectErrorCategory{"counter sender error"}, err)
						} else {
							ct := custom.Load().(*Custom)
							// id回滚
							if ((1<<63-1)/2)-ct.IdStep < ct.IdStep {
								cid = 0
							}
							nextId := cid + int64(ct.IdStep)
							err = c.ackId(nextId)
							if err != nil {
								fatal(UnexpectErrorCategory{"counter sender error"}, err)
							}
							for cid < nextId {
								cid++
								c.idChan <- cid
							}
						}
					}
				} else {
					time.Sleep(50 * time.Millisecond)
				}
			}
		}
	}()
}

// Rocksdb to get a globally unique self increment ID
func (c *counter) getId() (int64, error) {
	id := <-c.idChan
	return id, nil

	//return -1, GetIdError{bytes2string(c.IdKey)}
}

func (c *counter) GetId() (int64, error) {
	return c.getId()
}

func (c *counter) ackId(id int64) error {
	rdb := rocksdb.Load().(*Rocksdb)
	err := rdb.Put(c.getIdKey(), []byte(strconv.FormatInt(id, 10)))
	if err != nil {
		return err
	}

	return nil
}

func (c *counter) AckId(id int64) error {
	return c.ackId(id)
}

// Gets the key of the ID
func (c *counter) getIdKey() []byte {
	return c.IdKey
}
```

这里我们优先考虑可以通过内存直接通过`++`或者`+1操作符`分配的方式。我们重点看到：

```go
nextId := cid + int64(ct.IdStep)
err = c.ackId(nextId)
for cid < nextId {
	cid++
	c.idChan <- cid
}
```

可以再这里看到，我们通过拿到当前cid的数值，通过`idStep`来增加固定的步长，然后先通过回写nextId的值到rocksdb进行持久化，再通过`for`循环来对cid进行叠加，每次都推送到`有缓冲区`的`idChan`中。


```go
// Rocksdb to get a globally unique self increment ID
func (c *counter) getId() (int64, error) {
	id := <-c.idChan
	return id, nil
}

func (c *counter) GetId() (int64, error) {
	return c.getId()
}
```

通过 `func (c *counter) getId() (int64, error) ` 来消费`idChan`中的id，达到一个获取id的效果。 

```go
// id回滚
if ((1<<63-1)/2)-ct.IdStep < ct.IdStep {
	cid = 0
}
```

我们看到这里有一行代码，当int64的cid已经到达分配的极限了，那么cid就会进行回滚，基本保证了发号的可重复利用性。

扩展问题：id回溯了，怎么做递增判断？

这个问题其实有点类似tcp的syn回溯的问题。因为syn一开始是随机生成的，并且这个过程了syn是会不断增加的。当syn到达分配的极限进行了回溯的时候，如何比较大小？

我们查看到内核的tcp源码，可以看到提供的判断方式十分巧妙，如下：

```c
/*
* The next routines deal with comparing 32 bit unsigned ints
* and worry about wraparound (automatic with unsigned arithmetic).
*/
static inline int before(__u32 seq1, __u32 seq2)
{
return (__s32)(seq1-seq2) < 0;
}
#define after(seq2, seq1) before(seq1, seq2)
```

为什么`（__s32）(seq1-seq2)<0`就可以判断`seq1<seq2`呢？这里的`__s32`是有符号整型的意思，而`__u32`则是无符号整型。
为了方便说明，我们以`unsigned char`和`char`为例来说明：

假设seq1=255， seq2=1（发生了回绕）
seq1 = 1111 1111 seq2 = 0000 0001
我们希望比较结果是 `seq1<seq2`

```
 seq1 - seq2=
 1111 1111
-0000 0001
-----------
 1111 1110
```

由于我们将结果转化成了有符号数，`由于最高位是1`，因此结果是`一个负数`，负数的绝对值为
 0000 0001 + 1 = 0000 0010 = 2 (补码：取反+1)

因此 `seq1 - seq2 < 0`

注意：

如果seq2=128的话，我们会发现：

```
 seq1 - seq2=
 1111 1111
-1000 0000
-----------
 0111 1111
```

此时结果尤为正了，判断的结果是`seq1>seq2`。因此，上述算法正确的前提是，`回绕后的增量小于2^(n-1)-1`。

由于tcp序列号用的`32位无符号数`，因此可以支持的`回绕幅度是2^31-1`，满足要求了。

> 但是由于我们这里不需要比较发号的先后次序，只需要保证其唯一性，所以这个回溯的大小比较问题，并不需要过多的关注

## 行级锁的实现

```go

var (
	// dbID:tblID
	// dbID:tblID:rowID
	rowLockLock sync.RWMutex
	rowLock     rl
	ttlTime     = int64(30 * 60)
)

type (
	rl map[string]*lock

	lock struct {
		ttl  int64
		lock sync.RWMutex
	}
}

func init() {
	// clean row lock, release memory
	go func() {
		t := time.NewTicker(10 * time.Minute)
		for {
			select {
			case <-t.C:
				ct := time.Now().Unix()
				rowLockLock.Lock()
				for key, lock := range rowLock {
					if ct > lock.ttl {
						delete(rowLock, key)
					}
				}
				rowLockLock.Unlock()
			}
		}
	}()

	rowLock = make(rl, 10)
}

func rowLockKey(dbId, tblId, rowId int64) string {
	return fmt.Sprintf("%d:%d:%d", dbId, tblId, rowId)
}

func (r *rl) Lock(lockKey string) {
	rowLockLock.Lock()
	m, ok := (*r)[lockKey]
	if !ok {
		m = new(lock)
		(*r)[lockKey] = m
		m.ttl = time.Now().Unix() + ttlTime
	}
	rowLockLock.Unlock()

	m.lock.Lock()
}

func (r *rl) UnLock(lockKey string) {
	rowLockLock.Lock()
	m, ok := (*r)[lockKey]
	if !ok {
		m = new(lock)
		(*r)[lockKey] = m
		m.ttl = time.Now().Unix() + ttlTime
	}
	rowLockLock.Unlock()

	m.lock.Unlock()
}

func (r *rl) RLock(lockKey string) {
	rowLockLock.Lock()
	m, ok := (*r)[lockKey]
	if !ok {
		m = new(lock)
		(*r)[lockKey] = m
		m.ttl = time.Now().Unix() + ttlTime
	}
	rowLockLock.Unlock()

	m.lock.RLock()
}

func (r *rl) RUnlock(lockKey string) {
	rowLockLock.Lock()
	m, ok := (*r)[lockKey]
	if !ok {
		m = new(lock)
		(*r)[lockKey] = m
		m.ttl = time.Now().Unix() + ttlTime
	}
	rowLockLock.Unlock()

	m.lock.RUnlock()
}
```

以上是行级锁的实现方式，主要是利用`sync.RWMutex`来实现读写锁，并且带有ttl的机制，每次加锁的时候，都会更新ttl的时间。
其中在`init阶段`，我们利用的ticker来实现对锁进行一个类似`LRU`的机制，对于不活跃的锁对象进行释放，防止在这里造成内存只增不减。

```go
func (s *Store) updateHandle(result *Result, stmt *ast.UpdateStmt) {
	// 通过ast获取old数据
	....
	// 行级锁锁定 
	rowID, _ := item[0].(json2.Number).Int64()
	rowlockKey := rowLockKey(db.Id, tbl.Id, rowID)
	rowLock.Lock(rowlockKey)
	defer rowLock.UnLock(rowlockKey)

	// 更新索引数据
	for _, index := range indexs {
		...
	}
	
	// 更新为new数据
	...
}
```

## 逆波兰表达式 && 波兰表达式

这一块其实暂时还没实现，但是他的原理有必要和大家说一下，我们的db实现，都是基于`sql` 来实现的，我们知道 `sql` 中也有表达式计算，并且是有优先级之分的。

`前/中/后`序遍历，相信大家基本都听说过，但是实际运用中少之又少，这是因为大家可能在实际中没有找到合适的模式和套用这些树的遍历方式。

- 前序遍历：根结点 ---> 左子树 ---> 右子树

- 中序遍历：左子树---> 根结点 ---> 右子树

- 后序遍历：左子树 ---> 右子树 ---> 根结点

例如：

```sql
SELECT (count * price) AS sum FROM orders WHERE order_id < 100 
```

其中 `order_id < 10` 就是一个表达式，它有一个列输入参数： `order_id`，输出：`Bool`

### RPN 表达式(逆波兰表示法)

RPN 是树的`后序遍历`，后序遍历在每个节点知道自己有几个子节点的时候等价于原本的树结构。

> 所以你波澜是后序遍历：`左右中`

比如说我们有一个数学算式 `2 *（3 + 4）+ 5`：

![ RPN ](/images/数据库/RPN.png)

由于数学上习惯写法是`中序遍历`，我们通常要加上括号消除歧义（比如加减和乘除的顺序）。通过把操作符后移 我们得到 `RPN：2 3 4 + * 5 +`，这样我们无需括号就能无歧义地遍历这个表达式：

`中序表达式`转`后序表达式`：

```
原式：a+b*(c+d/e)
补全括号：(a+(b*(c+(d/e))))
操作符右移：(a(b(c(de)/)+)*)+
去掉括号：abcde/+*+
```

> 所以波兰表达式是中序遍历：`左右中`

![ RPN ](/images/数据库/RPN2.png)

执行 RPN 的过程需要一个`栈`来缓存中间结果，比如说对于 `2 3 4 + * 5 +`，我们`从左到右`遍历表达式，遇到值就压入栈中。直到 `+` 操作符，栈中已经压入了 `2 3 4`。

![ RPN ](/images/数据库/RPN3.png)

因为 `+` 是二元操作符，需要从栈中弹出两个值 `3 4`，结果为 `7`，`重新`压入栈中：

![ RPN ](/images/数据库/RPN4.png)

此时栈中的值为 `2 7`。

![ RPN ](/images/数据库/RPN5.png)

下一个是 `*` 运算符，也需要弹出两个值 `2 7`，结果为 `14` 压入栈中。

![ RPN ](/images/数据库/RPN6.png)

接着压入 `5` 。

![ RPN ](/images/数据库/RPN7.png)

最后 `+` 运算符弹出 `14 5`，结果为 `19` ，压入`栈`。

![ RPN ](/images/数据库/RPN8.png)

最后留在栈里的就是表达式的结果，因此，如果需要计算表达式优先级的话，可以采用RPN的方式来读取tree结构来进行顺序计算。

## 单独使用DB例子：

![ db-debug ](/images/数据库/db-debug.png)

这里有一个类似于`mysql-client` 的一个 `bin` 程序

```go
package main

import (
	"flag"
	"github.com/pingcap/parser"
	"github.com/pingcap/parser/ast"
	"gitlab.mingchao.com/basedev-deps/logbdev"
	"gitlab.mingchao.com/basedev-deps/msource/v2"
	"os"
)

var sql = flag.String("sql", "", "Input Your Sql")

func init() {
	flag.Parse()
}

func main() {
	if os.Getenv("DEBUG") == "true" {
		logbdev.SetLevel(logbdev.DebugLevel)
	}

	msource.PreparePhase()
	store := msource.NewStore()

	p := parser.New()
	stmtNode, err := p.ParseOneStmt(*sql, "", "")
	if err != nil {
		logbdev.Error(err)
		return
	}

	_, ok := stmtNode.(*ast.SelectStmt)
	var r *msource.Result
	if ok {
		r, err = store.Query(*sql)
		if err != nil {
			logbdev.Error(err)
			return
		}
	} else {
		r, err = store.Execute(*sql)
		if err != nil {
			logbdev.Error(err)
			return
		}
	}

	if r != nil {
		if r.Data != nil {
			switch ar := r.Data.(type) {
			case *msource.InsertResultData:
				logbdev.Info(ar.GetSliceInt64())
				logbdev.Info(ar.Raw())
			case *msource.ShowDatabasesResultData:
				logbdev.Info(ar.GetSliceString())
			case *msource.ShowTablesResultData:
				logbdev.Info(ar.GetSliceString())
			case *msource.SelectResultSetData:
				logbdev.Info(ar.GetFields())
				logbdev.Info(ar.GetValues())
				logbdev.Info(ar.Count())
			case *msource.DeleteResultData:
				logbdev.Info(ar.GetAffected())
			case *msource.UpdateResultData:
				logbdev.Info(ar.GetAffected())
			}
		}
		logbdev.Info(r)
	}
}
```

具体用法：

```
go run example/msource_db/customStmt/main.go --sql "INSERT INTO users(\`name\`,\`age\`,\`last_login\`) VALUES (\"caiwenhui\", 18, 1614776101)"
go run example/msource_db/customStmt/main.go --sql "show databases;"
go run example/msource_db/customStmt/main.go --sql "show tables;"
go run example/msource_db/customStmt/main.go --sql "INSERT INTO mingchao.users2(\`name\`,\`age\`) VALUES (\"caiwenhui\", 18),(\"caiwenhui\", 19)"
go run example/msource_db/customStmt/main.go --sql "INSERT INTO mingchao.users2 VALUES (1000,\"caiwenhui\", 18)"
```

我们可以用对外暴露一个`msource.NewStore()`来创建一个存储器对象，然后通过API进行`数据库`的操作。

> NewStore我们用了sync.Pool封装，对象可以做到尽可能的复用。

可以看到如果是`SELECT STMT`的话，我们调用的是`QUERY`API，如果是`非SELECT STMT`的话，我们调用的是`EXECUTE`API。

## TODO

基于目前尚未实现，所以暂时不再展开讲叙，后续可以升级处理的点为：

- 事务处理，例如前面所说的`redolog`和`undolog`可实现。
- orderby， 数据排序。
- 全双工的通信获取数据，无需一次性读取所有数据。
- Explain执行计划的实现，逻辑根据执行计划走。

# SPOUT

另外一篇文章中，记录了我们的`spout`的作用，在这里，再简单说一下，`spout` 是我们`msource`组件的核心角色，它是用于把数据推送到上层业务的所使用。上层业务通过`spout`角色提供的`API`，可以获取到从数据源拿到的数据。

`spout` 自身保持了一套 `高可靠`, `高性能`, `可容错` 的数据机制，主要用于区别出`ACK`, `NACK`，并且自带有 `失败重传`, `多阶段状态机的checkpoint`等机制。

## channel-mode 大体数据流程图

![ channel-mode ](/images/数据库/channel-mode.png)

之前有一篇文章，专门讲解channel-mode下，是如何工作的，这里不做过多详细的说明。简单复述一下。

channel模式下，是直接把数据推送到我们的`golang`的`channel` 当中，上层业务直接用过channel拿到数据，拿到数据后根据自身业务处理数据来判断可以ack或者nack掉数据，同时保存offset。

这里的问题就在于：

> 由于我们是本地存储的offset，因为`不信任` kafka-client的`auto-commit`机制，当程序在某个节点crash的时候，这会让我们的程序在下次启动的时候，重复消费到数据或者遗漏数据

缺点：每个partition的offset都需要顺序消费，在上层业务无法并发处理，这极大程度的降低了我们的消费效率

期望：如果我们提前把offset存储起来了，而不需要`ACK`之后再存储offset的话，那么我们就可以再上层业务并发的处理消息，而无需关注offset的问题

## db-demo 大体数据流程图

![ db-mode ](/images/数据库/db-mode.png)

鉴于`channel-mode`下的缺点，由此诞生了我们的`db-mode`，其原理是把数据先存储在本地的数据库，也就是我们上面所说的`db`，所以这里我们可以得出关系`spout <- db`， `db角色` 可以被 `spout角色`所依赖。

我们创建了4个表来存储不同的数据：

```go
const (
	DefaultDatabase = "default"
	DefaultDatabaseSql = "CREATE DATABASE IF NOT EXISTS `" +
		DefaultDatabase +
		"`"
	UseDefaultDatabase = "USE `" +
		DefaultDatabase +
		"`"

	// 推送消息的时候使用
	// 因为正常消息过来的时候是没有row_id的，所以这个payload_marshal内的row_id没意义
	// 该表仅仅遍历数据到Runner表，到了Runner表和Loser表，Row_id才有用
	SpoutStoreStorageTable         = "storage"
	SpoutStoreStorageBuildTableSql = "create table if not exists " + SpoutStoreStorageTable +
		"(" +
		"	`payload_marshal` varchar(255) not null comment \"序列化后的payload\"," +
		"	`is_multi_phase` int(11) not null default 0 comment \"是否多阶段，0=否, 1=是\"," +
		"	`cur_state` int(11) not null default 0 comment \"当前状态\"," +
		"	`fin_state` int(11) not null default 0 comment \"最终状态\"" +
		")"

	// Storage -> Runner 使用
	// 刚启动服务的时候Runner->Storage有用
	// Ack的时候有用
	SpoutStoreRunningTable         = "runner"
	SpoutStoreRunningBuildTableSql = "create table if not exists " + SpoutStoreRunningTable +
		"(" +
		"	`payload_marshal` varchar(255) not null comment \"序列化后的payload\"," +
		"	`is_multi_phase` int(11) not null default 0 comment \"是否多阶段，0=否, 1=是\"," +
		"	`cur_state` int(11) not null default 0 comment \"当前状态\"," +
		"	`fin_state` int(11) not null default 0 comment \"最终状态\"" +
		")"

	// Runner -> Loser 使用
	// Nack的时候有用
	// 失败重传的时候用/刚启动服务的时候Loser->Storage有用
	SpoutStoreLoserTable         = "loser"
	SpoutStoreLoserBuildTableSql = "create table if not exists " + SpoutStoreLoserTable +
		"(" +
		"	`payload_marshal` varchar(255) not null comment \"序列化后的payload\"," +
		"	`is_multi_phase` int(11) not null default 0 comment \"是否多阶段，0=否, 1=是\"," +
		"	`cur_state` int(11) not null default 0 comment \"当前状态\"," +
		"	`fin_state` int(11) not null default 0 comment \"最终状态\"" +
		")"

	SpoutStoreDefaultOffsetTable         = "offset"
	SpoutStoreDefaultOffsetBuildTableSql = "create table if not exists " + SpoutStoreDefaultOffsetTable +
		"(" +
		"	`group_id` varchar(255) not null comment \"消费组\"," +
		"	`topic` varchar(255) not null comment \"消费的topic\"," +
		"	`partition` int(11) not null comment \"topic的partition\"," +
		"	`offset` int(11) not null comment \"当前消费的offset\"," +
		"    UNIQUE KEY `uniq_idx` (`group_id`,`topic`,`partition`)" +
		")"
)
```

![ phase-deal-with ](/images/数据库/phase-deal-with.png)

## DB模式下的用法例子：

> channel-mode下的例子和db模式的差不多，但是更加简单，这里就不列出来了。

```go
package common

import (
	"context"
	"gitlab.mingchao.com/basedev-deps/logbdev"
	"gitlab.mingchao.com/basedev-deps/msource/v2"
	"os"
	"os/signal"
	"sync"
	"syscall"
)

func PreparePhase() {
	logbdev.SetLevel(logbdev.DebugLevel)
	S = msource.PreparePhase()
}

var S *msource.Spout

func CoreStart(function func(payload *msource.Payload)) {
	wg := new(sync.WaitGroup)

	// 创建主协程上下文
	ctx, cannel := context.WithCancel(context.Background())

	// 启动msource，并且传递主协程上下文，用于任务间的通信控制
	S.Start(ctx)

	// 注册信号量
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-sig:
				cannel()
				return
			}
		}
	}()

	// 这里我们可以再创建更多的worker协助我们的消费数据
	// 使用方式基本向后兼容
	innerWorker := 3

	logbdev.Infof("total chan: %d\n", S.ChanSize())
	// 主协程中创建子协程（worker）工作
	for i := 0; i < S.ChanSize(); i++ {
		for ii := 0; ii < innerWorker; ii++ {
			wg.Add(1)
			go func(idx, idx2 int) {
				defer wg.Done()
				logbdev.Infof("start chan[%d-%d]\n", idx, idx2)
				payloadCh := S.GetPayloadChanById(idx)

				for payload := range payloadCh.GetCh() {
					function(payload)
				}
			}(i, ii)
		}
	}
	// 等待子协程结束
	wg.Wait()
	// 等待msource退出
	S.Stop()
}
```

### ACK

```go
package main

import (
	"gitlab.mingchao.com/basedev-deps/logbdev"
	"gitlab.mingchao.com/basedev-deps/msource/v2"
	"gitlab.mingchao.com/basedev-deps/msource/v2/example/spout/db/common"
)

func main() {
	common.CoreStart(func(payload *msource.Payload) {
		if err := common.S.Ack(payload); err != nil {
			logbdev.Error(err)
		}
	})
}
```

### NACK

```go
package main

import (
	"gitlab.mingchao.com/basedev-deps/logbdev"
	"gitlab.mingchao.com/basedev-deps/msource/v2"
	"gitlab.mingchao.com/basedev-deps/msource/v2/example/spout/db/common"
)

func main() {
	common.PreparePhase()
	common.CoreStart(func(payload *msource.Payload) {
		if err := common.S.MarkFailure(payload); err != nil {
			logbdev.Error(err)
		}
	})
}
```

### STATE-MACHINE

```go
package main

import (
	"context"
	"fmt"
	"gitlab.mingchao.com/basedev-deps/logbdev"
	"gitlab.mingchao.com/basedev-deps/msource/v2/example/spout/db/common"
	"os"
	"os/signal"
	"sync"
	"syscall"
)

type MyStateMachine struct {
	phases []string
}

func (msm *MyStateMachine) AddPhase(name string) error {
	msm.phases = append(msm.phases, name)
	return nil
}

// get all phase
func (msm *MyStateMachine) GetPhases() []string {
	return msm.phases
}

func main() {
	common.PreparePhase()
	wg := new(sync.WaitGroup)

	// 创建主协程上下文
	ctx, cannel := context.WithCancel(context.Background())

	// 启动msource，并且传递主协程上下文，用于任务间的通信控制
	// 需要设置为多阶段的话，必须设置状态机，并且在msource服务Start之前设置
	sms := &MyStateMachine{}
	_ = sms.AddPhase("step1")
	_ = sms.AddPhase("step2")
	_ = sms.AddPhase("step3")
	common.S.SetStateMachine(sms)
	common.S.Start(ctx)

	// 注册信号量
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-sig:
				cannel()
				return
			}
		}
	}()

	logbdev.Infof("total chan: %d\n", common.S.ChanSize())
	// 主协程中创建子协程（worker）工作
	for i := 0; i < common.S.ChanSize(); i++ {
		wg.Add(1)
		chCtx, _ := context.WithCancel(ctx)
		go func(idx int, childCtx context.Context) {
			defer wg.Done()
			logbdev.Infof("start chan[%d]\n", idx)
			payloadCh := common.S.GetPayloadChanById(idx)
			for {
				select {
				case payload := <-payloadCh.GetCh():
					// 不同阶段之间如果相互无依赖的话，则可以并发处理
					// 否则请使用同步的方式
					var wg sync.WaitGroup
					wg.Add(1)
					go func() {
						defer wg.Done()
						phase := "step1"
						if common.S.CanTransition(payload, phase) {
							fmt.Println("Do Step 1 something")
							_ = common.S.Transition(payload, phase)
						}
					}()

					wg.Add(1)
					go func() {
						defer wg.Done()
						phase := "step2"
						if common.S.CanTransition(payload, phase) {
							fmt.Println("Do Step 2 something")
							_ = common.S.Transition(payload, phase)
						}
					}()

					wg.Add(1)
					go func() {
						defer wg.Done()
						phase := "step3"
						if common.S.CanTransition(payload, phase) {
							fmt.Println("Do Step 3 something")
							_ = common.S.Transition(payload, phase)
						}
					}()
					wg.Wait()

					// 多阶段的请看下，Ack非必须要，如果手动调用ack的话，那么等于一条条同步删除
					// msource 在后台会定期检测runner中的状态机数据
					//if err := common.S.Ack(payload); err != nil {
					//	logbdev.Error(err)
					//}
				case <-ctx.Done():
					fmt.Println("Done")
					return
				}
			}
		}(i, chCtx)
	}
	// 等待子协程结束
	wg.Wait()
	// 等待msource退出
	common.S.Stop()
}
```

# 小知识总结

## time组件

在开发的过程中，`time组件`用得还是比较多的，因为有各种异步任务在后台运行，常规的用法就不记录讲述了，这里说一下一些注意的点。

```
// After waits for the duration to elapse and then sends the current time
// on the returned channel.
// It is equivalent to NewTimer(d).C.
// The underlying Timer is not recovered by the garbage collector
// until the timer fires. If efficiency is a concern, use NewTimer
// instead and call Timer.Stop if the timer is no longer needed.
func After(d Duration) <-chan Time {
	return NewTimer(d).C
}
```

我们看到这个`API`，如果想要用

```go
for {
	select {
		case <-time.After(1*time.Second)):
			fmt.Println("时间到了")
		default:
			fmt.Println("go on")
	}
}
```

看到这个例子，如果我们这么用的话，每1秒都会重新创建一个Timer对象，不断在堆空间申请内存，然后gc-worker再大量回收没有再使用的对象内存。这就导致cpu做了额外的一些无效工作。

所以这种用法我是不推荐的。

```go
func (t *Timer) Reset(d Duration) bool {
	if t.r.f == nil {
		panic("time: Reset called on uninitialized Timer")
	}
	w := when(d)
	return resetTimer(&t.r, w)
}
```

我们看到其实`Timer` 其实有一个`Reset`的API，我们可以对同一个timer进行`Reset`的操作，不断是重置时间即可。

```go
d := 1*time.Second
t:= NewTimer(d)
for {
	select {
		case <-t.C:
			t.Reset(d)
		default:
			fmt.Println("go on")
	}
}
```

## make函数

make函数是一个很强大的函数，我们会经常使用到，但是有一些细节，需要大家知道的。

`make([]byte,0,10)` 与 `make([]byte,10)` 这是2中不同的切片，对于可能刚学习golang的小伙伴来说，会有点疑惑，但是这是需要了解的，如果是三个参数的时候，一个是`cap`,一个是`len`，他们是有区别的。如果是三个参数的话，那代表当前大小`cap` = `len`

我们经常会用三个参数来进行预分配空间，第二个参数默认都是填写0来进行优化，特别是我们在写`DB`的时候，用到了大量`[]byte`类型，在组装编码字节的时候，我们就需要使用这种方式来处理，否则。

```go
a := make([]byte, 0, 5)
a = append(a, []byte{'a'}) // a = [97]

a := make([]byte, 5)
a = append(a, []byte{'a'}) // a = [0,0,0,0,0,97]
```

看到这里，大家就会明白区别。


## once函数

有些时候，我们想要保证只运行一次，这里，我们就需要借助 `sync.Once`，需要注意的是 一个`sync.Once`只能与一个函数绑定！

```go
once := new(sync.Once)
callback:= func() { fmt.Println("我只想运行一次")}
once.Do(callback) // 会 输出

once.Do(callback) // 无 输出
once.Do(callback) // 无 输出
once.Do(callback) // 无 输出
```

## 自定义marshal和unmarshal

有时候，我们想要自己定义json的`marshal` 和 `unmarshal`，这里我们的`发号计数器` 就用到了，用它的原因其实是因为，我们的发号计数器在发号的过程中，其实是后台跑着一个异步任务在发号，所以在被反编码的时候，我们需要启动这个异步任务。

```go
func (c *counter) UnmarshalJSON(data []byte) (err error) {
	c.IdKey = data[1 : len(data)-1]

	// 重点关注这里
	turboNew(c)

	return
}

func (c *counter) MarshalJSON() ([]byte, error) {
	b := make([]byte, 0, len(c.IdKey)+2)
	b = append(b, '"')
	b = append(b, c.IdKey...)
	b = append(b, '"')
	return b, nil
}

func turboNew(c *counter) {
	ct := custom.Load().(*Custom)
	c.idChan = make(chan int64, ct.IdStep)
	c.sig = make(chan os.Signal, 1)
	c.ReadOptions = gorocksdb.NewDefaultReadOptions()
	signal.Notify(c.sig, syscall.SIGINT, syscall.SIGTERM)

	// 这里会启动一个异步任务
	c.sender()
}

func (c *counter) sender() {
	// 异步任务
	...
}
```

## lockfree-queue和lockfree-stack

我们知道如果想要做到并发安全的话，普遍做法就是2种

- 无锁化结构的设计（需要针对特定的业务常用，并且不允许乱用）
- 有锁结构

无锁化(`lock-free`)的实现方式有很多种，在开发的过程中，我也有想过利用`lock-free-stack`以及`lock-free-queue`，分别想要运用在`RPN`的实现以及`发号器`当中，虽然后来发现用不到，但是可以拿到这里和大家分享一下。

```go
// inrInt64 Increase
func inrInt64(i *int64) {
	t := int64(+1)
	for {
		value := atomic.LoadInt64(i)
		if atomic.CompareAndSwapInt64(i, value, value+t) {
			return
		}
		time.Sleep(time.Nanosecond)
	}
}

// dcrInt64 Decrease
func dcrInt64(i *int64) {
	t := int64(-1)
	for {
		value := atomic.LoadInt64(i)
		if atomic.CompareAndSwapInt64(i, value, value+t) {
			return
		}
		time.Sleep(time.Nanosecond)
	}
}

// LKStack returns an empty queue.
func NewLKStack() *LKStack {
	n := unsafe.Pointer(&node{})
	return &LKStack{head: n}
}

// LKStack is a lock-free unbounded stack.
type LKStack struct {
	len  int64
	head unsafe.Pointer
}

func (q *LKStack) IsEmpty() bool {
	return q.Len() == 0
}

func (q *LKStack) Len() int64 {
	return q.len
}

// LKStack puts the given value v at the tail of the stack.
func (q *LKStack) Push(v interface{}) {
	n := &node{value: v}
	for {
		head := load(&q.head)
		next := load(&n.next)
		cas(&n.next, next, head)
		if cas(&q.head, head, n) {
			inrInt64(&q.len)
			return
		}

		time.Sleep(time.Nanosecond)
	}
}

// Pop removes and returns the value at the head of the stack.
// It returns nil if the stack is empty.
func (q *LKStack) Pop() interface{} {
	for {
		head := load(&q.head)
		next := load(&head.next)
		if next == nil { // is stack empty?
			return nil
		} else {
			// read value before CAS otherwise another pop might free the next node
			v := head.value
			if cas(&q.head, head, next) {
				dcrInt64(&q.len)
				return v // Pop is done.  return
			}
		}
		time.Sleep(time.Nanosecond)
	}
}

// load from atomic load pointer node
func load(p *unsafe.Pointer) (n *node) {
	return (*node)(atomic.LoadPointer(p))
}

// cas swap set
func cas(p *unsafe.Pointer, old, new *node) (ok bool) {
	return atomic.CompareAndSwapPointer(
		p, unsafe.Pointer(old), unsafe.Pointer(new))
}
```

这里也不过多在这里描述了，我们大家查看源码吧，主要就是利用了`atomic`包中的`原子性`操作`CompareAndSwapXxx`, 因为这是一个原子性的指令，合理的运用即可做到`无锁化并发安全`的结构。

`atomic`包的`CompareAndSwapXxx`其实就是一个`CAS`的理念，用`乐观锁(逻辑锁)`来做数据处理。

##  unsafa包中的指针的作用：零拷贝string和byte的转换

`零拷贝(zero-copy)`，传统较多的说法就是无需经过用户态到内核态到数据copy，即可做到想做的事情。 通俗一点就是不经过copy就能转换数据。

```go
type StringHeader struct {
    Data uintptr
    Len  int
}

type SliceHeader struct {
    Data uintptr
    Len  int
    Cap  int
}
```

这是String和slice的底层数据结构，他们基本是一致的，区别其实就是在于一个有Cap，一个是固定的Len。

只需要共享底层 Data 和 Len 就可以实现 zero-copy。

```go
func string2bytes(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(&s))
}

func bytes2string(b []byte) string {
	return *(*string)(unsafe.Pointer(&b))
}
```

## context控制上下文也讲解一下

我们这里用到了大量协程，他们之间有一些或许是有上下文关系的，因此，我们这里就需要用到`context`来对协程进行一个上下文的管理，做到协助的作用。

特别是我们在退出程序的时候，我们想要某一些异步任务`优雅`,`可靠`,`安全`的退出程序，那么我们就需要用到context来控制每个后台运行的程序。

我们这里用到比较多的其实就是 `context.WithCancel(ctx)`， 我们需要管理每个协程的退出需要做的事情，例如：我需要msource在退出的时候，保存一下当前在内存中最新的数据到rocksdb中，那么这个时候context的作用就十分有效了。

## pprof的查看

要利用pprof粗略查看性能，及时它不能准确的反馈出所有的问题，起码它能帮助我们在前面的大问题上更容易发现问题。

##  sync.Pool如何做到优化

- 对STW暂停时间做了优化, 避免大的sync.Pool严重影响STW时间
- 第二个优化是GC时入对`sync.Pool`进行回收，不会一次将池化对象全部回收，这就避免了`sync.Pool`释放对象和重建对象导致的性能尖刺，造福于`sync.Pool`重度用户。
- 第三个就是对性能的优化。
- 
对以上的改进主要是两次提交：
[sync: use lock-free structure for Pool stealing](https://github.com/golang/go/commit/d5fd2dd6a17a816b7dfd99d4df70a85f1bf0de31#diff-491b0013c82345bf6cfa937bd78b690d)
[sync: smooth out Pool behavior over GC with a victim cache](https://github.com/golang/go/commit/2dcbf8b3691e72d1b04e9376488cef3b6f93b286#diff-491b0013c82345bf6cfa937bd78b690d)

分别是用到了`无锁化结构` 以及程序GC的行为的优化

