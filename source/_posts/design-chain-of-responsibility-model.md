---
title: 设计模式の行为型の责任链模式
date: 2017-06-22 15:06:00
categories: [设计模式]
tags: [设计模式, PHP]
---

# 理解概念

责任链是一种比较高级的行为设计模式，就是当你有一个请求，你不知道用那个方法(handler)来处理这个请求时，你可以把这个请求丢进一个责任链里（里面有很多方法），这个责任链会通过轮询的方式自动找到对应的方法。

比如我要翻译一个单词，我写这个代码的时候，根本不知道用户会输入什么语言，所以我干脆就不管了，无论用户输入什么语言，我把它输入的内容丢进一个责任链，这个责任链里有德语翻译器，英语翻译器，法语翻译器，汉语翻译器，日语翻译器等等等等，丢进去的时候它就会自动查找了，找到对应的语言就会自动翻译出来。

<!-- more -->

## 实现

```PHP
abstract class TranslationResponsibility
{ // 抽象责任角色
  protected $next; // 下一个责任角色
  protected $translator;

  public function setNext(TranslationResponsibility $l)
  {
    $this->next = $l;

    return $this;
  }

  public function canTranslate($input)
  {
    return $this->translator == $this->check($input);
  }

  // 不允许被继承，用final
  public final function check($input)
  {
    //写验证输入语言总类的逻辑
    if ($input == '白菜')
    {
      return 'English';
    }

    return 'French';
  }

  abstract public function translate($input); // 翻译方法
}

class EnglishTranslator extends TranslationResponsibility
{
  public function __construct()
  {
    $this->translator = 'English';
  }

  public function translate($input)
  {
    //如果当前翻译器翻译不了，并且责任链上还有下一个翻译器可用，则让下一个翻译器试试
    if (!is_null($this->next) && !$this->canTranslate($input))
    {
      $this->next->translate($input);
    } else
    {
      echo '英语逻辑';
    }
  }
}

class FrenchTranslator extends TranslationResponsibility
{
  public function __construct()
  {
    $this->translator = 'French';
  }

  public function translate($input)
  {
    //如果当前翻译器翻译不了，并且责任链上还有下一个翻译器可用，则让下一个翻译器试试
    if (!is_null($this->next) && !$this->canTranslate($input))
    {
      $this->next->translate($input);
    } else
    {
      echo '法语逻辑';
    }
  }
}
```

## 使用

```PHP
//组建注册链
$res_a = new EnglishTranslator();
$res_b = new FrenchTranslator();
$res_a->setNext($res_b);
//使用
$res_a->translate('白菜');  // 英语逻辑

$res_a->translate('白菜2'); // 法语逻辑
```

结果就是，英语翻译器翻译不了，传递到法语翻译器翻译。

注意，这里为了简化说明，只展示了 2 个翻译器互为责任链的情况，如果你需要多个翻译器，还需要改造一下代码，让它能够轮询。
