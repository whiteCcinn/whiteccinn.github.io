---
title: 设计模式の结构型の装饰器模式
date: 2017-06-22 09:57:00
categories: [设计模式]
tags: [设计模式, PHP]
---

# 大概的意思

一个类中有一个方法，我需要经常改它，而且会反反复复，改完了又改回去。 一般要么我们直接改原来的类中的方法，要么继承一下类覆盖这个方法。 有没有一个办法可以不用继承，只需要增加一个类进去，就可以改掉那个方法。 有，装饰器模式。

## 场景

```PHP
class plainCoffee
{
  public function makeCoffee()
  {
    $this->addCoffee();
  }

  public function addCoffee()
  {
  }
}
```

这是一个煮咖啡的程序，现在我还想加点糖，一般做法：

<!-- more -->

```PHP
class sweetCoffee extends plainCoffee
{
  public function makeCoffee()
  {
    $this->addCoffee();
    $this->addSugar();
  }

  public function addSugar()
  {
  }
}
```

好了，下面如果我还想加点奶，加点奶油，加点巧克力，加点海盐？会 extends 到崩溃。

## 装饰器

要想使用装饰器，需要对最早那个类进行改造：

```PHP
class plainCoffee
{
  public function makeCoffee()
  {
    $this->addCoffee();
  }

  public function addCoffee()
  {
  }
}
```

我们想改造 makeCoffee()这个方法，无非是在它前面或后面加点逻辑，于是：

```PHP
class plainCoffee
{
  private function before()
  {
  }

  private function after()
  {
  }

  public function makeCoffee()
  {
    $this->before();
    $this->addCoffee();
    $this->after();
  }

  public function addCoffee()
  {
  }
}
```

那么我们怎么在 before 和 after 中加入逻辑呢：

```PHP
class plainCoffee
{
  private $decorators;

  public function addDecorator($decorator)
  {
    $this->decorators[] = $decorator;
  }

  private function before()
  {
    foreach ($this->decorators as $decorator)
    {
      $decorator->before();
    }
  }

  private function after()
  {
    foreach ($this->decorators as $decorator)
    {
      $decorator->after();
    }
  }

  public function makeCoffee()
  {
    $this->before();
    $this->addCoffee();
    $this->after();
  }

  public function addCoffee()
  {
  }
}
```

改造好了，我们来看看怎么写装饰器：

```PHP
class sweetCoffeeDecorator
{
  public function before()
  {
  }

  public function after()
  {
    $this->addSugar();
  }

  public function addSugar()
  {
  }
}
```

由于我们这里这里的逻辑只会写在后面，所以 before 就留空了。

## 使用

```PHP
$coffee = new plainCoffee();

$coffee->addDecorator(new sweetCoffeeDecorator());

$coffee->makeCoffee();
```

这样就得到了加糖的 coffee，如果要加奶的，就再新建一个类似的修饰器：

```PHP
$coffee = new plainCoffee();

$coffee->addDecorator(new sweetCoffeeDecorator());

$coffee->addDecorator(new milkCoffeeDecorator());

$coffee->makeCoffee();
```

不难发现，在这里可以自由的新增或注释掉 不同的装饰器。
是不是很灵活？

当你 extends 用过后又遇到需要再次 extends 的情况时，不妨考虑一下装饰器模式。
