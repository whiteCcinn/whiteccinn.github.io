---
title: 字符编码深度剖析
date: 2017-07-27 22:44:00
categories: [协议]
tags: [协议, ascii]
---

## 前言

在这里，我们对如下4种编码进行对比

- unicode编码
- utf8编码
- ascii编码
- asni编码

### ASCII编码和ASNI编码的区别

字符内码(charcter code)指的是用来代表字符的内码.读者在输入和存储文档时都要使用内码,内码分为 单字节内码 -- Single-Byte character sets (SBCS),可以支持**255**（ `8bits = (2^8)-1 = 255`）个字符编码. 双字节内码 -- Double-Byte character sets)(DBCS),可以支持**65000**个字符编码（最多支持`16 bits = (2^16)-1 = 65535`）. 前者即为ASCII编码，后者对应ANSI. 至于简体中文编码GB2312，实际上它是ANSI的一个代码页

### UNICODE编码

unicode 是一种编码表格，例如，给一个汉字规定一个代码。类似 GB2312-1980, GB18030等，只不过字集不同。 一个unicode码可能转成长度为一个BYTE,或两个，三个，四个BYTE（`最多6个byte`）的UTF8码，取决于unicode码的值。英文unicode码因为值小于**0x80**（`单字节字符`）,只要用一个BYTE的UTF8传送，`比送unicode两个bytes快`。

如上，ANSI有很多代码页，使用不同代码页的内码无法在其他代码也正常显示，这就是为什么日文版／繁体中文版游戏无法在简体中文平台直接显示的原因．

Unicode也是一种字符编码方法，不过它是由国际组织设计，可以容纳**全世界所有语言文字的编码方案**．它是一种`２字节编码`，能够提供６５５３５个字符， 这个数字是**不够表示所有的字符**的（汉语就有５５０００多字符），所以，通过一个代理对的机制来实现附加的９１７，４７６个字符表示，以达到所有字符都具有`唯一编码`．

### Unicode和BigEndianUnicode

这两者只是存储顺序不同，如＂A＂的unicode编码为65 00 其BigEndianUnicode编码为00 65

其实就是类比于我之前说过的大小端的介绍

### UTF8编码

UTF8全称：Unicode Transformation Format -- 8 bit（unicode转化格式为8位的流数据）

Unicode是一个字符集，而UTF-8是Unicode的其中一种，Unicode是定长的都为双字节，而UTF-8是可变的，对于汉字来说Unicode占有的字节比UTF-8占用的字节少1个字节。Unicode为双字节，而UTF-8中汉字占三个字节。

是Unicode传送格式。即把Unicode文件转换成BYTE的传送流。

其中UTF-16和Unicode编码大致一样, UTF-8就是以8位为单元对Unicode进行编码。

UTF-8编码字符理论上可以最多到6个字节长,然而`16位BMP（Basic Multilingual Plane）字符`最多只用到3字节长。从Unicode到UTF-8的编码方式如下：

| Unicode编码(16进制) | UTF-8 字节流(二进制)                                  |
| ------------------- | ----------------------------------------------------- |
| 0000 - 007F         | 0xxxxxxx                                              |
| 0080 - 07FF         | 110xxxxx 10xxxxxx                                     |
| 0800 - FFFF         | 1110xxxx 10xxxxxx 10xxxxxx                            |
| 100000 - 1FFFFF     | 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx                   |
| 200000 - 3FFFFFF    | 111110xx 10xxxxxx 10xxxxxx 10xxxxxx 10xxxxxx          |
| 4000000 - 7FFFFFFF  | 1111110x 10xxxxxx 10xxxxxx 10xxxxxx 10xxxxxx 10xxxxxx |


例如“我”字的Unicode编码是4f6b。4f6b在0800-FFFF之间，所以肯定要用3字节模板了：1110xxxx 10xxxxxx 10xxxxxx。将4f6b写成二进制是：100 111101 101011， 用这个比特流依次代替模板中的x，得到：11100100 10111101 10101011，即E4 9C AB。

### 用PHP实现unicode编码和utf8编码的转变

```PHP
<?php
/**
 * UTF-8编码字符理论上可以最多到6个字节长,然而16位BMP（Basic Multilingual Plane）字符最多只用到3字节长。下面看一下UTF-8编码表：
 *
 * U-00000000 - U-0000007F: 0xxxxxxx
 * U-00000080 - U-000007FF: 110xxxxx 10xxxxxx
 * U-00000800 - U-0000FFFF: 1110xxxx 10xxxxxx 10xxxxxx
 * U-00010000 - U-001FFFFF: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
 * U-00200000 - U-03FFFFFF: 111110xx 10xxxxxx 10xxxxxx 10xxxxxx 10xxxxxx
 * U-04000000 - U-7FFFFFFF: 1111110x 10xxxxxx 10xxxxxx 10xxxxxx 10xxxxxx 10xxxxxx
 */
/**
 * 单字符汉字转换unicode(16进制)
 *
 * @param $utf8_str
 *
 * @return string
 */
function utf8_transform_unicode($utf8_str)
{
  $unicode = (ord($utf8_str{0}) & 0xF) << 12;
  $unicode |= (ord($utf8_str{1}) & 0x3F) << 6;
  $unicode |= (ord($utf8_str{2}) & 0x3F);

  return dechex($unicode);
}

/**
 * unicode编码转汉字
 * @param $unicode
 * @return string
 */
function unicode_transform_utf8($unicode)
{
  // 十六进制转十进制
  $unicode  = (int)hexdec($unicode);
  $ord_1    = decbin(0xe0 | ($unicode >> 12));
  $ord_2    = decbin(0x80 | (($unicode >> 6) & 0x3f));
  $ord_3    = decbin(0x80 | ($unicode & 0x3f));
  $utf8_str = chr(bindec($ord_1)) . chr(bindec($ord_2)) . chr(bindec($ord_3));

  return $utf8_str;

}


$str = '我';
echo utf8_transform_unicode($str);

$unicode = '6211';
echo unicode_transform_utf8($unicode);
```

后续，我会出一个用php直接实现编码转换和汉字字符串截取的PHP扩展，都会用到这次的知识，后续见。