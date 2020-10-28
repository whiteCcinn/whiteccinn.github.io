---
title: 设计模式の行为型の观察者模式
date: 2017-06-22 14:26:45
categories: [设计模式]
tags: [设计模式, PHP]
---

# 大概说明

如果我希望一个动作在发生的时候，希望订阅他这个动作的所有人都知道了有这么一件事的话，那么就采用观察者模式。

## 没用观察者模式的情况下

```PHP
class Event
{
  function trigger()
  {
    echo "Event update!<br/>";

    //具体更新逻辑

    echo "update1<br/>";

    echo "update2<br/>";

    // ...
  }
}

//使用
$event = new Event;

$event->trigger();
```

这个事件的触发可以看到如果我不断的有新的人需要订阅的话，那么这个 `trigger` 方法不断的就是要添加新的逻辑和业务。违反了设计模式-开闭原则，就是对修改关闭，对扩展开放的原则。

<!-- more -->

## 观察者模式

```PHP
//声明一个抽象的事件发生者基类

abstract class EventGenerator
{
  private $observers = array();

  //添加观察者方法
  function addobserver(Observer $observer)
  {
    $this->observers[] = $observer;
  }

  //对每个添加的观察者进行事件通知
  function notify()
  {
    //对每个观察者逐个去更新
    foreach ($this->observers as $observer)
    {
      $observer->update();
    }
  }
}
```

```PHP
//声明一个观察者接口

interface observer
{
  function update($event_info = null);
}
```

```PHP
//声明多个观察者

class Observer1 implements observer
{
  function update($event_info = null)
  {
    echo "逻辑1<br/>";
  }
}

class Observer2 implements observer
{
  function update($event_info = null)
  {
    echo "逻辑2<br/>";
  }
}
```

```PHP
//使用
$event = new Event;

$event->addObserver(new Observer1);

$event->addObserver(new Observer2);

$event->trigger();

//仔细观察代码其实很简单的，Event基类里的foreach，可以实现一个事件对应多个观察者；
在这里我们搞明白了，所谓观察者其实就是事件的handler，它和事件怎么挂钩呢，其实是需要注册一下；

$event->addObserver(new Observer1);
$event->addObserver(new Observer2);

//而这个步骤

$event = new Event;
$event->trigger();
```

这样子，就只需要注册对应的 handler 到 listered 里面便可以实现主动推送小新给“订阅者”。
