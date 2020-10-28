---
title: 设计模式の结构型の适配器模式
date: 2017-06-20 11:54:00
categories: [设计模式]
tags: [设计模式, PHP]
---

## 说明

我们先来看看下面的代码。先来看看接口的作用。

```PHP
// 目标角色(对外一致的接口)
interface Database
{
  public function connect();

  public function query();

  public function close();
}

class Mysql implements Database
{
  public function connect()
  {
    //mysql 的逻辑
  }

  public function query()
  {
    //mysql 的逻辑
  }

  public function close()
  {
    //mysql 的逻辑
  }
}

class Pdo implements Database
{
  public function connect()
  {
    //Pdo 的逻辑
  }

  public function query()
  {
    //Pdo 的逻辑
  }

  public function close()
  {
    //Pdo 的逻辑
  }
}

//使用
$database = new Mysql(); //切换数据库只要改这一行就行了，因为后面的都是标准接口方法，不管哪个数据库都一样。
$database->connect();
$database->query();
$database->close();
```

<!-- more -->

# 问题

有些第三方的 数据库类并没有按照我的接口来实现，而是有自己不同的方法，这个时候我们就需要有一个适配器类，来先处理一下这个异类。 作用有点像把 110v 电源转换成为 220v（电源适配器）。

```PHP
//第三方数据库类(源角色)
class Oracle
{
  public function oracleConnect()
  {
    //Oracle 的逻辑
  }

  public function oracleQuery()
  {
    //Oracle 的逻辑
  }

  public function oracleClose()
  {
    //Oracle 的逻辑
  }
}
```

## 适配器模式

```PHP
// 适配器角色
class Adapter implements Database
{
  private $adaptee;

  function __construct($adaptee)
  {
    $this->adaptee = $adaptee;
  }

  //这里把异类的方法转换成了 接口标准方法，下同
  public function connect()
  {
    $this->adaptee->oracleConnect();
  }

  public function query()
  {
    $this->adaptee->oracleQuery();
  }

  public function close()
  {
    $this->adaptee->oracleClose();
  }
}
```

使用上：

```PHP
$adaptee  = new Oracle();
$adapter  = new Adapter($adaptee);//只要改这个类就行了，后面的都可以不用改；
// OR
// $adapter  = new Mysql();
$database = $adapter;
$database->connect();
$database->query();
$database->close();
```

所以说，适配器对应不同的具体类,这个类实现目标角色的所有接口，但是由于源角色的操作个不一致,所以需要一个适配器适配一个源角色。很简单，也很实用。

注意，还可以结合抽象类和借口分别做文章，最终的目的就是目标角色的统一性。
