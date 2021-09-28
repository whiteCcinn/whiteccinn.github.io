---
title: 【大数据】- flink开发环境搭建
date: 2021-09-28 09:56:40
categories: [大数据]
tags: [flink]
---

## 前言

由于最近要推动flink的流计算代替我们的内部的自行研发的mstream流计算服务，所以需要对flink进行开发。

<!-- more -->

## 环境搭建

我们的flink的版本上1.12.0

理论上只是jdk8和jdk11.所以我们需要安装jdk8和jdk8

因为我的是macOS，所以这里我说一下mac安装的过程。

首先，我们需要安装jdk。

```shell
brew tap adoptopenjdk/openjdk
brew install adoptopenjdk8
brew install adoptopenjdk11
```

> 置于要用jdk8还是jdk11，自行抉择，我这里2个都安装了。

但是这个时候你可能会找不到安装路径

```shell
➜  ~ /usr/libexec/java_home -V
Matching Java Virtual Machines (3):
    11.0.12 (x86_64) "Oracle Corporation" - "Java SE 11.0.12" /Library/Java/JavaVirtualMachines/jdk-11.0.12.jdk/Contents/Home
    11.0.11 (x86_64) "AdoptOpenJDK" - "AdoptOpenJDK 11" /Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home
    1.8.0_292 (x86_64) "AdoptOpenJDK" - "AdoptOpenJDK 8" /Library/Java/JavaVirtualMachines/adoptopenjdk-8.jdk/Contents/Home
```

通过`/usr/libexec/java_home -V`内置的一个程序，就可以找到所有相关的`java_home`，这里我们就可以看到对应的`java_home`，然后找到对应的java解析器。

## IDE初始化项目

我这里用的是`IDEA`，所以我这里列一下我的操作步骤。

### New Project

先把`Maven`包的路径确定下来。后面利用docker-maven工具的时候，指定挂载仓库有用。

![newproject13](/images/大数据/newproject13.png)

开始创建项目

![newproject1](/images/大数据/newproject1.png)

选择使用Maven来创建项目，并且选择刚才安装好的`JDK8`或者`JDK11`。

默认情况下，这是不带`archetype`的，这个是`Maven`模板的类型。我们需要勾选这个`archetype`，

![newproject2](/images/大数据/newproject2.png)

接下来添加`flink-quickstart-java`的`archetype`。

- GroupId = org.apache.flink
- AryofactId = flink-quickstart-java
- Version = 1.12.0

![newproject3](/images/大数据/newproject3.png)

利用模版创建项目

![newproject4](/images/大数据/newproject4.png)

可以根据自行的需要，填写项目的路径以及对应的`GroupId`, `AryofactId`, `Version`

![newproject5](/images/大数据/newproject5.png)

然后就是Maven的相关配置，这里使用的默认的就行，直接点击`Finish`完成项目初始化，然后项目会自动根据Maven的配置加载对应的Jar包。

![newproject6](/images/大数据/newproject6.png)


等待一切初始化完毕后，会看到如下图的模板

![newproject7](/images/大数据/newproject7.png)

其中包含了2个Job，分别是`BatchJob`和`StreamingJob`。

- BatchJob 代表批处理任务
- StreamingJob 代表流处理任务

## 编写批处理代码并测试执行

```java
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package my.flink;

import org.apache.flink.api.java.ExecutionEnvironment;
import org.apache.flink.api.java.operators.DataSource;
import org.apache.flink.util.Collector;

import java.util.Arrays;

/**
 * Skeleton for a Flink Batch Job.
 *
 * <p>For a tutorial how to write a Flink batch application, check the
 * tutorials and examples on the <a href="https://flink.apache.org/docs/stable/">Flink Website</a>.
 *
 * <p>To package your application into a JAR file for execution,
 * change the main class in the POM.xml file to this class (simply search for 'mainClass')
 * and run 'mvn clean package' on the command line.
 */
public class BatchJob {

    public static void main(String[] args) throws Exception {
        // set up the batch execution environment
        final ExecutionEnvironment env = ExecutionEnvironment.getExecutionEnvironment();

        DataSource<String> el = env.fromElements("good good study", "day day up");

        el.flatMap(
                (String a, Collector<String> out) -> Arrays.stream(a.split(" ")).forEach(x -> out.collect(x))
        ).returns(String.class).print();

        // 由于print()是调试模式，所以不能指定Jobname，print()内部会自动调用Execute()
        // 所以 env.execute() 将无法调用，需要注释掉，否则会有报错抛出，当然你也可以选择忽略这个异常
        // execute program
        // env.execute("Flink Batch Java API Skeleton");
    }
}

```

这里我们把`BatchJob`加入了`具体`的任务。我这里的写法是Java8的lamba的写法，使用lamba的写法记得需要在后面加上`returns`的函数，这是因为使用`lamba`的情况下，会导致部分信息无法自动推导，需要手动显式指定，从而导致我们需要调用多这个函数。

我们初始化了一个数据源集合，这个集合类型为`String`类型，我们指定这个集合的元素有2个，分别是`good good study`, `day day up`。

然后我们通过`flatMap`的方法进行一个归并的操作，把每个元素通过`一个空格`进行切分，切分之后，我们通过`Collector`的`collect()`进行收集起来。最终输出在终端。

并且这个Job的名字，我们定义为`Flink Batch Java API Skeleton`。

我们运行这个Job.默认情况下，会遇到如下报错：

```
Exception in thread "main" java.lang.NoClassDefFoundError: org/apache/flink/api/java/ExecutionEnvironment
	at my.flink.BatchJob.main(BatchJob.java:41)
Caused by: java.lang.ClassNotFoundException: org.apache.flink.api.java.ExecutionEnvironment
	at java.base/jdk.internal.loader.BuiltinClassLoader.loadClass(BuiltinClassLoader.java:581)
	at java.base/jdk.internal.loader.ClassLoaders$AppClassLoader.loadClass(ClassLoaders.java:178)
	at java.base/java.lang.ClassLoader.loadClass(ClassLoader.java:522)
	... 1 more
```

你可能会觉得很奇怪，明明`IDEA`已经把`Flink`的包加载进来，也能正常跳转，为什么在运行的时候却出现了这个，这是因为这是编译的行为，和IDEA加载包没有直接的关系。

打开你的`pom.xml`，找到`dependencies`下的`<groupId>org.apache.flink</groupId>`的所有依赖包，你会发现每个依赖包下面都有一个`<scope />`的定义，里面的value写的是`provided`，我们只需要把这一整行注释掉就好了。

```xml
		<dependency>
			<groupId>org.apache.flink</groupId>
			<artifactId>flink-java</artifactId>
			<version>${flink.version}</version>
			<scope>provided</scope>
		</dependency>
		<dependency>
			<groupId>org.apache.flink</groupId>
			<artifactId>flink-streaming-java_${scala.binary.version}</artifactId>
			<version>${flink.version}</version>
			<scope>provided</scope>
		</dependency>
		<dependency>
			<groupId>org.apache.flink</groupId>
			<artifactId>flink-clients_${scala.binary.version}</artifactId>
			<version>${flink.version}</version>
			<scope>provided</scope>
		</dependency>
```

注释后

```xml
		<dependency>
			<groupId>org.apache.flink</groupId>
			<artifactId>flink-java</artifactId>
			<version>${flink.version}</version>
			<!-- <scope>provided</scope> -->
		</dependency>
		<dependency>
			<groupId>org.apache.flink</groupId>
			<artifactId>flink-streaming-java_${scala.binary.version}</artifactId>
			<version>${flink.version}</version>
			<!-- <scope>provided</scope> -->
		</dependency>
		<dependency>
			<groupId>org.apache.flink</groupId>
			<artifactId>flink-clients_${scala.binary.version}</artifactId>
			<version>${flink.version}</version>
			<!-- <scope>provided</scope> -->
		</dependency>
```

这样子，就等同于定义依赖包，使用默认的`scope`范围。

我们这里需要了解一下scope的一些细节。

对于`scope=compile`的情况（`默认scope`),也就是说这个项目在`编译`，`测试`，`运行阶段``都需要`这个artifact(模块)对应的jar包`在classpath中`。

而对于`scope=provided`的情况，则可以认为这个provided是`目标容器已经provide这个artifact`。换句话说，`它只影响到编译，测试阶段`。在编译测试阶段，我们需要这个artifact对应的jar包在classpath中，而在运行阶段，假定目标的容器（比如我们这里的liferay容器）已经提供了这个jar包，所以无需我们这个artifact对应的jar包了。

maven中三种classpath
编译，测试，运行
- compile：默认范围，编译测试运行都有效
- provided：在编译和测试时有效
- runtime：在测试和运行时有效
- test：只在测试时有效
- system：在编译和测试时有效，与本机系统关联，可移植性差

所以我们需要改变的就是这个`scope`的范围，让某情况下可以运行。例如，我们需要在本机上运行，那么我们就可以注释掉，然后就会使用默认的`compile`。

但是需要注意的是，当你改动了这个`pom.xml`之后，idea我不知道是不是bug，反正我的当前版本不会自动刷新，怎么理解这句话？

通过`File -> Project Structure`打开页面（因为我是mac），所以可以通过快捷键`Command + [:;]`打开。界面如下

![newproject8](/images/大数据/newproject8.png)

我们可以看到，`Flink`相关的依赖包其实已经存在了，这里显示了我们的Maven包下的scope是`Provided`，那就代表`IDEA`并未自动识别我刚才的注释。因为如果成功识别出来了，应该是会变成`Compile`。当然我可以直接在这里进行修改，但是为了统一维护的问题，不建议在此处修改，虽然直接修改很方便，但是下次加载还是从`pom.xml`加载的，并且间接依赖包也特别多，你无法掌握那么多依赖包的关系。

所以注释后，我们需要利用`pom.xml`进行`maven`的`reload project`。

![newproject10](/images/大数据/newproject10.png)

这个时候，我们就发现不管是直接还是间接的依赖包都变成了`Compile`。

![newproject11](/images/大数据/newproject11.png)

接下来，我们在运行一次我们的任务。

```
15:33:55,353 INFO  org.apache.flink.api.java.utils.PlanGenerator                [] - The job has 0 registered types and 0 default Kryo serializers
15:33:55,523 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutorResourceUtils [] - The configuration option taskmanager.cpu.cores required for local execution is not set, setting it to the maximal possible value.
15:33:55,523 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutorResourceUtils [] - The configuration option taskmanager.memory.task.heap.size required for local execution is not set, setting it to the maximal possible value.
15:33:55,523 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutorResourceUtils [] - The configuration option taskmanager.memory.task.off-heap.size required for local execution is not set, setting it to the maximal possible value.
15:33:55,523 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutorResourceUtils [] - The configuration option taskmanager.memory.network.min required for local execution is not set, setting it to its default value 64 mb.
15:33:55,524 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutorResourceUtils [] - The configuration option taskmanager.memory.network.max required for local execution is not set, setting it to its default value 64 mb.
15:33:55,524 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutorResourceUtils [] - The configuration option taskmanager.memory.managed.size required for local execution is not set, setting it to its default value 128 mb.
15:33:55,548 INFO  org.apache.flink.runtime.minicluster.MiniCluster             [] - Starting Flink Mini Cluster
15:33:55,551 INFO  org.apache.flink.runtime.minicluster.MiniCluster             [] - Starting Metrics Registry
15:33:55,627 INFO  org.apache.flink.runtime.metrics.MetricRegistryImpl          [] - No metrics reporter configured, no metrics will be exposed/reported.
15:33:55,627 INFO  org.apache.flink.runtime.minicluster.MiniCluster             [] - Starting RPC Service(s)
15:33:55,780 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcServiceUtils        [] - Trying to start local actor system
15:33:56,203 INFO  akka.event.slf4j.Slf4jLogger                                 [] - Slf4jLogger started
15:33:56,313 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcServiceUtils        [] - Actor system started at akka://flink
15:33:56,328 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcServiceUtils        [] - Trying to start local actor system
15:33:56,341 INFO  akka.event.slf4j.Slf4jLogger                                 [] - Slf4jLogger started
15:33:56,356 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcServiceUtils        [] - Actor system started at akka://flink-metrics
15:33:56,373 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Starting RPC endpoint for org.apache.flink.runtime.metrics.dump.MetricQueryService at akka://flink-metrics/user/rpc/MetricQueryService .
15:33:56,399 INFO  org.apache.flink.runtime.minicluster.MiniCluster             [] - Starting high-availability services
15:33:56,418 INFO  org.apache.flink.runtime.blob.BlobServer                     [] - Created BLOB server storage directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/blobStore-4ec8c72e-36f6-4b8d-aba8-70bb3d443f93
15:33:56,430 INFO  org.apache.flink.runtime.blob.BlobServer                     [] - Started BLOB server at 0.0.0.0:58212 - max concurrent requests: 50 - max backlog: 1000
15:33:56,434 INFO  org.apache.flink.runtime.blob.PermanentBlobCache             [] - Created BLOB cache storage directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/blobStore-3433044e-b47e-445c-9df2-ceb5d1e8da6f
15:33:56,436 INFO  org.apache.flink.runtime.blob.TransientBlobCache             [] - Created BLOB cache storage directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/blobStore-4d06675d-1b13-4fa2-87e9-0a1609934f09
15:33:56,436 INFO  org.apache.flink.runtime.minicluster.MiniCluster             [] - Starting 1 TaskManger(s)
15:33:56,441 INFO  org.apache.flink.runtime.taskexecutor.TaskManagerRunner      [] - Starting TaskManager with ResourceID: a7c681c7-48a2-4491-803a-535036a51fcb
15:33:56,477 INFO  org.apache.flink.runtime.taskexecutor.TaskManagerServices    [] - Temporary file directory '/var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T': total 233 GB, usable 25 GB (10.73% usable)
15:33:56,482 INFO  org.apache.flink.runtime.io.disk.FileChannelManagerImpl      [] - FileChannelManager uses directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/flink-io-dc01cff1-6b52-43ed-9d16-9085f49c732e for spill files.
15:33:56,492 INFO  org.apache.flink.runtime.io.disk.FileChannelManagerImpl      [] - FileChannelManager uses directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/flink-netty-shuffle-41571afb-b13e-494b-b937-0696d2c77ca1 for spill files.
15:33:56,580 INFO  org.apache.flink.runtime.io.network.buffer.NetworkBufferPool [] - Allocated 64 MB for network buffer pool (number of memory segments: 2048, bytes per segment: 32768).
15:33:56,594 INFO  org.apache.flink.runtime.io.network.NettyShuffleEnvironment  [] - Starting the network environment and its components.
15:33:56,596 INFO  org.apache.flink.runtime.taskexecutor.KvStateService         [] - Starting the kvState service and its components.
15:33:56,631 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Starting RPC endpoint for org.apache.flink.runtime.taskexecutor.TaskExecutor at akka://flink/user/rpc/taskmanager_0 .
15:33:56,650 INFO  org.apache.flink.runtime.taskexecutor.DefaultJobLeaderService [] - Start job leader service.
15:33:56,653 INFO  org.apache.flink.runtime.filecache.FileCache                 [] - User file cache uses directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/flink-dist-cache-fc4fd5a1-79fa-4a19-8d7d-f3072006c91e
15:33:56,714 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint   [] - Starting rest endpoint.
15:33:56,717 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint   [] - Failed to load web based job submission extension. Probable reason: flink-runtime-web is not in the classpath.
15:33:57,089 WARN  org.apache.flink.runtime.webmonitor.WebMonitorUtils          [] - Log file environment variable 'log.file' is not set.
15:33:57,089 WARN  org.apache.flink.runtime.webmonitor.WebMonitorUtils          [] - JobManager log files are unavailable in the web dashboard. Log file location not found in environment variable 'log.file' or configuration key 'web.log.path'.
15:33:57,300 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint   [] - Rest endpoint listening at localhost:58223
15:33:57,302 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Proposing leadership to contender http://localhost:58223
15:33:57,305 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint   [] - http://localhost:58223 was granted leadership with leaderSessionID=22a043f5-f263-4e6c-87e9-6e61beef3075
15:33:57,306 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Received confirmation of leadership for leader http://localhost:58223 , session=22a043f5-f263-4e6c-87e9-6e61beef3075
15:33:57,327 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Starting RPC endpoint for org.apache.flink.runtime.resourcemanager.StandaloneResourceManager at akka://flink/user/rpc/resourcemanager_1 .
15:33:57,344 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Proposing leadership to contender LeaderContender: DefaultDispatcherRunner
15:33:57,345 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Proposing leadership to contender LeaderContender: StandaloneResourceManager
15:33:57,347 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - ResourceManager akka://flink/user/rpc/resourcemanager_1 was granted leadership with fencing token 99793e5c3d8a81ced62f8a03bd21494c
15:33:57,350 INFO  org.apache.flink.runtime.minicluster.MiniCluster             [] - Flink Mini Cluster started successfully
15:33:57,350 INFO  org.apache.flink.runtime.resourcemanager.slotmanager.SlotManagerImpl [] - Starting the SlotManager.
15:33:57,351 INFO  org.apache.flink.runtime.dispatcher.runner.SessionDispatcherLeaderProcess [] - Start SessionDispatcherLeaderProcess.
15:33:57,353 INFO  org.apache.flink.runtime.dispatcher.runner.SessionDispatcherLeaderProcess [] - Recover all persisted job graphs.
15:33:57,354 INFO  org.apache.flink.runtime.dispatcher.runner.SessionDispatcherLeaderProcess [] - Successfully recovered 0 persisted job graphs.
15:33:57,355 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Received confirmation of leadership for leader akka://flink/user/rpc/resourcemanager_1 , session=d62f8a03-bd21-494c-9979-3e5c3d8a81ce
15:33:57,357 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Connecting to ResourceManager akka://flink/user/rpc/resourcemanager_1(99793e5c3d8a81ced62f8a03bd21494c).
15:33:57,365 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Starting RPC endpoint for org.apache.flink.runtime.dispatcher.StandaloneDispatcher at akka://flink/user/rpc/dispatcher_2 .
15:33:57,378 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Received confirmation of leadership for leader akka://flink/user/rpc/dispatcher_2 , session=0a8eb324-f6f9-44d7-a452-87c855415b0e
15:33:57,387 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Resolved ResourceManager address, beginning registration
15:33:57,393 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - Registering TaskManager with ResourceID a7c681c7-48a2-4491-803a-535036a51fcb (akka://flink/user/rpc/taskmanager_0) at ResourceManager
15:33:57,395 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Successful registration at resource manager akka://flink/user/rpc/resourcemanager_1 under registration id 3e9b649958365e1a080d0b1102807505.
15:33:57,396 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher     [] - Received JobGraph submission c9c27c95a1e3b4a8bfd7250101fa1126 (Flink Java Job at Tue Sep 28 15:33:55 CST 2021).
15:33:57,396 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher     [] - Submitting job c9c27c95a1e3b4a8bfd7250101fa1126 (Flink Java Job at Tue Sep 28 15:33:55 CST 2021).
15:33:57,423 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Starting RPC endpoint for org.apache.flink.runtime.jobmaster.JobMaster at akka://flink/user/rpc/jobmanager_3 .
15:33:57,433 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Initializing job Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126).
15:33:57,452 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Using restart back off time strategy NoRestartBackoffTimeStrategy for Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126).
15:33:57,487 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Running initialization on master for job Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126).
15:33:57,490 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Successfully ran initialization on master in 3 ms.
15:33:57,512 INFO  org.apache.flink.runtime.scheduler.adapter.DefaultExecutionTopology [] - Built 1 pipelined regions in 3 ms
15:33:57,518 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Using failover strategy org.apache.flink.runtime.executiongraph.failover.flip1.RestartPipelinedRegionFailoverStrategy@4fe83a40 for Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126).
15:33:57,527 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Proposing leadership to contender akka://flink/user/rpc/jobmanager_3
15:33:57,528 INFO  org.apache.flink.runtime.jobmaster.JobManagerRunnerImpl      [] - JobManager runner for job Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126) was granted leadership with session id 00c173d1-6a96-47ad-a2d9-da1ebc4d6a41 at akka://flink/user/rpc/jobmanager_3.
15:33:57,532 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Starting execution of job Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126) under job master id a2d9da1ebc4d6a4100c173d16a9647ad.
15:33:57,533 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Starting scheduling with scheduling strategy [org.apache.flink.runtime.scheduler.strategy.PipelinedRegionSchedulingStrategy]
15:33:57,533 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - Job Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126) switched from state CREATED to RUNNING.
15:33:57,537 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1) (2d0c18f32aaefecbd6f3d76a781d54b9) switched from CREATED to SCHEDULED.
15:33:57,537 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - DataSink (collect()) (1/1) (1feb48784b233306f550eda82cf1b5e9) switched from CREATED to SCHEDULED.
15:33:57,546 INFO  org.apache.flink.runtime.jobmaster.slotpool.SlotPoolImpl     [] - Cannot serve slot request, no ResourceManager connected. Adding as pending request [SlotRequestId{1e28fd68790f78b4b48f557e8ba4d92f}]
15:33:57,552 INFO  org.apache.flink.runtime.highavailability.nonha.embedded.EmbeddedLeaderService [] - Received confirmation of leadership for leader akka://flink/user/rpc/jobmanager_3 , session=00c173d1-6a96-47ad-a2d9-da1ebc4d6a41
15:33:57,552 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Connecting to ResourceManager akka://flink/user/rpc/resourcemanager_1(99793e5c3d8a81ced62f8a03bd21494c)
15:33:57,554 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Resolved ResourceManager address, beginning registration
15:33:57,555 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - Registering job manager a2d9da1ebc4d6a4100c173d16a9647ad@akka://flink/user/rpc/jobmanager_3 for job c9c27c95a1e3b4a8bfd7250101fa1126.
15:33:57,559 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - Registered job manager a2d9da1ebc4d6a4100c173d16a9647ad@akka://flink/user/rpc/jobmanager_3 for job c9c27c95a1e3b4a8bfd7250101fa1126.
15:33:57,561 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - JobManager successfully registered at ResourceManager, leader id: 99793e5c3d8a81ced62f8a03bd21494c.
15:33:57,562 INFO  org.apache.flink.runtime.jobmaster.slotpool.SlotPoolImpl     [] - Requesting new slot [SlotRequestId{1e28fd68790f78b4b48f557e8ba4d92f}] and profile ResourceProfile{UNKNOWN} with allocation id d73fe42189235dfaf22a937eb4556ee1 from resource manager.
15:33:57,562 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - Request slot with profile ResourceProfile{UNKNOWN} for job c9c27c95a1e3b4a8bfd7250101fa1126 with allocation id d73fe42189235dfaf22a937eb4556ee1.
15:33:57,565 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Receive slot request d73fe42189235dfaf22a937eb4556ee1 for job c9c27c95a1e3b4a8bfd7250101fa1126 from resource manager with leader id 99793e5c3d8a81ced62f8a03bd21494c.
15:33:57,570 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Allocated slot for d73fe42189235dfaf22a937eb4556ee1.
15:33:57,571 INFO  org.apache.flink.runtime.taskexecutor.DefaultJobLeaderService [] - Add job c9c27c95a1e3b4a8bfd7250101fa1126 for job leader monitoring.
15:33:57,573 INFO  org.apache.flink.runtime.taskexecutor.DefaultJobLeaderService [] - Try to register at job manager akka://flink/user/rpc/jobmanager_3 with leader id 00c173d1-6a96-47ad-a2d9-da1ebc4d6a41.
15:33:57,574 INFO  org.apache.flink.runtime.taskexecutor.DefaultJobLeaderService [] - Resolved JobManager address, beginning registration
15:33:57,577 INFO  org.apache.flink.runtime.taskexecutor.DefaultJobLeaderService [] - Successful registration at job manager akka://flink/user/rpc/jobmanager_3 for job c9c27c95a1e3b4a8bfd7250101fa1126.
15:33:57,578 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Establish JobManager connection for job c9c27c95a1e3b4a8bfd7250101fa1126.
15:33:57,580 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Offer reserved slots to the leader of job c9c27c95a1e3b4a8bfd7250101fa1126.
15:33:57,588 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1) (2d0c18f32aaefecbd6f3d76a781d54b9) switched from SCHEDULED to DEPLOYING.
15:33:57,590 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - Deploying CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1) (attempt #0) with attempt id 2d0c18f32aaefecbd6f3d76a781d54b9 to a7c681c7-48a2-4491-803a-535036a51fcb @ localhost (dataPort=-1) with allocation id d73fe42189235dfaf22a937eb4556ee1
15:33:57,595 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - DataSink (collect()) (1/1) (1feb48784b233306f550eda82cf1b5e9) switched from SCHEDULED to DEPLOYING.
15:33:57,595 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - Deploying DataSink (collect()) (1/1) (attempt #0) with attempt id 1feb48784b233306f550eda82cf1b5e9 to a7c681c7-48a2-4491-803a-535036a51fcb @ localhost (dataPort=-1) with allocation id d73fe42189235dfaf22a937eb4556ee1
15:33:57,595 INFO  org.apache.flink.runtime.taskexecutor.slot.TaskSlotTableImpl [] - Activate slot d73fe42189235dfaf22a937eb4556ee1.
15:33:57,627 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Received task CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 (2d0c18f32aaefecbd6f3d76a781d54b9), deploy into slot with allocation id d73fe42189235dfaf22a937eb4556ee1.
15:33:57,628 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 (2d0c18f32aaefecbd6f3d76a781d54b9) switched from CREATED to DEPLOYING.
15:33:57,630 INFO  org.apache.flink.runtime.taskexecutor.slot.TaskSlotTableImpl [] - Activate slot d73fe42189235dfaf22a937eb4556ee1.
15:33:57,630 INFO  org.apache.flink.runtime.taskexecutor.slot.TaskSlotTableImpl [] - Activate slot d73fe42189235dfaf22a937eb4556ee1.
15:33:57,633 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - Loading JAR files for task CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 (2d0c18f32aaefecbd6f3d76a781d54b9) [DEPLOYING].
15:33:57,634 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - Registering task at network: CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 (2d0c18f32aaefecbd6f3d76a781d54b9) [DEPLOYING].
15:33:57,642 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Received task DataSink (collect()) (1/1)#0 (1feb48784b233306f550eda82cf1b5e9), deploy into slot with allocation id d73fe42189235dfaf22a937eb4556ee1.
15:33:57,642 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - DataSink (collect()) (1/1)#0 (1feb48784b233306f550eda82cf1b5e9) switched from CREATED to DEPLOYING.
15:33:57,643 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - Loading JAR files for task DataSink (collect()) (1/1)#0 (1feb48784b233306f550eda82cf1b5e9) [DEPLOYING].
15:33:57,644 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - Registering task at network: DataSink (collect()) (1/1)#0 (1feb48784b233306f550eda82cf1b5e9) [DEPLOYING].
15:33:57,647 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 (2d0c18f32aaefecbd6f3d76a781d54b9) switched from DEPLOYING to RUNNING.
15:33:57,648 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - DataSink (collect()) (1/1)#0 (1feb48784b233306f550eda82cf1b5e9) switched from DEPLOYING to RUNNING.
15:33:57,648 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1) (2d0c18f32aaefecbd6f3d76a781d54b9) switched from DEPLOYING to RUNNING.
15:33:57,649 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - DataSink (collect()) (1/1) (1feb48784b233306f550eda82cf1b5e9) switched from DEPLOYING to RUNNING.
15:33:57,659 WARN  org.apache.flink.metrics.MetricGroup                         [] - The operator name DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) exceeded the 80 characters length limit and was truncated.
15:33:57,667 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 (2d0c18f32aaefecbd6f3d76a781d54b9) switched from RUNNING to FINISHED.
15:33:57,667 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - Freeing task resources for CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 (2d0c18f32aaefecbd6f3d76a781d54b9).
15:33:57,670 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Un-registering task and sending final execution state FINISHED to JobManager for task CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1)#0 2d0c18f32aaefecbd6f3d76a781d54b9.
15:33:57,677 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - CHAIN DataSource (at main(BatchJob.java:43) (org.apache.flink.api.java.io.CollectionInputFormat)) -> FlatMap (FlatMap at main(BatchJob.java:45)) (1/1) (2d0c18f32aaefecbd6f3d76a781d54b9) switched from RUNNING to FINISHED.
15:33:57,678 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - DataSink (collect()) (1/1)#0 (1feb48784b233306f550eda82cf1b5e9) switched from RUNNING to FINISHED.
15:33:57,678 INFO  org.apache.flink.runtime.taskmanager.Task                    [] - Freeing task resources for DataSink (collect()) (1/1)#0 (1feb48784b233306f550eda82cf1b5e9).
15:33:57,679 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Un-registering task and sending final execution state FINISHED to JobManager for task DataSink (collect()) (1/1)#0 1feb48784b233306f550eda82cf1b5e9.
15:33:57,682 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - DataSink (collect()) (1/1) (1feb48784b233306f550eda82cf1b5e9) switched from RUNNING to FINISHED.
15:33:57,685 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph       [] - Job Flink Java Job at Tue Sep 28 15:33:55 CST 2021 (c9c27c95a1e3b4a8bfd7250101fa1126) switched from state RUNNING to FINISHED.
15:33:57,691 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher     [] - Job c9c27c95a1e3b4a8bfd7250101fa1126 reached globally terminal state FINISHED.
15:33:57,691 INFO  org.apache.flink.runtime.minicluster.MiniCluster             [] - Shutting down Flink Mini Cluster
15:33:57,691 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint   [] - Shutting down rest endpoint.
15:33:57,691 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Stopping TaskExecutor akka://flink/user/rpc/taskmanager_0.
15:33:57,692 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Close ResourceManager connection 01714233597d70de71bbfbda09ac665e.
15:33:57,692 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - Closing TaskExecutor connection a7c681c7-48a2-4491-803a-535036a51fcb because: The TaskExecutor is shutting down.
15:33:57,693 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Close JobManager connection for job c9c27c95a1e3b4a8bfd7250101fa1126.
15:33:57,694 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Stopping the JobMaster for job Flink Java Job at Tue Sep 28 15:33:55 CST 2021(c9c27c95a1e3b4a8bfd7250101fa1126).
15:33:57,695 INFO  org.apache.flink.runtime.taskexecutor.slot.TaskSlotTableImpl [] - Free slot TaskSlot(index:0, state:ALLOCATED, resource profile: ResourceProfile{managedMemory=128.000mb (134217728 bytes), networkMemory=64.000mb (67108864 bytes)}, allocationId: d73fe42189235dfaf22a937eb4556ee1, jobId: c9c27c95a1e3b4a8bfd7250101fa1126).
15:33:57,697 INFO  org.apache.flink.runtime.jobmaster.slotpool.SlotPoolImpl     [] - Suspending SlotPool.
15:33:57,697 INFO  org.apache.flink.runtime.jobmaster.JobMaster                 [] - Close ResourceManager connection 01714233597d70de71bbfbda09ac665e: Stopping JobMaster for job Flink Java Job at Tue Sep 28 15:33:55 CST 2021(c9c27c95a1e3b4a8bfd7250101fa1126)..
15:33:57,697 INFO  org.apache.flink.runtime.jobmaster.slotpool.SlotPoolImpl     [] - Stopping SlotPool.
15:33:57,697 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - Disconnect job manager a2d9da1ebc4d6a4100c173d16a9647ad@akka://flink/user/rpc/jobmanager_3 for job c9c27c95a1e3b4a8bfd7250101fa1126 from the resource manager.
15:33:57,699 INFO  org.apache.flink.runtime.taskexecutor.DefaultJobLeaderService [] - Stop job leader service.
15:33:57,699 INFO  org.apache.flink.runtime.state.TaskExecutorLocalStateStoresManager [] - Shutting down TaskExecutorLocalStateStoresManager.
good
good
study
day
day
up
15:33:57,725 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint   [] - Removing cache directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/flink-web-ui
15:33:57,727 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint   [] - Shut down complete.
15:33:57,729 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager [] - Shut down cluster because application is in CANCELED, diagnostics DispatcherResourceManagerComponent has been closed..
15:33:57,729 INFO  org.apache.flink.runtime.io.disk.FileChannelManagerImpl      [] - FileChannelManager removed spill file directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/flink-io-dc01cff1-6b52-43ed-9d16-9085f49c732e
15:33:57,730 INFO  org.apache.flink.runtime.io.network.NettyShuffleEnvironment  [] - Shutting down the network environment and its components.
15:33:57,730 INFO  org.apache.flink.runtime.entrypoint.component.DispatcherResourceManagerComponent [] - Closing components.
15:33:57,730 INFO  org.apache.flink.runtime.dispatcher.runner.SessionDispatcherLeaderProcess [] - Stopping SessionDispatcherLeaderProcess.
15:33:57,730 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher     [] - Stopping dispatcher akka://flink/user/rpc/dispatcher_2.
15:33:57,731 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher     [] - Stopping all currently running jobs of dispatcher akka://flink/user/rpc/dispatcher_2.
15:33:57,731 INFO  org.apache.flink.runtime.resourcemanager.slotmanager.SlotManagerImpl [] - Closing the SlotManager.
15:33:57,731 INFO  org.apache.flink.runtime.resourcemanager.slotmanager.SlotManagerImpl [] - Suspending the SlotManager.
15:33:57,731 INFO  org.apache.flink.runtime.rest.handler.legacy.backpressure.BackPressureRequestCoordinator [] - Shutting down back pressure request coordinator.
15:33:57,731 INFO  org.apache.flink.runtime.io.disk.FileChannelManagerImpl      [] - FileChannelManager removed spill file directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/flink-netty-shuffle-41571afb-b13e-494b-b937-0696d2c77ca1
15:33:57,732 INFO  org.apache.flink.runtime.taskexecutor.KvStateService         [] - Shutting down the kvState service and its components.
15:33:57,732 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher     [] - Stopped dispatcher akka://flink/user/rpc/dispatcher_2.
15:33:57,732 INFO  org.apache.flink.runtime.taskexecutor.DefaultJobLeaderService [] - Stop job leader service.
15:33:57,734 INFO  org.apache.flink.runtime.filecache.FileCache                 [] - removed file cache directory /var/folders/zq/2b48w4_x5vq89_jrz3yns13h0000gn/T/flink-dist-cache-fc4fd5a1-79fa-4a19-8d7d-f3072006c91e
15:33:57,735 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           [] - Stopped TaskExecutor akka://flink/user/rpc/taskmanager_0.
15:33:57,735 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Stopping Akka RPC service.
15:33:57,760 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Stopping Akka RPC service.
15:33:57,760 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Stopped Akka RPC service.
15:33:57,766 INFO  org.apache.flink.runtime.blob.PermanentBlobCache             [] - Shutting down BLOB cache
15:33:57,768 INFO  org.apache.flink.runtime.blob.TransientBlobCache             [] - Shutting down BLOB cache
15:33:57,772 INFO  org.apache.flink.runtime.blob.BlobServer                     [] - Stopped BLOB server at 0.0.0.0:58212
15:33:57,772 INFO  org.apache.flink.runtime.rpc.akka.AkkaRpcService             [] - Stopped Akka RPC service.
```

![newproject12](/images/大数据/newproject12.png)

可以看到，我们的代码已经执行，并且生效。这样子我们的开发环境就搭建完毕了。其他的基本大同小异，如需记录，后面会额外的篇章进行记录。

## 项目打包并提交Flink集群执行

直到刚才为止，我们都是本地开发的模式，但是如果要在生产环境运行，那么我们需要打包成jar，然后借助flink-client提交job图对象给flink-job-manager，然后再分发给各个的taskManager进行执行。

所以这里我们需要打包出`jar`包。

我们使用Maven的`mvn clean package`命令可以很方便地进行打包。

如果需要额外指定一些内容的话，可以使用`mvn clean package -Dfile.encoding=UTF-8 -DskipTests=true`，这样子可以忽略测试阶段。


利用docker

- 构架一个flink1.12的集群
- 构建一个maven工具，版本3.6.3（由于idea采用的是内置的maven，这是是一个独立的jar包，所以外部无法直接引用mvn命令）

```shell
docker pull flink:1.12-scala_2.11-java8
docker pull maven:3.6.3
```

在代码目录下打包出jar包

> 记得打包成`生成环境的jar包`的时候，把`<scope />`改回 `provided`, 也就是把注释取消掉。

```shell
➜  my-flink-jdk11 docker run --rm -it -v  ~/.m2:/root/.m2 -v $(PWD):/www -w /www maven:3.6.3 mvn clean package
[INFO] Scanning for projects...
[INFO] 
[INFO] ----------------------< my-flink:my-flink-jdk11 >-----------------------
[INFO] Building Flink Quickstart Job 1.0-SNAPSHOT
[INFO] --------------------------------[ jar ]---------------------------------
[INFO] 
[INFO] --- maven-clean-plugin:2.5:clean (default-clean) @ my-flink-jdk11 ---
[INFO] Deleting /www/target
[INFO] 
[INFO] --- maven-resources-plugin:2.6:resources (default-resources) @ my-flink-jdk11 ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] Copying 1 resource
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:compile (default-compile) @ my-flink-jdk11 ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 2 source files to /www/target/classes
[INFO] 
[INFO] --- maven-resources-plugin:2.6:testResources (default-testResources) @ my-flink-jdk11 ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] skip non existing resourceDirectory /www/src/test/resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:testCompile (default-testCompile) @ my-flink-jdk11 ---
[INFO] No sources to compile
[INFO] 
[INFO] --- maven-surefire-plugin:2.12.4:test (default-test) @ my-flink-jdk11 ---
[INFO] No tests to run.
[INFO] 
[INFO] --- maven-jar-plugin:2.4:jar (default-jar) @ my-flink-jdk11 ---
[INFO] Building jar: /www/target/my-flink-jdk11-1.0-SNAPSHOT.jar
[INFO] 
[INFO] --- maven-shade-plugin:3.1.1:shade (default) @ my-flink-jdk11 ---
[INFO] Excluding org.slf4j:slf4j-api:jar:1.7.15 from the shaded jar.
[INFO] Excluding org.apache.logging.log4j:log4j-slf4j-impl:jar:2.12.1 from the shaded jar.
[INFO] Excluding org.apache.logging.log4j:log4j-api:jar:2.12.1 from the shaded jar.
[INFO] Excluding org.apache.logging.log4j:log4j-core:jar:2.12.1 from the shaded jar.
[INFO] Replacing original artifact with shaded artifact.
[INFO] Replacing /www/target/my-flink-jdk11-1.0-SNAPSHOT.jar with /www/target/my-flink-jdk11-1.0-SNAPSHOT-shaded.jar
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  8.988 s
[INFO] Finished at: 2021-09-28T08:30:35Z
[INFO] ------------------------------------------------------------------------
```

转移就构建成功了。

在`target`目录下查看`jar包`

```shell
➜  my-flink-jdk11 ll target/my-flink-jdk11-1.0-SNAPSHOT.jar 
-rw-r--r--  1 caiwenhui  staff   6.6K Sep 28 16:30 target/my-flink-jdk11-1.0-SNAPSHOT.jar
```

同样把代码目录挂载进flink容器，然后构建flink容器（此步骤只要是拿到target目录下的jar包，如果你指定了其他路径换个挂载目录也可以）

```shell
docker run -it --name flinkc --privileged  -w /www -v$(PWD):/www flink:1.12-scala_2.11-java8 bash
```

进到容器后，启动单机版flink集群

```shell
flink@ed5e7ea28514:/www$ start-cluster.sh
Starting cluster.
Starting standalonesession daemon on host ed5e7ea28514.
Starting taskexecutor daemon on host ed5e7ea28514
```

```
flink@ed5e7ea28514:/www$ flink run --class my.flink.BatchJob ./target/my-flink-jdk11-1.0-SNAPSHOT.jar
Job has been submitted with JobID ca99d6d7ef6f913ac334d7123d63658b
Program execution finished
Job with JobID ca99d6d7ef6f913ac334d7123d63658b has finished.
Job Runtime: 187 ms
Accumulator Results:
- 40a6a5d6af948dba01cbb7bee71f2d4e (java.util.ArrayList) [6 elements]


good
good
study
day
day
up
```

可以看到，可以这个结果和我们再IDEA执行的结果一致，所以开发环境搭建完毕。后面的篇章将会是具体的流计算内容。
