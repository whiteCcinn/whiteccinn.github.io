---
title: 设计模式の行为型の策略模式
date: 2017-06-22 15:23:00
categories: [设计模式]
tags: [设计模式，PHP]
---

## 基本概念

策略模式是一个非常常用，且非常有用的设计模式。
简单的说，它是当你使用大量 if else 逻辑时的救星。
if else 就是一种判断上下文的环境所作出的策略，如果你把 if else 写死，那么在复杂逻辑的时候你会发现代码超级长，而且最蛋疼的是，当你以后要新增策略时，再写一个 elseif？
万一这个逻辑要修改 20 个地方呢？
一口老血吐在屏幕上…
策略模式就是来解决这个问题的。
举一个场景，商城的首页，男的进来看男性商品，女的进来看女性商品，不男不女…以此类推，各种条件下用不同策略展示不同商品。

<!-- more -->

## 实现

### showStrategy . php 展示策略接口

```PHP
interface showStrategy
{
  public function showCategory();
}
```

### maleShowStrategy . php 男性用户展示策略

```PHP
class maleShowStrategy implements showStrategy
{ // 具体策略A
  public function showCategory()
  {
    echo '展示男性商品目录';
  }
}
```

### femaleShowStrategy . php 女性用户展示策略

```PHP
class femaleShowStrategy implements showStrategy
{ // 具体策略B
  public function showCategory()
  {
    echo '展示女性商品目录';
  }
}
```

### page . php 展示页面

```PHP
class Page
{
  private $_strategy;

  public function __construct(showStrategy $strategy)
  {
    $this->_strategy = $strategy;
  }

  public function showPage()
  {
    $this->_strategy->showCategory();
  }
}
```

## 使用

```PHP
$_GET['male'] = 1;

if (isset($_GET['male']))
{
  $strategy = new maleShowStrategy();
} elseif (isset($_GET['female']))
{
  $strategy = new femaleShowStrategy();
}
//注意看这里上下，Page类不再依赖一种具体的策略，而是只需要绑定一个抽象的接口，这就是传说中的控制反转（IOC）。
$question = new Page($strategy);

$question->showPage();
```

## 总结

仔细看上面的例子，不复杂，我们发现有 2 个好处：

它把 if else 抽离出来了，不需要在每个类里都写 if else；

它成功的实现了控制反转，Page 类里没有具体的依赖策略，这样我们就可以随时添加和删除 不同的策略。
