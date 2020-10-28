---
title: 【Laravel】Service Providers 服务提供者
date: 2018-07-08 14:10:46
categories: [PHP]
tags: [PHP, Laravel]
---

## 前言

服务提供者和服务容器是两个不同的概念，在我看来，服务提供者是 Laravel 应用启动的中心，你自己的应用以及所有 Laravel 的核心服务都是通过服务提供者启动。

## 正文

里面有 2 个核心的方法，分别是

- register（一般用于将服务的对象绑定到服务容器中，不做其他事情。）
- boot （在 register 之后，将会调用这个 boot 方法，这个 boot 方法`允许依赖注入`。）

里面 2 个核心的属性，分别是

- bindings
- singletons

具体的用处就是用于服务器容器依赖注入用的。

<!-- more -->

官方提供的例子如下：

```PHP
class AppServiceProvider extends ServiceProvider
{
    /**
     * All of the container bindings that should be registered.
     *
     * @var array
     */
    public $bindings = [
        ServerProvider::class => DigitalOceanServerProvider::class,
    ];

    /**
     * All of the container singletons that should be registered.
     *
     * @var array
     */
    public $singletons = [
        DowntimeNotifier::class => PingdomDowntimeNotifier::class,
    ];
}
```

我们定义好了之后需要注册到系统中，找到`config/app.php`

```PHP
'providers' => [
    // 其它服务提供者
    App\Providers\ComposerServiceProvider::class,
],
```

这样子就注册好了。

注册好了之后，系统会在启动的时候就初始化服务提供者。

当然，如果你觉得这样子十分眼中影响性能的话，也有一个`延迟加载`的`属性`

```PHP
/**
 * 服务提供者加是否延迟加载.
 *
 * @var bool
 */
protected $defer = true;
```

定义了这个属性之后，在你用到这些服务提供者的时候才会去加载。
