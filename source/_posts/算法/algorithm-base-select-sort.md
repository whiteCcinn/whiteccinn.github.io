---
title: 【基础算法】- 排序 - 选择排序
date: 2018-03-01 17:22:01
categories: [算法]
tags: [算法]
---

选择排序是一种不稳定的算法。基本思路是：他是将每次 2 个数据都比较完之后，记录一个最大值或者最小值，不急着交换，（这是和冒泡排序的差别，减少了交换的次数，所以效率会高），等一轮循环比较完毕之后，再把无序区最靠近有序区的那个数和当前记录的值交换，每次循环只交换一次。

<!-- more -->

```php
class Select
{
    public function __invoke(array $args)
    {
        $length = count($args) - 1;
        for ($i = 0; $i < $length; $i++) {
            $k = $i;
            // 1
            for ($j = $i + 1; $j < $length; $j++) {
                if ($args[$j] < $args[$k]) {
                    $k = $j;
                }
            }

            if ($k != $i) {
                $tmp      = $args[$i];
                $args[$i] = $args[$k];
                $args[$k] = $tmp;
            }
//            foreach ($args as $v) {
//                echo $v . ' - ';
//            }
//            echo PHP_EOL;
        }
        return $args;
    }
}


$data = [3, 5, 1, 2, 8, 6, 7, 9];

$sort     = new Select();
$sortData = $sort($data);

print_r($sortData);
```
