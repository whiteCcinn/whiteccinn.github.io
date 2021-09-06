---
title: 【Golang】- protobuf插件扩展开发2
date: 2021-09-06 09:16:51
categories: [Golang]
tags: [Golang]
---

## 前言

上一片，我们讲到了`protobuf扩展开发`的大体流程和思路，这一篇，我们来继续总结一下相关的API细节。

<!-- more -->

## API

### 第一点

```
option go_package = "github.com/xxxx/pb/go-pb/api;pb";
```

我们经常可以看到这种定义，分好前面的`github.com/xxxx/pb/go-pb/api`，我们在写代码的时候会被加载到：

```go
// 源码
func (gen *Plugin) NewGeneratedFile(filename string, goImportPath GoImportPath) *GeneratedFile

// 我们自己的代码
filename := f.GeneratedFilenamePrefix + ".api.go"
g := plugin.NewGeneratedFile(strings.TrimPrefix(filename, strings.Trim(pbPkg.String(), "\"")), f.GoImportPath)
```

这里，我们可以看到`Plugin.NewGeneratedFile`有2个参数，第一个是`filename`,另外一个是`goImportPath`，分别的含义是：

生成的文件名和这个文件被import的时候，应该要怎么import。

- 这个文件名需要注意的是，这是一个全路径文件名，如果你的文件名种存在`/`，那么前面的都是`目录`，直到最后一个，才是文件名。
- 例如我这里的是`github.com/xxxx/pb/go-pb/api`，那么生成的文件被引用的时候，就会`import "github.com/xxxx/pb/go-pb/api"`。

看到这里，我们再来看看分号后面的`pb`，这个在外面写代码的时候到体现是：

```go
// 我们自己的代码
g.P("package " + f.GoPackageName)
```

看到其实这个`pb`会被加载进文件的`GoPackageName`种，所以分号前面的意义是不同的，前面的对应`filename`和`GoImportPath`,后面对应的就是`GoPackageName`

### 第二点

```go
var (
	pbPkg = protogen.GoImportPath("github.com/xxx/pb/go-pb")
)
```

在代码中，我们会定义一些这样子的xxxPkg的变量，他们由`protogen.GoImportPath`来包装起来，在使用上就是：

```go
g.P("     ", method.GoName, "Api = ", pbPkg.Ident("NewApi"), "(\"", method.GoName, "\", \"", m, "\", \"", url, "\")")
```

看到这里的`pbPkg.Ident("NewApi")`，意思就是这个要调用`pbPkg`包下的`NewApi`的方法。

值得注意的是，这里用到的`Ident()`API，顾名思义就是`.`的意思。

### 第三点

有时候，我们调用`Plugin.NewGeneratedFile`，创建了生成文件实例并且已经预写入了一些内容，但是实际代码中，并`没有任何有意义`有价值的代码，那么这个时候我希望这个文件`不要生成`，我就可以调用`Skip()`的API。

```go
// 我们自己的代码
g := plugin.NewGeneratedFile(strings.TrimPrefix(filename, strings.Trim(pbPkg.String(), "\"")), f.GoImportPath)
g.Skip()
```

那么这个文件在最终将不会被生成。
