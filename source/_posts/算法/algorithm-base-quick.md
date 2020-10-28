---
title: 【基础算法】- 排序 - 快排
date: 2018-02-24 13:46:00
categories: [算法]
tags: [算法]
---

## 说明

快排算法，比普通的冒泡排序要快，原因说明将在时间复杂度和空间复杂度的文章中说明。

## PHP 实现

```php
<?php

/**
 * Created by PhpStorm.
 * User: admin
 * Date: 2018/2/24
 * Time: 9:39
 */
class Quick
{
    public function __invoke(array $args)
    {
        $length = count($args);
        if ($length < 1) {
            return;
        }
        $this->quickSort($args, 0, $length - 1);

        return $args;
    }

    public function quickSort(array &$args, int $low, int $high)
    {
        if ($low > $high) {
            return;
        }

        $frist = $low;
        $last  = $high;
        $k     = $args[$low];

//        $i = 0;
        while ($frist < $last) {
//            $i++;
            while ($frist < $last && $args[$last] >= $k) {
                $last--;
            }
            $args[$frist] = $args[$last];
//            echo '[' . $i . ']last -- : $frist ' . $frist . ' . $last ' . $last . PHP_EOL;
//            foreach ($args as $value){
//                echo $value . '  ';
//            }
            echo PHP_EOL;
            while ($frist < $last && $args[$frist] <= $k) {
                $frist++;
            }
            $args[$last] = $args[$frist];

//            echo '[' . $i . ']last -- : $frist ' . $frist . ' . $last ' . $last . PHP_EOL;
//            foreach ($args as $value){
//                echo $value . '  ';
//            }
//            echo PHP_EOL;
        }

        $args[$frist] = $k;
//        print_r($args);
//        exit;
        $this->quickSort($args, $low, $frist - 1);
        $this->quickSort($args, $frist + 1, $high);
    }
}

$data = [3, 5, 1, 2, 8, 6, 7, 9];

$sort     = new Quick();
$sortData = $sort($data);

print_r($sortData);
```

<!-- more -->

快速排序：
顾名思义，快速排序的基本思路是分治的思路，为什么这么说呢，因为他是一个整体排序的过程，但是他把数据分成了子数据段的排序

相信很多人看到这里还是一头雾水，我们按照这个说法，看看上面的例子。

我们现在有一批数字：[3, 5, 1, 2, 8, 6, 7, 9]

我们拿到基本数据元素:3。从后开始往前看，直到找到比 3 小的数据，我从 9-7-6-8-2(下标索引 j:7-6-5-4-3。j=3)看到 2 比 3 小，这个时候 3、2 交换位置。

[2,5,1,3,8,6,7,9]

然后从前开始往后看，直到找到比 3 大的数据
我从 2-5（下标索引 i：0，1。i=1）看到 5 比 3 大，这个时候 5、3 交换位置。

[2,3,1,5,8,6,7,9]

这个时候，我们发现 j 不等于 i，所以需要计算计算，直到 i=j 位置。

这个时候（j=3，i=1）。我们按照从后开始往前找的规律。从 5-1（下标索引 j：3-2。j=2）看到 1 比 3 小，这个时候，1，3 交换位置。

[2,1,3,5,8,6,7,9]

这个时候（j=2，i=1）。我们按照从前开始往后找的规律。当读 1 的时候（i=j=2），已经符合了我们的 j=i，这个时候，说明已经完成了一轮循环。

以上这个过程称之为一轮循环（从后面开始找小的，从前面开始找大的）,这个时候,会发现，基础数据 3 左边都是小于 3 的，右边都是大于 3 的。以此循环，就是快排的基本思路。

> 如果想看数据变动的过程，可以把注释删掉，就可以看到每一次数据变动的情况了。
