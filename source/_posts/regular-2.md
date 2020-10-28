---
title: 【正则表达式】 - 超简单练习题
date: 2018-03-12 13:58:00
categories: [正则]
tags: [正则]
---

## 1. 匹配一段文本中的每行的邮箱

```
$str = '123@qq.comaaa@163.combbb@126.comasdfasfs33333@adfcom';

preg_match_all("/\w+@(?:qq|126|163)\.com/", $str, $matches);

var_dump($matches);
```

<!-- more -->

### 2. 匹配一段文本中的每行的时间字符串，比如：‘1990-07-12’

```
$str = 'asfasf1990-07-12asdfAAAbbbb434241';

preg_match_all("/(?P<year>19[0-9]{2})-(?P<month>\d+)-(?P<day>\d+)/", $str, $matches);

var_dump($matches);
```

### 3. 匹配一段文本中的 1-12 的值

```
$str = '23123156865423150506087111009';

preg_match_all('/1[0-2]|[1-9]/',$str, $matches);

var_dump($matches);
```
