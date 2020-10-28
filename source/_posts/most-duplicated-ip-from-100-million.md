---
title: 模拟从1亿个ip中访问次数最多的IP--PHP
date: 2017-03-15 14:03:38
categories: PHP
tags: [PHP, 大数据, 算法]
---

## 前提：

- 存储在一个文件中
- 内存有限，时间无限。

## 思路：

- 采用类似分表的办法，将文件拆分到各个文件中再做统计运算，提高检索速度，分散内存压力
- 涉及到 ip 的，首先要考虑的就是将 ip 转程长整形，理由是整型省内存，并且支持一般都支持整形索引，比字符串索引速度快
- 数组存储的数据结构，采用冗余的策略，记录一组数组中重复最多的 ip 和数据
- 独立小文件胜出的，再和分出来的其他的 N-1 个小文件胜出的比较

<!-- more -->

```PHP
<?php

/**
 * 模拟从1亿个ip中访问次数最多的IP
 * 创建文件
 * Created by PhpStorm.
 * User: admin
 * Date: 2017/3/14
 * Time: 16:19
 */
class Test
{
  const MAX_NUM = 100000000;

  const HASH_NUM = 1000;

  const FILE_NAME = 'IpFile.txt';

  public static $hashIps = [];

  public static function generateIp()
  {
    // 大概15个字节byte
    $number = '192.168';
    $number = $number . '.' . random_int(0, 255) . '.' . random_int(0, 255);

    return $number;
  }

  public static function generateIpFiles()
  {
    /**
     * fopen 的mode，如果加上b，例如wb的话，是说明强调说明这个文件是二进制文件
     * 如果1亿次的话，那就是15byte*1E = 15E byte /1024
     * 由于机器性能比较差，文件我只生成了700M的数据。可能只有5千万条数据
     */
    $handler = fopen(self::FILE_NAME, 'w');
    for ($i = 0; $i < self::MAX_NUM; $i++)
    {
      $ip = self::generateIp();
      fwrite($handler, $ip . PHP_EOL);
    }
    fclose($handler);
  }

  /**
   * ip转成长整形
   *
   * @param string $ip
   *
   * @return int
   */
  public static function ipToLong(string $ip)
  {
    list($position1, $position2, $position3, $position4) = explode('.', $ip);

    return ($position1 << 24) | ($position2 << 16) | ($position3 << 8) | ($position4);
  }

  /**
   * 哈希取模
   *
   * @param string $ip
   *
   * @return int
   */
  public static function hash(string $ip)
  {
    $longInt = self::ipToLong($ip);

    return $longInt % self::HASH_NUM;
  }

  /**
   * 拆分文件
   * 考虑：
   * 1.1E行数据，一次性加载文件这是不明智的做法，所以我们需要一行一行来读取，也可以理解为缓存读取。
   * 2.假如1E个ip，我们直接一行行读写操作的话，需要操作的io就是1E次，所以这个是十分不明智的，所以我们可以根据自身服务器的内存比例来进行划分出预定的数组来保存
   */
  public static function divideIpsFiles()
  {
    $handler = fopen(self::FILE_NAME, 'r');
    $count   = 0;
    while (($ip = fgets($handler)) !== false)
    {
      $count++;
      $hashIp                     = self::hash($ip);
      self::$hashIps[ $hashIp ][] = $ip;

      // 当处理了50000万条数据的时候，就写入一次性写入文件。
      if ($count == 50000)
      {
        foreach (self::$hashIps as $key => $hip)
        {
          $handler2 = fopen($key . '.txt', 'a');
          while (($ip = current($hip)) !== false)
          {
            $byte = fwrite($handler2, $ip);
            if ($byte === false)
            {
              die('Shutdown');
            }
            next($hip);
          }
          fclose($handler2);
        }
        $count         = 0;
        self::$hashIps = [];
      }
    }
    fclose($handler);
  }

  public static function calus()
  {
    $last = [];
    for ($i = 0; $i < 1000; $i++)
    {
      $first   = [
          'item' => [],
          'max'  => ['ip' => 0, 'count' => 0]
      ];
      $handler = fopen($i . '.txt', 'r');
      while (($ip = fgets($handler)) !== false)
      {
        if (array_key_exists($ip, $first['item']))
        {
          $first['item'][ $ip ]++;
        } else
        {
          $first['item'][ $ip ] = 1;
        }

        if ($first['item'][ $ip ] > $first['max']['count'])
        {
          $first['max']['ip']    = $ip;
          $first['max']['count'] = $first['item'][ $ip ];
        }
      }
      fclose($handler);

      $last[ $first['max']['ip'] ] = $first['max']['count'];

      unset($first);
    }

    echo 'IP最多重复的是：' . array_search(($count = max($last)), $last) . ',重复次数为:' . $count;
  }

  /**
   * 移除文件
   */
  public static function deleteFiles()
  {
    for ($i = 0; $i < 1000; $i++)
    {
      if (file_exists($i . '.txt'))
      {
        unlink($i . '.txt');
      } else
      {
        return false;
      }
    }

    echo '移除完毕' . PHP_EOL;

    return true;
  }

}

if (!file_exists(Test::FILE_NAME))
{
  Test::generateIpFiles();
}
//
//Test::deleteFiles();
//
//Test::divideIpsFiles();

Test::calus();
```
