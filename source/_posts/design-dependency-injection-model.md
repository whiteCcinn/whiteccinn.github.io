---
title: 设计模式の结构型の依赖注入模式
date: 2017-06-22 11:11:00
categories: [设计模式]
tags: [设计模式, PHP]
---

## 很简单的理解

终于要讲到这个著名的设计原则，其实它比其他设计模式都简单。
依赖注入的实质就是把一个类不可能更换的部分 和 可更换的部分 分离开来，通过注入的方式来使用，从而达到解耦的目的。

## 一个数据库连接类

```PHP
class Mysql
{
  private $host;
  private $port;
  private $username;
  private $password;
  private $db_name;

  public function __construct()
  {
    $this->host     = '127.0.0.1';
    $this->port     = 22;
    $this->username = 'root';
    $this->password = '';
    $this->db_name  = 'my_db';
  }

  public function connect()
  {
    return mysqli_connect($this->host, $this->username, $this->password, $this->db_name, $this->port);
  }
}
```

<!-- more-->

## 使用

```PHP
$db  = new Mysql();
$con = $db->connect();
```

通常应该设计为单例，这里就先不搞复杂了。

## 依赖注入

显然，数据库的配置是可以更换的部分，因此我们需要把它拎出来。

```PHP
class MysqlConfiguration
{
  private $host;
  private $port;
  private $username;
  private $password;
  private $db_name;

  public function __construct(string $host, int $port, string $username, string $password, string $db_name)
  {
    $this->host     = $host;
    $this->port     = $port;
    $this->username = $username;
    $this->password = $password;
    $this->db_name  = $db_name;
  }

  public function getHost(): string
  {
    return $this->host;
  }

  public function getPort(): int
  {
    return $this->port;
  }

  public function getUsername(): string
  {
    return $this->username;
  }

  public function getPassword(): string
  {
    return $this->password;
  }

  public function getDbName(): string
  {
    return $this->db_name;
  }
}
```

然后不可替换的部分这样：

```PHP
class Mysql
{
  private $configuration;

  public function __construct(MysqlConfiguration $config)
  {
    $this->configuration = $config;
  }

  public function connect()
  {
    return mysqli_connect($this->configuration->getHost(), $this->configuration->getUsername(), $this->configuration->getPassword, $this->configuration->getDbName(), $this->configuration->getPort());
  }
}
```

这样就完成了配置文件和连接逻辑的分离。

## 使用

```PHP
$config = new MysqlConfiguration('127.0.0.1', 'root', '', 'my_db', 22);
$db     = new Mysql($config);
$con    = $db->connect();
```

\$config 是注入 Mysql 的，这就是所谓的依赖注入。

## 备注

还有一种做法就是将所有的组件都放在一个容器里，等到控制器需要的时候，再去动态注入进来，后续如果还要再使用的话，就从已经加载了的是实例中获取。
