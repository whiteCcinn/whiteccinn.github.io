---
title: PHP-CS-Fixer 配置详细对比
date: 2019-05-21 09:50:00
categories: [PHP]
tags: [PHP]
---

## 前言

由于我们项目比较多，而且每个人的编写代码的风格也不太一致，我们希望尽可能在格式上得到统一，这样子的好处有如下几点：

- 遵循 PSR2
- codereview 的时候可以免除格式差异所带来的干扰
- 统一格式有利于大家在这个基础上写出更为优雅的代码格式

因此，我们实现了用于的统一格式化配套的工具链：

- `husky-php`：用于实现客户端 `githook 钩子`，用于执行触发我们的 husky 项目（默认支持自动格式化，冲突校验）
- `composer-husky-plugin`：专门由 `husky-php` 定制的 composer 插件，用于自动部署`husky-php`
- `php-cs-fixer-config`：专门定义 `php-cs-fixer` 格式配置的组件

<!-- more -->

## PHP_CS_Fixer

这是一个代码格式化工具，并且支持很多高级格式内容。

[PHP_CS_FIXER](https://github.com/FriendsOfPHP/PHP-CS-Fixer)

## 配置项

### @PSR2

遵循 PSR2 的标准

```php
$rules = [
    '@PSR2' => true
];
```

原始格式：

```php
function A($args1,$args2=0){
    $a=2;
    var_dump($args1,$args2);
}
```

格式化后：

```php
function A($args1, $args2=0)
{
    $a=2;
    var_dump($args1, $args2);
}
```

### align_multiline_comment [@PhpCsFixer]

每行多行 DocComments 必须有一个星号（PSR-5），并且必须与第一行对齐。

可选配置项

- comment_type
  - phpdocs_only （默认）
  - phpdocs_like
  - all_multiline

> 暂时未知三个选项的具体区别，目前来看效果都是一致的，例子如下

```php
$rules = [
  'align_multiline_comment' => [
      'comment_type' => 'phpdocs_only'
  ]
];
```

原始格式：

```php
/**
 * @param     $args1
@param int $args2
 */
function A($args1, $args2=0)
{
    $a=2;
}
```

格式化后：

```php
/**
 * @param     $args1
 * @param int $args2
 */
function A($args1, $args2=0)
{
    $a=2;
}
```

### array_indentation [@PhpCsFixer]

数组的每个元素必须缩进一次。

```php
$rules = [
  'array_indentation'=>true
];
```

原始格式：

```php
/**
 * @param     $args1
 * @param int $args2
 */
function A($args1, $args2=0)
{
    $array=[
    '1'
    ];
}
```

格式化后：

```php
/**
 * @param     $args1
 * @param int $args2
 */
function A($args1, $args2=0)
{
    $array=[
        '1'
    ];
}
```

### array_syntax [@PhpCsFixer]

应使用配置的语法声明 PHP 数组。

可选配置项

- syntax
  - long (默认，用`array`关键字来定义数组)
  - short (用`[]`关键字来定义数组)

```php
$rules = [
  'array_syntax' => [
      'syntax' => 'short',
  ]
];
```

原始格式：

```php
/**
 * @param     $args1
 * @param int $args2
 */
function A($args1, $args2=0)
{
    $array=array();
}
```

格式化后：

```php
/**
 * @param     $args1
 * @param int $args2
 */
function A($args1, $args2=0)
{
    $array=[];
}
```

### backtick_to_shell_exec

将反引号运算符转换为 shell_exec 调用。

```php
$rules = [
  'backtick_to_shell_exec' => true
];
```

原始格式：

```php
function A()
{
    $out = `echo Hello`;
    var_dump($out);
}

A();
```

格式化后：

```php
function A()
{
    $out = shell_exec("echo Hello");
    var_dump($out);
}

A();
```

### binary_operator_spaces [@Symfony, @PhpCsFixer]

"=", "_", "/", "%", "<", ">", "|", "^", "+", "-", "&", "&=", "&&", "||", ".=", "/=", "=>", "==", ">=", "===", "!=", "<>", "!==", "<=", "and", "or", "xor", "-=", "%=", "_=", "|=", "+=", "<<", "<<=", ">>", ">>=", "^=", "**", "**=", "<=>", "??"这一类的二进制运算符应按配置包含的空格。

可选配置项

- align_double_arrow (双箭头居中格式，将会为废弃，用 default/operators 来代替更详细的配置)
  - false
  - null
  - true
- align_equals (等于号居中格式，将会为废弃，用 default/operators 来代替更详细的配置)
  - false
  - null
  - true
- default (默认)
  - align （居中）
  - align_single_space （默认，单空格居中）
  - align_single_space_minimal (和 align_single_space 的区别是如果空格大于 1 个的时候，会缩减到 1 个)
  - no_space （没有空格）
  - single_space (单空格，不居中)
  - null (不做任何改变)
- operators（array） （针对特殊的操作符做特殊的处理）
  - key ："=", "_", "/", "%", "<", ">", "|", "^", "+", "-", "&", "&=", "&&", "||", ".=", "/=", "=>", "==", ">=", "===", "!=", "<>", "!==", "<=", "and", "or", "xor", "-=", "%=", "_=", "|=", "+=", "<<", "<<=", ">>", ">>=", "^=", "**", "**=", "<=>", "??"
  - value 同 default

> 这里就不测试 align_double_arrow 和 align_equals 了，因为这 2 个参数会被废弃

```php
$rules = [
  'binary_operator_spaces' => [
    'default' => 'align'
  ]
];
```

原始格式：

```php
function A()
{
    $a = 1>>2;
    $a = 12>>2;
    $a = 12<<1;
    $a = 12&1;
    $bb=1112|1;
}
```

格式化后：

```php
function A()
{
    $a = 1 >>2;
    $a = 12>>2;
    $a = 12<<1;
    $a = 12&1;
    $bb=1112|1;
}
```

```php
$rules = [
  'binary_operator_spaces' => [
    'default' => 'align_single_space'
  ]
];
```

原始格式：

```php
function A()
{
    $a = 1>>2;
    $a = 12>>2;
    $a = 12<<1;
    $a = 12&1;
    $bb=1112|1;
}
```

格式化后：

```php
function A()
{
    $a  = 1  >> 2;
    $a  = 12 >> 2;
    $a  = 12 << 1;
    $a  = 12 & 1;
    $bb = 1112 | 1;
}
```

```php
$rules = [
  'binary_operator_spaces' => [
    'default' => 'align_single_space_minimal'
  ]
];
```

原始格式：

```php
function A()
{
    $a  = 1  >> 2;
    $a  = 12 >> 2;
    $a  = 12 << 1;
    $a  = 12 & 1;
    $bb = 1112 |            1;
}
```

格式化后：

```php
function A()
{
    $a  = 1  >> 2;
    $a  = 12 >> 2;
    $a  = 12 << 1;
    $a  = 12 & 1;
    $bb = 1112 | 1;
}
```

```php
$rules = [
  'binary_operator_spaces' => [
    'default' => 'no_space'
  ]
];
```

原始格式：

```php
function A()
{
    $a  = 1  >> 2;
    $a  = 12 >> 2;
    $a  = 12 << 1;
    $a  = 12 & 1;
    $bb = 1112 | 1;
}
```

格式化后：

```php
function A()
{
    $a=1>>2;
    $a=12>>2;
    $a=12<<1;
    $a=12&1;
    $bb=1112|1;
}
```

```php
$rules = [
  'binary_operator_spaces' => [
    'default' => 'single_space'
  ]
];
```

原始格式：

```php
function A()
{
    $a=1>>2;
    $a=12>>2;
    $a=12<<1;
    $a=12&1;
    $bb=1112|1;
}
```

格式化后：

```php
function A()
{
    $a = 1 >> 2;
    $a = 12 >> 2;
    $a = 12 << 1;
    $a = 12 & 1;
    $bbbb = 1112 | 1;
}
```

```php
$rules = [
  'binary_operator_spaces' => [
    'operators' => [
      '=' => 'no_space'
    ]
  ]
];
```

原始格式：

```php
function A()
{
    $array = [
        'a'=>1,
        'bb'=>2,
        'ccc'=>3
    ];
}
```

格式化后：

```php
function A()
{
    $array=[
        'a' => 1,
        'bb' => 2,
        'ccc' => 3
    ];
}
```

### blank_line_after_namespace [@PSR2, @Symfony, @PhpCsFixer]

命名空间之后空一行

```php
$rules = [
  'blank_line_after_namespace' => true
];
```

原始格式：

```php
namespace Test;
function A()
{
}

```

格式化后：

```php
namespace Test;

function A()
{
}

```

### blank_line_after_opening_tag [@Symfony, @PhpCsFixer]

`<?php` 后面加一个空行

```php
$rules = [
  'blank_line_after_namespace' => true
];
```

原始格式：

```php
<?php
namespace Test;

function A()
{
}

```

格式化后：

```php
<?php

namespace Test;

function A()
{
}

```

### blank_line_before_return

return 前面加一个空白行（弃用！用 blank_line_before_statement 代替）

```php
$rules = [
  'blank_line_before_return' => true
];
```

原始格式：

```php
function A()
{
   $a = '123'
   return $a;
}

```

格式化后：

```php
function A()
{
   $a = '123'

   return $a;
}
```

### blank_line_before_statement [@Symfony, @PhpCsFixer]

空行换行必须在任何已配置的语句之前

```php
$rules = [
  'blank_line_before_statement' => [
    'statements' => [
      'break',
      'continue',
      'declare',
      'return',
      'throw',
      'try'
  ]
];
```

可选配置项

- statements (赋值数组)
  - break
  - case
  - continue
  - declare
  - default
  - die
  - do
  - exit
  - for
  - foreach
  - goto
  - if
  - include
  - include_once
  - require
  - require_once
  - return
  - switch
  - throw
  - try
  - while
  - yield

默认配置项的值为：['break', 'continue', 'declare', 'return', 'throw', 'try']

原始格式：

```php
function A()
{
    $a = 1;
    switch ($a) {
        case 1:
            break;
        default:
    }

    while (true) {
        if ($a == true){
            $a = 2;
            continue;
        }
    }
    throw new \Exception();
    return 1;
}


```

格式化后：

```php
function A()
{
    $a = 1;
    switch ($a) {
        case 1:
            break;
        default:
    }

    while (true) {
        if ($a == true) {
            $a = 2;

            continue;
        }
    }

    throw new \Exception();

    return 1;
}
```

### braces [@PSR2, @Symfony, @PhpCsFixer]

每个结构的主体必须用大括号括起来。大括号应妥善放置。大括号应适当缩进。

可选配置项

- allow_single_line_closure (是否应该允许单行 lambda 表示法)
  - true
  - false (默认)
- position_after_anonymous_constructs (在匿名构造（匿名类和 lambda 函数）之后是否应将开括号放在“next”或“same”行)
  - next
  - same (默认)
- position_after_functions_and_oop_constructs 在优雅结构（非匿名类，接口，特征，方法和非 lambda 函数）之后，是否应将开括号放在“next”或“same”行上
  - next （默认）
  - same

这个规则就不写了，因为这个就是最佳的了，因为是 PSR2 标准（偷懒）

原始格式：

```php
class A{
    public function __construct(){
        $a = function(){ echo 1;};
    }
}

```

格式化后：

```php
class A
{
    public function __construct()
    {
        $a = function () {
            echo 1;
        };
    }
}

```

### cast_spaces [@Symfony, @PhpCsFixer]

类型转换的时候，是否需要在中间加空格

可选配置项

- space
  - none
  - single (默认)

```php
$rules = [
  'cast_spaces' => [
    'space' => [
      'single',
  ]
];
```

原始格式：

```php
function A(){
    echo (int)1;
}

```

格式化后：

```php
function A()
{
    echo (int) 1;
}

```

### class_attributes_separation [@Symfony, @PhpCsFixer]

Class, trait 和 interface 的属性是否需要一个空行隔开

可选配置项

- elements （数组）
  - const
  - method
  - property

默认配置项的值为：['const', 'method', 'property']

```php
$rules = [
  'class_attributes_separation'  => [
      'elements' => ['const', 'method', 'property']
  ]
];
```

原始格式：

```php
class A
{
    private $a;
    private $b;
}


```

格式化后：

```php
class A
{
    private $a;

    private $b;
}
```

### class_definition [@PSR2, @Symfony, @PhpCsFixer]

`class`,`trait`,`interface` 关键字周围是否只有一个空格

可选配置项

- multi_line_extends_each_single_line
  - true
  - false (默认)
- single_item_single_line
  - true
  - false (默认)
- single_line
  - true
  - false (默认)

PSR2 标准的就不具体配置了

原始格式：

```php
class          A
{
    private $a;
    private $b;
}

```

格式化后：

```php
class A
{
    private $a;

    private $b;
}
```

### class_keyword_remove

`::class` 关键字移除，转成字符串

```php
$rules = [
  'class_keyword_remove'  => true
];
```

原始格式：

```php
class A
{
}

echo A::class;

```

格式化后：

```php
class A
{
}

echo 'A';

```

### combine_consecutive_issets [@PhpCsFixer]

当多个 isset 通过&&连接的时候，合并处理

```php
$rules = [
  'combine_consecutive_issets'  => true
];
```

原始格式：

```php
isset($a) && isset($b) && isset($c);

```

格式化后：

```php
isset($a, $b, $c);

```

### combine_consecutive_unsets [@PhpCsFixer]

当多个 unset 使用的时候，合并处理

```php
$rules = [
  'combine_consecutive_unsets'  => true
];
```

原始格式：

```php
unset($a);
unset($b);
unset($c);

```

格式化后：

```php
unset($a, $b, $c);

```

### combine_nested_dirname [@PHP70Migration:risky, @PHP71Migration:risky]

Replace multiple nested calls of dirname by only one call with second \$level parameter. Requires PHP >= 7.0.

Risky rule: risky when the function `dirname` is overridden.

### comment_to_phpdoc [@PhpCsFixer:risky]

Comments with annotation should be docblock when used on structural elements.

Risky rule: risky as new docblocks might mean more, e.g. a Doctrine entity might have a new column in database.

### compact_nullable_typehint [@PhpCsFixer]

> 暂时不太清楚什么区别

### concat_space [@Symfony, @PhpCsFixer]

连接字符是否需要空格

可选配置项

- spacing
  - none (默认)
  - one

```php
$rules = [
  'concat_space'  => [
    'spacing' => 'one'
  ]
];
```

原始格式：

```php
$a = '';
$c = 'c';
$b = $a.$c;

```

格式化后：

```php
$a = '';
$c = 'c';
$b = $a . $c;

```

### date_time_immutable

Class DateTimeImmutable should be used instead of DateTime.

Risky rule: risky when the code relies on modifying `DateTime` objects or if any of the `date_create*` functions are overridden.

### declare_equal_normalize [@Symfony, @PhpCsFixer]

declare 语句中的等于号是否需要空格

可选配置项

- space
  - none
  - single（默认）

```php
$rules = [
  'declare_equal_normalize'  => [
    'space' => 'single'
  ]
];
```

原始格式：

```php
declare(ticks=1) {
}

```

格式化后：

```php
declare(ticks = 1) {
}

```

### declare_strict_types [@PHP70Migration:risky, @PHP71Migration:risky]

Force strict types declaration in all files. Requires PHP >= 7.0.

Risky rule: forcing strict types will stop non strict code from working.

### dir_constant [@Symfony:risky, @PhpCsFixer:risky]

Replaces dirname(\_\_FILE\_\_) expression with equivalent \_\_DIR\_\_ constant.

Risky rule: risky when the function `dirname` is overridden.

### doctrine_annotation_array_assignment [@DoctrineAnnotation]

Doctrine annotations must use configured operator for assignment in arrays.

Configuration options:

ignored_tags (array): list of tags that must not be treated as Doctrine Annotations; defaults to ['abstract', 'access', 'code', 'deprec', 'encode', 'exception', 'final', 'ingroup', 'inheritdoc', 'inheritDoc', 'magic', 'name', 'toc', 'tutorial', 'private', 'static', 'staticvar', 'staticVar', 'throw', 'api', 'author', 'category', 'copyright', 'deprecated', 'example', 'filesource', 'global', 'ignore', 'internal', 'license', 'link', 'method', 'package', 'param', 'property', 'property-read', 'property-write', 'return', 'see', 'since', 'source', 'subpackage', 'throws', 'todo', 'TODO', 'usedBy', 'uses', 'var', 'version', 'after', 'afterClass', 'backupGlobals', 'backupStaticAttributes', 'before', 'beforeClass', 'codeCoverageIgnore', 'codeCoverageIgnoreStart', 'codeCoverageIgnoreEnd', 'covers', 'coversDefaultClass', 'coversNothing', 'dataProvider', 'depends', 'expectedException', 'expectedExceptionCode', 'expectedExceptionMessage', 'expectedExceptionMessageRegExp', 'group', 'large', 'medium', 'preserveGlobalState', 'requires', 'runTestsInSeparateProcesses', 'runInSeparateProcess', 'small', 'test', 'testdox', 'ticket', 'uses', 'SuppressWarnings', 'noinspection', 'package_version', 'enduml', 'startuml', 'fix', 'FIXME', 'fixme', 'override']
operator (':', '='): the operator to use; defaults to '='

### doctrine_annotation_braces [@DoctrineAnnotation]

Doctrine annotations without arguments must use the configured syntax.

Configuration options:

ignored_tags (array): list of tags that must not be treated as Doctrine Annotations; defaults to ['abstract', 'access', 'code', 'deprec', 'encode', 'exception', 'final', 'ingroup', 'inheritdoc', 'inheritDoc', 'magic', 'name', 'toc', 'tutorial', 'private', 'static', 'staticvar', 'staticVar', 'throw', 'api', 'author', 'category', 'copyright', 'deprecated', 'example', 'filesource', 'global', 'ignore', 'internal', 'license', 'link', 'method', 'package', 'param', 'property', 'property-read', 'property-write', 'return', 'see', 'since', 'source', 'subpackage', 'throws', 'todo', 'TODO', 'usedBy', 'uses', 'var', 'version', 'after', 'afterClass', 'backupGlobals', 'backupStaticAttributes', 'before', 'beforeClass', 'codeCoverageIgnore', 'codeCoverageIgnoreStart', 'codeCoverageIgnoreEnd', 'covers', 'coversDefaultClass', 'coversNothing', 'dataProvider', 'depends', 'expectedException', 'expectedExceptionCode', 'expectedExceptionMessage', 'expectedExceptionMessageRegExp', 'group', 'large', 'medium', 'preserveGlobalState', 'requires', 'runTestsInSeparateProcesses', 'runInSeparateProcess', 'small', 'test', 'testdox', 'ticket', 'uses', 'SuppressWarnings', 'noinspection', 'package_version', 'enduml', 'startuml', 'fix', 'FIXME', 'fixme', 'override']
syntax ('with_braces', 'without_braces'): whether to add or remove braces; defaults to 'without_braces'

### doctrine_annotation_indentation [@DoctrineAnnotation]

Doctrine annotations must be indented with four spaces.

Configuration options:

ignored_tags (array): list of tags that must not be treated as Doctrine Annotations; defaults to ['abstract', 'access', 'code', 'deprec', 'encode', 'exception', 'final', 'ingroup', 'inheritdoc', 'inheritDoc', 'magic', 'name', 'toc', 'tutorial', 'private', 'static', 'staticvar', 'staticVar', 'throw', 'api', 'author', 'category', 'copyright', 'deprecated', 'example', 'filesource', 'global', 'ignore', 'internal', 'license', 'link', 'method', 'package', 'param', 'property', 'property-read', 'property-write', 'return', 'see', 'since', 'source', 'subpackage', 'throws', 'todo', 'TODO', 'usedBy', 'uses', 'var', 'version', 'after', 'afterClass', 'backupGlobals', 'backupStaticAttributes', 'before', 'beforeClass', 'codeCoverageIgnore', 'codeCoverageIgnoreStart', 'codeCoverageIgnoreEnd', 'covers', 'coversDefaultClass', 'coversNothing', 'dataProvider', 'depends', 'expectedException', 'expectedExceptionCode', 'expectedExceptionMessage', 'expectedExceptionMessageRegExp', 'group', 'large', 'medium', 'preserveGlobalState', 'requires', 'runTestsInSeparateProcesses', 'runInSeparateProcess', 'small', 'test', 'testdox', 'ticket', 'uses', 'SuppressWarnings', 'noinspection', 'package_version', 'enduml', 'startuml', 'fix', 'FIXME', 'fixme', 'override']
indent_mixed_lines (bool): whether to indent lines that have content before closing parenthesis; defaults to false

### doctrine_annotation_spaces [@DoctrineAnnotation]

Fixes spaces in Doctrine annotations.

Configuration options:

after_argument_assignments (null, bool): whether to add, remove or ignore spaces after argument assignment operator; defaults to false
after_array_assignments_colon (null, bool): whether to add, remove or ignore spaces after array assignment : operator; defaults to true
after_array_assignments_equals (null, bool): whether to add, remove or ignore spaces after array assignment = operator; defaults to true
around_argument_assignments (bool): whether to fix spaces around argument assignment operator; defaults to true. DEPRECATED: use options before_argument_assignments and after_argument_assignments instead
around_array_assignments (bool): whether to fix spaces around array assignment operators; defaults to true. DEPRECATED: use options before_array_assignments_equals, after_array_assignments_equals, before_array_assignments_colon and after_array_assignments_colon instead
around_commas (bool): whether to fix spaces around commas; defaults to true
around_parentheses (bool): whether to fix spaces around parentheses; defaults to true
before_argument_assignments (null, bool): whether to add, remove or ignore spaces before argument assignment operator; defaults to false
before_array_assignments_colon (null, bool): whether to add, remove or ignore spaces before array : assignment operator; defaults to true
before_array_assignments_equals (null, bool): whether to add, remove or ignore spaces before array = assignment operator; defaults to true
ignored_tags (array): list of tags that must not be treated as Doctrine Annotations; defaults to ['abstract', 'access', 'code', 'deprec', 'encode', 'exception', 'final', 'ingroup', 'inheritdoc', 'inheritDoc', 'magic', 'name', 'toc', 'tutorial', 'private', 'static', 'staticvar', 'staticVar', 'throw', 'api', 'author', 'category', 'copyright', 'deprecated', 'example', 'filesource', 'global', 'ignore', 'internal', 'license', 'link', 'method', 'package', 'param', 'property', 'property-read', 'property-write', 'return', 'see', 'since', 'source', 'subpackage', 'throws', 'todo', 'TODO', 'usedBy', 'uses', 'var', 'version', 'after', 'afterClass', 'backupGlobals', 'backupStaticAttributes', 'before', 'beforeClass', 'codeCoverageIgnore', 'codeCoverageIgnoreStart', 'codeCoverageIgnoreEnd', 'covers', 'coversDefaultClass', 'coversNothing', 'dataProvider', 'depends', 'expectedException', 'expectedExceptionCode', 'expectedExceptionMessage', 'expectedExceptionMessageRegExp', 'group', 'large', 'medium', 'preserveGlobalState', 'requires', 'runTestsInSeparateProcesses', 'runInSeparateProcess', 'small', 'test', 'testdox', 'ticket', 'uses', 'SuppressWarnings', 'noinspection', 'package_version', 'enduml', 'startuml', 'fix', 'FIXME', 'fixme', 'override']

### elseif [@PSR2, @Symfony, @PhpCsFixer]

用`elseif`来代替`else if`

由于是 PSR2 的标准，所以就不配置了

原始格式：

```php
if ($a = 1) {
} else if (true) {
}

```

格式化后：

```php
if ($a = 1) {
} elseif (true) {
}

```

### encoding [@PSR1, @PSR2, @Symfony, @PhpCsFixer]

PHP 代码必须只使用没有 BOM 的 UTF-8（删除 BOM）。

由于是 PSR2 的标准，所以就不配置了

> 这个也没什么好演示的了

### ereg_to_preg [@Symfony:risky, @PhpCsFixer:risky]

Replace deprecated ereg regular expression functions with preg.

Risky rule: risky if the `ereg` function is overridden.

### error_suppression [@Symfony:risky, @PhpCsFixer:risky]

Error control operator should be added to deprecation notices and/or removed from other cases.

Risky rule: risky because adding/removing `@` might cause changes to code behaviour or if `trigger_error` function is overridden.

Configuration options:

mute_deprecation_error (bool): whether to add @ in deprecation notices; defaults to true
noise_remaining_usages (bool): whether to remove @ in remaining usages; defaults to false
noise_remaining_usages_exclude (array): list of global functions to exclude from removing @; defaults to []

### escape_implicit_backslashes [@PhpCsFixer]

是否需要自动帮忙添加转义字符

可选配置项

- double_quoted (双引号)
  - true （默认）
  - false
- heredoc_syntax （heredoc 的语法）
  - true （默认）
  - false
- single_quoted (单引号)
  - true
  - false （默认）

```php
$rules = [
  'escape_implicit_backslashes'  => [
      'double_quoted' => true,
      'heredoc_syntax' => true,
      'single_quoted' => false
  ]
];
```

原始格式：

```php
$a = "\d";
$a = <<<HEREDOC
\d
HEREDOC;
$a = '\d';
```

格式化后：

```php
$a = "\\d";
$a = <<<HEREDOC
\\d
HEREDOC;
$a = '\d';

```

### explicit_indirect_variable [@PhpCsFixer]

Add curly braces to indirect variables to make them clear to understand. Requires PHP >= 7.0.

### explicit_string_variable [@PhpCsFixer]

把双引号或者 heredoc 字符串内部的隐形变量转成显性

```php
$rules = [
 'explicit_string_variable'  => true
];
```

原始格式：

```php
$b = 'b';
$a = "\d $b";
$a = <<<HEREDOC
\d $b
HEREDOC;
```

格式化后：

```php
$b = 'b';
$a = "\d ${b}";
$a = <<<HEREDOC
\d ${b}
HEREDOC;

```

### final_class

All classes must be final, except abstract ones and Doctrine entities.

Risky rule: risky when subclassing non-abstract classes.

### final_internal_class [@PhpCsFixer:risky]

Internal classes should be final.

Risky rule: changing classes to `final` might cause code execution to break.

Configuration options:

annotation-black-list (array): class level annotations tags that must be omitted to fix the class, even if all of the white list ones are used as well. (case insensitive); defaults to ['@final', '@Entity', '@ORM\\Entity']
annotation-white-list (array): class level annotations tags that must be set in order to fix the class. (case insensitive); defaults to ['@internal']
consider-absent-docblock-as-internal-class (bool): should classes without any DocBlock be fixed to final?; defaults to false

### fopen_flag_order [@Symfony:risky, @PhpCsFixer:risky]

Order the flags in fopen calls, b and t must be last.

Risky rule: risky when the function `fopen` is overridden.

### fopen_flags [@Symfony:risky, @PhpCsFixer:risky]

The flags in fopen calls must omit t, and b must be omitted or included consistently.

Risky rule: risky when the function `fopen` is overridden.

Configuration options:

b_mode (bool): the b flag must be used (true) or omitted (false); defaults to true

### fopen_flags [@Symfony:risky, @PhpCsFixer:risky]

The flags in fopen calls must omit t, and b must be omitted or included consistently.

Risky rule: risky when the function `fopen` is overridden.

Configuration options:

b_mode (bool): the b flag must be used (true) or omitted (false); defaults to true

### full_opening_tag [@PSR1, @PSR2, @Symfony, @PhpCsFixer]

php 代码必须用 `<?php` 或者 `<?=` 不能是其他

> 这个在以前的前后段代码一起的时候可能需要注意的问题，在这里不做过多的演示

### fully_qualified_strict_types [@PhpCsFixer]

Transforms imported FQCN parameters and return types in function arguments to short version.

### function_declaration [@PSR2, @Symfony, @PhpCsFixer]

必包函数关键字`function后面是否需要空格`

可选配置项

- closure_function_spacing （闭包函数 function 是否需要空格）
  - none
  - one (默认)

```php
$rules = [
 'function_declaration'  => [
   'closure_function_spacing' => 'one'
 ]
];
```

原始格式：

```php
$a = function($a, $b) {
};
```

格式化后：

```php
$a = function ($a, $b) {
};

```

### function_to_constant [@Symfony:risky, @PhpCsFixer:risky]

Replace core functions calls returning constants with the constants.

Risky rule: risky when any of the configured functions to replace are overridden.

Configuration options:

functions (a subset of ['get_called_class', 'get_class', 'php_sapi_name', 'phpversion', 'pi']): list of function names to fix; defaults to ['get_class', 'php_sapi_name', 'phpversion', 'pi']

### function_typehint_space [@Symfony, @PhpCsFixer]

在闭包函数的参数类型约束的时候，是否需要空格

```php
$rules = [
 'function_typehint_space'  => true
];
```

原始格式：

```php
$a = function(array$a, $b) {
};
```

格式化后：

```php
$a = function (array $a, $b) {
};

```

### general_phpdoc_annotation_remove

在 phpdoc 中应该忽略的注解

可选配置项

- annotations(数组)
  - author
  - ...

默认可选配置项的值：[]

```php
$rules = [
  'general_phpdoc_annotation_remove'  => [
    'annotations' => [
        'author'
    ]
  ]
];
```

原始格式：

```php
/**
 * @copyright 471113744@qq.com
 * @author caiwenhui
 */

$a = '1';
```

格式化后：

```php
/**
 * @copyright caiwenhui
 */

$a = '1';

```

### hash_to_slash_comment

Single line comments should use double slashes // and not hash #. DEPRECATED: use single_line_comment_style instead.

### header_comment

Add, replace or remove header comment.

Configuration options:

comment_type ('comment', 'PHPDoc'): comment syntax type; defaults to 'comment'; DEPRECATED alias: commentType
header (string): proper header content; required
location ('after_declare_strict', 'after_open'): the location of the inserted header; defaults to 'after_declare_strict'
separate ('both', 'bottom', 'none', 'top'): whether the header should be separated from the file content with a new line; defaults to 'both'

### heredoc_indentation [@PHP73Migration]

Heredoc/nowdoc content must be properly indented. Requires PHP >= 7.3.

### heredoc_to_nowdoc [@PhpCsFixer]

当一个 heredoc 里面没有变量当时候，可以转成 nowdoc

```php
$rules = [
  'heredoc_to_nowdoc'  => true
];
```

原始格式：

```php
$b = 'a';
$a = <<<HEREDOC
${b}
HEREDOC;

$c = <<<CNOWDOC
\$b
CNOWDOC;
```

格式化后：

```php
$b = 'a';
$a = <<<HEREDOC
${b}
HEREDOC;

$c = <<<'CNOWDOC'
$b
CNOWDOC;

```

### implode_call [@Symfony:risky, @PhpCsFixer:risky]

Function implode must be called with 2 arguments in the documented order.

Risky rule: risky when the function `implode` is overridden.

### include [@Symfony, @PhpCsFixer]

Include/Require 的时候，不应该用括号扩起来，应该用空格分割

```php
$rules = [
  'include'  => true
];
```

原始格式：

```php
include('test.php');

```

格式化后：

```php
include 'test.php';

```

### increment_style [@Symfony, @PhpCsFixer]

Pre- or post-increment and decrement operators should be used if possible.

Configuration options:

style ('post', 'pre'): whether to use pre- or post-increment and decrement operators; defaults to 'pre'

### indentation_type [@PSR2, @Symfony, @PhpCsFixer]

Code MUST use configured indentation type.

### is_null [@Symfony:risky, @PhpCsFixer:risky]

Replaces is_null($var) expression with null === $var.

Risky rule: risky when the function `is_null` is overridden.

Configuration options:

use_yoda_style (bool): whether Yoda style conditions should be used; defaults to true. DEPRECATED: use yoda_style fixer instead

### line_ending [@PSR2, @Symfony, @PhpCsFixer]

所有的 PHP 文件编码必须一致

### linebreak_after_opening_tag

在<?php 标签所在的行不允许存在代码

```php
$rules = [
  'linebreak_after_opening_tag'  => true
];
```

原始格式：

```php
<?php $a = 2;

$a = 0;

```

格式化后：

```php
<?php

$a = 2;

$a = 0;

```

### list_syntax

List (array destructuring) assignment should be declared using the configured syntax. Requires PHP >= 7.1.

Configuration options:

syntax ('long', 'short'): whether to use the long or short list syntax; defaults to 'long'

### logical_operators [@PhpCsFixer:risky]

Use && and || logical operators instead of and and or.

Risky rule: risky, because you must double-check if using and/or with lower precedence was intentional.

### lowercase_cast [@Symfony, @PhpCsFixer]

数据类型转换必须小写

```php
$rules = [
  'lowercase_cast'  => true
];
```

原始格式：

```php
<?php

$a = (INT)2;

```

格式化后：

```php
<?php

$a = (int)2;

```

### lowercase_constants [@PSR2, @Symfony, @PhpCsFixer]

true, false, null 这几个 php 常量必须为小写

```php
$rules = [
  'lowercase_constants'  => true
];
```

原始格式：

```php
$a = TRUE;
$a = FALSE;
$a = NULL;

```

格式化后：

```php
$a = true;
$a = false;
$a = null;

```

### lowercase_keywords [@PSR2, @Symfony, @PhpCsFixer]

PHP 关键字必须小写

```php
$rules = [
  'lowercase_keywords'  => true
];
```

原始格式：

```php
CLASS A {

}

```

格式化后：

```php
class A {

}


```

### lowercase_static_reference [@Symfony, @PhpCsFixer]

静态调用必须小写,例如：`self`, `static`, `parent`

```php
$rules = [
  'lowercase_static_reference'  => true
];
```

原始格式：

```php
class A
{
    public static $b;

    public function __construct()
    {
        STATIC::$b;
    }
}

```

格式化后：

```php
class A
{
    public static $b;

    public function __construct()
    {
        static::$b;
    }
}
```

### magic_constant_casing [@Symfony, @PhpCsFixer]

Magic constants should be referred to using the correct casing.

### magic_method_casing [@Symfony, @PhpCsFixer]

Magic method definitions and calls must be using the correct casing.

### mb_str_functions

Replace non multibyte-safe functions with corresponding mb function.

Risky rule: risky when any of the functions are overridden.

### method_argument_space [@PSR2, @Symfony, @PhpCsFixer]

在方法参数和方法调用中，每个逗号之前不能有空格，每个逗号后必须有一个空格。参数列表可以分为多行，每行后续行缩进一次。这样做时，列表中的第一项必须在下一行，并且每行必须只有一个参数。

可选配置项

- after_heredoc (是否应删除 heredoc end 和逗号之间的空格)
  - true
  - false (默认)
- ensure_fully_multiline (确保多行参数列表的每个参数都在其自己的行上,废弃，on_multiline 改为使用选项)
  - true
  - false （默认）
- keep_multiple_spaces_after_comma （逗号后是否保留多个空格）
  - true
  - false（默认）
- on_multiline （定义如何处理包含换行符函数的参数列表）
  - ensure_fully_multiline
  - ensure_single_line
  - ignore （默认）

> 这个也是比较重要，比较繁琐，但是容易理解，这里就不具体举例子了

### method_chaining_indentation [@PhpCsFixer]

Method chaining MUST be properly indented. Method chaining with different levels of indentation is not supported.

### modernize_types_casting [@Symfony:risky, @PhpCsFixer:risky]

Replaces intval, floatval, doubleval, strval and boolval function calls with according type casting operator.

### multiline_comment_opening_closing [@PhpCsFixer]

DocBlocks 必须以两个星号开头，多行注释必须以单个星号开头，在开头的斜线后面。两者必须在结束斜杠之前以单个星号结尾

### multiline_whitespace_before_semicolons [@PhpCsFixer]

在结束分号之前禁止多行空格或将分号移动到链接调用的新行。

```php
$rules = [
  'multiline_whitespace_before_semicolons'  => [
    'strategy' => 'no_multi_line'
  ]
];
```

原始格式：

```php
$a = 1

;

```

格式化后：

```php
$a = 1;
```

### native_constant_invocation [@Symfony:risky, @PhpCsFixer:risky]

Add leading \ before constant invocation of internal constant to speed up resolving. Constant name match is case-sensitive, except for null, false and true.

Risky rule: risky when any of the constants are namespaced or overridden.

Configuration options:

exclude (array): list of constants to ignore; defaults to ['null', 'false', 'true']
fix_built_in (bool): whether to fix constants returned by get_defined_constants. User constants are not accounted in this list and must be specified in the include one; defaults to true
include (array): list of additional constants to fix; defaults to []
scope ('all', 'namespaced'): only fix constant invocations that are made within a namespace or fix all; defaults to 'all'

### native_function_casing [@Symfony, @PhpCsFixer]

Function defined by PHP should be called using the correct casing.

### native_function_invocation [@Symfony:risky, @PhpCsFixer:risky]

Add leading \ before function invocation to speed up resolving.

Risky rule: risky when any of the functions are overridden.

Configuration options:

exclude (array): list of functions to ignore; defaults to []
include (array): list of function names or sets to fix. Defined sets are @internal (all native functions), @all (all global functions) and @compiler_optimized (functions that are specially optimized by Zend); defaults to ['@internal']
scope ('all', 'namespaced'): only fix function calls that are made within a namespace or fix all; defaults to 'all'
strict (bool): whether leading \ of function call not meant to have it should be removed; defaults to false

### native_function_type_declaration_casing [@Symfony, @PhpCsFixer]

Native type hints for functions should use the correct case.

### new_with_braces [@Symfony, @PhpCsFixer]

使用 new 关键字创建的所有实例必须后跟括号。

```php
$rules = [
  'new_with_braces'  => true
];
```

原始格式：

```php
class A
{
}

$a = new A;

```

格式化后：

```php
class A
{
}

$a = new A();

```

### no_alias_functions [@Symfony:risky, @PhpCsFixer:risky]

Master functions shall be used instead of aliases.

Risky rule: risky when any of the alias functions are overridden.

Configuration options:

sets (a subset of ['@internal', '@IMAP', '@mbreg', '@all']): list of sets to fix. Defined sets are @internal (native functions), @IMAP (IMAP functions), @mbreg (from ext-mbstring) @all (all listed sets); defaults to ['@internal', '@IMAP']

### no_alternative_syntax [@PhpCsFixer]

一般是结合在 html 页面写 php 的时候才用到 (alternative_syntax)[https://www.php.net/manual/zh/control-structures.alternative-syntax.php]

### no_binary_string [@PhpCsFixer]

There should not be a binary flag before strings.

### no_blank_lines_after_class_opening [@Symfony, @PhpCsFixer]

class 开标签后面不应该有空

```php
$rules = [
  'no_blank_lines_after_class_opening'  => true
];
```

原始格式：

```php
class A
{

  private $d;
}

```

格式化后：

```php
class A
{
  private $d;
}

```

### no_blank_lines_after_phpdoc [@Symfony, @PhpCsFixer]

phpdoc 后面不应该有空行

```php
$rules = [
  'no_blank_lines_after_phpdoc'  => true
];
```

```php
/**
 * A class
 */

class A
{

  private $d;
}

```

格式化后：

```php
/**
 * A class
 */
class A
{

  private $d;
}

```

### no_blank_lines_before_namespace

命名空间之前不应该有空行

```php
$rules = [
  'no_blank_lines_before_namespace'  => true
];
```

```php
<?php

namespace caiwenhui

class A
{
  private $d;
}

```

格式化后：

```php
<?php
namespace caiwenhui

class A
{
  private $d;
}

```

### no_break_comment [@PSR2, @Symfony, @PhpCsFixer]

There must be a comment when fall-through is intentional in a non-empty case body.

Configuration options:

comment_text (string): the text to use in the added comment and to detect it; defaults to 'no break'

### no_closing_tag [@PSR2, @Symfony, @PhpCsFixer]

`?>` 关闭标签必须在 PHP 文件中去掉

### no_empty_comment [@Symfony, @PhpCsFixer]

不应该存在空注释

### no_empty_phpdoc [@Symfony, @PhpCsFixer]

不应该存在空的 phpdoc

### no_empty_statement [@Symfony, @PhpCsFixer]

不应该存在空的结构体

### no_extra_blank_lines [@Symfony, @PhpCsFixer]

移除额外的空行，在['break', 'case', 'continue', 'curly_brace_block', 'default', 'extra', 'parenthesis_brace_block', 'return', 'square_brace_block', 'switch', 'throw', 'use', 'useTrait', 'use_trait'中

```php
$rules = [
  'no_extra_blank_lines'  => [
    'tokens' => [
      'return'
    ]
  ]
];
```

可选配置项

- tokens （数组）
  - break
  - case
  - continue
  - curly_brace_block
  - default
  - extra ( 默认)
  - parenthesis_brace_block
  - return
  - square_brace_block
  - switch
  - throw
  - use
  - useTrait
  - use_trait

可选配置项默认值：['extra']

原始格式：

```php
function a()
{
    echo 1;

    return 1;




}

```

格式化后：

```php
function a()
{
    echo 1;

    return 1;
}

```

### no_homoglyph_names [@Symfony:risky, @PhpCsFixer:risky]

Replace accidental usage of homoglyphs (non ascii characters) in names.

Risky rule: renames classes and cannot rename the files. You might have string references to renamed code (`$$name`).

### no_leading_import_slash [@Symfony, @PhpCsFixer]

在 use 语句中，取消前置斜杠

```php
$rules = [
  'no_leading_import_slash' => true
];
```

原始格式：

```php
use \A;

```

格式化后：

```php
use A;

```

### no_leading_namespace_whitespace [@Symfony, @PhpCsFixer]

在声明命令空间的时候，不允许有前置空格

```php
$rules = [
  'no_leading_namespace_whitespace' => true
];
```

原始格式：

```php
    namespace A;

```

格式化后：

```php
namespace A;

```

### no_mixed_echo_print [@Symfony, @PhpCsFixer]

不允许混合使用`echo`和`print`语句

可选配置项

- use
  - echo (默认)
  - print

```php
$rules = [
  'no_mixed_echo_print' => [
    'use' => 'echo'
  ]
];
```

原始格式：

```php
echo 1;
print 1;

```

格式化后：

```php
echo 1;
echo 1;

```

### no_multiline_whitespace_around_double_arrow [@Symfony, @PhpCsFixer]

运算符 `=>` 不应被多行空格包围。

```php
$rules = [
  'no_multiline_whitespace_around_double_arrow' => true
];
```

原始格式：

```php
$a = [
    1 =>


        '33',
];
```

格式化后：

```php
$a = [
    1 => '33',
];
```

### no_null_property_initialization [@PhpCsFixer]

属性不能用显式初始化 null

```php
$rules = [
  'no_null_property_initialization' => true
];
```

原始格式：

```php
class A
{
  private $dd = null;
}

```

格式化后：

```php
class A
{
  private $dd;
}

```

### no_php4_constructor

Convert PHP4-style constructors to \_\_construct.

Risky rule: risky when old style constructor being fixed is overridden or overrides parent one.

### no_short_bool_cast [@Symfony, @PhpCsFixer]

Short cast bool using double exclamation mark should not be used.

### no_short_echo_tag [@PhpCsFixer]

用 `<?php echo` 来代替 `<?=`

### no_singleline_whitespace_before_semicolons [@Symfony, @PhpCsFixer]

禁止在关闭分号前使用单行空格。

### no_spaces_after_function_name [@PSR2，@Symfony，@PhpCsFixer]

在函数或者方法定义的时候，不允许函数和左括号之间有空格

```php
$rules = [
  'no_spaces_after_function_name' => true
];
```

原始格式：

```php
function a ()
{

}

```

格式化后：

```php
function a()
{

}

```

### no_spaces_around_offset [@Symfony, @PhpCsFixer]

There MUST NOT be spaces around offset braces.

Configuration options:

positions (a subset of ['inside', 'outside']): whether spacing should be fixed inside and/or outside the offset braces; defaults to ['inside', 'outside']

### no_spaces_inside_parenthesis [@PSR2, @Symfony, @PhpCsFixer]

在左括号后面不能有空格。在右括号之前不能有空格。

### no_superfluous_elseif [@PhpCsFixer]

Replaces superfluous elseif with if.

### no_superfluous_phpdoc_tags

删除没有提供有效信息的@param 和@return 注解

 可选配置项

- allow_mixed （是否允许 mixed 注解存在）
  - true
  - false （默认）

```php
$rules = [
  'no_superfluous_phpdoc_tags' => [
    'allow_mixed' => false
  ]
];
```

原始格式：

```php
/**
 * @param $c
 */
function a($b)
{
}

```

格式化后：

```php
/**
 */
function a($b)
{
}

```

### no_trailing_comma_in_list_call [@Symfony，@ PhpCsFixer]

Remove trailing commas in list function calls.

### no_trailing_comma_in_singleline_array [@Symfony, @PhpCsFixer]

PHP 单行数组不应该有逗号。

```php
$rules = [
  'no_trailing_comma_in_singleline_array' => true
];
```

原始格式：

```php
$array = [1,2,];

```

格式化后：

```php
$array = [1,2];

```

### no_trailing_whitespace [@PSR2，@Symfony，@PhpCsFixer]

删除非空行末尾的尾随空格。

> 意思如描述

### no_trailing_whitespace_in_comment [@PSR2，@Soundfony，@PhpCsFixer]

注释或 PHPDoc 中必须没有尾随空格。

> 意思如描述

### no_unneeded_control_parentheses [@Symfony，@PhpCsFixer]

删除控制语句周围不需要的括号。

可选配置项

- statements （数组）
  - break
  - clone
  - continue
  - echo_print
  - return
  - switch_case
  - yield

可选配置项默认值：['break', 'clone', 'continue', 'echo_print', 'return', 'switch_case', 'yield']

```php
$rules = [
  'no_unneeded_curly_braces' => [
    'statements' => ['break', 'clone', 'continue', 'echo_print', 'return', 'switch_case', 'yield']
  ]
];
```

原始格式：

```php
function a()
{
    return(1);
}

```

格式化后：

```php
function a()
{
    return 1;
}

```

### no_unneeded_curly_braces [@Symfony，@PhpCsFixer]

删除不需要的花括号，这些花括号是多余的，不属于控制结构的主体。

```php
$rules = [
  'no_unneeded_curly_braces' => true
];
```

```php
<?php
{
    echo 1;
}

```

格式化后：

```php
<?php

    echo 1;


```

### no_unneeded_final_method [@Symfony，@PhpCsFixer]

终态类一定不能有终态方法

```php
$rules = [
  'no_unneeded_final_method' => true
];
```

```php
final class A
{
    final public function echoA()
    {
    }
}

```

格式化后：

```php
final class A
{
    public function echoA()
    {
    }
}

```

### no_unreachable_default_argument_value [@PhpCsFixer:risky]

In function arguments there must not be arguments with default values before non-default ones.

Risky rule: modifies the signature of functions; therefore risky when using systems (such as some Symfony components) that rely on those (for example through reflection).

### no_unset_cast [@PhpCsFixer]

必须设置变量 null 而不是使用(unset)强制转换。

```php
$rules = [
  'no_unset_cast' => true
];
```

```php
$a = (unset)$b;

```

格式化后：

```php
$a = null;

```

### no_unset_on_property [@PhpCsFixer:risky]

Properties should be set to null instead of using unset.

Risky rule: changing variables to `null` instead of unsetting them will mean they still show up when looping over class variables.

### no_unused_imports [@Symfony, @PhpCsFixer]

引入 use 后但是没有用到的类要删除

> 如描述

### no_useless_else [@PhpCsFixer]

不需要没有用的 else 分支

```php
$rules = [
  'no_useless_else' => true
];
```

```php
function a($a, $b)
{
    if ($a) {
        return $a;
    } else {
        return $b;
    }
}

```

格式化后：

```php
function a($a, $b)
{
    if ($a) {
        return $a;
    }

    return $b;
}

```

### no_whitespace_before_comma_in_array [@Symfony，@PhpCsFixer]

在数组声明中，每个逗号前不得有空格。

可选配置项

- after_heredoc （是否应删除 heredoc end 和逗号之间的空格）
  - true
  - false （默认）

```php
$rules = [
  'no_whitespace_before_comma_in_array' => true
];
```

```php
$a = [1 , 2 , 3];

```

格式化后：

```php
$a = [1, 2, 3];

```

### no_whitespace_in_blank_line [@Symfony，@PhpCsFixer]

删除空行中的空格

> 如描述

### non_printable_character [@Symfony:risky, @PhpCsFixer:risky, @PHP70Migration:risky, @PHP71Migration:risky]

Remove Zero-width space (ZWSP), Non-breaking space (NBSP) and other invisible unicode symbols.

Risky rule: risky when strings contain intended invisible characters.

Configuration options:

use_escape_sequences_in_strings (bool): whether characters should be replaced with escape sequences in strings; defaults to false

### normalize_index_brace [@Symfony, @PhpCsFixer]

Array index should always be written by using square braces.

### not_operator_with_space

逻辑 NOT 运算符（!）应该具有前导和尾随空格。

> 如描述

### not_operator_with_successor_space

逻辑 NOT 运算符（!）应该有一个尾随空格。

> 如描述

### phpdoc_align [@Symfony，@PhpCsFixer]

给定 phpdoc 标签的所有项目必须左对齐或（默认情况下）垂直对齐。

配置选项：

align（'left'，'vertical'）：对齐评论; 默认为'vertical'
tags（子集['param', 'property', 'return', 'throws', 'type', 'var', 'method']）：应该对齐的标签; 默认为 ['param', 'return', 'throws', 'type', 'var'

### phpdoc_annotation_without_dot [@Symfony，@PhpCsFixer]

PHPDoc 注释描述不应该是一个句子。

### phpdoc_indent [@Symfony，@PhpCsFixer]

Docblock 应与文档主题具有相同的缩进。

### phpdoc_inline_tag [@Symfony，@PhpCsFixer]

修复 PHPDoc 内联标记，使@inheritdoc 内联始终。

### phpdoc_no_empty_return [@Symfony，@ PhpCsFixer]

@return void 和@return null 注释应该 PHPDoc 的被省略。

### phpdoc_no_package [@Symfony，@ PhpCsFixer]

@package 和@subpackage 注释应该 PHPDoc 的被省略。

### phpdoc_order [@PhpCsFixer]

应该对 PHPDoc 中的@param 注释进行排序，以便首先@throws 注释，然后是@return 注释，然后是注释。

### phpdoc_return_self_reference [@Symfony，@ PhpCsFixer]

@return 返回对自身的引用的方法的注释类型必须是已配置的注释。

配置选项：

replacements（array）：替换的返回类型与新的返回类型之间的映射; 默认为['this' => '$this', '@this' => '$this', '$self' => 'self', '@self' => 'self', '$static' => 'static', '@static' => 'static']

### phpdoc_scalar [@Symfony，@PhpCsFixer]

标量类型应始终以相同的形式编写。int 不 integer，bool 不 boolean，float 不是 real 或 double。

配置选项：

types（子集['boolean', 'callback', 'double', 'integer', 'real', 'str']）：要修复的类型的映射; 默认为['boolean', 'double', 'integer', 'real', 'str']

### phpdoc_separation [@Symfony，@ PhpCsFixer]

PHPDoc 中的注释应该组合在一起，以便相同类型的注释紧跟在一起，并且不同类型的注释由单个空行分隔。

### phpdoc_single_line_var_spacing [@Symfony，@ PhpCsFixer]

单行@varPHPDoc 应该有适当的间距。

### phpdoc_summary [@Symfony，@ PhpCsFixer]

PHPDoc 摘要应以句号，感叹号或问号结尾。

### phpdoc_to_comment [@Symfony，@ PhpCsFixer]

Docblock 只应用于结构元素。

### phpdoc_trim [@Symfony，@ PhpCsFixer]

PHPDoc 应该以内容开头和结尾，不包括 docblock 的第一行和最后一行。

### phpdoc_trim_consecutive_blank_line_separation [@PhpCsFixer]

在摘要之后和 PHPDoc 中的描述之后删除额外的空白行。

### phpdoc_var_annotation_correct_order [@PhpCsFixer]

@var 和@type 注释必须具有正确顺序的类型和名称。

### phpdoc_var_without_name [@Symfony，@ PhpCsFixer]

@var 和@type 注释不应包含变量名称。

### protected_to_private [@Symfony，@ PhpCsFixer]

尽可能将 protected 变量和方法转换 private。

### single_blank_line_at_eof [@ PSR2，@ Soundfony，@ PhpCsFixer]

没有结束标记的 PHP 文件必须始终以单个空行换头结束。

### single_import_per_statement [@ PSR2，@ Symfony，@ PhpCsFixer]

每个声明必须有一个 use 关键字。(针对 PHP7 可以多个 use)

### single_line_after_imports [@ PSR2，@ Symfony，@ PhpCsFixer]

每个命名空间使用必须在它自己的行上，并且在 use 语句块之后必须有一个空行。

### single_line_comment_style [@Symfony，@PhpCsFixer]

只有一行实际内容的单行注释和多行注释应使用//语法。

配置选项：

comment_types（子集['asterisk', 'hash']）：要修复的注释类型列表; 默认为['asterisk', 'hash']

### space_after_semicolon [@Symfony，@PhpCsFixer]

分号后修复空格

可选配置项

- remove_in_empty_for_expressions （是否应删除空 for 表达式的空格）
  - true
  - false (默认)

```php
$rules = [
  'space_after_semicolon' => [
    'remove_in_empty_for_expressions' => true
  ]
];
```

原始格式：

```php
for ($i = 0;      $i < 10;      $i++) {
    echo $i;
}

```

格式化后：

```php
for ($i = 0; $i < 10; $i++) {
    echo $i;
}

```

### standardize_increment [@Symfony，@PhpCsFixer]

如果可能，应使用递增和递减运算符。

```php
$rules = [
  'standardize_increment' => true
];
```

原始格式：

```php
$a = 0;
$a += 1;
$a -= 1;

```

格式化后：

```php
$a = 0;
++$a;
--$a;

```

### switch_case_semicolon_to_colon [@PSR2，@Symfony，@PhpCsFixer]

case 之后应该是冒号而不是分号。

```php
$rules = [
  'switch_case_semicolon_to_colon' => true
];
```

原始格式：

```php
$type = 1;
switch ($type) {
    case 1;
        echo 2;

        break;
    default;
        echo 1;
}

```

格式化后：

```php
$type = 1;
switch ($type) {
    case 1:
        echo 2;

        break;
    default:
        echo 1;
}

```

### switch_case_space [@PSR2，@Symfony，@PhpCsFixer]

删除 case 冒号和大小写值之间的额外空格。

```php
$rules = [
  'switch_case_space' => true
];
```

原始格式：

```php
$type = 1;
switch ($type) {
    case 1           :
        echo 2;

        break;
    default             :
        echo 1;
}

```

格式化后：

```php
$type = 1;
switch ($type) {
    case 1:
        echo 2;

        break;
    default:
        echo 1;
}

```

### ternary_operator_spaces [@Symfony, @PhpCsFixer]

三元操作符周围有标准空格

```php
$rules = [
  'ternary_operator_spaces' => true
];
```

原始格式：

```php
$a = empty($e)?true:false;

```

格式化后：

```php
$a = empty($e) ? true : false;

```

### ternary_to_null_coalescing [@PHP70Migration, @PHP71Migration, @PHP73Migration]

Use null coalescing operator ?? where possible. Requires PHP >= 7.0.

### trailing_comma_in_multiline_array [@Symfony，@PhpCsFixer]

PHP 多行数组应该有一个尾随逗号。

配置选项：

after_heredoc（bool）：是否也应该在 heredoc 结束后放置一个尾随逗号; 默认为 false

### trim_array_spaces [@Symfony，@ PhpCsFixer]

数组应该像函数/方法参数一样格式化，不带前导或尾随单行空格。

### unary_operator_spaces [@Symfony，@ PhpCsFixer]

一元运算符应放在其操作数旁边。

### whitespace_after_comma_in_array [@Symfony，@ PhpCsFixer]

在数组声明中，每个逗号后必须有一个空格。

## 总结

以上均为 php-cs-fixer 的配置详，有一些风险的配置，我们不提倡使用，所以并没有翻译，而且一些没有给出例子。情况有 2 种，一种是：暂时不了解具体用法。一种是字面意思可懂。

每个配置项后面的中括号中的`@xxx`的写法代表这个配置在什么 tag 中生效，具体相关的可以查看 php-cs-fixer 的官网文档。
