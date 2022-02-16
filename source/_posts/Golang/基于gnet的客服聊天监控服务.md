---
title: 【Golang】- 基于gnet的端口复用支持多协议的客服聊天监控服务
date: 2022-02-12 00:46:51
categories: [Golang]
tags: [Golang]
---

## 前言

最近，公司以前有一些旧的服务，由于各种原因，导致各种问题，并且架构设计行也不是那么友好和不利于维护。
所以准备重构设计一些服务。

在游戏公司中，GM客服的其中一个职能就是监督舆论，从玩家平日的聊天中进行监控。

我们从`业务需求`+`技术架构`层面进行整理。

<!-- more -->

## 历史

在过去中，由于当时php还是如日中天，旧的则是采集的`swoole1.x`的版本进行开发的服务。
受限于php一个语言特性，注定无法实现一些高性能的中间件，或者说大数据生态十分欠缺。当时用php除了`fastcgi`的`web系统`外，最多就只能做一些基本的`常驻`任务。

消息中间件最多也就是用到`rabbitmq`，`rocketmq`等等。

而常驻，一般无非就是直接`cli`，外加一个`循环+sleep`的组合套餐。而要实现`websocket-server`这种常驻服务，一般是借助`swoole`来处理。毕竟`reactor`的模式，怎么都比`单进程`的实现好。


分为了3个模块（每个模块=每个角色=一个进程=一个服务）：

- chat_record （聊天记录角色）（weboccket_client, tcp_clinet）
- db_server （数据层角色) (tcp_server)
- websocket_server (连接层角色) (webocket_server)

由于当时php基本无法多线程编程(可用，但是不友好)，只能采用这种委婉的`伪多进程`的模拟进行`不同任务的处理`和`数据的交互`。

![旧服务的数据流图](/images/Go/chat_monitor.png)

## 新服务

![新服务的数据流图](/images/Go/chat_monitor_new.png)

> 但是由于种种原因，后面并未如此拆分架构，而是将`websocket-server网络连接层`的和`业务层`合并成为了一个`单体服务`

技术选型上

- go
- gnet
- kafka

### 为什么核心的网络层需要采用`gnet`呢？

一般Go语言的TCP(和HTTP)的处理都是`每一个连接`启动`一个goroutine`去处理，因为我们被教导`goroutine`的不像`thread`, 它是很便宜的，可以在服务器上启动成`千上万的goroutine`。

但是对于`一百万`的连接，这种`goroutine-per-connection`的模式就`至少`要启动`一百万个goroutine`，这对资源的消耗也是极大的。

针对不同的操作系统和不同的Go版本，一个goroutine锁使用的最小的栈大小是`2KB ~ 8 KB (go stack)`,如果在每个goroutine中在`分配byte buffer`用以从连接中读写数据，`几十G的内存`轻轻松松就分配出去了。

`吞吐率`和`延迟`需要数据来支撑，但是显然这个`单goroutine`处理的模式`不适合耗时较长`的业务处理，`"hello world"`或者`直接的简单的memory操作`应该没有问题。

对于百万连接`但是并发量很小`的场景，比如消息推送、页游等场景，这种实现应该是没有问题的。

但是对于并发量很大，延迟要求比较低的场景，这种实现可能会存在问题。

`gnet`采用了类似`netty`的`reactor`模式，基于`epoll`或者`kqueue`实现io多路复用。并且基于golang的语言特性，其实现原理为`带线程/go程池的主从 Reactors 多线程`模式，在网络层上性能上有极大的优化。

我们通过gnet提供的tcp网络层，在应用层，实现了http和webocket的端口复用的形式。

http用于提供`prometheus`的`metrics`指标，例如`连接数/各种类型引发的error数/每条数据被多少个GM客服监视着`等等

websocket则是用于在我们的`GM客服`中，提一个实时的聊天数据获取

### 为什么采用kafka

由于我们整套日志服务都是基于kafka作为核心组件的，所以在数据的实时上，可以保证到数据的实效性。

从而取消了以往从mysql中分库分表去查询数据。也不需要通过其他`OLAP`的服务进行处理。

### 端口复用实现支持多协议

这个是网络连接层，也是链接的核心业务逻辑，在gnet中当有数据到来的时候，由`IO多路复用`的`epoll`模型，会触发`OnTraffic(c gnet.Conn)`的回调函数，在这个过程中，我们就可以通过网络层中获取的数据进行加工处理，形成自己想要的`应用协议`。

由于刚才介绍到了，我们需要实现核心需求：`端口多协议复用`

在这里，先列出核心的逻辑：

```go

type ApplicationLayerProto int

func (alp ApplicationLayerProto) String() (s string) {
	switch alp {
	case HttpApplicationLayerProto:
		s = "http"
	case WebsocketApplicationLayerProto:
		s = "websocket"
	default:
		s = "unknown"
	}
	return
}

const (
	HttpApplicationLayerProto ApplicationLayerProto = iota
	WebsocketApplicationLayerProto
)

type codec struct {
	proto ApplicationLayerProto
}

func (c *codec) isHttp() bool {
	if c.proto == HttpApplicationLayerProto {
		return true
	}

	return false
}

func (c *codec) isWebsocket() bool {
	if c.proto == WebsocketApplicationLayerProto {
		return true
	}

	return false
}

type httpCodec struct {
	*codec
	parser *wildcat.HTTPParser
}

type wsCodec struct {
	*codec
	connected bool
}

func (serv *server) OnOpen(c gnet.Conn) ([]byte, gnet.Action) {
	c.SetContext(new(codec))
	return nil, gnet.None
}

func (serv *server) OnTraffic(c gnet.Conn) gnet.Action {
	var buffer *bytes.Buffer
	var buff []byte
pipeline:
	switch cdc := c.Context().(type) {
	case *codec:
		buf, err := c.Next(-1)
		buff = make([]byte, len(buf))
		copy(buff, buf)
		buffer = bytes.NewBuffer(buff)
		if err != nil {
			return gnet.Close
		}
		hc := &httpCodec{parser: wildcat.NewHTTPParser(), codec: cdc}
		_, err = hc.parser.Parse(buf)
		if err != nil {
			log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("http parser error: %v", err)})
			return gnet.Close
		}

		if upgrade := hc.parser.FindHeader([]byte("Upgrade")); upgrade != nil && bytes.Equal(upgrade, []byte("websocket")) {
			cdc.proto = WebsocketApplicationLayerProto
			wc := &wsCodec{
				codec: cdc,
			}
			c.SetContext(wc)
		} else {
			cdc.proto = HttpApplicationLayerProto
			c.SetContext(hc)
		}
		goto pipeline
	case *httpCodec:
		buf := bufio.NewReader(buffer)
		req, err := http.ReadRequest(buf)
		if err != nil {
			log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("request from http error: %v", err)})
			return gnet.Close
		}
		metrics.TotalConnectedCounter.WithLabelValues(HttpApplicationLayerProto.String()).Inc()
		resp := route.NewResponse(c)
		h, _ := serv.serverMux.Handler(req)
		h.ServeHTTP(resp, req)
		if _, err = resp.Close(); err != nil {
			log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("write to http error: %v", err)})
			return gnet.Close
		}
		return gnet.Close
	case *wsCodec:
		if !cdc.connected {
			wcb := &wsConnBridge{
				buff: buffer,
				c:    c,
			}
			_, err := ws.Upgrade(wcb)
			if err != nil {
				log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("upgrade[%s] to websocket error: %v", c.RemoteAddr().String(), err)})
			}
			log.Debugf(log.NetServerDebugCategory{}, "conn[%v] upgrade websocket protocol", c.RemoteAddr().String())
			cdc.connected = true
			metrics.ConnectedGauge.Inc()
			metrics.TotalConnectedCounter.WithLabelValues(WebsocketApplicationLayerProto.String()).Inc()
		} else {
			msg, op, err := wsutil.ReadClientData(c)
			if err != nil {
				if _, ok := err.(wsutil.ClosedError); !ok {
					log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("[%s] receive ws message error: %v", c.RemoteAddr().String(), err)})
				}
				return gnet.Close
			}
			log.Debugf(log.NetServerDebugCategory{}, "conn[%v] receive [op=%v] [msg=%v]", c.RemoteAddr().String(), op, string(msg))
			if op == ws.OpText {
				if rs := route.MatchRequestSpec(msg); rs == nil {
					return route.GlobalWsRouter.DefaultHandler().ServeWebsocket("/", msg, c, op)
				} else {
					return route.GlobalWsRouter.MatchHandler(rs.Path).ServeWebsocket(rs.Path, rs.Params, c, op)
				}
			}
		}
	}

	return gnet.None
}
```

这里，我们可以看到，当存在新链接进来的啥时候，首先经过`OnOpen(c gnet.Conn)`方法，这个时候，我们会在`gnet.Conn`中设置一个我们用户的一个`上下文环境Context`，在这个Context下，我们为每个连接都初始化了`codec`的结构体对象，当开始接收数据的时候，触发到了`OnTraffic(c gnet.Conn)`方法，这个以后，我们需要把网络层接收到的数据拿出来，由于`流`的存在，使得我们无法重复在同一个连接中，多次重复获取流，所以如果后面需要用到的话，利用取出来的`byte-buffer`生成一个新的`流`，以供后续使用。

所以你会发现有一段代码为:

```go
buf, err := c.Next(-1)
buff = make([]byte, len(buf))
copy(buff, buf)
buffer = bytes.NewBuffer(buff)
```

接下来，需要做的事情就是解析数据为http协议对象，由于我这里的`端口复用`的逻辑是`http+webocket`复用，所以都是基于`http协议`的，所以这里可以简单粗暴的处理，然后通过判断`http协议`中是否包含了需要升级为`webocket协议`的关键字段`Upgrade:webocket`，如果包含，则表示本次请求是一个websocket连接，否则就是一个单纯http连接。以此来达到复用的需求。

在这个基础之上，我们也更新了当前连接的`上下文环境Context`，升级为了`httpCodec`和`wsCodec`，通过`goto+断言`语法，我们可以进入到，我们所需要进入的逻辑阶段。不要觉得这就完事了，麻烦的事情才刚开始，现在你只是知道了开头。

```go
buf := bufio.NewReader(buffer)
req, err := http.ReadRequest(buf)
if err != nil {
    log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("request from http error: %v", err)})
    return gnet.Close
}
metrics.TotalConnectedCounter.WithLabelValues(HttpApplicationLayerProto.String()).Inc()
resp := route.NewResponse(c)
h, _ := serv.serverMux.Handler(req)
h.ServeHTTP(resp, req)
if _, err = resp.Close(); err != nil {
    log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("write to http error: %v", err)})
    return gnet.Close
}
return gnet.Close
```


如果是`http协议`，那么我们就不需要升级协议了。但是有一个问题就是，在golang的`http/server.go`中，我们所熟悉的接口

```go
// A Handler responds to an HTTP request.
//
// ServeHTTP should write reply headers and data to the ResponseWriter
// and then return. Returning signals that the request is finished; it
// is not valid to use the ResponseWriter or read from the
// Request.Body after or concurrently with the completion of the
// ServeHTTP call.
//
// Depending on the HTTP client software, HTTP protocol version, and
// any intermediaries between the client and the Go server, it may not
// be possible to read from the Request.Body after writing to the
// ResponseWriter. Cautious handlers should read the Request.Body
// first, and then reply.
//
// Except for reading the body, handlers should not modify the
// provided Request.
//
// If ServeHTTP panics, the server (the caller of ServeHTTP) assumes
// that the effect of the panic was isolated to the active request.
// It recovers the panic, logs a stack trace to the server error log,
// and either closes the network connection or sends an HTTP/2
// RST_STREAM, depending on the HTTP protocol. To abort a handler so
// the client sees an interrupted response but the server doesn't log
// an error, panic with the value ErrAbortHandler.
type Handler interface {
	ServeHTTP(ResponseWriter, *Request)
}
```

我们看到这个`Handler`interface，需要实现`ServeHTTP(ResponseWriter, *Request)`，而这个`Request`，对于我们目前来是，是不存在的，所以我们需要想办法构造一个`Request`对象出来。

```go
// ReadRequest reads and parses an incoming request from b.
//
// ReadRequest is a low-level function and should only be used for
// specialized applications; most code should use the Server to read
// requests and handle them via the Handler interface. ReadRequest
// only supports HTTP/1.x requests. For HTTP/2, use golang.org/x/net/http2.
func ReadRequest(b *bufio.Reader) (*Request, error) {
	return readRequest(b, deleteHostHeader)
}
```

好在标准包中提供一个`ReadRequest(b *bufio.Reader) (*Request, error)`的方法，可以通过`bufio.Reader`去读取`http协议`，然后构造出我们所需要的`Request`对象，所以你会看到，我们在一开始`copy(buff, buf)`的意义就体现在此了。
还会那句话，因为这是一个`流`，无法重复读取，所以我们利用`[]byte`构造一个全新的可度的字节流。

解决了`Request`的问题之后，另外一个问题也来了，`ResponseWriter`是一个和Response相关可写的字节流。

```go
// A ResponseWriter interface is used by an HTTP handler to
// construct an HTTP response.
//
// A ResponseWriter may not be used after the Handler.ServeHTTP method
// has returned.
type ResponseWriter interface {
	// Header returns the header map that will be sent by
	// WriteHeader. The Header map also is the mechanism with which
	// Handlers can set HTTP trailers.
	//
	// Changing the header map after a call to WriteHeader (or
	// Write) has no effect unless the modified headers are
	// trailers.
	//
	// There are two ways to set Trailers. The preferred way is to
	// predeclare in the headers which trailers you will later
	// send by setting the "Trailer" header to the names of the
	// trailer keys which will come later. In this case, those
	// keys of the Header map are treated as if they were
	// trailers. See the example. The second way, for trailer
	// keys not known to the Handler until after the first Write,
	// is to prefix the Header map keys with the TrailerPrefix
	// constant value. See TrailerPrefix.
	//
	// To suppress automatic response headers (such as "Date"), set
	// their value to nil.
	Header() Header

	// Write writes the data to the connection as part of an HTTP reply.
	//
	// If WriteHeader has not yet been called, Write calls
	// WriteHeader(http.StatusOK) before writing the data. If the Header
	// does not contain a Content-Type line, Write adds a Content-Type set
	// to the result of passing the initial 512 bytes of written data to
	// DetectContentType. Additionally, if the total size of all written
	// data is under a few KB and there are no Flush calls, the
	// Content-Length header is added automatically.
	//
	// Depending on the HTTP protocol version and the client, calling
	// Write or WriteHeader may prevent future reads on the
	// Request.Body. For HTTP/1.x requests, handlers should read any
	// needed request body data before writing the response. Once the
	// headers have been flushed (due to either an explicit Flusher.Flush
	// call or writing enough data to trigger a flush), the request body
	// may be unavailable. For HTTP/2 requests, the Go HTTP server permits
	// handlers to continue to read the request body while concurrently
	// writing the response. However, such behavior may not be supported
	// by all HTTP/2 clients. Handlers should read before writing if
	// possible to maximize compatibility.
	Write([]byte) (int, error)

	// WriteHeader sends an HTTP response header with the provided
	// status code.
	//
	// If WriteHeader is not called explicitly, the first call to Write
	// will trigger an implicit WriteHeader(http.StatusOK).
	// Thus explicit calls to WriteHeader are mainly used to
	// send error codes.
	//
	// The provided code must be a valid HTTP 1xx-5xx status code.
	// Only one header may be written. Go does not currently
	// support sending user-defined 1xx informational headers,
	// with the exception of 100-continue response header that the
	// Server sends automatically when the Request.Body is read.
	WriteHeader(statusCode int)
}
```

秉着面向接口开发的原则，并且为了更好的兼容第三方的API，所以我们需要实现一个自己的`ResponseWriter`对象，于是就有了`route.NewResponse(c)`，这个`resp`实现了上述的接口.

兼容了`promhttp`提供的`Handler`，也兼容了自己的`helloworld`接口。

接着我们通过`cmux`进行一个路由匹配，然后调用到对应的`ServeHTTP`,处理完逻辑之后，在`resp`的`Close()`阶段，把缓存区的所有`[]byte`，推送到连接层，然后通过返回`gnet.Close`进行网络层的断开，至此，一个简单而完整的`http交互流程`完毕。


对于`Websocket`协议来说，要做的事情也是十分繁琐（由于用了开源协议库，相对简化了很多），请先看下面的应用层协议处理逻辑。

```go
if !cdc.connected {
        wcb := &wsConnBridge{
            buff: buffer,
            c:    c,
        }
        _, err := ws.Upgrade(wcb)
        if err != nil {
            log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("upgrade[%s] to websocket error: %v", c.RemoteAddr().String(), err)})
        }
        log.Debugf(log.NetServerDebugCategory{}, "conn[%v] upgrade websocket protocol", c.RemoteAddr().String())
        cdc.connected = true
        metrics.ConnectedGauge.Inc()
        metrics.TotalConnectedCounter.WithLabelValues(WebsocketApplicationLayerProto.String()).Inc()
    } else {
        msg, op, err := wsutil.ReadClientData(c)
        if err != nil {
            if _, ok := err.(wsutil.ClosedError); !ok {
                log.Errorlog(log.NetServerErrorCategory{Summary: fmt.Sprintf("[%s] receive ws message error: %v", c.RemoteAddr().String(), err)})
            }
            return gnet.Close
        }
        log.Debugf(log.NetServerDebugCategory{}, "conn[%v] receive [op=%v] [msg=%v]", c.RemoteAddr().String(), op, string(msg))
        if op == ws.OpText {
            if rs := route.MatchRequestSpec(msg); rs == nil {
                return route.GlobalWsRouter.DefaultHandler().ServeWebsocket("/", msg, c, op)
            } else {
                return route.GlobalWsRouter.MatchHandler(rs.Path).ServeWebsocket(rs.Path, rs.Params, c, op)
            }
        }
    }
}
```

升级协议的过程中，我们用到了`github.com/gobwas/ws`这个协议库。

我们在接受到`websocket`前的时候需要先升级为websocket协议，但是这里遇到了一个问题，还是同理，我们的`gnet.Conn`的数据已经被我们取出来了，而升级的API显然就是需要提供一个可读可写的IO。

```go
// Upgrade is like Upgrader{}.Upgrade().
func Upgrade(conn io.ReadWriter) (Handshake, error) {
	return DefaultUpgrader.Upgrade(conn)
}
```

```go
// ReadWriter is the interface that groups the basic Read and Write methods.
type ReadWriter interface {
	Reader
	Writer
}

type Reader interface {
	Read(p []byte) (n int, err error)
}

type Writer interface {
	Write(p []byte) (n int, err error)
}
```

因此，我们又需要实现一个自己的`wsConnBridge`对象，主要是实现上述的接口，但是这个结构体相对来说就比较简单了，分别保存之前提出来的`[]byte`的buffer用于读行为，再保存一个`gnet.Conn`用于写行为即可。

```go
type wsConnBridge struct {
	buff *bytes.Buffer
	c    gnet.Conn
}

func (w *wsConnBridge) Read(p []byte) (n int, err error) {
	return w.buff.Read(p)
}

func (w *wsConnBridge) Write(p []byte) (n int, err error) {
	return w.c.Write(p)
}
```

升级完了，我们需要给当前的`上下文环境的Context`标记为已经升级连接完毕。

然后就是进入到数据的收发环节了。

`github.com/gobwas/ws`提供了`api`来进行数据的收发，分别有`high-level`和`low-level`，这里，我们可优先选择`high-level-api`，然后读取数据。

```go
type WebsocketHandler interface {
	ServeWebsocket(path string, data []byte, w io.Writer, op ws.OpCode) gnet.Action
}
```

读取到数据之后，又因为我需要和http的route能有一个高度匹配的代码写法，所以在路由匹配上，也是做了一个类似的`Match`的行为，然后选择到对应的`Handler`，触发统一的`ServeWebsocket()`接口（为了和http的`ServeHttp()`对应）。

到此，从`网络层到应用层`的`端口复用实现多协议`原理就到此为止了。

接着就是处理自己的业务逻辑数据了。

## 业务逻辑概述

1. 记录客服需要监控的数据规则和连接关联
2. kafka-client从监控规则中匹配合适的数据，推送到对应的fd中 

```go
// ...
var i int64 = 0
var wg sync.WaitGroup
ListenChatRuleMap.Range(func(key, value interface{}) bool {
    if Match(key.(string), kmsKey) {
        wg.Add(1)
        go func(c gnet.Conn, wsp *WsSendPayload) {
            defer wg.Done()
            err := wsutil.WriteServerMessage(c, ws.OpText, wsp.Json())
            if err != nil {
                log.Errorf(log.AppErrorCategory{Summary: fmt.Sprintf("[wsWriteServerMessage failed] [err=%v]", err)}, "[key=%s],[data=%s]", key.(string), string(wsp.Json()))
                return
            }
            atomic.AddInt64(&i, 1)
        }(value.(gnet.Conn), wsp)
    }
    return true
})
wg.Wait()
metrics.ChatLogCounterClientHistogram.WithLabelValues(strconv.FormatUint(uint64(lrc.Pid), 10), strconv.Itoa(wsp.ServerId), strconv.Itoa(wsp.AgentId)).Observe(float64(atomic.LoadInt64(&i)))
// ...
```

至此，网络层和业务层的所有需求大体已经完毕了。

## prometheus 指标

部分的指标如下，后续可以通过一些指标对服务的稳定和可靠性进行优化升级处理。

```html
# HELP chat_monitor_app_handle_chat_total Counter of handle.
# TYPE chat_monitor_app_handle_chat_total counter
chat_monitor_app_handle_chat_total{agent_id="29",app_id="19",server_id="6558"} 3
# HELP chat_monitor_net_client_recv_counter number of chat log for client
# TYPE chat_monitor_net_client_recv_counter histogram
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="1"} 0
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="2"} 0
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="4"} 2
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="8"} 3
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="16"} 3
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="32"} 3
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="64"} 3
chat_monitor_net_client_recv_counter_bucket{agent_id="29",pid="1643890670000002",server_id="6558",le="+Inf"} 3
chat_monitor_net_client_recv_counter_sum{agent_id="29",pid="1643890670000002",server_id="6558"} 12
chat_monitor_net_client_recv_counter_count{agent_id="29",pid="1643890670000002",server_id="6558"} 3
# HELP chat_monitor_net_current_connected Current Counter Gauge of ws-connected.
# TYPE chat_monitor_net_current_connected gauge
chat_monitor_net_current_connected 4
# HELP chat_monitor_net_total_connected The Total Counter of connected.
# TYPE chat_monitor_net_total_connected counter
chat_monitor_net_total_connected{type="http"} 15
chat_monitor_net_total_connected{type="websocket"} 5
# HELP chat_monitor_server_error_total Counter of error.
# TYPE chat_monitor_server_error_total counter
chat_monitor_server_error_total{type="network_server_error"} 1
# HELP chat_monitor_server_gogc The value of GOGC
# TYPE chat_monitor_server_gogc gauge
chat_monitor_server_gogc 100
# HELP chat_monitor_server_info Indicate the chat_monitor server info, and the value is the start timestamp (s).
# TYPE chat_monitor_server_info gauge
chat_monitor_server_info 1.644568978e+09
# HELP chat_monitor_server_maxprocs The value of GOMAXPROCS.
# TYPE chat_monitor_server_maxprocs gauge
chat_monitor_server_maxprocs 6
```

到这里，一些基础而核心的逻辑也介绍完了。