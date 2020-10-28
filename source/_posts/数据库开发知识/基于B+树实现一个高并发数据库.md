---
title: 【数据库开发知识】基于B+树实现一个高并发数据库
date: 2019-12-05 17:43:43
categories: [数据结构, 数据库]
tags: [数据库开发知识]
---

# 开发笔记

```c

#define M (3) // B+树的阶数
#define LIMIT_M_2 (M >> 1) // M的中点
#define True (1)
#define False (0)
#define INDEX_NAME ("index") // 索引文件
#define SUCCESS (1)
#define ERROR (-1)
#define OPEN_MODE (O_RDWR | O_CREAT | O_TRUNC) // 打开文件的模式：可读可写打开 | 若此文件不存在则创建它 | 如果文件已存在，并且以只写或可读可写方式打开，则将其长度截断（Truncate）为0字节
#define FILE_MODE (S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH) // 文件的权限：660

typedef int KeyType; // 关键字的数据类型
typedef off_t Record; // 索引所对应的值

typedef struct BPTNode{
	int isLeaf;                // 是否是叶子节点
	int keynum;                // 关键字个数
	KeyType key[M + 1];        // 存放的关键字的连续内存
	struct BPTNode *ptr[M + 1];// 关键字子树的连续内存
	struct BPTNode *next;
	Record value[M + 1];       // 关键字对应的value，当节点为叶子节点的时候才有效
}BPTNode, *BPTree;
```

我们看到 `BPTNode` 是我们的节点结构体，这个结构体占用的内存大小我们计算一下：

记住内存对齐的原则，并且指针占用 8 个字节，off_t 一般是 64 位，占用 8 个字节

```
4(int)+4(int)+4(KeyType)*4(M+1)+4(*pts)*4(M+1)+4(*next)+8(Record)*4(M+1) = 4+4+16+32+8+32 = 96bytes
```

<!-- more -->

## 构建 B+树

```c
// 从索引文件中读取数据，创建b+树
extern BPTree CreatBPTree(BPTree T)
{
  int fd;
  int i = 0, ret = -1;
  unsigned long file_len = -1;
  struct stat statbuff;
  KeyType temp = 0;
  KeyType *q;
  Record t_record = 0;
  Record *p;

  q = &temp;
  p = &t_record;

  file_len = get_file_size(INDEX_NAME);

  if ((fd = open(INDEX_NAME, O_RDONLY)) == -1)
  {
    printf("Open index file failled!\n");
    return NULL;
  }

  while (i < file_len)
  {
    if ((ret = pread(fd, q, 4, i)) == -1)
    {
      close(fd);
      return NULL;
    }
    if ((ret = pread(fd, p, 4, i + 4)) == -1)
    {
      close(fd);
      return NULL;
    }
    T = Insert(T, *q, *p);
    i = i + 8;
  }
  close(fd);

  return T;
}
```

以只读的方式打开索引未见，用于构建 B+树。
