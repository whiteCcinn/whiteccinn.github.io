---
title: 【Golang】- unsafe Pointer
date: 2020-01-14 11:37:12
categories: [Golang]
tags: [Golang]
---

## 前言

由于目前在使用使用一些go写的odbc库，里面涉及到一些cgo的内容，那就避不开内存和指针等问题，在这边文章中记录一下`unsafe Pointer` 和 `uintptr` 的相关内容。

Go语言在设计的时候，为了编写方便、效率高以及降低复杂度，被设计成为一门强类型的静态语言。强类型意味着一旦定义了，它的类型就不能改变了；静态意味着类型检查在运行前就做了。

同时为了安全的考虑，Go语言是不允许两个指针类型进行转换的。

<!-- more -->

## 指针类型转换

我们一般使用`*T`作为一个指针类型，表示一个指向类型`T变量`的`指针`。为了安全的考虑，两个不同的指针类型不能相互转换，比如`*int`不能转为`*float64`。

```go
func main() {
	i:= 10
	ip:=&i

	var fp *float64 = (*float64)(ip)

	fmt.Println(fp)
}
```

以上代码我们在编译的时候，会提示 `cannot convert ip (type *int) to type *float64`，也就是不能进行强制转型。那如果我们还是需要进行转换怎么做呢？这就需要我们使用 `unsafe包` 里的 `Pointer` 了，下面我们先看看 `unsafe.Pointer` 是什么，然后再介绍如何转换。


## unsafe.Pointer

`unsafe.Pointer` 是一种特殊意义的指针，它可以包含任意类型的地址，有点类似于 `C语言` 里的 `void*` 指针，全能型的。

```go
func main() {
	i:= 10
	ip:=&i

	var fp *float64 = (*float64)(unsafe.Pointer(ip))

	*fp = *fp * 3

	fmt.Println(i)
}
```

以上示例，我们可以把 `*int` 转为 `*float64` ,并且我们尝试了对新的 `*float64` 进行操作，打印输出i，就会发现i的址同样被改变。

以上这个例子没有任何实际的意义，但是我们说明了，通过 `unsafe.Pointer` 这个万能的指针，我们可以在 `*T` 之间做任何转换。


```go
type ArbitraryType int

type Pointer *ArbitraryType
```

可以看到 `unsafe.Pointer` 其实就是一个 `*int`,一个通用型的指针。

我们看下关于 `unsafe.Pointer` 的4个规则。

- `任何指针` 都可以转换为 `unsafe.Pointer`
- `unsafe.Pointer` 可以转换为 `任何指针`
- `uintptr` 可以转换为 `unsafe.Pointer`
- `unsafe.Pointer` 可以转换为 `uintptr`

前面两个规则我们刚刚已经演示了，主要用于 `*T1` 和 `*T2` 之间的转换，那么最后两个规则是做什么的呢？我们都知道 `*T` 是 `不能计算偏移量` 的，也不能进行计算，`但是uintptr可以`，所以我们可以把`指针`转为`uintptr`再`进行偏移计算`，这样我们就可以`访问特定的内存`了，达到对不同的`内存读写`的目的。


下面我们以通过`指针偏移` 修改Struct结构体内的字段为例，来演示 `uintptr` 的用法。

```go
func main() {
	u:=new(user)
	fmt.Println(*u)

	pName:=(*string)(unsafe.Pointer(u))
	*pName="张三"

	pAge:=(*int)(unsafe.Pointer(uintptr(unsafe.Pointer(u))+unsafe.Offsetof(u.age)))
	*pAge = 20

	fmt.Println(*u)
}

type user struct {
	name string
	age int
}
```

以上我们通过内存偏移的方式，定位到我们需要操作的字段，然后改变他们的值。

第一个修改user的name值的时候，`因为name是第一个字段，所以不用偏移`，我们获取user的指针，然后通过 `unsafe.Pointer` 转为`*string` 进行赋值操作`即可`。

第二个修改user的age值的时候，`因为age不是第一个字段，所以我们需要内存偏移`，内存偏移牵涉到的计算只能通过`uintptr`，所我们要先把`user的指针地址`转为`uintptr`，然后我们再通过`unsafe.Offsetof(u.age)`获取需要偏移的值，进行`地址运算(+)偏移`即可。

现在偏移后，地址已经是user的age字段了，如果要给它赋值，我们需要把`uintptr`转为`*int`才可以。所以我们通过把`uintptr`转为`unsafe.Pointer`,再转为`*int`就可以操作了。

这里我们可以看到，我们第二个偏移的表达式非常长，但是也千万不要把他们分段，不能像下面这样。

```go
temp:=uintptr(unsafe.Pointer(u))+unsafe.Offsetof(u.age)
pAge:=(*int)(unsafe.Pointer(temp))
*pAge = 20
```

栈内指针在栈扩容的时候，有了新的地址，因此`uintptr`只能作为指针计算的中间态，`不允许`使用变量`保存uintptr的值`。

## 小结

`unsafe是不安全的，所以我们应该尽可能少的使用它`，比如内存的操纵，这是绕过Go本身设计的安全机制的，不当的操作，可能会破坏一块内存，而且这种问题非常不好定位。

当然必须的时候我们可以使用它，比如底层类型相同的数组之间的转换；比如使用sync/atomic包中的一些函数时；还有访问Struct的私有字段时，该用还是要用，不过一定要慎之又慎。

`整个unsafe包都是用于Go编译器的，不用运行时，在我们编译的时候，Go编译器已经把他们都处理了`。
