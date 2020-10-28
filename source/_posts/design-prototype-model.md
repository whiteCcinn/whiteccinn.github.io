---
title: 设计模式の创建型の原型模式
date: 2017-06-20 11:46:00
categories: [设计模式]
tags: [设计模式, PHP]
---

## 实质就是 对象的复制

对一些大型对象，每次去 new，初始化开销很大，这个时候我们 先 new 一个模版对象，然后其他实例都去 clone 这个模版， 这样可以节约不少性能。
这个所谓的模版，就是原型（Prototype）；
当然，原型模式比单纯的 Clone 要稍微升级一下。

## 普通 clone

new 和 clone 都是用来创建对象的方法。
在 PHP 中， 对象间的赋值操作实际上是引用操作 （事实上，绝大部分的编程语言都是如此! 主要原因是内存及性能的问题) ，比如：

<!-- more -->

```PHP
class ProClass
{
  public $data;
}

$obj1       = new ProClass();
$obj1->data = "aaa";
$obj2       = $obj1;
$obj2->data = "bbb";     //$obj1->data的值也会变成"bbb"

var_dump($obj1->data);
```

但是如果你不是直接引用，而是 clone，那么相当于做了一个独立的副本：

```PHP
$obj2 = clone $obj1;
$obj2->data ="bbb";     //$obj1->data的值还是"aaa"，不会关联
```

这样就得到一个和被复制对象完全没有纠葛的新对象，但两个对象长得是一模一样的。

## 浅复制和深复制

如果你以为你已经把它俩彻底分开了，你错了，没那么容易, 我们再看一个复杂点例子。
继续接着上面的例子看:

```PHP
class ProClass
{
  public $data;
  public $item;
}

$obj1       = new ProClass();
$obj1->data = "aaa";

class itemObject
{
  public $count = 0;

  public function add()
  {
    $this->count = ++$this->count;
  }
}

$item       = new itemObject;
$obj1->item = $item;
$obj2       = clone $obj1;

$obj2->data = "bbb";

var_dump($obj1->data);  // aaa
var_dump($obj2->data);  // bbb

// 到目前为止,一切都没问题,已经隔离开了.
// 但是到这里之后，运行以下代码
$obj2->item->add();

print_r($item);   // count = 1
print_r($obj1);   // count = 1
print_r($obj2);   // count = 1

// 发现$obj1,$obj2的count都变成了1,发现又依赖上了，并没有完全隔离开。这就是所谓的 浅复制
```

我们既然要 Clone，目的就是要把 两个对象 完全分离开。

所以我们来聊一下 `深复制` 的方法：

非常简单，在被复制对象中加一个魔术方法就可以了。

```
class ProClass
{
  public $data;
  public $item;
  public function __clone() {
    $this->item = clone $this->item;
  }
}
```

## 正解

```PHP
interface Prototype
{
  public function copy();
}

class ConcretePrototype implements Prototype
{
  private $_name;

  public function __construct($name)
  {
    $this->_name = $name;
  }

  public function copy()
  {
    return clone $this;
  }
}

class Demo
{
}

// client
$demo    = new Demo();
$object1 = new ConcretePrototype($demo);
$object2 = $object1->copy();
```

从上面的例子不难看出，所谓原型模式就是不直接用 clone 这种关键字写法，而是创建一个原型类。

把需要被复制的对象丢进 原型类里面，然后这个类就具有了 复制自己的能力（方法），并且可以继承原型的一些公共的属性和方法。
