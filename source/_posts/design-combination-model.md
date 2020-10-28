---
title: 设计模式の结构型の组合模式
date: 2017-06-20 16:19:00
categories: [设计模式]
tags: [设计模式, PHP]
---

# 大概意思

一个接口对于多个实现，并且这些实现中都拥有相同的方法（名）。 有时候你需要只运行一个方法，就让不同实现类的某个方法或某个逻辑全部执行一遍。在批量处理多个实现类时，感觉就像在使用一个类一样。

```PHP
//先建立一个表单
$form = new Form();

//在表单中增加一个Email元素
$form->addElement(new TextElement('Email:'));
$form->addElement(new InputElement());

//在表单中增加一个密码元素
$form->addElement(new TextElement('Password:'));
$form->addElement(new InputElement());

//把表单渲染出来
$form->render();
```

这个例子形象的介绍了组合模式，表单的元素可以动态增加，但是只要渲染一次，就可以把整个表单渲染出来。

<!-- more -->

# 实现

```PHP

// 顶层渲染接口 RenderableInterface.php

interface RenderableInterface
{
  public function render(): string;
}

// 表单构造器 Form.php

//必须继承顶层渲染接口
class Form implements RenderableInterface
{
  private $elements;

  //这里很关键，相当于是批量处理接口实现类
  public function render(): string
  {
    $formCode = '<form>';
    foreach ($this->elements as $element)
    {
      $formCode .= $element->render();
    }
    $formCode .= '</form>';

    return $formCode;
  }

  //这个方法用来注册 接口实现类
  public function addElement(RenderableInterface $element)
  {
    $this->elements[] = $element;
  }
}

// 具体实现类一 TextElement.php

class TextElement implements RenderableInterface
{
  private $text;

  public function __construct(string $text)
  {
    $this->text = $text;
  }

  public function render(): string
  {
    return $this->text;
  }
}

// 具体实现类二 InputElement.php

class InputElement implements RenderableInterface
{
  public function render(): string
  {
    return '<input type="text" />';
  }
}

// 你还可以定义更多的元素，来构建表单。
```

## 输出结果

当你使用 `$form->render()` 渲染之后，所有的元素都可以渲染出来。

```PHP
<form>Email:<input type="text" />Password:<input type="text" /></form>

```
