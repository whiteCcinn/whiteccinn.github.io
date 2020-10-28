---
title: 设计模式の创建型の单例模式
date: 2017-06-20 10:22:00
categories: [设计模式]
tags: [设计模式，PHP]
---

# 简介

很容易理解，也很简单。

最常见的场景就是一个数据库的链接，我们每次请求只需要连接一次，也就是说如果我们用类来写的话，只需要用一个实例就够了（多了浪费）。

<!-- more -->

```PHP
<?php
class Mysql
{
  //该属性用来保存实例
  private static $conn;

  //构造函数为private,防止创建对象
  private function __construct()
  {
    self::$conn = mysqli_connect('localhost', 'root', '');
  }

  //创建一个用来实例化对象的方法，如果不存在一个这个类的实例属性，就创建一个，否则就取这个实例属性。
  public static function getInstance()
  {
    if (!(self::$conn instanceof self))
    {
      self::$conn = new self;
    }

    return self::$conn;
  }

  //防止对象被复制
  public function __clone()
  {
    trigger_error('Clone is not allowed !');
  }

  //防止反序列化后创建对象
  private function __wakeup()
  {
    trigger_error('Unserialized is not allowed !');
  }
}

//只能这样取得实例，不能new 和 clone
$mysql = Mysql::getInstance();
```

# 说明

单例模式其实分为 2 种，PHP 中最常用的是懒汉模式，意识就是需要加载的时候才去实例化，还有一种就是叫饿汉模式，就是一开始就开始实例化了，但是由于 PHP 不支持在类定义时给类的成员变量赋予非基本类型的值。如表达式，new 操作等等，所以 PHP 中就不存在饿汉模式了。
