---
title: TIDB源码剖析（一）
date: 2022-01-24 10:28:33
categories: TIDB
tags: [TIDB]
---

## 简介

这一章，作为我们的起始章节，跟着源码，我们一步步来熟悉TIDB的整体代码结构

------------

<!-- more -->


## Select

当我们有一条基本的sql如下：

```sql
select * from mysql.user;
```

我们从接收到客户端连接开始，`执行`，`解析`，`逻辑优化器`，`物理优化器`，到`最终结果`开始分析。

```
github.com/pingcap/tidb/planner.optimize at optimize.go:335
github.com/pingcap/tidb/planner.Optimize at optimize.go:211
github.com/pingcap/tidb/executor.(*Compiler).Compile at compiler.go:77
github.com/pingcap/tidb/session.(*session).ExecuteStmt at session.go:1696
github.com/pingcap/tidb/server.(*TiDBContext).ExecuteStmt at driver_tidb.go:220
github.com/pingcap/tidb/server.(*clientConn).handleStmt at conn.go:1977
github.com/pingcap/tidb/server.(*clientConn).handleQuery at conn.go:1846
github.com/pingcap/tidb/server.(*clientConn).dispatch at conn.go:1341
github.com/pingcap/tidb/server.(*clientConn).Run at conn.go:1091
github.com/pingcap/tidb/server.(*Server).onConn at server.go:556
runtime.goexit at asm_amd64.s:1371
 - Async stack trace
github.com/pingcap/tidb/server.(*Server).startNetworkListener at server.go:453
```

上面这是一个基本的执行流程，我们跟着这一段堆栈来进行分析。

## github.com/pingcap/tidb/server.(*Server).onConn at server.go (连接处理逻辑)

```go
conn.Run(ctx)
```

这里，我们看到了这是进入到了一个`clientConn`的 `Run` 方法。

```go
// Run reads client query and writes query result to client in for loop, if there is a panic during query handling,
// it will be recovered and log the panic error.
// This function returns and the connection is closed if there is an IO error or there is a panic.
// 在for循环中，执行读取客户端查询，并将查询结果写入客户端，如果在处理查询时出现panic，
// 它将被恢复并记录panic错误。
// 如果出现IO错误或panic，该函数返回并关闭连接。
func (cc *clientConn) Run(ctx context.Context)
```

这里我们看到了有一段文字帮助我们理解注意事项。

我们按照过程式的顺序来从上往下看源码

```go
    const size = 4096
	defer func() {
		r := recover()
		if r != nil {
			buf := make([]byte, size)
			stackSize := runtime.Stack(buf, false)
			buf = buf[:stackSize]
			logutil.Logger(ctx).Error("connection running loop panic",
				zap.Stringer("lastSQL", getLastStmtInConn{cc}),
				zap.String("err", fmt.Sprintf("%v", r)),
				zap.String("stack", string(buf)),
			)
			err := cc.writeError(ctx, errors.New(fmt.Sprintf("%v", r)))
			terror.Log(err)
			metrics.PanicCounter.WithLabelValues(metrics.LabelSession).Inc()
		}
		if atomic.LoadInt32(&cc.status) != connStatusShutdown {
			err := cc.Close()
			terror.Log(err)
		}
	}()
```

这段代码，我们看到了几点。

- 通过 `recover()` 方法来阻止`panic`引起的程序异常崩溃，如果是panic的话，那么将会有一段特殊的逻辑处理
	1.1 通过 `runtime.Stack(buf,false)` 的第二个参数来控制只获取当前协程下的堆栈信息，并且写入到`buf`变量中
	1.2 由于 `const size = 4096` 的原因，我们拿到的buf未必是那么多，因此，通过 `buf[:stackSize]` 来进行切片处理，把变量的指针重新指向新的数据区域
	1.3 通过日志组件来记录详细信息， 有意思的是，这里通过了`getLastStmtInConn结构体`里面的`String()`方法来进行序列化自己想要的内容信息，其他的就是基本的`err`, `stack`的信息了
	1.4 我们不单单需要在服务器上记录信息，还要把对应的用户错误信息也记录下来并且发送给客户端。所以通过了 `err := cc.writeError(ctx, errors.New(fmt.Sprintf("%v", r)))` 来实现这一点。
	1.5 然后就是记录相关的`metrics`，因为发生了一次 `panic`，所以需要通过`PanicCounter`记录下来，用于统计由于`session`引起的`panic`总共有多少次
- 如果是非panic引起的函数析构，那么还要通过原子性草走来判断状态是否为关闭状态，如果是关闭状态，那么在这里就需要把连接断开，并且记录下错误信息


```go
	// Usually, client connection status changes between [dispatching] <=> [reading].
	// When some event happens, server may notify this client connection by setting
	// the status to special values, for example: kill or graceful shutdown.
	// The client connection would detect the events when it fails to change status
	// by CAS operation, it would then take some actions accordingly.
	// 通常情况下，客户端连接状态在[dispatching] <=> [reading]之间变化。
	// 当某个事件发生时，服务器可以通过设置来通知这个客户端连接
	// 将状态设置为特殊值，例如:kill或graceful shutdown。
	// 当CAS操作改变状态失败时，客户端连接将检测到事件，然后采取相应的动作。
	for {
		if !atomic.CompareAndSwapInt32(&cc.status, connStatusDispatching, connStatusReading) ||
			// The judge below will not be hit by all means,
			// But keep it stayed as a reminder and for the code reference for connStatusWaitShutdown.
			atomic.LoadInt32(&cc.status) == connStatusWaitShutdown {
			return
		}
	...
	}

```

- 我们看到这是一个循环操作，并且通过原子性操作`atomic.CompareAndSwapInt32`（比较然后再交换，所以符合CAS原则，乐观锁）来判断session连接是否能是否能切换到`connStatusDispatching` => `connStatusReading` 状态
- 如果不可以切换，那么则结束该方法
- 如果连接状态为等待关闭状态，那么也结束该方法

对于其中的 `...`，现在会在下面进一步说明。

```go
	cc.alloc.Reset()
	// close connection when idle time is more than wait_timeout
	waitTimeout := cc.getSessionVarsWaitTimeout(ctx)
	cc.pkt.setReadTimeout(time.Duration(waitTimeout) * time.Second)
	start := time.Now()
	data, err := cc.readPacket()
	if err != nil {
		if terror.ErrorNotEqual(err, io.EOF) {
			if netErr, isNetErr := errors.Cause(err).(net.Error); isNetErr && netErr.Timeout() {
				idleTime := time.Since(start)
				logutil.Logger(ctx).Info("read packet timeout, close this connection",
					zap.Duration("idle", idleTime),
					zap.Uint64("waitTimeout", waitTimeout),
					zap.Error(err),
				)
			} else {
				errStack := errors.ErrorStack(err)
				if !strings.Contains(errStack, "use of closed network connection") {
					logutil.Logger(ctx).Warn("read packet failed, close this connection",
						zap.Error(errors.SuspendStack(err)))
				}
			}
		}
		disconnectByClientWithError.Inc()
		return
	}
```

- `cc.alloc.Reset()`重置内存池大小
- 当空闲时间大于等待超时时间的话那么将会关闭丽连接。`cc.pkt.setReadTimeout(time.Duration(waitTimeout) * time.Second)`
- 从客户端读取数据，如果存在错误，那么将会记录下来相关信息，例如从读取数据到最后的时间，来统计idletime，通过`metrics.DisconnectionCounter.WithLabelValues(metrics.LblError)`来记录因为err导致连接断开的次数


```go
	if !atomic.CompareAndSwapInt32(&cc.status, connStatusReading, connStatusDispatching) {
		return
	}
```

同理，经过cas乐观锁，把状态从 `connStatusReading` => `connStatusDispatching`如果，交换设置失败，那么就结束函数。

```go
	startTime := time.Now()
	err = cc.dispatch(ctx, data)
```

## github.com/pingcap/tidb/server.(*clientConn).dispatch （分发逻辑）


```go
// dispatch handles client request based on command which is the first byte of the data.
// It also gets a token from server which is used to limit the concurrently handling clients.
// The most frequently used command is ComQuery.
// dispatch根据命令处理客户端请求，命令是数据的第一个字节。
// 它也从服务器获取一个令牌，用于限制并发处理客户端。
// 最常用的命令是ComQuery。
func (cc *clientConn) dispatch(ctx context.Context, data []byte) error
```

下面的方法都是dispatch的过程顺序逻辑

```go
	defer func() {
		// reset killed for each request
		atomic.StoreUint32(&cc.ctx.GetSessionVars().Killed, 0)
	}()
	t := time.Now()
	if (cc.ctx.Status() & mysql.ServerStatusInTrans) > 0 {
		connIdleDurationHistogramInTxn.Observe(t.Sub(cc.lastActive).Seconds())
	} else {
		connIdleDurationHistogramNotInTxn.Observe(t.Sub(cc.lastActive).Seconds())
	}
```

- 这里可以看到这里有一个defer，当函数结束的时候，会重置session的Killed次数
- `cc.ctx.Status() & mysql.ServerStatusInTrans` 这里因为兼容了mysql的无状态协议，所以通过第一个`位运算`来判断当前状态
	1. 如果当前链接处于一个`事务`状态下的话，那么通过`connIdleDurationHistogramInTxn.Observe(t.Sub(cc.lastActive).Seconds())` 用直方图监控从最后一次活跃时间到当前分发时间
	2. 否则则用另一个`metrics`来记录

```go
	span := opentracing.StartSpan("server.dispatch")
	cfg := config.GetGlobalConfig()
	if cfg.OpenTracing.Enable {
		ctx = opentracing.ContextWithSpan(ctx, span)
	}

	var cancelFunc context.CancelFunc
	ctx, cancelFunc = context.WithCancel(ctx)
	cc.mu.Lock()
	cc.mu.cancelFunc = cancelFunc
	cc.mu.Unlock()
```

- 通过`opentracing`来开始进行`分布式追踪`，`cc.mu` 主要是用来在`事务`中取消事务用的。

```go
	cc.lastPacket = data
	cmd := data[0]
	data = data[1:]
	if topsqlstate.TopSQLEnabled() {
		defer pprof.SetGoroutineLabels(ctx)
	}
	if variable.EnablePProfSQLCPU.Load() {
		label := getLastStmtInConn{cc}.PProfLabel()
		if len(label) > 0 {
			defer pprof.SetGoroutineLabels(ctx)
			ctx = pprof.WithLabels(ctx, pprof.Labels("sql", label))
			pprof.SetGoroutineLabels(ctx)
		}
	}
```

- 把当前session接收到的数据记录在`lastPakcet`中
- `第一个字节`代表`命令`
- `后面的字节`代表`数据`

```go
	token := cc.server.getToken()
	defer func() {
		// if handleChangeUser failed, cc.ctx may be nil
		if cc.ctx != nil {
			cc.ctx.SetProcessInfo("", t, mysql.ComSleep, 0)
		}

		cc.server.releaseToken(token)
		span.Finish()
		cc.lastActive = time.Now()
	}()
```

这里需要关注一下`defer`里面的内容

- 根据mysql协议，当命令为`mysql.ComSleep`的时候，代表execute已经完成了。所以当结束的时候，需要设置一下这个`ProcessInfo`
- 然后释放本次token，并且span也需要标记为完成
- 更新最后一次活跃时间

```go
	vars := cc.ctx.GetSessionVars()
	// reset killed for each request
	atomic.StoreUint32(&vars.Killed, 0)
	if cmd < mysql.ComEnd {
		cc.ctx.SetCommandValue(cmd)
	}
```

- 获取当前session的变量
- 重置其中的killed属性
- 如果`cmd`在范围内的，更新当前命令的值

```go
	dataStr := string(hack.String(data))
	switch cmd {
	case mysql.ComPing, mysql.ComStmtClose, mysql.ComStmtSendLongData, mysql.ComStmtReset,
		mysql.ComSetOption, mysql.ComChangeUser:
		cc.ctx.SetProcessInfo("", t, cmd, 0)
	case mysql.ComInitDB:
		cc.ctx.SetProcessInfo("use "+dataStr, t, cmd, 0)
	}
```

- 这里利用了golang种的`hack（黑科技）`的方式来把`byte`转换成`string`，其实主要就是因为底层用的都有一样的结构体，所以可以直接通过`unsafe.pointer`来直接操作内容指针，进行`zero-copy`
- 对cmd进行`processinfo`的处理，如果是`use db`的命令的话，则需要传递数据库

```go
switch cmd {
	case mysql.ComSleep:
		// TODO: According to mysql document, this command is supposed to be used only internally.
		// So it's just a temp fix, not sure if it's done right.
		// Investigate this command and write test case later.
		return nil
	case mysql.ComQuit:
		return io.EOF
	case mysql.ComInitDB:
		if err := cc.useDB(ctx, dataStr); err != nil {
			return err
		}
		return cc.writeOK(ctx)
	case mysql.ComQuery: // Most frequently used command.
		// For issue 1989
		// Input payload may end with byte '\0', we didn't find related mysql document about it, but mysql
		// implementation accept that case. So trim the last '\0' here as if the payload an EOF string.
		// See http://dev.mysql.com/doc/internals/en/com-query.html
		if len(data) > 0 && data[len(data)-1] == 0 {
			data = data[:len(data)-1]
			dataStr = string(hack.String(data))
		}
		return cc.handleQuery(ctx, dataStr)
	...
}
```

这里我复制了一部分，因为我们重点关注`mysql.ComQuery`命令。

- 根据提示，我们发现因为mysql协议说明了输入载体可能以`\0`作为最后字节，所以这里一定要减去client发送的多余的最后一个字节。所以长度进行了-1操作
- 然后进入到`cc.handleQuery(ctx, dataStr)`

## github.com/pingcap/tidb/server.(*clientConn).handleQuery

```go
// handleQuery executes the sql query string and writes result set or result ok to the client.
// As the execution time of this function represents the performance of TiDB, we do time log and metrics here.
// There is a special query `load data` that does not return result, which is handled differently.
// Query `load stats` does not return result either.
func (cc *clientConn) handleQuery(ctx context.Context, sql string) (err error)
```

这个方法，终于开始正式进入我们的主题了

```go
	defer trace.StartRegion(ctx, "handleQuery").End()
	sc := cc.ctx.GetSessionVars().StmtCtx
	prevWarns := sc.GetWarnings()
	stmts, err := cc.ctx.Parse(ctx, sql)
	if err != nil {
		return err
	}

	if len(stmts) == 0 {
		return cc.writeOK(ctx)
	}
```

- defer进行了当函数结束的时候，标记`handleQuery`结束
- 拿到`statement`的上下文环境
- 从上下文中拿到所有的`warinning`警告
- 通过`cc.ctx.Parse(ctx, sql)`来进行解析sql，这里属于一个大的篇章，暂时不张开讲，主要涉及到的内容有`编译原理`,`AST-Tree`，`Yacc`。我们通过这里可以拿到一棵抽象语法树，实质是`SelectStmt`，内部包含了如下内容：
	1. dmlNode（因为select语句属于dml语句）
	2. 其他的都是常规的例如`FROM`, `WHERE`, `FIELDS`, `DISTINCT` 等等
- 如果没有一个完成的抽象语法书，则直接返回响应协议和对应的内容

```go
	var pointPlans []plannercore.Plan
	if len(stmts) > 1 {

		// The client gets to choose if it allows multi-statements, and
		// probably defaults OFF. This helps prevent against SQL injection attacks
		// by early terminating the first statement, and then running an entirely
		// new statement.

		capabilities := cc.ctx.GetSessionVars().ClientCapability
		if capabilities&mysql.ClientMultiStatements < 1 {
			// The client does not have multi-statement enabled. We now need to determine
			// how to handle an unsafe situation based on the multiStmt sysvar.
			switch cc.ctx.GetSessionVars().MultiStatementMode {
			case variable.OffInt:
				err = errMultiStatementDisabled
				return err
			case variable.OnInt:
				// multi statement is fully permitted, do nothing
			default:
				warn := stmtctx.SQLWarn{Level: stmtctx.WarnLevelWarning, Err: errMultiStatementDisabled}
				parserWarns = append(parserWarns, warn)
			}
		}

		// Only pre-build point plans for multi-statement query
		pointPlans, err = cc.prefetchPointPlanKeys(ctx, stmts)
		if err != nil {
			return err
		}
	}
```

- 通过Session中的var中的`ClientCapability`的`位运算`来判断是否支持`mysql.ClientMultiStatements`（多sql语句）
- 如果`sysvar`也不支持`MultiStatementMode`,也就是`variable.OffInt`，那么就直接返回err
- 如果没有能力支持client多statement的话，但是var又开启了的话，目前啥事也没做
- 默认就是不支持，但是会通过warn来展示给客户端
- 只有在多statement的场景下预取目标计划关键字

```go
for i, stmt := range stmts {
	if len(pointPlans) > 0 {
		// Save the point plan in Session, so we don't need to build the point plan again.
		cc.ctx.SetValue(plannercore.PointPlanKey, plannercore.PointPlanVal{Plan: pointPlans[i]})
	}
	retryable, err = cc.handleStmt(ctx, stmt, parserWarns, i == len(stmts)-1)
	if err != nil {
		if !retryable || !errors.ErrorEqual(err, storeerr.ErrTiFlashServerTimeout) {
			break
		}
		_, allowTiFlashFallback := cc.ctx.GetSessionVars().AllowFallbackToTiKV[kv.TiFlash]
		if !allowTiFlashFallback {
			break
		}
		// When the TiFlash server seems down, we append a warning to remind the user to check the status of the TiFlash
		// server and fallback to TiKV.
		warns := append(parserWarns, stmtctx.SQLWarn{Level: stmtctx.WarnLevelError, Err: err})
		delete(cc.ctx.GetSessionVars().IsolationReadEngines, kv.TiFlash)
		_, err = cc.handleStmt(ctx, stmt, warns, i == len(stmts)-1)
		cc.ctx.GetSessionVars().IsolationReadEngines[kv.TiFlash] = struct{}{}
		if err != nil {
			break
		}
	}
}
```

- 如果有目标计划的话，那么只需要在上下文中设置value即可，不需要再次构建目标计划
- `cc.handleStmt(ctx, stmt, parserWarns, i == len(stmts)-1)` 这是我们的核心中的核心，这里面就是处理`抽象语法树`的逻辑，包含了`逻辑优化`, `物理优化`, `执行器`，`tikv`交互等等
- todo：留着回来分析

## github.com/pingcap/tidb/server.(*clientConn).handleStmt

```go
// The first return value indicates whether the call of handleStmt has no side effect and can be retried.
// Currently, the first return value is used to fall back to TiKV when TiFlash is down.
// 第一个返回值表示调用handleStmt是否没有副作用，是否可以重试
// 当前，第一个返回值用于在TiFlash down时回落到TiKV
func (cc *clientConn) handleStmt(ctx context.Context, stmt ast.StmtNode, warns []stmtctx.SQLWarn, lastStmt bool) (bool, error)
```

```go
	ctx = context.WithValue(ctx, execdetails.StmtExecDetailKey, &execdetails.StmtExecDetails{})
	ctx = context.WithValue(ctx, util.ExecDetailsKey, &util.ExecDetails{})
	reg := trace.StartRegion(ctx, "ExecuteStmt")
	cc.audit(plugin.Starting)
	rs, err := cc.ctx.ExecuteStmt(ctx, stmt)
```

- 上下文带上value，设置主要是`StmtExecDetails`，里面记录了写入sql到响应的时间
- 上下文带上value，设置主要是`ExecDetails`，里面记录了`execution`的详情信息，分别有