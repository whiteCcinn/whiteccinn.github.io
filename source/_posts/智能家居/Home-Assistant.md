---
title: Home Assistant （一）
date: 2023-07-30 00:00:19
categories: [智能家居]
tags: [智能家居, Home Assistant, HA]
---

## 前言

既然是技术博客，那么这一期，我会开始做一系列的关于智能家居的玩法。

`Home Assistant` 也叫 `HA` + `Zigbee协议`(硬件之间的通信协议)

`HACS` 是 `HA` 的一个第三方插件，这个插件包括了许多开发者所贡献的插件，如果你是一名开发人员，那么你一定了解什么叫`依赖库`。所以可以理解为 `HACS` 就是 `HA` 的第三方插件依赖库，你可以在连找到需要对你有用的插件，而你不必重新开发。

为什么选择 `Zigbee协议` ？ 在对比过`蓝牙mesh`,`wifi协议`之后，我最终选择了`zigbee协议`，在于硬件之间的控制信号量传输本身就少，所以它自身的稳定性和分布式的特点，可以很好的支持到家庭中的各个角落，不会出现由于信号差导致失灵的情况，并且`zigbee协议`的特点，电量的消耗也是十分的低。

<!-- more -->

## 硬件

由于我现在没有`树莓派`或者`nas`等`本地服务器`，所以我以我的`macbook pro`来例。但是实际情况下的智能家居，我们需要有一台连接在本地局域网的服务，它需要要求的特点包括如下：

- 低功耗
- 便携，不占用家庭空间
- 支持更多的其他功能，例如用于`nas`，`time machine`, `软路由(科学上学)` 等等（非必要，但是可以做在一起，所以机器的性能越出色越好）


由于是测试用的，所以我只买了2个 `涂鸦` 品牌的 `e27` 的`智能灯泡` 和 `zigbee2mqtt` 的 `zigbee协议信号网关`

** 需要去淘宝买 **

- `zigbee信号网关`
- `2个智能灯泡`

### zigbee信号网关

![y-5](/images/智能家居/y5.jpg)

![y-6](/images/智能家居/y6.jpg)

### 支持zigbee协议的智能灯泡

![y-1](/images/智能家居/y-1.jpg)

![y-2](/images/智能家居/y2.jpg)

![y-3](/images/智能家居/y3.jpg)

![y-4](/images/智能家居/y4.jpg)

## Home Assistant 安装

由于目前我在尝试阶段，并且是`macbook`，并且我更倾向于用`docker安装`各种服务，在容器化的时代，物理环境的隔离是十分重要的一个环节。

### docker 安装

> 这里不介绍docker怎么安装了，如果是完全没编程的基础知识的话，折腾起来确实有点麻烦


创建数据存储目录，`mkdir -p ~/ha;cd ~/ha`，然后执行如下 docker命令 进行安装

```shell
docker run -d \
  --name homeassistant \
  --privileged \
  -e TZ=Asia/Shanghai \
  -v $(PWD):/config \
  -p 8123:8123 \
  homeassistant/home-assistant
```

> 网上很多都说要用--net=host模式，但是其实没必要的，指定端口暴露就好
> ha的默认端口就是8123

`docker ps` 查看容器情况

```shell
CONTAINER ID   IMAGE                          COMMAND                  CREATED         STATUS        PORTS                                                                      NAMES
b2f9de1af25b   homeassistant/home-assistant   "/init"                  2 seconds ago   Up 1 second   0.0.0.0:8123->8123/tcp                                                     homeassistant
```

可以看到我们的容器启动了。并且正常运行了。如果你还不放心，可以看一下日志也可以 `docker log homeassistant`

```shell
s6-rc: info: service s6rc-oneshot-runner: starting
s6-rc: info: service s6rc-oneshot-runner successfully started
s6-rc: info: service fix-attrs: starting
s6-rc: info: service fix-attrs successfully started
s6-rc: info: service legacy-cont-init: starting
s6-rc: info: service legacy-cont-init successfully started
s6-rc: info: service legacy-services: starting
services-up: info: copying legacy longrun home-assistant (no readiness notification)
s6-rc: info: service legacy-services successfully started
```

打开浏览器，在浏览器中输入 `127.0.0.1:8123`，就会看到如下界面

![ha-1](/images/智能家居/ha-1.jpg)

接下来，我们创建好账号密码，切勿忘记`密码`，好记性不如烂笔头，记得记录下来

![ha-2](/images/智能家居/ha-2.jpg)

这里我们，不怎么需要理会，正常填写即可。

![ha-3](/images/智能家居/ha-3.jpg)

这里默认的都是关闭的，也推荐关闭。然后点击下一步。

![ha-4](/images/智能家居/ha-4.jpg)

这里其实就可以选择你要连接的品牌了，但是这里我先跳过，后面再设置。直接点击 `完成` 即可

![ha-5](/images/智能家居/ha-5.jpg)

ok，现在我们可以看到了，完成之后，进到 `HA系统` 了，可以看到，内置了一个谷歌的`TTS`的功能，可以不用理会（这个是谷歌推出的一个文本转语音的机器学习的功能）。


### HACS 安装

`Home Assistant Community Store` 为社区建设的`HomeAssistant商店`，可以安装`第三方集成`、`主题`、`表盘`以及`自动化`等。

GitHub 地址如下:

- https://github.com/hacs
- https://github.com/hacs/integration

![hacs1](/images/智能家居/hacs1.jpg)

安装之前，让我们先把资源目录整理好.

```shell
# 存放等会要安装的 HACS文件
mkdir -p ~/ha/custom_components/hacs
# 存放未来 HACS 安装的各种首页磁贴啥的（官方叫Lovelace ）
mkdir -p ~/ha/www
```

打开浏览器，输入`github` 的地址 `https://github.com/hacs/integration/releases` ，在这里下载最新的hacs的releases包。

![hacs2](/images/智能家居/hacs2.jpg)

这里看见，我当前看到的目前的版本是去到了 `1.32.1`，所以本篇文章将以 `1.32.1` 为例子.

![hacs3](/images/智能家居/hacs3.jpg)

下载这个 `zip` 的压缩包，然后解压到 `~/ha/custom_components/hacs` 目录

终端命令如下： `unzip ~/Downloads/hacs.zip -d ~/ha/custom_components/hacs`

![hacs4](/images/智能家居/hacs4.jpg)

解压后的情况如上图。


![hacs5](/images/智能家居/hacs5.jpg)

在这里点击`开发者工具页面`，然后点击`检测配置`。

![hacs6](/images/智能家居/hacs6.jpg)

![hacs7](/images/智能家居/hacs7.jpg)

接下来就可以看到`检测通过`，然后我们在同一个页面中找到`重启按钮`, 就可以`重启我们的HA系统`，让`插件加载生效`.

![hacs8](/images/智能家居/hacs8.jpg)

点击`重启按钮`之后，可以看到`系统正在重启，目前失去了连接`.

![hacs9](/images/智能家居/hacs9.jpg)

接着，我们手动刷新一下页面，用户登陆失效了，代表重启成功了，所以我们需要重新登陆到我们的`HA系统`，这个时候，需要输入我们记下来的`账号密码`


** 换另外一种 ** 方式去安装HACS也可以的，`直接在docker容器内部安装`，通过`hacs脚本`自动安装。

```shell
docker exec -it homeassistant bash -c 'wget -q -O - https://install.hacs.xyz | bash -'
```

![hacs10](/images/智能家居/hacs10.jpg)

可以看到，现在安装完毕了，我需要重启然后让插件加载成功。

![hacs11](/images/智能家居/hacs11.jpg)

接下来，我们点击 `配置` ，找到 `设备与服务` 项

![hacs12](/images/智能家居/hacs12.jpg)

点击 `添加集成`

![hacs13](/images/智能家居/hacs13.jpg)

搜索一下hacs，然后我们就能识别到的刚才安装的hacs了。

![hacs14](/images/智能家居/hacs14.jpg)

这里把`全部选中`，因为这个是第三方插件，所以`HA`需要确保你会排查问题。所以需要看你是否懂得这些，你只需要全选了即可.

![hacs15](/images/智能家居/hacs15.jpg)

这是设备注册。需要先拥有Github账号，没有的话注册一个并在浏览器上登录,`github.com`

![hacs16](/images/智能家居/hacs16.jpg)

然后打开上面的提供的连接: `https://github.com/login/device`, 输入提供的 `设备码`

![hacs17](/images/智能家居/hacs17.jpg)

点击 账号授权给 `hacs` 服务，即可。

![hacs18](/images/智能家居/hacs18.jpg)

回到 `HA系统`，会发现已经识别到了，所以完成安装了 `HACS` 。

![hacs19](/images/智能家居/hacs19.jpg)

## homeassistant App

HA官方提供了APP，iOS和Android都有，可自行下载~

```shell
ios: https://www.github.com/home-assistant/iOS
android: https://github.com/home-assistant/android
```

当然，也可以自行去各大应用商店下载，例如 `appstore`

温馨提示： App需要填入自己的HA地址，所以如果服务跑在家里的话，需要内网穿透或者公网才能在外面使用噢~ 

如果HA内网穿透，configuration.yaml需要加上下面内容，同时内网穿透服务器(如ngrok、frp等)的nginx需要开启websocket支持，否则会出现外网无法访问、能访问但是无法登录等问题。

HA配置文件`configuration.yaml`

```yaml
http:
  use_x_forwarded_for: True
  trusted_proxies:
    - 127.0.0.1/24
    - ::1/128
```

nginx配置参考(用frp内网穿透)

```shell
server {
     listen	  80;
     server_name  *.frp.yourdomain.cn frp.yourdomain.cn;
     location / {
             proxy_redirect off;
             proxy_set_header Host $http_host;
             proxy_set_header X-Real-IP $remote_addr;
             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
             # 下面两行提供websocket支持,homeassistant需要
             proxy_set_header Upgrade $http_upgrade;
             proxy_set_header Connection "upgrade";
             proxy_pass http://127.0.0.1:8123;
     }
}
```

最后附上同一个局域网下的访问效果图


![haapp1](/images/智能家居/haapp1.jpg)

![haapp2](/images/智能家居/haapp2.jpg)

![haapp3](/images/智能家居/haapp3.jpg)
