---
title: 【nginx】- 常用配置例子
date: 2018-02-23 10:53:30
categories: [Nginx]
tags: [Nginx]
---

# 说明

以下整理一下一些 nginx 常用例子。

## 例子

- 目录对换

```
/123456/xxxx -> /xxxx?id=123456

rewrite ^/(\d+)/(.+)/ /$2?id=$1 last;
```

- 例如下面设定 nginx 在用户使用 ie 的使用重定向到/nginx-ie 目录下：

```
if ($http_user_agent ~ MSIE) {
  rewrite ^(.*)$ /nginx-ie/$1 break;
}
```

<!-- more -->

- 目录自动加“/”

```
if (-d $request_filename){
    rewrite ^/(.*)([^/])$ http://$host/$1$2/ permanent;
    }
```

- 禁止 htaccess

```
location ~/\.ht {
    deny all;
}
```

- 禁止多个目录

```
location ~ ^/(cron|templates)/ {
    deny all;
    break;
}
```

- 只充许固定 ip 访问网站，并加上密码

```
root  /opt/htdocs/www;
allow   208.97.167.194;
allow   222.33.1.2;
allow   231.152.49.4;
deny    all;
auth_basic “C1G_ADMIN”;
auth_basic_user_file htpasswd;
```

- 文件和目录不存在的时候重定向：

```
if (!-e $request_filename) {
    proxy_pass http://127.0.0.1;
}
```

多域名转向

```
server_name  www.test.com/  www.test2.com/;
index index.html index.htm index.php;
root  /opt/ccinn/;
if ($host ~ “test3\.cn”) {
    rewrite ^(.*) http://www.test.com$1/ permanent;
}
```
