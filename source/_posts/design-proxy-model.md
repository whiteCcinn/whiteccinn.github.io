---
title: 设计模式の结构型の代理模式
date: 2017-06-22 11:50:00
categories: [设计模式]
tags: [设计模式, PHP]
---

## 大概意思

这个模式其实比较简单，就是你想访问一个类的时候，不直接访问，而是找这个类的一个代理。
代理就是中介，有中介就意味着解耦。

在代理模式下，代理对象和被代理的对象，有个重要特点：必须继承同一个接口。

这里说下重点，之前说过的 适配器模式，和代理模式非常非常像，只不过是在适配器模式下，适配器和它要适配的类没有继承同一接口，适配器就是要把这个第三方类变成符合接口规范。适配器也是个中介，所以我说它们很像。
实现

接口：

```PHP
interface Image
{
  public function getWidth();
}
```

现在我们有一个 Image 接口类，接口定义 getWidth 方法。现在我们需要一个具体类（实现类）来实现这个接口。

<!-- more -->

实现类：

```PHP
class RawImage implements Image
{
  public function getWidth()
  {
    return "100 x 100";
  }
}
```

代理类

```PHP
class ImageProxy implements Image
{
  private $img;

  public function __construct()
  {
    $this->img = new RawImage();
  }

  public function getWidth()
  {
    return $this->img->getWidth();
  }
}
```

实现了同一个接口的目的是，接口是对外开放的，设计模式的原则是对内封闭。也就是说，如果别人给到的模式就是这样子的，你通过实现一样的接口，或者说是继承了同一个接口的设计模式，就可以额外的添加业务逻辑在里面判断了，我们经常也用到这种模式，例如在控制器里面

```PHP
class A{
  public function __construct(){}
}

class B extends A{
  public function __construct(){
   echo '做我想做';
   parents::__construct();
   echo '做我想做';
  }
}
```

这样子就可以很好的用到了代理模式。

## 作用

显而易见，解耦。因为代理和被代理对象 都实现同一接口，所以对于原真实对象，你无论怎么改都行。同样，在代理对象中，除了如实反映真实对象的方法逻辑，你还可以添加点别的逻辑，怎么添加都行，不会影响到真实对象，添加后可以在所有使用过代理对象的业务逻辑中瞬间更新。
