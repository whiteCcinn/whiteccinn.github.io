---
title: 【基础算法】- 排序 - 二分插入排序
date: 2018-03-01 15:15:00
categories: [算法]
tags: [算法]
---

二分插入排序可以说是直接插入排序的升级版，对于数据量比较大的时候，二分插入排序可以有效的减少比较的次数，从而提高效率。

这里借助了二分的思想，但是需要注意的是，这个只是二分思想，和二分搜索并非一致，如果需要用到二分查询的话，前提必须是有序数据，但是这里只是借助了这个思想，把最靠近有序区的一个通过二分查找需要插入的位置，并且一次性移动所有大于目标数的所有元素。

<!-- more -->

```php
class BinSearch
{
    public function __invoke(array $args)
    {
        $length = count($args);

        for ($i = 1; $i < $length; $i++) {
            $j   = $i - 1;
            $k   = $args[$i];
            $loc = $this->_binSearch($args, $k, 0, $j);

            while ($j >= $loc) {
                $args[$j + 1] = $args[$j];
                $j--;
            }

            $args[$j + 1] = $k;
        }

        return $args;
    }

    public
    function _binSearch(
        $args,
        $key,
        $low,
        $high
    ) {
        while ($low <= $high) {
            $mid = ceil(($low + $high) / 2);

            if ($key > $args[$mid]) {
                $low = $mid + 1;
            } else {
                $high = $mid - 1;
            }
        }

        return $low;
    }
}

$data = [3, 5, 1, 2, 8, 6, 7, 9];

$sort     = new BinSearch();
$sortData = $sort($data);

print_r($sortData);
```
