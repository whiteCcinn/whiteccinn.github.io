---
title: 设计模式の结构型の门面模式
date: 2017-06-22 11:19:00
categories: [设计模式]
tags: [设计模式, PHP]
---

## 概念

用过 Laravel 的朋友的应该熟悉，Laravel 给我们科普了一个概念 Facade，然而 Laravel 中的 Facade 并不是真正设计模式中定义的 Facade，那么为什么它们都叫一个名字呢？

我们还是先来了解一下 Facade 这个单词的意思吧。
首先它的读音是[fəˈsɑːd]，源自法语 façade，法语这个词原意就是 frontage，意思是建筑的正面，门面，由于以前法国，意大利的建筑只注重修葺临街的一面，十分精美，而背后却比较简陋，所以这个词引申的意思是表象，假象。

## 先讲设计模式中的概念

在设计模式中，其实 Facade 这个概念十分简单。

它主要讲的是设计一个接口来统领所有子系统的功能。看完下面这个例子就明白了：

<!-- more -->

```PHP
class CPU
{
  public function freeze(){ /*...*/}

  public function jump(){/*...*/}

  public function execute(){/*...*/}
}

class HardDrive
{
  public function read($boot_sector, $sector_size){/*...*/}
}

class Memory
{
  public function load($boot_address, $hd_data){/*...*/}
}
```

这是三个电脑中的子系统，我们需要写一个总系统来组织它们之间的关系，这其实就是 Facade：

```PHP

class ComputerFacade
{
  private $cpu;
  private $ram;
  private $hd;

  public function __construct()
  {
    $this->cpu = new CPU();
    $this->ram = new Memory();
    $this->hd  = new HardDrive();
  }

  public function start()
  {
    $this->cpu->freeze();
    $this->ram->load(BOOT_ADDRESS, $this->hd->read(BOOT_SECTOR, SECTOR_SIZE));
    $this->cpu->jump(BOOT_ADDRESS);
    $this->cpu->execute();
  }
}
```

## 使用：

```PHP
$computer = new ComputerFacade();
$computer->start();
```

门面模式其实就是这么回事，由一个门面（入口）把所有子系统隐藏起来了，只需要操作门面就可以，也可以理解为对外的，别人只知道有个 start 开机键，但是里面是怎么跑的，别人压根不清楚。
