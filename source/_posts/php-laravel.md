---
title: 【Laravel】Service Container 服务容器用法
date: 2018-07-08 12:50:00
categories: [PHP]
tags: [PHP, Laravel]
---

## 前言

Laravel 是一款 PHP 开源框架，最近学习了一下 Symfony，现在来了解一下 Laravel 的最新版本的一些东西。

其实说到服务器容器，相信大家都会直接提到`依赖注入`的概念，其实服务容器的概念，就和我们设计模式中的对象池差不多，把所有的对象都放在一个池子里面去，而不必一个个去 new 了。而且支持每次都新建和单例，等等。

在这些的基础之上，衍生出了 2 个概念`Ioc：控制反转`，`Di：依赖注入`，这些概念，在我的认知里，早起出自 java 框架之中。主要的目的就是实现对象依赖解耦。具体的设计模式的理念，可以参考我博客中的设计模式一系列的文章。

下述主要参考了谋篇 laravel 服务容器介绍摘录+部分自我实践整理。对比了一下和官网的介绍差不多，更多的主要是例子的说明。

## 正题

Laravel 中有一大堆访问 Container 实例的姿势，比如最简单的：

```PHP
$container = app();
```

<!-- more -->

但我们还是先关注下 Container 类本身。

```PHP
Laravel 官方文档中一般使用 $this->app 代替 $container。它是 Application 类的实例，而 Application 类继承自 Container 类。

```

#### 用法一：基本用法，用`type hint (类型提示) 注入` 依赖：

```PHP
<?php

include './vendor/autoload.php';

use Illuminate\Container\Container;
$container = Container::getInstance();

class MyClass
{
    private $dependency;

    public function __construct(AnotherClass $dependency)
    {
        $this->dependency = $dependency;
    }
}

class AnotherClass{

}

$instance = $container->make(MyClass::class);

var_dump($instance)
```

接下来用 Container 的 make 方法来代替 new MyClass:

```PHP
$instance = $container->make(MyClass::class);
```

Container 会自动实例化依赖的对象，所以它等同于：

```PHP
$instance = new MyClass(new AnotherClass());
```

如果 AnotherClass 也有 依赖，那么 Container 会递归注入它所需的依赖。

> Container 使用 Reflection (反射) 来找到并实例化构造函数参数中的那些类。

#### 用法二：Binding Interfaces to Implementations (绑定接口到实现)

用 Container 可以轻松地写一个接口，然后在运行时实例化一个具体的实例。 首先定义接口：

```PHP
interface MyInterface { /* ... */ }
interface AnotherInterface { /* ... */ }
```

然后声明实现这些接口的具体类。下面这个类不但实现了一个接口，还依赖了实现另一个接口的类实例：

```PHP
class MyClass implements MyInterface
{
    private $dependency;

    // 依赖了一个实现 AnotherInterface 接口的类的实例
    public function __construct(AnotherInterface $dependency)
    {
        $this->dependency = $dependency;
    }
}
```

现在用 Container 的 bind() 方法来让每个 接口 和实现它的类一一对应起来：

```PHP
$container->bind(MyInterface::class, MyClass::class);
$container->bind(AnotherInterface::class, AnotherClass::class);
```

最后，用`接口名` **而不是** `类名` 来传给 make():

```PHP
$instance = $container->make(MyInterface::class);
```

> 注意：如果你忘记绑定它们，会导致一个 Fatal Error:"Uncaught ReflectionException: Class MyInterface does not exist"。

实战

下面是可封装的 Cache 层：

```php
interface Cache
{
    public function get($key);
    public function put($key, $value);
}
class Worker
{
    private $cache;

    public function __construct(Cache $cache)
    {
        $this->cache = $cache;
    }

    public function result()
    {
        // 去缓存里查询
        $result = $this->cache->get('worker');

        if ($result === null) {
             // 如果缓存里没有，就去别的地方查询，然后再放进缓存中
            $result = do_something_slow();

            $this->cache->put('worker', $result);
        }

        return $result;
    }
}
use Illuminate\Container\Container;

$container = Container::getInstance();
$container->bind(Cache::class, RedisCache::class);

$result = $container->make(Worker::class)->result();
// 这里用 Redis 做缓存，如果改用其他缓存，只要把 RedisCache 换成别的就行了，easy!
```

## 用法三：Binding Abstract & Concret Classes （绑定抽象类和具体类）

绑定还可以用在抽象类：

```PHP
$container->bind(MyAbstract::class, MyConcreteClass::class);
```

或者继承的类中：

```PHP
$container->bind(MySQLDatabase::class, CustomMySQLDatabase::class);
```

## 用法四：自定义绑定

如果类需要一些附加的配置项，可以把 bind() 方法中的第二个参数换成 Closure (闭包函数)：

```PHP
$container->bind(Database::class, function (Container $container) {
    return new MySQLDatabase(MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASS);
});
```

闭包也可用于定制 具体类 的实例化方式：

```PHP
$container->bind(GitHub\Client::class, function (Container $container) {
    $client = new GitHub\Client;
    $client->setEnterpriseUrl(GITHUB_HOST);
    return $client;
});
```

## 用法五：Resolving Callbacks (回调)

可用 `resolveing()`方法来注册一个 callback (回调函数)，而不是直接覆盖掉之前的 绑定。 `这个函数会在绑定的类解析完成之后调用`。

<font color="red">注意此时的回调函数中，第一个参数是对应被解析的对象，第二个参数是容器(container)<=>应用(app)</font>.

```PHP
$container->resolving(GitHub\Client::class, function ($client, Container $container) {
    $client->setEnterpriseUrl(GITHUB_HOST);
});
```

如果有一大堆 callbacks，他们全部都会被调用。对于 `接口` 和 `抽象类` 也可以这么用：

```PHP
$container->resolving(Logger::class, function (Logger $logger) {
    $logger->setLevel('debug');
});

$container->resolving(FileLogger::class, function (FileLogger $logger) {
    $logger->setFilename('logs/debug.log');
});

$container->bind(Logger::class, FileLogger::class);

$logger = $container->make(Logger::class);
```

更 `diao` 的是，还可以注册成「**什么类解析完之后都调用**」：

```
$container->resolving(function ($object, Container $container) {
    // ...
});
```

> 但这个估计只有 `logging`和 `debugging` 才会用到。

## 用法六：Extending a Class (扩展一个类)

使用 extend() 方法，可以封装一个类然后返回一个不同的对象 (代理模式)：

<font color="red">（为什么不是装饰器模式？，因为装饰器模式不需要实现一样的接口，但是代理模式下，代理类需要和原来的类一样实现同一接口）</font>.

```PHP
$container->extend(APIClient::class, function ($client, Container $container) {
    return new APIClientProxy($client);
});
```

<font color="red">注意：这两个类要实现相同的 `接口`，不然用类型提示的时候会出错：</font>.

```PHP
interface Getable
{
    public function get();
}
class APIClient implements Getable
{
    public function get()
    {
        return 'yes!';
    }
}
class APIClentProxy implements Getable
{
    private $client;

    public function __construct(APIClient $client)
    {
        $this->client = $client;
    }

    public function get()
    {
        return 'no!';
    }
}
class User
{
    private $client;

    public function __construct(Getable $client)
    {
        $this->client = $client;
    }
}

$container->extend(APIClient::class, function ($client, Container $container) {
    return new APIClentProxy($client);
});

$container->bind(Getable::class, APIClient::class);

// 此时 $instance 的 $client 属性已经是 APIClentProxy 类型了
$instance = $container->make(User::class);
```

## 用法七：单例

使用 `bind()` 方法绑定后，每次解析时都会`新实例化`一个对象(或重新调用闭包)，如果想获取 `单例` ，则用 `singleton()` 方法**代替** `bind()`：

```PHP
$container->singleton(Cache::class, RedisCache::class);
```

绑定单例 闭包

```PHP
$container->singleton(Database::class, function (Container $container) {
    return new MySQLDatabase('localhost', 'testdb', 'user', 'pass');
});
```

绑定 `具体类` 的时候，不需要第二个参数：

```PHP
$container->singleton(MySQLDatabase::class);
```

在每种情况下，`单例` 对象将在第一次需要时创建，然后在后续重复使用。

如果你已经有一个 `实例` 并且想`重复使用`，可以用 `instance()` 方法。

```PHP
$container->instance(Container::class, $container);
```

> Laravel 就是用这种方法来确保每次获取到的都是同一个 Container 实例：

## 用法七：Arbitrary Binding Names (任意绑定名称)

`Container` 还可以<font color="red">绑定任意字符串</font>而不是 **类/接口名称**。<font color="red">但这种情况下不能使用类型提示，并且只能用 `make()` 来获取实例。</font>

```PHP
$container->bind('database', MySQLDatabase::class);
$db = $container->make('database');
```

为了<font color="red">同时支持类/接口名称和短名称</font>，可以使用 `alias()`：

```PHP
$container->singleton(Cache::class, RedisCache::class);
$container->alias(Cache::class, 'cache');

$cache1 = $container->make(Cache::class);
$cache2 = $container->make('cache');

assert($cache1 === $cache2);
```

## 用法八：保存任何值

`Container` 还可以用来保存任何值，例如 `configuration` 数据：

```PHP
$container->instance('database.name', 'testdb');
$db_name = $container->make('database.name');
```

它支持数组访问语法，这样用起来更自然：

```PHP
$container['database.name'] = 'testdb';
$db_name = $container['database.name'];
```

> 这是因为 Container 实现了 PHP 的 ArrayAccess 接口。

当处理 Closure 绑定的时候，你会发现这个方式非常好用：

```PHP
$container->singleton('database', function (Container $container) {
    return new MySQLDatabase(
        $container['database.host'],
        $container['database.name'],
        $container['database.user'],
        $container['database.pass']
    );
});
```

> Laravel 自己没有用这种方式来处理配置项，它使用了一个单独的 Config 类本身。 PHP-DI 用了。

<font color="red">数组访问语法还可以代替 make() 来实例化对象：</font>.

```PHP
$db = $container['database'];
```

## 用法九：Dependency Injection for Functions & Methods (给函数或方法注入依赖)

除了给构造函数注入依赖，Laravel 还可以往`任意函数`中注入：

```PHP
function do_something(Cache $cache) { /* ... */ }
$result = $container->call('do_something');
```

函数的附加`参数`可以作为`索引或关联数组传递`：

```PHP
function show_product(Cache $cache, $id, $tab = 'details') { /* ... */ }

// show_product($cache, 1)
$container->call('show_product', [1]);
$container->call('show_product', ['id' => 1]);

// show_product($cache, 1, 'spec')
$container->call('show_product', [1, 'spec']);
$container->call('show_product', ['id' => 1, 'tab' => 'spec']);
```

除此之外，闭包：

```PHP
$closure = function (Cache $cache) { /* ... */ };
$container->call($closure);
```

静态方法：

```PHP
class SomeClass
{
    public static function staticMethod(Cache $cache) { /* ... */ }
}
$container->call(['SomeClass', 'staticMethod']);
// or:
$container->call('SomeClass::staticMethod');
```

实例的方法：

```PHP
class PostController
{
    public function index(Cache $cache) { /* ... */ }
    public function show(Cache $cache, $id) { /* ... */ }
}
$controller = $container->make(PostController::class);

$container->call([$controller, 'index']);
$container->call([$controller, 'show'], ['id' => 1]);
```

都可以注入。

## 用法十: 调用实例方法的快捷方式

使用 `ClassName@methodName` 语法可以快捷调用实例中的方法：

```PHP
$container->call('PostController@index');
$container->call('PostController@show', ['id' => 4]);
```

因为 Container 被用来实例化类。意味着：

依赖 被注入进构造函数（或者方法）；
如果需要复用实例，可以定义为`单例`；
可以用接口或任何名称来代替具体类。
所以这样调用也可以生效：

```PHP
class PostController
{
    public function __construct(Request $request) { /* ... */ }
    public function index(Cache $cache) { /* ... */ }
}
$container->singleton('post', PostController::class);
$container->call('post@index');
```

最后，还可以传一个「默认方法」作为第三个参数。如果第一个参数是没有指定方法的类名称，则将调用默认方法。 `Laravel 用这种方式来处理 event handlers`:

```PHP
$container->call(MyEventHandler::class, $parameters, 'handle');

// 相当于:
$container->call('MyEventHandler@handle', $parameters);
```

## 用法十一：Method Call Bindings (方法调用绑定)

`bindMethod()` 方法可用来`覆盖方法`，例如用来传递其他参数：

```PHP
$container->bindMethod('PostController@index', function ($controller, $container) {
    $posts = get_posts(...);

    return $controller->index($posts);
});
```

下面的方式都有效，调用闭包来代替调用原始的方法：

```PHP
$container->call('PostController@index');
$container->call('PostController', [], 'index');
$container->call([new PostController, 'index']);
```

但是，`call()` 的任何其他参数都`不会传递`到`闭包`中，因此不能使用它们。

```PHP
$container->call('PostController@index', ['Not used :-(']);
```

## 用法十二：Contextual Bindings (上下文绑定)

有时候你想在不同的地方给接口不同的实现。这里有 Laravel 文档 里的一个例子：

```PHP
$container
    ->when(PhotoController::class)
    ->needs(Filesystem::class)
    ->give(LocalFilesystem::class);

$container
    ->when(VideoController::class)
    ->needs(Filesystem::class)
    ->give(S3Filesystem::class);
```

现在 `PhotoController` 和 `VideoController` 都依赖了 `Filesystem 接口`，但是收到了`不同的实例`。

可以像 bind() 那样，给 give() `传闭包`：

```PHP
    ->when(VideoController::class)
    ->needs(Filesystem::class)
    ->give(function () {
        return Storage::disk('s3');
    });
```

或者短名称：

```PHP
$container->instance('s3', $s3Filesystem);

$container
    ->when(VideoController::class)
    ->needs(Filesystem::class)
    ->give('s3');
```

## 用法十三：Binding Parameters to Primitives (绑定初始数据)

当有一个类`不仅`需要接受一个`注入类`，`还需要`注入一个`基本值`（比如整数）。
还可以通过将变量名称 (而不是接口) 传递给 needs() 并将`值`传递给 `give()` 来注入需要的任何值 (字符串、整数等) ：

```PHP
$container
    ->when(MySQLDatabase::class)
    ->needs('$username')
    ->give(DB_USER);
```

还可以使用闭包实现延时加载，只在需要的时候取回这个 `值` 。

```PHP
$container
    ->when(MySQLDatabase::class)
    ->needs('$username')
    ->give(function () {
        return config('database.user');
    });
```

这种情况下，不能传递类或命名的依赖关系（例如，give('database.user')），因为它将作为`字面值返回`。所以需要使用闭包：

```PHP
$container
    ->when(MySQLDatabase::class)
    ->needs('$username')
    ->give(function (Container $container) {
        return $container['database.user'];
    });
```

## 用法十四: Tagging (标记)

Container 可以用来「标记」有关系的绑定：

```PHP
$container->tag(MyPlugin::class, 'plugin');
$container->tag(AnotherPlugin::class, 'plugin');
```

这样会以数组的形式取回所有「标记」的实例：

```PHP
foreach ($container->tagged('plugin') as $plugin) {
    $plugin->init();
}
```

`tag()` 方法的`两个参数`都可以`接受数组`：

```PHP
$container->tag([MyPlugin::class, AnotherPlugin::class], 'plugin');
$container->tag(MyPlugin::class, ['plugin', 'plugin.admin']);
```
