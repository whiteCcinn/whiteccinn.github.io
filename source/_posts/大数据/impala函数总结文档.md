---
title: 【大数据】- Impala函数使用文档
date: 2020-05-12 09:56:40
categories: [大数据]
tags: [大数据, Impala]
---

## 前言

目前一些传统的公司比较早期使用大数据计算引擎的，都会选择使用imapla做为计算引擎，所以对impala对一些sql使用还是需要熟悉的。

<!-- more -->

## 条件函数

故名思议，条件函数区域主要都是一些条件判定的函数

### case when

```sql
用法 1:

CASE a WHEN b THEN c [WHEN d THEN e]... [ELSE f] END

用法 2:

CASE WHEN a THEN b [WHEN c THEN d]... [ELSE e] END
```

用法1:

```sql
select case xµÂ
    when 1 then 'one'
    when 2 then 'two'µ
    when 0 then 'zero'
    else 'out of range'
  end
    from t1;
```

用法2:

```sql
select case
    when dayname(now()) in ('Saturday','Sunday') then 'result undefined on weekends'
    when x > y then 'x greater than y'
    when x = y then 'x and y are equal'
    when x is null or y is null then 'one of the columns is null'
    else null
  end
    from t1;
```
