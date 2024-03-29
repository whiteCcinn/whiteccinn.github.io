---
title: 【基础算法】- 排序 - 冒泡
date: 2018-02-24 12:13:00
categories: [算法]
tags: [算法]
---

## 说明

感觉一些基础的排序算法，貌似我的博客并没有说明，虽然我也很多了，但是还会记录一下，和大家分享一下，并且终结一下我每次的写排序算法的心得。

先贴代码，再讲原理。

## PHP 实现

```php
class Bubble
{
    public function __invoke(array $args)
    {
        $length = count($args);
        for ($i = 0; $i < $length - 1; $i++) {
            for ($j = 0; $j < $length - 1 - $i; $j++) {
                if ($args[$j] > $args[$j + 1]) {
                    $tmp          = $args[$j];
                    $args[$j]     = $args[$j + 1];
                    $args[$j + 1] = $tmp;
                }
            }
        }
        return $args;
    }
}

$data = [3, 5, 1, 2, 8, 6, 7, 9];

$sort   = new Bubble();
$sortData = $sort($data);

print_r($sortData);
```

<!-- more -->

冒泡排序：
顾名思义，这个意思就是像泡泡一样一层层的向上浮（针对升序：从小到大排序，首先确定的是最大值），基本思路就是两两比较，只记得两者之间大的值，直到最后一次比较，即可确定该值为最大值，这样子就完成了一次循环比较，剩下的数字也同样的思路循环下去即可。

按照这个说法，我们来看上面的例子。

我们现在有一批数字：[3, 5, 1, 2, 8, 6, 7, 9]

第一次比较:3,5。发现 5 比 3 大，无需交换位置。

3，5，1，2，8，6，7，9

第二次比较：5，1。发现 1 比 5 小，交换位置。

3，1，5，2，8，6，7，9

第三次比较：5，2。发现 2 比 5 小，交换位置。

3，1，2，5，8，6，7，9

第四次比较：5，8。发现 8 比 5 大，无需交换位置。

3，1，2，5，8，6，7，9

第五次比较：8，6。发现 6 比 8 小，交换位置。

3，1，2，5，6，8，7，9

第六次比较：8，7。发现 7 比 8 小，交换位置。

3，1，2，5，6，7，8，9

第 7 次比较：8，9。发现 9 比 8 大，无需交换位置。

完成了第一轮比较，从而得出了`9`是这批数据中的最大值。

第二轮（不用比较 9，已经确定最大值），第三轮（不用比较 8，9 已经确认最大值和第二大的值）...直到第 7 轮（少了一轮是因为，不用比较最小值，因为已经比较得出了最大的 7 位，）。得出了：

1，2，3，5，6，7，8，9

的升序数据。
