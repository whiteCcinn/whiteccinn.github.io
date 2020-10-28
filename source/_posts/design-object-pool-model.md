---
title: 设计模式の创建型の原型模式
date: 2017-06-20 11:46:00
categories: [设计模式]
tags: [设计模式, PHP]
---

简介

对象池（也称为资源池）被用来管理对象缓存。对象池是一组已经初始化过且可以直接使用的对象集合，用户在使用对象时可以从对象池中获取对象，对其进行操作处理，并在不需要时归还给对象池而非销毁它。

若对象初始化、实例化的代价高，且需要经常实例化，但每次实例化的数量较少的情况下，使用对象池可以获得显著的性能提升。常见的使用对象池模式的技术包括线程池、数据库连接池、任务队列池、图片资源对象池等。

当然，如果要实例化的对象较小，不需要多少资源开销，就没有必要使用对象池模式了，这非但不会提升性能，反而浪费内存空间，甚至降低性能。

<!-- more -->

```PHP
class ObjectPool
{
  private $instances = [];

  public function get($key)
  {
    if (isset($this->instances[ $key ]))
    {
      return $this->instances[ $key ];
    } else
    {
      $item                    = $this->make($key);
      $this->instances[ $key ] = $item;

      return $item;
    }
  }

  public function add($object, $key)
  {
    $this->instances[ $key ] = $object;
  }

  public function make($key)
  {
    if ($key == 'mysql')
    {
      return new Mysql();
    } elseif ($key == 'socket')
    {
      return new Socket();
    }
  }
}

class ReusableObject
{
  public function doSomething()
  {
    // ...
  }
}
```

# 说明

上面的例子其实只是一个最基础的例子，对象池的理念还有很多的升级版本，像对象个数的控制，就有动态扩展容器对象的做法，也有静态固定的做法，还有初始化和静态固定之间浮动的做法。所有的线程池之类的概念，其实都是设计模式的对象池的思想。
