---
title: HASH算法のBKDRHash
date: 2017-06-20 17:39:00
categories: [算法]
tags: [算法, Hash函数]
---

# 说明

今天和别人说一下 hash 算法，起源是因为字符串在数据库做索引的问题，我的想法是字符串通过 hash 算法，得到的 int 类型的数据，在 int 类型的数据库上做索引，但是 hash 算法有很多选择，就 PHP 而言，有人说 10 万数据内的话，用 PHP 内置的 CRC32 算法(abs(crc32(\$str)))就可以，但是我发现 hash 算法有很多种，其中一种就是 bkdrhash 算法。

<!-- more -->

```PHP
<?php

/**
 * BKDRHash算法
 *
 * C、C++版本
 * unsigned int BKDRHash(char *str)
 * {
 * unsigned int seed = 131313;//也可以乘以31、131、1313、13131、131313..
 * unsigned int hash = 0;
 * while(*str)
 * {
 * hash = hash*seed + (*str++);
 * }
 *
 * return hash%32767;//最好对一个大的素数取余
 * }
 *
 * php实现 比c语言版本复杂的部分，是由于php中整型数的范围是，且一定是-2147483648 到2147483647，并且没有无符号整形数。
 * 在算法中会出现大数溢出的问题，不能使用intval,需要用floatval，同时在运算过程中取余保证不溢出。
 * 0x7FFFFFFF 是控制long int的最大值
 */
class BKDRHash
{
  private $seed = 131;
  private $hash = 0;
  public $str = '';

  public function __construct($str)
  {
    $this->str = md5($str);
  }

  public function hash()
  {
    $this->hash = 0;
    for ($i = 0; $i < 32; $i++)
    {
      $this->hash = ((floatval($this->hash * $this->seed) & 0x7FFFFFFF) + ord($this->str{$i})) & 0x7FFFFFFF; // 表示控制在long int范围之内
    }

    return $this->hash & 0x7FFFFFFF;
  }
}

$obj = new BKDRHash('白菜');

var_dump($obj->hash());

$obj->str = md5('白菜');

var_dump($obj->hash());


```
