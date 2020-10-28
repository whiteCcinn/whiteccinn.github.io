---
title: 基于tire-tree的关键字匹配
date: 2018-01-23 15:20:00
categories: [算法]
tags: [算法, 树]
---

# 前言

字典树，又称前缀树或 trie 树，是一种有序树，用于保存关联数组，其中的键通常是字符串。与二叉查找树不同，键不是直接保存在节点中，而是由节点在树中的位置决定。一个节点的所有子孙都有相同的前缀，也就是这个节点对应的字符串，而根节点对应空字符串。

# 开始

早期的时候，我在 github 上写了一个，但是一直没有写博文。

https://github.com/whiteCcinn/tire-php

当时写的时候，比较复杂，因为汉字的编码问题，里面会设置一些 ascii 码和 utf-8 编码的转码代码，看上去比较复杂。接下来，会贴一段通过正则实现的代码。

那么 trie 树怎么实现关键字的匹配呢? 这里以一幅图来讲解 trie 树匹配的过程。

<!-- more -->

### 其中要点：

#### 构造 trie 树

- 将关键词用上面介绍的 preg_split()函数拆分为单个字符。如科学家就拆分为科、学、家三个字符。
- 在最后一个字符后添加一个特殊字符 <font color="red">\`</font>，此字符作为一个关键词的结尾（图中的粉红三角），以此字符来标识查到了一个关键词（不然，我们不知道匹配到科、学两个字符时算不算匹配成功）。<font color="red">\`</font>，此字符作为一个关键词的结尾（图中的粉红三角），以此字符来标识查到了一个关键词（不然，我们不知道匹配到科、学两个字符时算不算匹配成功）。
- 检查根部是否有第一个字符(科)节点，如果有了此节点，到步骤 4。 如果还没有，在根部添加值为科的节点。
- 依次检查并添加学、家 两个节点。
- 在结尾添加<font color="red">\`</font>节点，并继续下一个关键词的插入。

#### 匹配

然后我们以 这位科学家很了不起！为例来发起匹配。

- 首先我们将句子拆分为单个字符 这、位、...；
- 从根查询第一个字符这，并没有以这个字符开头的关键词，将字符“指针”向后移，直到找到根下有的字符节点科;
- 接着在节点科下寻找值为 学节点，找到时，结果子树的深度已经到了 2，关键词的最短长度是 2，此时需要在学结点下查找是否有<font color="red">\`</font>，找到意味着匹配成功，返回关键词，并将字符“指针”后移，如果找不到则继续在此结点下寻找下一个字符。
- 如此遍历，直到最后，返回所有匹配结果。

PHP 代码实现：

```php
<?php

class Trie
{
    /**
     * node struct
     *
     * node = array(
     * val->word
     * next->array(node)/null
     * depth->int
     * )
     */
    private $root    = array(
        'depth' => 0,
        'next'  => array(),
    );
    private $matched = array();

    public function append($keyword)
    {
        $words = preg_split('/(?<!^)(?!$)/u', $keyword);
        array_push($words, '`');
        $this->insert($this->root, $words);
    }

    public function match($str)
    {
        $this->matched = array();
        $words         = preg_split('/(?<!^)(?!$)/u', $str);
        while (count($words) > 0) {
            $matched = array();
            $res     = $this->query($this->root, $words, $matched);
            if ($res) {
                $this->matched[] = implode('', $matched);
            }
            array_shift($words);
        }
        return $this->matched;
    }

    private function insert(&$node, $words)
    {
        if (empty($words)) {
            return;
        }
        $word = array_shift($words);
        if (isset($node['next'][$word])) {
            $this->insert($node['next'][$word], $words);
        } else {
            $tmp_node            = array(
                'depth' => $node['depth'] + 1,
                'next'  => array(),
            );
            $node['next'][$word] = $tmp_node;
            $this->insert($node['next'][$word], $words);
        }
    }

    private function query($node, $words, &$matched)
    {
        $word = array_shift($words);
        if (isset($node['next'][$word])) {
            array_push($matched, $word);
            if (isset($node['next'][$word]['next']['`'])) {
                return true;
            }
            return $this->query($node['next'][$word], $words, $matched);
        } else {
            $matched = array();
            return false;
        }
    }
}

$tire = new Trie();
$msg = '性派对';
$tire->append('性');
$tire->append('性爱');
$tire->append('性爱2');
$tire->append('性爱3');

print_r($tire->match($msg));
```

注意到，上面的这一段代码有一个弱点就是按照最短匹配。当你输入`性爱排队`的时候，无法搜索出`性爱`，只能搜索到`性`。

以下的代码进行了升级，全匹配。

```php
class Trie
{
    /**
     * node struct
     *
     * node = array(
     * val->word
     * next->array(node)/null
     * depth->int
     * )
     */
    private $root    = array(
        'depth' => 0,
        'next'  => array(),
    );
    private $matched = array();

    public function append($keyword)
    {
        $words = preg_split('/(?<!^)(?!$)/u', $keyword);
        array_push($words, '`');
        $this->insert($this->root, $words);
    }

    public function match($str)
    {
        $this->matched = array();
        $words         = preg_split('/(?<!^)(?!$)/u', $str);
        while (count($words) > 0) {
            $matched = array();
            $res     = $this->query($this->root, $words, $matched);
            if ($res) {
                $this->matched[] = implode('', $matched);
            }
            array_shift($words);
        }
        return $this->matched;
    }

    private function insert(&$node, $words)
    {
        if (empty($words)) {
            return;
        }
        $word = array_shift($words);
        if (isset($node['next'][$word])) {
            $this->insert($node['next'][$word], $words);
        } else {
            $tmp_node            = array(
                'depth' => $node['depth'] + 1,
                'next'  => array(),
            );
            $node['next'][$word] = $tmp_node;
            $this->insert($node['next'][$word], $words);
        }
    }

    private function query($node, $words, &$matched)
    {
        $word = array_shift($words);
        if (isset($node['next'][$word])) {
            array_push($matched, $word);
            $keys = array_keys($node['next'][$word]['next']);
            if (!empty($keys) && in_array('`', $keys)) {
                if (count($keys) == 1) {
                    return true;
                } else {
                    $this->matched[] = implode('', $matched);
                }
            }
            return $this->query($node['next'][$word], $words, $matched);
        } else {
            $matched = array();
            return false;
        }
    }
}

$tire = new Trie();
$msg  = '性爱派对';
$tire->append('性');
$tire->append('性爱');
$tire->append('性爱派');

print_r($tire->match($msg));
```
