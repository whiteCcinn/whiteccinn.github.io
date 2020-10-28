---
title: 设计模式の结构型の链式模式
date: 2017-06-22 11:36:00
categories: [设计模式]
tags: [设计模式, PHP]
---

## 一个常见的非正统的设计模式

fluent interface（流利接口）有一个更广为人知的名字『链式操作』，可能大多数人大概都是从 Jquery 最先熟悉的，在 laravel 中，ORM 的一系列 sql 操作，也是链式操作，特点是每次都返回一个 Query Builder 对象。

<!-- more -->

## 实例

```PHP
class Employee
{
  public $name;
  public $surName;
  public $salary;

  public function setName($name)
  {
    $this->name = $name;

    return $this;
  }

  public function setSurname($surname)
  {
    $this->surName = $surname;

    return $this;
  }

  public function setSalary($salary)
  {
    $this->salary = $salary;

    return $this;
  }

  public function __toString()
  {
    $employeeInfo = 'Name: ' . $this->name . PHP_EOL;
    $employeeInfo .= 'Surname: ' . $this->surName . PHP_EOL;
    $employeeInfo .= 'Salary: ' . $this->salary . PHP_EOL;

    return $employeeInfo;
  }
}

//链式操作的效果
$employee = (new Employee())
    ->setName('Tom')
    ->setSurname('Smith')
    ->setSalary('100');
echo $employee;
# 输出结果
# Name: Tom
# Surname: Smith
# Salary: 100
```

链式操作的关键在于，每次都返回本对象 `return $this`，使得没一次操作之后都是可以可调用方法的对象。
