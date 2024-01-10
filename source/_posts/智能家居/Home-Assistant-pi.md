---
title: 树莓派4b Home Assistant
date: 2024-01-05 00:00:19
categories: [智能家居, 树莓派]
tags: [智能家居, Home Assistant, HA]
---

## 前言

前面做了几期关于`Home assistant`的教程，在前面我是完全使用docker手动部署，并且采用基本都是通过安装`home-assistant-core`去处理。后面我发现很多东西的使用方式都特别别扭，而且确实很多东西都比较麻烦，所以后面再反过来看，发现了一个叫`hass`的生态，这个其实就是`home-assistant`的周边生态，而这些周边，几乎都是必备的，于是我妥协了使用了`hass`的生态，但是有一点不同的是，我这里并没有使用`hassOS`，而是采用`hassIO`，也就是`home-assistant-supervisor`。

![ha-install-compare.jpg](/images/智能家居/ha-install-compare.jpg)

下面开始，我就会我的正式体现记录我后面的智能家居做法。

<!-- more -->

## 硬件

- 树莓派4b+一个（我在写这篇文章的时候，已经出了树莓派5，但是由于ha还没公布稳定支持树莓派5，所以我还是购入了4b+，后面稳定后再替换）

## 效果展示

![pi-ha-docker](/images/智能家居/pi-ha-docker.jpg)

## Home Assistant Supervisor 安装

### 切换为root用户

`ccinn@raspberrypi:~ $ sudo su -`

```shell
sudo apt update -y
sudo apt upgrade -y
```

查看树莓派版本

```shell
➜  ~ lsb_release -a
No LSB modules are available.
Distributor ID:	Debian
Description:	Debian GNU/Linux 12 (bookworm)
Release:	12
Codename:	bookworm
```

如果要完整支持`Home Assistant Supervised`，最好根据 ![Home Assistant Supervised官方支持系统说明查](https://www.home-assistant.io/more-info/unsupported/os) 看本地的系统是否满足

![ha-install-condition](/images/智能家居/ha-install-condition.jpg)

可以看到，截止到文章发布，官方文档说明是需要Debian12，我的树莓派系统是满足的。

### NetworkManager

HomeAssistantSupervised需要NetworkManager的支持，树莓派官方使用的是ModemManager、openresolv和dhcpcd5。

原本的配置可以不动，但是需要固定Mac地址并禁用ModemManger。

因为NetworkManager一旦安装就会开始工作。所以我们先创建一个NetworkManager的配置文件来固定Mac地址，防止我们后续操作重启时候，树莓派的Mac地址频繁变更。

#### 固定Mac地址

预编写NetworkManager的配置：

```bash
# 创建配置目录和文件
sudo mkdir -p /etc/NetworkManager/conf.d/
# 对文件追加内容
sudo vim /etc/NetworkManager/conf.d/100-disable-wifi-mac-randomization.conf
```

追加的内容：

```bash
[connection]
wifi.mac-address-randomization=1

[device]
wifi.scan-rand-mac-address=no
```

![ha-network-manager](/images/智能家居/ha-network-manager.jpg)

之后就可以安装network-manager了。

> 安装完Network-Manager后，网络可能会出现短暂的丢包。这个时候多等一下就好，并且在完成ModemManager的禁用前，请勿重启树莓派系统！！！

安装：

```bash
sudo apt install -y network-manager
```

### 禁用ModemManager

有些教程会让你卸载`dhcpcd5`，但是这样重启后需要重新配置网络，并且不能用树莓派的方法配置，这让我这没有显示器的用户很苦恼……所以这里我们就不卸载`dhcpcd5`，直接禁用`ModemManager`即可。

```bash
# 停止ModemManager
sudo systemctl stop ModemManager
# 禁止ModemManager开机自启
sudo systemctl disable ModemManager
```

![ha-modem-manager](/images/智能家居/ha-modem-manager.jpg)

到此，NetworkManager部分就准备好了。

### Apparmor

```shell
sudo apt install -y apparmor-utils jq software-properties-common apt-transport-https avahi-daemon ca-certificates curl dbus socat
```

但是需要注意，需要把Apparmor的启动配置参数加到树莓派的启动参数内（参考自：https://github.com/Kanga-Who/home-assistant/issues/25）：

```bash
# 使用vim打开/boot/cmdline.txt
sudo vim /boot/cmdline.txt
```

末尾添加：`apparmor=1 security=apparmor`

### OS-Agent

还需要安装OS Agent。这个并没有在Debian的软件源内，所以我们需要使用`dpkg安装`。最新OS Agent的下载地址：https://github.com/home-assistant/os-agent/releases/latest

> 记得找最新的aarch版

```bash
# 下载OS Agent 1.2.2
wget https://github.com/home-assistant/os-agent/releases/download/1.2.2/os-agent_1.2.2_linux_aarch64.deb
# 使用dpkg安装
sudo dpkg -i os-agent_1.2.2_linux_aarch64.deb
```

### 其他依赖

```bash
sudo apt-get install \
vim \
jq \
wget \
curl \
udisks2 \
libglib2.0-bin \
dbus -y
```

在2022.11.27后Homeassistant正式需要`Systemd Journal`的支持；我们同样可以使用软件包管理器进行安装：

```bash
sudo apt install systemd-journal-remote -y
```

### Docker

```bash
# 下载Docker安装脚本
sudo curl -fsSL https://get.docker.com -o get-docker.sh
# 使用阿里镜像源下载并安装Docker
sudo sh get-docker.sh --mirror Aliyun
```

把我们自带的`ccinn用户`添加到`docker用户组`内：

> 这个用户根据自己的实际用户来
> 有的人默认就是pi用户

```bash
sudo usermod -aG docker ccinn
```

### 重启设备

上诉操作，我们已经`重新配置了网络`、`安装了依赖`和`添加了启动参数`，所以在正式安装`Home Assisistant Supervised`前，我们需要重启设备。

### Supervised

现在开始安装`Home Assisistant Supervised`啦。

```shell
# 下载deb安装包
wget https://github.com/home-assistant/supervised-installer/releases/latest/download/homeassistant-supervised.deb
# 安装
sudo dpkg -i homeassistant-supervised.deb
```

之后，没有问题就会出现选项卡，我们选择树莓派4B：

![ha-install](/images/智能家居/ha-install.jpg)

安装过程……根据自己的网络，这一步可能会卡很久，如果还是不行，记得科学一下再重新安装。

## 成果

使用docker命令，查看`Supervised`的容器状态（如果并没有Homeassistant容器；那么等10min～20min再试试，期间保持树莓派运行，Homeassistant会组建初始化完成）：

![ha-docker-ps](/images/智能家居/ha-docker-ps.jpg)

进入`IP:4357`，可以查看`Supervised`的状态：

![ha-health](/images/智能家居/ha-health.jpg)

等待5分钟左右（Home Assisistant Supervised第一次启动比较慢），就可以通过`IP:8123`在浏览器访问了

![ha-ok](/images/智能家居/ha-ok.jpg)

至此ha的安装就ok了，接下来会继续一些辅助性的东西。

## 安装zsh

```bash
apt install zsh
sh -c "$(curl -fsSL https://gitee.com/shmhlsy/oh-my-zsh-install.sh/raw/master/install.sh)"
```

```bash
vim ~/.zshrc

# 在最后一行加入
export PROMPT='%n@%m:%F{13}%~ %F{50}%B%# %f%b'
```

如果想要复制ha容器中的配置出来，可以使用

```bash
docker cp $(docker ps | grep -v NAMES | grep homeassistant | awk '{print $1}'):/config /home/ccinn/.homeassistant/
```

这样子，`/home/ccinn/.homeassistant` 目录就是当前的了。

如果我们想要找到hassio中的ha容器挂载的目录是那里的话，可以用以下命令

```bash
cat /var/lib/docker/containers/$(docker inspect homeassistant | jq -r '.[] | .Id')/config.v2.json | jq '.MountPoints."/config"'

# 下面为标准的路径
{
  "Source": "/usr/share/hassio/homeassistant",
  "Destination": "/config",
  "RW": true,
  "Name": "",
  "Driver": "",
  "Type": "bind",
  "Propagation": "rprivate",
  "Spec": {
    "Type": "bind",
    "Source": "/usr/share/hassio/homeassistant",
    "Target": "/config"
  },
  "SkipMountpointCreation": true
}
```

可以看到，容器和宿主机的目录地址是`/usr/share/hassio/homeassistant`

所以，当我们需要手动安装插件，修改配置等等，直接操作这个目录即可。

## 安装 Samba

我们知道，树莓派是一个小型主机，我们日常使用，肯定有我们自己的主机。我们可以通过Samba服务来进行文件的二次管理。把文件备份到我们的日常使用的主机上，或者直接在我们日常使用的主机上进行操作文件配置。

```bash
sudo apt-get install samba samba-common-bin
```

修改配置文件

```bash
sudo vim /etc/samba/smb.conf

# 在文件底部添加
[pi]
path = /home/ccinn/.homeassistant
writeable=Yes 
create mask=0777 
directory mask=0777 
public=no 
```

> 因为我上面用的路径和宿主机下的路径不一致，所以需要做个软连接 `ln -s /usr/share/hassio/homeassistant /home/ccinn/.homeassistant`, 这样子就能实现，samba和树莓派和ha容器的文件实时同步了。

保存文件后，添加samba用户

```bash
sudo smbpasswd -a ccinn
```

> 注意：使用 sudo smbpasswd -a 命令创建用户时，创建的用户必须为 Linux 系统账户，如我这里的ccinn

输入自己的samba用户的密码，比如 `a123456`

重启服务让其生效

```bash
sudo systemctl restart smbd
```

Samba 安装完成后，树莓派的 Hass 开发环境搭建完毕。

## 通过 Samba 访问 Home Assistant 文件夹

因为我的是macOS,所以这里用mac为例子。

在电脑桌面上打开 `访达。`

选择桌面左上角菜单中的 `前往 > 连接服务器`。

在弹出的窗口中，输入以下地址后单击 `连接`。

```bash
smb://192.168.8.189/pi
```

![ha-sambd](/images/智能家居/ha-sambd.jpg)

## 安装hacs

在树莓派中执行如下命令。

```bash 
wget -U - nttps://get.nacs.xyz | bash -
```

![ha-hacs](/images/智能家居/ha-hacs.jpg)

可以看到，hacs会自动找到对应的目录进行安装。

![ha-hacs-1](/images/智能家居/ha-hacs-1.jpg)

然后外面通过samba，也可以看到在`custom_components`中多了个hacs的`自定义组件`。
