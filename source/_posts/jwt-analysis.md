---
title: 深度解剖JWT认证流程
date: 2017-01-17 10:40:00
categories: 协议
tags: [协议, JWT]
---

## 说明

> 说明简介

传统的 cookie-session 机制可以保证的接口安全，在没有通过认证的情况下会跳转至登入界面或者调用失败。

在如今 RESTful 化的 API 接口下，cookie-session 已经不能很好发挥其余热保护好你的 API 。

更多的形式下采用的基于 Token 的验证机制，JWT 本质的也是一种 Token，但是其中又有些许不同。

---

## 什么是 JWT

JWT 及时 JSON Web Token，它是基于 [RFC 7519][7519] 所定义的一种在各个系统中传递紧凑和自包含的 JSON 数据形式。

- **紧凑（Compact）** ：由于传送的数据小，JWT 可以通过 GET、POST 和 放在 HTTP 的 header 中，同时也是因为小也能传送的更快。
- **自包含（self-contained）** : Payload 中能够包含用户的信息，避免数据库的查询。

JSON Web Token 由三部分组成使用 `.` 分割开：

- header （头部）
- payload （载荷）
- Signature（签名）

<!-- more -->

一个完整的 JWT 为以下的形式：

`xxxxx.yyyy.zzzz`

Header 一般由两个部分组成

- alg
- tpy

alg 是所采用的加密 hash 算法（HS256，MD5 等），tpy 就是 token 的类型了，在这里就肯定是"JWT"。

```json
{
  "alg": "HS256",
  "tpy": "JWT"
}
```

在这个基础上，我们采用 Base64 加密的算法来加密第一部分 `header`

结果如下：

`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

那么，目前 JWT 的形式不完整形态就为：

`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<second part>.<third part>`

Payload 一般分了几个部分，它是整个 JWT 的核心信息，相当于 body，其中包含了许多种的声明（**claims**）。

- **（保留声明）reserved claims** ：预定义的 [一些声明][2]，并不是强制的但是推荐，它们包括 **iss** (issuer)，**exp** (expiration time)，**sub** (subject)，**aud**(audience) 等。
- **（公有声明）public claims** : 这个部分可以随便定义，但是要注意和 [IANA JSON Web Token][2] 冲突。

Payload 一般由以下部分组成

- issu （签发者）
- sub （面向对象）
- iat （签发时间）
- exp （过期时间）

```json
{
  "issu":"Baicai",
  "sub":"http://usblog.crazylaw.cn",
  "iat":1484618744
  "exp":1484618754 (注：10s后过期)
}
```

Signature

在创建该部分时候你应该已经有了 编码后的 Header 和 Payload 还需要一个一个秘钥，这个加密的算法应该 Header 中指定。

一个使用 HMAC SHA256 的例子如下:

```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  secret)
```

这个 `signature` 是用来验证发送者的 JWT 的同时也能确保在期间不被篡改。

所以，做后你的一个完整的 JWT 应该是如下形式：

```shell
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ
```

`注意被 . 分割开的三个部分`

JSON Web Token 的工作流程

在用户使用证书或者账号密码登入的时候一个 JSON Web Token 将会返回，同时可以把这个 JWT 存储在 local storage、或者 cookie 中，用来替代传统的在服务器端创建一个 session 返回一个 cookie。

![](http://usblog.crazylaw.cn/usr/uploads/2017/01/537119459.jpg)

当用户想要使用受保护的路由时候，应该要在请求得时候带上 JWT ，一般的是在 header 的 Authorization 使用 Bearer 的形式，一个包含的 JWT 的请求头的 Authorization 如下：

`Authorization: Bearer <token>`

这是一中无状态的认证机制，用户的状态从来不会存在服务端，在访问受保护的路由时候回校验 HTTP header 中 Authorization 的 JWT，同时 JWT 是会带上一些必要的信息，不需要多次的查询数据库。

这种无状态的操作可以充分的使用数据的 APIs，甚至是在下游服务上使用，这些 APIs 和哪服务器没有关系，因此，由于没有 cookie 的存在，所以在不存在跨域（CORS, Cross-Origin Resource Sharing）的问题。

---

#### 你们以为到这里就完了？其实还没有，还有 JWT 超时的问题以及传输的位置还没有讲。

JWT 一般你可以选择放在 `GET` 方法的 `query` 作为参数传递给服务器校验。你也可以选择 `POST` 方法的`body` 来传递该该参数，但是我们知道 GET、POST 方法都有自身的传递数据长度，我们要节约这些资源的话，我还是推荐放在头部。并且服务器端每次校验 jwt 的时候，可以设置一个 `leeway` ，我把它叫为迂回时间，这个时间的作用是在 jwt 超过了有效时间，但是可以刷新 jwt 而存在的，我们可以称之为 `刷新令牌时间`，只要在这个时间范围内，服务器端就会在响应性头设置新的 jwt 返回给客户端，客户端需要检测这个响应头是否存在这个属性来更新 jwt 的值，否则，如果 jwt 超过了这个 leeway，那么，你的 app 将需要重新登录来获取授权。

---

[7519]: https://tools.ietf.org/html/rfc7519 'RFC 7519'
[2]: http://www.iana.org/assignments/jwt/jwt.xhtml '预定义声明'
