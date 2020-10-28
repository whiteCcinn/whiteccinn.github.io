---
title: C语言数据结构の单链表
date: 2017-01-24 17:27:20
categories: 数据结构
tags: [C, 数据结构, 单链表]
---

## 实现

```C
#include <stdio.h>
#include <stdlib.h> // 声明exit函数

/* 单节点的数据结构 16个字节 */
typedef struct Node
{
 int data;            //数据域
 struct Node * pNext; //指针域
}NODE,*PNODE;

//函数声明
PNODE createLinkList(void);        //创建链表的函数
void traverseLinkList(PNODE pHead);      //遍历链表的函数

/**
 *  主函数入口 main
 */
void main()
{
    PNODE pHead = NULL;
    pHead = createLinkList();
    traverseLinkList(pHead);
}

/**
 *  创建链表
 */
PNODE createLinkList(void)
{
    int length;
    int i;
    int value;

    // 申请内存空间,头结点
    PNODE phead = (PNODE)malloc(sizeof(NODE));
     if(NULL == phead)
     {
      printf("内存分配失败，程序退出！\n");
      exit(-1);
     }

    // 尾节点
    PNODE pend = phead; // pend始终指向尾节点
    pend->pNext = NULL; // 单链表尾节点指针域为NULL

    printf("请输入链表的长度,len =");
    scanf("%d",&length);

    // 创建链表长度
    for(i= 0;i< length;i++){
        printf("请输入第%d个节点的值 :",i);
        scanf("%d",&value);
        PNODE pNew =(PNODE)malloc(sizeof(NODE));
        if(NULL == pNew)
        {
          printf("内存分配失败，程序退出！\n");
          exit(-1);
        }
        pNew->data = value;  // 把新值放入节点
        pend->pNext = pNew;  // 把尾节点指向新节点
        pNew->pNext = NULL;  // 尾节点指针域为NULL
        pend = pNew;
    }

    return phead;
}

void traverseLinkList(PNODE pHead)
{
 PNODE p = pHead->pNext;
 while(NULL != p)
 {
  printf("%d  ", p->data);
  p = p->pNext;
 }
 printf("\n");
}

```
