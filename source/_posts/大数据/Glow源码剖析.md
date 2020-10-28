---
title: 【大数据】- Glow 源码剖析
date: 2019-08-12 00:07:40
categories: [大数据, Golang]
tags: [大数据，流式计算, Golang]
---

## 前言

犹豫公司的流式计算，并没有用类似于 Hadoop 的 mapreduce 机制或者 storm 或者 flink，是我们自研基于 erlang 的单节点服务，其优点就是：部署和迁移都十分简单，并且犹豫 erlang 的天然的良好的利用了多核 CPU 的优势，可以实现效率较高的大数据流式计算。但是由于其单机性，导致对单台机器的要求过于苛刻，并且不能进行扩展机器提高计算能力是其致命的缺点，所以目前我规划利用 golang，写一个支持分布式并行计算的服务，在此之前，了解了各大流式计算的基本思想，并且结合 golang 语言的特性，找到了一个叫`glow`的服务，想要写好一个分布式流式计算的服务，我们先来看看 `glow` 有什么好的借鉴的思想和思路。

<!-- more -->

## 源码分析

我们要记得这 5 个内容，这是构成整个 flow 的核心名词

1. 上下文 Context
2. 步进 Step
3. 任务 Task
4. 数据集 Dataset
5. 数据分片 DatasetShard

## 上下文（Context）

上下文有 4 个属性，其中 2 个问数组

1. Id int
2. Steps []flow.Step
3. Datasets []flow.Dataset
4. ChannelBufferSize int

## 步进（Step） & 任务（Task）

### 步进（Step）

Step 有 6 个属性

1. Id int
2. Name string
3. Inputs []flow.Dataset （每一步的来源结果集）
4. Output flow.Dataset （每一个需要输出的结果集）
5. Function function (每一步操作接口提供的用户自定义业务逻辑)
6. Tasks []flow.Task （任务数基于上一步中的 Output 中 Task 中 Outputs 的数据分区数量）

### 任务（Task）

Task 有 5 个属性

1. Id int
2. Inputs []flow.DatasetShard
3. Outputs []flow.DatasetShard （输出结果集的分区，各个分区处于平等关系）
4. Step flow.Step （所属哪一步的任务）
5. InputChans []reflect.Value

> 一个任务 Inputs 等于一个上一步中的 Output 中 Task 中的 Outputs 的数量

## 数据集（Dataset） & 数据粉分片（DatasetShard）

### 数据集（Dataset）

Dataset 有 10 个属性

1. Id int （Step 输出的数据结集）
2. context flow.FlowContext
3. Type reflect.Type | \*reflect.rtype
4. Shards []flow.DatasetShard （对应 Step 中 Tasks 中 Outputs 的数据分区）
5. Step flow.Step （属于哪一个结果集）
6. ReadingSteps []flow.Step （对应下一步的 Step）
7. ExternalInputChans []reflect.Value
8. ExternalOutputChans []reflect.Value
9. IsKeyPartitioned bool
10. isKeyLocalSorted bool

### 数据集分片（DatasetShard）

DatasetShard 有 9 个属性

1. Id int
2. Parent flow.Dataset （所属的结果集）
3. WriteChan reflect.Value
4. ReadingTasks []flow.Task （Step 上有几个 Tasks 就有几个）
5. Counter int
6. ReadyTime time.Time
7. CloseTime time.Time
8. lock sync.RWMutex
9. readingChans []reflect.Value

## word_count

和其他流式计算一样，提供了一个单词统计的例子。

```Go
	flow.New().TextFile(
		"/etc/passwd", 2,
	).Filter(func(line string) bool {
		//println("filter:", line)
		return !strings.HasPrefix(line, "#")
	}).Map(func(line string, ch chan string) {
		for _, token := range strings.Split(line, ":") {
			ch <- token
		}
	}).Map(func(key string) int {
		println("map:", key)
		return 1
	}).Reduce(func(x int, y int) int {
		println("x:", x)
		println("y:", y)
		println("reduce:", x+y)
		return x + y
	}).Map(func(x int) {
		println("count:", x)
	}).Run()
```

我们看一下这个执行流程。

- flow.New() 生成 `flow.FlowContext`
- TextFile("/etc/passwd", 2) 打开`/etc/passwd` 文件，并且数据分片数量为：2
  - 这是第一个 Step
- Filter(func) 将返回`true`的数据筛选出来
  - 这是第二个 Step
- Map(func(line string, ch chan string)) 需要运执行 map 运算，第一个参数为上一个 Step 的结果值，第二个参数说明需要通过一个可读可写的 chan 来写入传输数据，相当于二次拆分数据
  - 这是第三个 Step
- Map(func(key string)) 从上一步的 Step 中的 chan 中读取出来的数据，每次来一个 key，都返回一个整型：1
- Reduce(func(x int, y int)）进行`Reduce`的操作，将数据合并汇总，x 代表上一次 step 的总数，y 代表最近一次得到的值。但是这里比较特殊，在前面所有 step 都处理完毕之后，如果你是进行了数据分片的话，会把数据分片再合并一次。
- Map(func(x int)) 由于我们进行了 Reduce 了，所以在 Reduce 之后的 map 只会进行一次运行，这个时候 x 就代表我们 Reduce 的 API 的最终结果
- Run() 运行流式计算

按照看源码的套路

1. 运行 demo，理解 demo
2. 找到 demo 的运行入口
3. 根据入口来查看运行方式
4. 再回过头来看 demo 的细节

### 运行逻辑

```Go
func (d *Dataset) Run() {
	d.context.Run()
}
```

```Go
func (fc *FlowContext) Run() {
	if taskRunner != nil && taskRunner.IsTaskMode() {
		taskRunner.Run(fc)
	} else if contextRunner != nil && contextRunner.IsDriverMode() {
		contextRunner.Run(fc)
	} else {
		fc.runFlowContextInStandAloneMode()
	}
}
```

```Go
func (fc *FlowContext) runFlowContextInStandAloneMode() {

  // 设置一个用于等于协程全部运行完毕的计数`wg`
	var wg sync.WaitGroup

  // 生成一个`map[int]bool`类型的类似于 HashTable 一样的 K/V 映射结构的 Map 类型
	isDatasetStarted := make(map[int]bool)

  // 设置接收到中断信号的处理回调函数
	OnInterrupt(fc.OnInterrupt, nil)

  // 启动所有的任务边界
	// start all task edges
	for _, step := range fc.Steps {                      // 循环所有的Steps，每一个API就代表一个Step
		for _, input := range step.Inputs {                // 循环每个step中的Inputs
			if _, ok := isDatasetStarted[input.Id]; !ok {    // 如果Dataset已经启动，那么就跳过，否则进行启动逻辑
				wg.Add(1)                                      // 每一次需要运行input的时候，协程计数器+1
				go func(input *Dataset) {                      // 每一个input都启动一个协程运行主逻辑
					defer wg.Done()                              // 每个协程结束的时候，协程计数器-1
					input.RunDatasetInStandAloneMode()           // 在协程环境下运行每个input启动自身逻辑
				}(input)
				isDatasetStarted[input.Id] = true               // 创建协程完毕之后设置这个input已经处理过了
			}
		}
		wg.Add(1)                                           // 每一次需要运行step的时候，协程计数器+1
		go func(step *Step) {                               // 创建协程运行主逻辑
			defer wg.Done()                                   // 每个协程结束的时候，协程计数器-1
			step.RunStep()                                    // 在协程环境下运行step的自身逻辑
		}(step)

		if step.Output != nil {                              // 如果step的output不等于nil的话，进行逻辑
			if _, ok := isDatasetStarted[step.Output.Id]; !ok {// 如果没有运行过的话，就运行否则就跳出
				wg.Add(1)                                        // 每一次需要运行Output的时候，协程计数器+1
				go func(step *Step) {                            // 创建协程运行主逻辑
					defer wg.Done()                                // 每个协程结束的时候，协程计数器-1
					step.Output.RunDatasetInStandAloneMode()       // 在协程环境下运行Output的自身逻辑
				}(step)
				isDatasetStarted[step.Output.Id] = true          // 创建协程完毕之后设置这个Output已经处理过了
			}
		}
	}
	wg.Wait()                                              // 当所有协程都执行完毕之后再退出主协程
}

/*
 总结：
  1. step.Inputs 和 step.Output 都是Dataset
  2. step.Inputs中所有input运行完逻辑之后，再运行step的逻辑，最后再运行step的Outpu逻辑，再接着下一个step
  3. 每个逻辑的运行都是在创建协程之后运行
*/
```

看到这里的逻辑比较核心的有`func (fc *FlowContext) runFlowContextInStandAloneMode()`，`func (s *Step) RunStep()`我们就看到了最终的入口了，解释我写在代码中。

接下来，我们看一下 input/Output 运行的主逻辑

```Go
func (d *Dataset) RunDatasetInStandAloneMode() {
  // 设置一个用于等于协程全部运行完毕的计数`wg`
	var wg sync.WaitGroup

	if len(d.ExternalInputChans) > 0 {                            // 如果数据集存在外部chan的话
		d.connectExternalInputChansToRead(&wg)                      // 连接外部chan进行处理，并且如果用到协程的话，需要同步更新协程计数器
		for _, shard := range d.Shards {                            // 循环数据集的分片
			shard.SetupReadingChans()                                 // 数据集分片运行主要逻辑
		}
	} else {                                                      // 如果不存在外部chan的话
		for _, shard := range d.Shards {                            // 循环数据集的分片
			wg.Add(1)                                                 // 每一次需要运行数据分片的时候，协程计数器+1
			go func(shard *DatasetShard) {                            // 创建协程运行主逻辑
				defer wg.Done()                                         // 每个协程结束的时候，协程计数器-1
				// println("setup shard reading chans", shard.Name())
				shard.SetupReadingChans()                               // 数据分片部署读取的数据的chan

				// start to run
				var t reflect.Value                                      // 定义个reflect.Value的类型
				for ok := true; ok; {                                    // 死循环
					if t, ok = shard.WriteChan.Recv(); ok {                // 数据分片写chan阻塞接收数据，如果有数据来的话就执行下面的逻辑
						shard.SendForRead(t)                                 // 数据分片发送数据到Readchan，参数为reflect.Value类型
						// hookup output channels
						d.sendToExternalOutputChans(t)                       // 发送数据到外部OutputChan
					}
				}
				// println("close shard reading", shard.Name())
				shard.CloseRead() // 数据分片关闭
			}(shard)
		}
	}

	wg.Wait()  // 当所有协程都执行完毕之后再运行下面的逻辑
	d.closeExternalOutputChans() // 关闭外部Outputchan
  return

/*
 总结：
  1. 每个数据分片都需要关联Task中的input的chan
  2. 当数据分片的WriteChan可读取的时候，把数据传递给readingChans
  3. 发送完毕之后，还会记录关闭时间
*/
}
```

```Go
func (shard *DatasetShard) SetupReadingChans() {
	// get unique list of tasks since ReadingTasks can have duplicates
  // especially when one dataset is used twice in a task, e.g. selfJoin()
  // 获取唯一的任务列表，因为ReadingTasks可能有重复的任务
  // 特别是当一个数据集在一个任务中使用两次时，例如selfJoin()

  // 定义变量uniqTasks
	var uniqTasks []*Task

  // 生成一个`map[*Task]bool`类型的类似于 HashTable 一样的 K/V 映射结构的 Map 类型
  seenTasks := make(map[*Task]bool)

	for _, task := range shard.ReadingTasks {    // 循环数据分片中的ReadingTasks，读取任务
		if ok := seenTasks[task]; ok {             // 如果任务已经处理过了，就处理下一个任务
			continue
		}
		seenTasks[task] = true                     // 开始处理任务，设置为true
		uniqTasks = append(uniqTasks, task)        // 加入uniqTasks的list
	}
	shard.lock.Lock()                            // 数据分片上加上`RWMutex`，并且进行写锁
	defer shard.lock.Unlock()                    // 函数结束的时候，进行写解锁
	for _, task := range uniqTasks {             // 再写锁读情况下进行：循环唯一的Tasks
		for i, s := range task.Inputs {            // 循环每个Task的Inputs
			if s == shard {                          // 找到对应的索引i
				shard.readingChans = append(shard.readingChans, task.InputChans[i]) // 把输入任务上的inputchan加入到分区需要读取的chan去
			}
		}
	}
	shard.ReadyTime = time.Now()                 // 数据分片准备就绪的时间
	// fmt.Printf("shard %s has reading tasks:%d channel:%d\n", shard.Name(), len(shard.ReadingTasks), len(shard.readingChans))
}
```

```Go
func (s *DatasetShard) SendForRead(t reflect.Value) {
	s.lock.RLock()  // 数据分片进行读锁
	defer s.lock.RUnlock() // 数结束的时候，进行读解锁
	s.Counter++ // 发送次数+1

	for _, c := range s.readingChans {  // 往读chan发送数据
		// println(s.Name(), "send chan", i, "entry:", s.counter)
		c <- t
	}
}
```

```Go
func (s *DatasetShard) CloseRead() {
	s.lock.RLock() // 数据分片进行读锁
	defer s.lock.RUnlock() // 数结束的时候，进行读解锁

	for _, c := range s.readingChans {
		close(c) // 关闭所有读chan
	}
	s.CloseTime = time.Now() // 记录关闭时间
}
```

接下来，我们看一下 RunStep 的主逻辑：

```Go
func (s *Step) RunStep() {
   // 设置一个用于等于协程全部运行完毕的计数`wg`
	var wg sync.WaitGroup
	for i, t := range s.Tasks {     // 循环所有Step的任务
		wg.Add(1)                     // 每一次需要运行数据分片的时候，协程计数器+1
		go func(i int, t *Task) {     // 创建协程运行主逻辑
			defer wg.Done()             // 每个协程结束的时候，协程计数器-1
			t.RunTask()                 // 运行任务的主逻辑
		}(i, t)
	}
	wg.Wait() // 当所有协程都执行完毕之后才算完毕

	return
}
```

```Go
// source ->w:ds:r -> task -> w:ds:r
// source close next ds' w chan
// ds close its own r chan
// task closes its own channel to next ds' w:ds

func (t *Task) RunTask() {
	// println("start", t.Name())
	t.Step.Function(t) // 运行每一个Step自定义的处理逻辑函数
	for _, out := range t.Outputs {
		// println(t.Name(), "close WriteChan of", out.Name())
		out.WriteChan.Close() // 关闭每个output的chan，那个每个Step.Function中的协程将会结束
	}
	// println("stop", t.Name())  
}
```


回到我们的程序：

1. 

=================

```Go
func (fc *FlowContext) TextFile(fname string, shard int) (ret *Dataset) {
	fn := func(out chan string) {
		file, err := os.Open(fname)
		if err != nil {
			// FIXME collect errors
			log.Panicf("Can not open file %s: %v", fname, err)
			return
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			out <- scanner.Text()
		}

		if err := scanner.Err(); err != nil {
			log.Printf("Scan file %s: %v", fname, err)
		}
	}
	return fc.Source(fn, shard)
}
```

这里，我们看到`func (fc *FlowContext) TextFile(fname string, shard int) (ret *Dataset)`，

```Go
// Source returns a new Dataset which evenly distributes the data items produced by f
// among multiple shards. f must be a function defined in the form func(chan <some_type>).
func (fc *FlowContext) Source(f interface{}, shard int) (ret *Dataset) {
	ret = fc.newNextDataset(shard, guessFunctionOutputType(f))
	step := fc.AddOneToAllStep(nil, ret)
	step.Name = "Source"
	step.Function = func(task *Task) {
		ctype := reflect.ChanOf(reflect.BothDir, ret.Type)
		outChan := reflect.MakeChan(ctype, 0)
		fn := reflect.ValueOf(f)
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer outChan.Close()
			fn.Call([]reflect.Value{outChan})
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()

			var t reflect.Value
			i := 0
			for ok := true; ok; {
				if t, ok = outChan.Recv(); ok {
					task.Outputs[i].WriteChan.Send(t)
					i++
					if i == shard {
						i = 0
					}
				}
			}
		}()

		wg.Wait()

	}
	return
}
```
