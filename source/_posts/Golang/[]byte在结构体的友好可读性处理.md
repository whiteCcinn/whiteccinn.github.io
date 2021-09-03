---
title: 【Golang】- []byte在结构体的友好可读性处理
date: 2021-09-03 11:16:51
categories: [Golang]
tags: [Golang]
---

## 前言

有些时候，我们会发现，`[]byte` 类型在 `struct` 中，是必不可少的结构体，因为用了`[]byte`代表可以存储字节数据，也可以叫做二进制安全的存储。代表可以存储任何数据。

如何才能做到在序列化json的情况下，可以`Println`出一个可读性的在`struct`的`[]byte`呢？

<!-- more -->

## 实现

最近我在开发我们的部门的配置服务，需要提供一个配置工具。里面设计的一个struct，有一个`[]byte`类型，就是用来存储实际数据的。但是我们在这里的时候，我们有一个查看原始数据的需求，因为我们的数据经过了`加密`，和`压缩`，最终才会放到该结构体。

简化结构体，这里列举一下例子：

```go
type V []byte

type Value struct {
	PublishTime     int64
	PublishDateTime string
	Value           V
}
```

这里我们看到，我们这里的`Value`实际就是一个`[]byte`，我们把这个结构体经过`json.Marshal`之后推送到远端`kv`服务中，一切都正常。

但是当我们需要查看的时候，就需要从远端的`kv`拉回来，经过`json.Unmarsha`处理，这个时候，我们会发现：

```json
{"PublishTime":1630636657,"PublishDateTime":"2021-09-03 02:37:37.8693941 +0000 UTC m=+0.015759101","Value":"MTIzCg=="}
```

这里，我们看到`Value`是一个经过`base64`加密过的数据，这是因为默认情况下`[]byte`将会把数据经过`base64`变成`字符串`来符合`json数据类型`。那么我们有什么版本让他显示出原来真是的数据呢？

这里我使用了一个方案，借助多一个数据结构，对`T V`进行一个`重组`。

```go
type VO []byte

type ValueReadable struct {
	PublishTime     int64
	PublishDateTime string
	Value           VO
}

func (b *VO) MarshalJSON() ([]byte, error) {
	return *b, nil
}

func (b *VO) UnmarshalJSON(input []byte) error {
	*b = input
	return nil
}
```

定义多一个`大体上一致`的结构体，注意此时的`Value`不再是`V`，而是`VO`，我们对`VO`自定义json序列化的行为，那就是把`base64`的行为给去掉。

这样子，我们得到的数据就会是

```json
{"PublishTime":1630636657,"PublishDateTime":"2021-09-03 02:37:37.8693941 +0000 UTC m=+0.015759101","Value":123}
```

细心的朋友一定发现了问题所在，那就是`Value`和`ValueReadable`怎么进行转换。

因为你存的时候是通过`Value`进行`marshal`的，那么你的`unmarsha`行为一定要对应才能解到正确的数据。

所以这里，就是我们的一个重点，我们需要借助`unsafe.Pointer`

```go
        // because []byte in struct will be base64encode
		// so you will see such as "Ik1USXpDZz09Ig=="
		// we should base64decode, so we custom a struct do not base64encode
		// struct type transform use unsafe.Pointer
		p := unsafe.Pointer(&persistenceValue)
		vr := (*config_sync.ValueReadable)(p)
		tv, err := json.Marshal(vr)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(string(tv))
```

我们利用`unsafe`的`指针`数据类型，进行一个强制转换，为什么会成功呢，因为在内存对齐的结构上，这2个对象的内存是一致的，所以我们就可以进行强制转换，而不用担心有`panic`的产生。这只是`unsafe`指针的一个灵活运用。但是可以达到我们的目的，十分的有效果。

```json
{"PublishTime":1630636657,"PublishDateTime":"2021-09-03 02:37:37.8693941 +0000 UTC m=+0.015759101","Value":123}
```

转换后，就可以看到我原本的数据了 `123`.