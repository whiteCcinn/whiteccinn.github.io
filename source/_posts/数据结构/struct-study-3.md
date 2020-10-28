---
title: C语言数据结构の循环队列
date: 2017-02-15 14:08:17
categories: 数据结构
tags: [C, 数据结构, 循环队列]
---

## 实现

```C
#include <stdio.h>
#include <stdlib.h>

// because the C language does not has the type of boolean ,so , we use replace of which int,example 1 and 0 replace of the "true" and "false"
#define true 1
#define false 0

// alias name by int
typedef int elementType;

// design the queue data stuct
typedef struct queue
{
    elementType *content;
    elementType front;
    elementType rear;
    elementType maxSize;
}QUEUE,*PQUEUE;

// define the func
PQUEUE createQueue();                 // create one queue , return the queue
int isFull(PQUEUE queue);             // is Full
int isEmpty(PQUEUE queue);            // is Empty
int enQueue(PQUEUE queue,int data);   // EnQueue , include isFull
int deQueue(PQUEUE queue);            // DeQueue, include isEmpty
//void loop_print(PQUEUE queue);      // Loop Print the queue;

void main()
{
    // define the queue
    PQUEUE queue = NULL;

    printf(" Please Input the queue of length :");
    int length;
    scanf("%d",&length);

    // invoke func
    queue = createQueue(length);

    while(true)
    {
        printf(" Please Input which your want to enQueue the data:");
        int data ;
        scanf("%d",&data);
        if(data == 0)
        {
            break;
        }
        // invoke func
        enQueue(queue,data);
    }

    char *result = (char *)malloc(sizeof(char));
    while(true)
    {
        printf("deQueue :");
        int data = deQueue(queue);
        printf("data : %d\n",data);

        printf(" Go on ? [yes|no]\n");
        scanf("%s",result);
        if(strcmp(result,"yes") != 0)
        {
            break;
        }
    }
}


PQUEUE createQueue(int maxSize)
{
    PQUEUE p = (PQUEUE)malloc(sizeof(PQUEUE));
    if(p == NULL)
    {
        printf("malloc apply fail");
        exit(-1);
    }

    if(maxSize < 1)
    {
        printf("the queue size does not < 1");
        exit(-1);
    }
    maxSize++;

    // when the front end rear equals ,the queue is empty
    p->front = p->rear = 0;
    p->maxSize = maxSize;
    p->content = (elementType *)malloc(sizeof(elementType));         // init Mem

    // return the queue of point;
    return p;
}

int enQueue(PQUEUE queue,int data)
{
    if(isFull(queue)){
        printf("The queue is fullest,data : %d\n",data);
        exit(-1);
    }
    queue->content[queue->rear] = data;
    queue->rear = (queue->rear+1)%queue->maxSize;
}

int isFull(PQUEUE queue)
{
    if((((queue->rear)+1)%queue->maxSize == queue->front))
    {
        return true;
    }

    return false;
}

int isEmpty(PQUEUE queue)
{
    if(queue->rear == queue->front && queue->maxSize > 0)
    {
        return true;
    }

    return false;
}

int deQueue(PQUEUE queue)
{
    if(isEmpty(queue))
    {
        printf("队列为空");
        exit(-1);
    }

    int data = queue->content[queue->front];
    queue->front = (queue->front+1)%queue->maxSize;

    return data;
}
```
