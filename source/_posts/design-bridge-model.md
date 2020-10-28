---
title: 设计模式の结构型の桥接模式
date: 2017-06-20 15:45:00
categories: [设计模式]
tags: [设计模式, PHP]
---

# 目的

我们知道一个类可以实现多个接口，一个接口对应多个实现。 在不同的实现类中，它实现接口方法的逻辑是不一样的。 有时候我们需要对这些抽象方法进行一些组合，修改，但是又能适用于所有实现类。 这时候我们需要做一个桥，连接不同的实现类并统一标准。

### 一个接口多个实现

```PHP
// 格式化接口
interface FormatterInterface
{
  public function format(string $text);
}

// 文本格式化
class PlainTextFormatter implements FormatterInterface
{
  public function format(string $text)
  {
    return $text;
  }
}

// HTML格式化
class HtmlFormatter implements FormatterInterface
{
  public function format(string $text)
  {
    return sprintf('<p>%s</p>', $text);
  }
}
```

<!-- more -->

## 桥接核心

```PHP
abstract class Service
{
  protected $implementation;

  //初始化一个FormatterInterface的实现
  public function __construct(FormatterInterface $printer)
  {
    $this->implementation = $printer;
  }

  // 可以跟换实现
  public function setImplementation(FormatterInterface $printer)
  {
    $this->implementation = $printer;
  }

  //桥接抽象方法
  abstract public function get();
}
```

## 具体桥接

```PHP
class HelloWorldService extends Service
{
  //桥接抽象方法的实现，这个方法是关键，因为它不在受限于原有的接口方法，而是可以自由组合修改，并且你可以编写多个类似的方法，这样就和原接口解耦了。
  public function get()
  {
    return $this->implementation->format('Hello World') . '-这是修改的后缀';
  }
}
```

## 使用

```PHP
$service = new HelloWorldService(new PlainTextFormatter());

echo $service->get(); //Hello World-这是修改的后缀

//在这里切换实现很轻松
$service->setImplementation(new HtmlFormatter());

echo $service->get(); //<p>Hello World</p>-这是修改的后缀
```
