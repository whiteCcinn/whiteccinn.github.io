---
title: C语言数据结构のBST树(写法二:指针引用，递归)
date: 2017-02-15 18:01:00
categories: 数据结构
tags: [C, 数据结构, BST树]
---

## 实现

```C
#include <stdio.h>
#include <stdlib.h>

#define true 1
#define false 0

typedef int elementType;

typedef struct bst
{
    elementType data;   // 数据域
    struct bst *left;   // 左指针
    struct bst *right;  // 右指针
}BST,*PBST;

PBST create_bst(int root_data);     // create include the root node tree
int insert_node(PBST *bst,int data); // insert into bst
void print_inorder(PBST tree);  

void main()
{
    int in;
    printf("请输入根节点的值");
    scanf("%d",&in);

    PBST bst = create_bst(in);
    insert_node(&bst,2);
    insert_node(&bst,3);
    insert_node(&bst,4);
    insert_node(&bst,5);
    insert_node(&bst,6);
//    printf("\n%d",bst->right == NULL);
//    printf("\n%d",bst->left->data);
    print_inorder(bst);
}

PBST create_bst(int root_data)
{
    // 申请内存，并且返回地址
    PBST bst = (PBST)malloc(sizeof(PBST));
    if(bst == NULL)
    {
        printf("malloc apply fail");
        exit(-1);
    }

    bst->data = root_data; // 默认为0
    bst->left = NULL; // 防止出现野指针
    bst->right = NULL; // 防止出现野指针

    return bst;
}

void create_node(PBST child,int data)
{
    child = (PBST)malloc(sizeof(PBST));
    child->data = data;
    child->left = child->right = NULL;
}

// 中序排列（递增排列）
int insert_node(PBST *bst,int data)
{
    if(!(*bst)) {
        PBST temp = (PBST)malloc(sizeof(PBST));
        temp->left = temp->right = NULL;
        temp->data = data;
        *bst = temp;
        return ;
    }

    if (data < (*bst)->data) {
        insert_node(&((*bst)->left),data);
    }else if (data > (*bst)->data) {
        insert_node(&((*bst)->right),data);
    }
}

void print_inorder(PBST tree) {
    if(tree) {
        print_inorder(tree->left);
        printf("%d\n",tree->data);
        print_inorder(tree->right);
    }
}

```
