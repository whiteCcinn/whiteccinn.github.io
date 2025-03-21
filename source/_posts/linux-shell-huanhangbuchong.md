---
title: 【工具】oh-my-zsh 换行补偿
date: 2018-11-15 12:06:01
categories: [Linux]
tags: [Linux, Shell]
---

# oh-my-zsh 换行补偿

大家应该也是经常会用到 linux 或者 macOS，大家应该都有了解 macos 必备软件之间，oh-my-zsh，它可以为我们的终端提供丰富的主题，当然，这里就不详细介绍了。现在主要说一下其中一个问题就是，oh-my-zsh 的 `换行补偿机制`。

一般情况下，我们在终端有时候会发现会存在 `%`，例如：

> root 账号的时候是 # 号
> 非 root 账号是 % 号

<!-- more-->

后面会多一个百分号，显得是否不舒服，但是这个恰巧就是 zsh 的换行补偿机制。意义在于，当我们输出的字符串忘记在终端显示换行符号 `\n` 的时候，他就会自动在输出到标准输出之前添加一个百分号来告诉我们，你的输出忘记换行了，我帮你换行了，用的是 `%` 符号。

看似挺友好，但是实在是不习惯。所以，我们现在的目的是要屏蔽。

需要用的是环境变量 `PROMPT_EOL_MARK`

我们只需要在 shell 中设置

```
PROMPT_EOL_MARK=''
```

那么它的换行补偿机制的替换符号就会是为空，那就是不存在了。

这个环境变量加在哪里？加在`~/.zshrc` 里面也可以，或者你不想永久生效的话，就直接在终端输入就可以了。

友情提示：记得不要忘记 source 一下配置哦～
