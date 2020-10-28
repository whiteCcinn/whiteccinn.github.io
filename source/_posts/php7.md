---
title: 【PHP】- php7的新特性
date: 2018-02-28 23:58:00
categories: [PHP]
tags: [PHP]
---

php7 出来的时候，多了哪些特性呢，在这里总结一下

为什么 PHP7 比 PHP5 性能提升了？

- 变量存储字节减小，减少内存占用，提升变量操作速度

- 改善数组结构，数组元素和 hash 映射表被分配在同一块内存里，降低了内存占用、提升了 cpu 缓存命中率
  （以往的 zval 是一个 24 字节的结构体，现在的固定是 16 个字节）

- 改进了函数的调用机制，通过优化参数传递的环节，减少了一些指令，提高执行效率

## 太空船操作符

```
<=>
```

- 左边大于右边的时候，返回 1
- 右边大于左边的时候，返回-1
- 两边相等的时候，返回 0

<!-- more -->

```php
$a = 1;
$b = 2;
$result = $a <=> $b
echo $result;
// -1
```

## null 合并符

```php
$a = $var['var'] ?? 'null';
```

- 相当于 isset($var['var'])?$var:'null'

## 强制返回类型

```php
public function myFunc(): int {
  return 1;
}
```

当一个方法确认数据类型的时候，可以写上强制返回类型，这可以使得 php7 的解析代码逻辑更快。

## define 定义数组

```php
define('defineArray',['a' => 1, 'b' => 2]);
```

这个的出现，可以使得你一开始就定义全局静态数组

## 匿名类

```php
$b = new class {
  public function __invoke() {
     echo '用后即焚';
  }
}
$b();

// 减少引用（还需要回收周期执行：gc_collect_cycles()，手动强制执行gc回收周期）
unset($b);
```

和匿名函数差不多，都可以实现用后即焚，但是这个涉及到 gc 垃圾回收机制，里面有一个引用计数，当引用计数为 0 并且刚好到了 gc 回收周期的时候，该便将就将会销毁

## use 集合化

```
use some\namespace\A;
use some\namespace\B;
use some\namespace\C;


use some\namespace\{A,B,C};
```

## 捕抓致命错误类

PHP 5 的 try ... catch ... finally 无法处理传统错误，如果需要，你通常会考虑用 set_error_handler() 来 Hack 一下。但是仍有很多错误类型是 set_error_handler() 捕捉不到的。PHP 7 引入 Throwable 接口，错误及异常都实现了 Throwable，无法直接实现 Throwable，但可以扩展 \Exception 和 \Error 类。可以用 Throwable 捕捉异常跟错误。\Exception 是所有 PHP 及用户异常的基类；\Error 是所有内部 PHP 错误的基类。

```php
        $name = "Tony";
        try {
            $name = $name->method();
        } catch (\Error $e) {
            echo "出错消息 --- ", $e->getMessage(), PHP_EOL;
        }

        try {
            $name = $name->method();
        } catch (\Throwable $e) {
            echo "出错消息 --- ", $e->getMessage(), PHP_EOL;
        }

        try {
            intdiv(5, 0);
        } catch (\DivisionByZeroError $e) {
            echo "出错消息 --- ", $e->getMessage(), PHP_EOL;
        }
```

后续陆续提供 7.1 才有的特性....
