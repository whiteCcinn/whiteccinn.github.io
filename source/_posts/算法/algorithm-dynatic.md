---
title: 动态规划算法の爬楼梯
date: 2017-06-21 16:04:00
categories: [算法]
tags: [算法, 动态规划, PHP]
---

## 题目

有一座高度是 10 级台阶的楼梯，从下往上走，每跨一步只能向上 1 级或者 2 级台阶。要求用程序来求出一共有多少种走法。

<!-- more -->

## 解法

```PHP
<?php
/**
 * 算法：动态规划.
 * 思路: 最优子结构,自低向上，空间换时间，关键一步，和备忘录算法区别
 * User: 白菜
 * Date: 2017/6/21
 * Time: 15:45
 * 题目 :有一座高度是10级台阶的楼梯，从下往上走，每跨一步只能向上1级或者2级台阶。要求用程序来求出一共有多少种走法。
 */

/**
 * 动态规划算法
 *
 * @param $n
 *
 * @return int|mixed
 */
/**
 * 动态规划写法（备忘录算法升级版）
 * 时间复杂度O(n),空间复杂度O(1)
 *
 * @param int $n 台阶数
 *
 * @return int
 */
function dp3(int $n)
{
  if ($n < 0)
  {
    return false;
  }
  switch ($n)
  {
    case 1:
      return 1;
      break;
    case 2:
      return 2;
      break;
    default:
      $a    = 1; // 第n-1个
      $b    = 2; // 第n-2个
      $temp = 0; // 临时变量,用于下面循环处交互$a,$b大小
      for ($i = 3; $i <= $n; $i++)
      {
        $temp = $a + $b;
        $a    = $b;
        $b    = $temp;
      }

      unset($a, $b);

      return $temp;
  }
}

$level = 4;
echo dp($level);
```

### 时间对比

```PHP
<?php
/**
 * 算法：动态规划.
 * 思路: 最优子结构,自低向上，空间换时间，关键一步，和备忘录算法区别
 * User: 白菜
 * Date: 2017/6/21
 * Time: 15:45
 * 题目 :有一座高度是10级台阶的楼梯，从下往上走，每跨一步只能向上1级或者2级台阶。要求用程序来求出一共有多少种走法。
 */

/**
 * 单纯的递归
 * 时间复杂度O(2^n),空间复杂度O(1)
 *
 * @param int $n 台阶数
 *
 * @return int
 */
function dp1(int $n)
{
  if ($n < 0)
  {
    return false;
  }
  // 单纯的递归，而非动态规划
  switch ($n)
  {
    case 1:
      return 1;
      break;
    case 2:
      return 2;
      break;
    default:
      return dp1($n - 1) + dp1($n - 2);
  }
}

/**
 * 备忘录算法(单纯的递归升级)
 * 时间复杂度O(n),空间复杂度O(n)
 *
 * @param int $n 台阶数
 *
 * @return int|mixed
 */
function dp2(int $n)
{
  if ($n < 0)
  {
    return false;
  }
  // 备忘录算法
  static $storage = [
      1 => 1,
      2 => 2,
  ];
  if (isset($storage[ $n ]))
  {
    return $storage[ $n ];
  }
  // 递归，动态规划根基 f(1)=1，f(2)=2 {1->1|2} ,f(3){1->1->1|1->2|2->1}
  $num = dp2($n - 1) + dp2($n - 2);

  $storage[ $n ] = $num;

  return $num;
}

/**
 * 动态规划写法（备忘录算法升级版）
 * 时间复杂度O(n),空间复杂度O(1)
 *
 * @param int $n 台阶数
 *
 * @return int
 */
function dp3(int $n)
{
  if ($n < 0)
  {
    return false;
  }
  switch ($n)
  {
    case 1:
      return 1;
      break;
    case 2:
      return 2;
      break;
    default:
      $a    = 1; // 第n-1个
      $b    = 2; // 第n-2个
      $temp = 0; // 临时变量,用于下面循环处交互$a,$b大小
      for ($i = 3; $i <= $n; $i++)
      {
        $temp = $a + $b;
        $a    = $b;
        $b    = $temp;
      }

      unset($a, $b);

      return $temp;
  }
}


$level = 4;

$start  = microtime(true);
$memory = memory_get_usage();
for ($i = 0; $i < 100000000; $i++)
{
  dp3($level);
}
echo '动态规划耗时：' . round(microtime(true) - $start, 4);
echo PHP_EOL;
echo '动态规划占用内存：' . (memory_get_usage() - $memory) / 1024 . 'KB';

echo PHP_EOL . PHP_EOL;

$start  = microtime(true);
$memory = memory_get_usage();
for ($i = 0; $i < 100000000; $i++)
{
  dp2($level);
}
echo '备忘录算法耗时：' . round(microtime(true) - $start, 4);
echo PHP_EOL;
echo '备忘录算法占用内存：' . (memory_get_usage() - $memory) / 1024 . 'KB';
echo PHP_EOL . PHP_EOL;

$start  = microtime(true);
$memory = memory_get_usage();
for ($i = 0; $i < 100000000; $i++)
{
  dp1($level);
}
echo '直接递归耗时：' . round(microtime(true) - $start, 4);
echo PHP_EOL;
echo '直接递归占用内存：' . (memory_get_usage() - $memory) / 1024 . 'KB';
echo PHP_EOL;
```

## 总结

从算法上看，动态规划，不管是从空间还是时间上都是最优的，但是由于我们用到的 static 关键字，放这个结果变成了备忘录算法比动态规划还要快。所以这个算法和结果还是有点出入的，不过也好，大家也知道动态规划的原理了。
