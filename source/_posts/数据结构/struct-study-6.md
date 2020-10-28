---
title: C语言数据结构のAVL树
date: 2017-02-20 11:03:43
categories: 数据结构
tags: [C, 数据结构, BST树]
---

## 实现

```C
#ifndef _INCLUDE_BASE
#define _INCLUDE_BASE

#include <stdio.h>
#include <stdlib.h>

#define true 1
#define false 0
#endif

typedef int avl_elementType;

typedef struct avl
{
    avl_elementType data;
    struct avl *left;    // 左节点
    struct avl *right;   // 右节点
    avl_elementType hight;   // 以此为根的高度
}AVL,*PAVL;

//  ================================================================
    void RotateWithDoubleRight(PAVL *avl);    // RR 旋转平衡算法
    void RotateWithDoubleLeft(PAVL *avl);     // LL旋转平衡算法
    void RotateWithLeftRight(PAVL *avl);      // LR旋转平衡算法
    void RotateWithRightLeft(PAVL *avl);      // RL旋转平衡算法
    void InsertNode(PAVL *avl,int data);      // AVL插入算法
    int NodeHigh(PAVL avl);                   // 查询当前树节点的高度
    int compareHigh(PAVL a,PAVL b);           // 对比高度，取最大值
    void LeftBalance(PAVL *avl);              // 左平衡算法
    void RightBalance(PAVL *avl);             // 右平衡算法
    void print_inorder(PAVL avl);             // 中序排列打印
    void print_preorder(PAVL avl);            // 前序排列打印
    void print_houorder(PAVL avl);            // 后序排列打印
    void print_inhight(PAVL avl);             // 节点的高度
//  =================================================================

// main func
void main()
{
    PAVL root = (PAVL)malloc(sizeof(PAVL));
//    root->data = 3;

//    InsertNode(&root,2);
    InsertNode(&root,2);
    InsertNode(&root,1);
    InsertNode(&root,-1);
//    InsertNode(&root,0);
    InsertNode(&root,6);
    InsertNode(&root,7);
    InsertNode(&root,5);
    printf("中序排列节点的高度：");
    print_inhight(root);
    printf("\n");
    printf("中序排列：");
    print_inorder(root);
    printf("\n");
    printf("前序排列：");
    print_preorder(root);
}

void InsertNode(PAVL *avl,int data)
{
    if(!(*avl))
    {
        PAVL node = (PAVL)malloc(sizeof(PAVL));
        node->data = data;
        node->hight = 0;
        *avl = node;
        return ;
    }

    if(data > (*avl)->data)
    {
        InsertNode(&((*avl)->right),data);
        //判断是否破坏AVL树的平衡性
        if (NodeHeight((*avl)->right)-NodeHeight((*avl)->left)==2)
            RightBalance(avl);  //右平衡处理
    }else{
        InsertNode(&((*avl)->left),data);
        //判断是否破坏AVL树的平衡性
        printf("相减为:%d",NodeHeight((*avl)->left)-NodeHeight((*avl)->right));
        if (NodeHeight((*avl)->left)-NodeHeight((*avl)->right)==2)
            LeftBalance(avl);  //左平衡处理
        }
    (*avl)->hight = compareHigh((*avl)->left,(*avl)->right) + 1 ;
    printf("当前节点:%d , 高度:%d , left-高度:%d,right-高度:%d \n",(*avl)->data,(*avl)->hight,NodeHeight((*avl)->left),NodeHeight((*avl)->right));
}

// 空节点为-1，否则返回树节点高度
int NodeHeight(PAVL avl)
{
    return avl == NULL ? -1 : avl->hight;
}

int compareHigh(PAVL a,PAVL b)
{
    if(!a || !b)
     return 0;
    return a->hight > b->hight ? a->hight : b->hight;
}


// 左平衡处理
void LeftBalance(PAVL *avl)
{
    if(NodeHeight((*avl)->left->left) - NodeHeight((*avl)->left->right) != -1)
    {
        RotateWithDoubleLeft(avl);
    }else
    {
        RotateWithLeftRight(avl);
    }
}

// 右平衡处理
void RightBalance(PAVL *avl)
{
    if(NodeHeight((*avl)->right->right) - NodeHeight((*avl)->right->left) != -1)
    {
        RotateWithDoubleRight(avl);
    }else
    {
        RotateWithRightLeft(avl);
    }
}

// LL旋转算法
void RotateWithDoubleLeft(PAVL *avl)
{
 PAVL p = *avl;
 PAVL q = p->left;
 p->left = q->right;
 q->right = p;

 p->hight = compareHigh(p->left,p->right) +1  ;
 q->hight = compareHigh(q->left,q->right) +1 ;

 *avl = q;
}

// RR旋转算法
void RotateWithDoubleRight(PAVL *avl)
{
  PAVL p = *avl;
  PAVL q = p->right;
  p->right = q->left;
  q->left = p;

  p->hight = compareHigh(p->left,p->right) +1  ;
  q->hight = compareHigh(q->left,q->right) +1 ;

  *avl = q;
}


// LR旋转算法
void RotateWithLeftRight(PAVL *avl)
{
    printf("\nLR\n");
    RotateWithDoubleRight(&((*avl)->left));
    RotateWithDoubleLeft(avl);
}

// RL旋转算法
void RotateWithRightLeft(PAVL *avl)
{
    printf("\nRL\n");
    RotateWithDoubleLeft(&((*avl)->right));
    RotateWithDoubleRight(avl);
}

void print_inorder(PAVL avl)
{
    if(avl)
    {
        print_inorder(avl->left);
        printf("%d - ",avl->data);
        print_inorder(avl->right);
    }
}

void print_inhight(PAVL avl)
{
    if(avl)
    {
        print_inhight(avl->left);
        printf("%d - ",avl->hight);
        print_inhight(avl->right);
    }
}

void print_preorder(PAVL avl)
{
    if(avl)
    {
        printf("%d - ",avl->data);
        print_preorder(avl->left);
        print_preorder(avl->right);
    }
}

void print_houorder(PAVL avl)
{
    if(avl)
    {
        print_houorder(avl->left);
        print_houorder(avl->right);
        printf("%d - ",avl->data);
    }
}
```
