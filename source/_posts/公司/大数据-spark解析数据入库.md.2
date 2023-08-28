---
title: 大数据-spark解析数据入库
date: 2022-06-08 18:52:40
categories: [大数据]
tags: [大数据, 公司]
---

## 前言

最近在处理原始日志入库的操作，由于这个不是一个常态化的需求，是一些日志的数据，所以和我们常规的日志存储不同，不经过`text`数据的存储，直接存储为`orc`的格式。

并且以往解析都是通过java的hadoop的map-reduce的api的去操作解析数据，这次采用`spark`来对数据进行解析，提高解析的速度。

<!-- more -->


### parse_s2s

```shell
#!/bin/bash

source ./config.sh

yyyy=$(echo ${yyyy_mm_dd_hh} | awk -F- '{print $1}')
mm=$(echo ${yyyy_mm_dd_hh} | awk -F- '{print $2}')
dd=$(echo ${yyyy_mm_dd_hh} | awk -F- '{print $3}')
hh=$(echo ${yyyy_mm_dd_hh} | awk -F- '{print $4}')

# 所有地区，例如singapore
area='*'
if [[ ! ${is_day} == "0" ]];then
    hh='*'
fi

input_path="${LOG_TRACKING_S2S_PATH}/${yyyy}/${mm}/${dd}/${hh}/${area}/"
output_path="${HIVE_DB_PATH}/${T_UPARPU_S2S}/"

dt=${yyyy_mm_dd_hh}
if [[ ! ${is_day} == "0" ]];then
    dt=${yyyy_mm_dd}
fi

spark-submit --class com.xx.spark.jobs.parse.S2sParsingJob \
  --name "xx_S2sParsingJob_dt${dt}" \
  --master yarn \
  --deploy-mode cluster \
  --executor-memory "${SPARK_EXECUTOR_MEMORY}" \
  --driver-memory "${SPARK_DRIVER_MEMORY}" \
  --executor-cores 2 \
  --num-executors "${SPARK_NUM_EXECUTORS}" \
  --conf spark.dynamicAllocation.enabled=false \
  --conf spark.dynamicAllocation.minExecutors=8 \
  --conf spark.dynamicAllocation.maxExecutors=32 \
  --conf spark.core.connection.ack.wait.timeout=3000 \
  --files "${HIVE_SITE_PATH}" \
  ${SPARK_SQL_JAR} "${CLIENT_TMP_LOG_PATH}" "${dt}" "${input_path}" "${output_path}"

hive -e "
    use ${DB_UPARPU};
    MSCK REPAIR TABLE ${T_UPARPU_S2S};
"
```

脚本很简单，只是一些参数的调整以及数据写入到`oss`后，对hive的数据进行可以重新修复分区的行为。

### S2sParsingJob

我们主要看一下这个和spark相关的`scala`以及`java`的代码部分。

```scala
package com.xx.spark.jobs.parse

import com.xx.spark.beans.S2sBean
import com.xx.spark.json.S2sParsing
import org.apache.spark.sql.types.{StringType, StructType}
import org.apache.spark.sql.{Row, SaveMode, SparkSession}
import org.apache.spark.sql.types.StructField

object S2sParsingJob {
  def main(args: Array[String]): Unit = {
    val tmpPath = args(0)
    val dt = args(1)
    val inputPath = args(2)
    var outputPath = args(3)

    val spark: SparkSession = SparkSession.builder
      .master("yarn") // avoid hardcoding the deployment environment
      .enableHiveSupport() // self-explanatory, isn't it?
      .config("spark.sql.warehouse.dir", tmpPath)
      .getOrCreate()

    val lineRDD = spark.sparkContext.textFile(inputPath)

    val beans = lineRDD
      .map(line => S2sParsing.map(line))

    val dts = dt.split("-")
    var yyyy = "0000"
    var mm = "00"
    var dd = "00"
    var hh = "25"
    yyyy = if (dts.nonEmpty) {
      dts(0)
    } else {
      "0000"
    }
    mm = if (dts.length > 1) {
      dts(1)
    } else {
      "00"
    }
    dd = if (dts.length > 2) {
      dts(2)
    } else {
      "00"
    }
    hh = if (dts.length > 3) {
      dts(3)
    } else {
      "25"
    }

    outputPath = dts.length match {
      case 1 => outputPath + "/yyyy=" + yyyy
      case 2 => outputPath + "/yyyy=" + yyyy + "/mm=" + mm
      case 3 => outputPath + "/yyyy=" + yyyy + "/mm=" + mm + "/dd=" + dd
      case 4 => outputPath + "/yyyy=" + yyyy + "/mm=" + mm + "/dd=" + dd + "/hh=" + hh
    }

    val values = beans.map(bean => S2sBean.transfer(bean))
      // 不依赖time解析，重置分区属性
      // 如果传递的是2022-06-08，那么hh的分区由time解析获得
      .map(bean => {
        if (dts.length > 3) {
          bean.hh = hh
        }
        if (dts.length > 2) {
          bean.dd = dd
        }
        if (dts.length > 1) {
          bean.mm = mm
        }
        if (dts.nonEmpty) {
          bean.yyyy = yyyy
        }
        bean
      })
      .map(bean => S2sParsing.extractValueToArray(bean))

    val fields = S2sParsing.extractKeyToArray(beans.first())
      .map(fieldName => StructField(fieldName, StringType, nullable = true))
    val schema = StructType(fields)

    val requiredNumberOfFields = schema.fieldNames.length
    val rowRDD = values.map(line => {
      Row.fromSeq(appendDummyData(line, requiredNumberOfFields).toSeq)
    })

    val lineDF = spark.createDataFrame(rowRDD, schema)
    //        lineDF.show()

    val partition = S2sBean.getPartitionBy(dts.length)
    lineDF.write
      .partitionBy(partition: _*)
      .mode(SaveMode.Overwrite)
      .option("orc.compress", "zlib")
      .orc(outputPath)

    spark.stop()
  }

  def appendDummyData(row: Array[String], len: Int): Array[String] = row.length == len match {
    case true => row
    case false => if (len > row.length) {
      val add = (for (loop <- 1 to len - row.length) yield "unknow").toArray
      row ++ add
    } else row.take(len)
  }
}
```

这一段的`scala`代码也比较简洁，主要涉及到几个参数

- 临时目录路径
- 日期时间
- 数据源的路径
- 清洗后数据输出路径

有意思的是，这里看到有一个`appendDummyData`的方法，该方法是用于对比`schema.fieldNames.length`用到，当从`javabean`中提取的`fields`个数和`values`个数不一致的时候，通过这个方法，可以给我们对齐数据量，防止程序报错，如果数据少了，则追加`unknow`值，如果数据多了，则追加最后一个元素的值。

其次，我们看到以下一段代码：

```scala
 val partition = S2sBean.getPartitionBy(dts.length)
    lineDF.write
      .partitionBy(partition: _*)
```

这一部分的代码，是用于获取`partition分区`用的，通过dts的长度，我们调整了output的路径和分区的信息，做到了不管是跑一天的数据，还是跑每个小时的数据，都确保了无关的数据不会被删除掉。

并且通过`scala`的`可变参数语法` `:_*`，对 `String*` 这种参数进行动态传参，从而实现了代码的简洁性操作。

另外，接下里，最核心的其实还是我们的javabean

### S2sBean

```java

public class S2sBean extends AbstractExtract implements java.io.Serializable {
    public String time;
    public CommonBean common;
    public DataBean data;
    public String callbackUrl;

    public String yyyy;
    public String mm;
    public String dd;
    public String hh;

    public static S2sBean transfer(S2sBean s2sBean) {
        if (s2sBean.time == null) {
            s2sBean.time = "0";
        }

        SimpleDateFormat reformat = new SimpleDateFormat("yyyy MM dd HH");
        reformat.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));

        String formatDate = reformat.format(new Date(Integer.parseInt(s2sBean.time) * 1000L));
        String[] DateArr = formatDate.split(" ");

        s2sBean.yyyy = DateArr[0];
        s2sBean.mm = DateArr[1];
        s2sBean.dd = DateArr[2];
        s2sBean.hh = DateArr[3];
        return s2sBean;
    }

    public static String[] getPartitionBy() {
        return new String[]{"yyyy", "mm", "dd", "hh"};
    }

    public static String[] getPartitionBy(int offset) {
        String[] partitions = new String[]{"yyyy", "mm", "dd", "hh"};
        ArrayList<String> partitionList = new ArrayList<>(Arrays.asList(partitions));
        while (offset > 0) {
            partitionList.remove(0);
            offset--;
        }
        String[] newPartition = new String[partitionList.size()];
        partitionList.toArray(newPartition);
        return newPartition;
    }
}

class CommonBean extends AbstractExtract implements java.io.Serializable {

    public static class CustomBean extends AbstractExtract implements java.io.Serializable {
        public String userCustomData;
        public String userId;
    }

    public String appId;
    public String system;
    public String platform;
    public String osVn;
    public String osVc;
    public String packageName;
    public String appVn;
    public String appVc;
    public String brand;
    public String model;
    public String screen;
    public String networkType;
    public String mnc;
    public String mcc;
    public String language;
    public String timezone;
    public String sdkVer;
    public String gpVer;
    public String ua;
    public String orient;
    public String upid;
    public String androidId;
    public String gaid;
    public String gdprCs;
    public String isCnSdk;
    public String itSrc;
    public String abtestId;
    public String firstInitTime;
    public String daysFromFirstInit;
    public CustomBean custom;
}

class DataBean extends AbstractExtract implements java.io.Serializable {
    public String plId;
    public String reqId;
    public String showId;
    public String unitId;
    public String nwFirmId;
    public String scenarioId;
    public String rvStartTs;
    public String rCallbackTs;
    public String rvPlayDur;
    public String currTs;
    public String ilrd;
}


abstract class AbstractExtract {
    public static <T> ArrayList<String> extractValue(T bean) {
        ArrayList<String> rs = new ArrayList<>();
        try {
            Class<?> c = bean.getClass();
            Field[] fields = c.getDeclaredFields();
            for (Field f : fields) {
                f.setAccessible(true);
                Object oo = f.get(bean);
                if (oo == null) {
                    if (f.getType().getName().contains("xx")) {
                        Class<?> clazz = Class.forName(f.getType().getName());
                        oo = clazz.getDeclaredConstructor().newInstance();
                    } else {
                        oo = "";
                    }
                }
                if (oo.getClass().getSuperclass().getName().equals(Thread.currentThread().getStackTrace()[1].getClassName())) {
                    try {
                        Method method = oo.getClass().getSuperclass().getDeclaredMethod(Thread.currentThread().getStackTrace()[1].getMethodName(), Object.class);
                        rs.addAll((ArrayList<String>) method.invoke(oo, oo));
                    } catch (NoSuchMethodException | InvocationTargetException e) {
                        e.printStackTrace();
                    }
                } else {
                    rs.add((String) oo);
                }
            }
        } catch (IllegalAccessException | ClassNotFoundException | InstantiationException | NoSuchMethodException | InvocationTargetException e) {
            e.printStackTrace();
        }

        return rs;
    }

    public static <T> ArrayList<String> extractKey(T bean) {
        ArrayList<String> rs = new ArrayList<>();
        try {
            Class<?> c = bean.getClass();
            Field[] fields = c.getDeclaredFields();
            for (Field f : fields) {
                f.setAccessible(true);
                Object o = f.get(bean);
                if (o == null) {
                    if (f.getType().getName().contains("topon")) {
                        Class<?> clazz = Class.forName(f.getType().getName());
                        o = clazz.getDeclaredConstructor().newInstance();
                    } else {
                        o = "";
                    }
                }
                if (o.getClass().getSuperclass().getName().equals(Thread.currentThread().getStackTrace()[1].getClassName())) {
                    try {
                        Method method = o.getClass().getSuperclass().getDeclaredMethod(Thread.currentThread().getStackTrace()[1].getMethodName(), Object.class);
                        rs.addAll((ArrayList<String>) method.invoke(o, o));
                    } catch (NoSuchMethodException | InvocationTargetException e) {
                        e.printStackTrace();
                    }
                } else {
                    rs.add(StrUtil.camelToSnake(f.getName()));
                }
            }
        } catch (IllegalAccessException | ClassNotFoundException | NoSuchMethodException | InstantiationException | InvocationTargetException e) {
            e.printStackTrace();
        }
        return rs;
    }

    public String toString() {
        return com.alibaba.fastjson.JSON.toJSONString(this);
    }
}

```

我们知道，在正常场景下，我们一个`bean对象`其实就是一个数据载体，他包含了必要的数据字段，并且我们的日志一般多为结构化的数据，所以这里的`javaBean` 通过实现对应的结构化，通过json 的转化，可以快速的实力化javabean，但是由于我们存储数据的时候，都是`一维`数据，所以，需要对数据进行扁平化处理，在这里，我们只需要简单的提取出来即可，不需要加任何的前缀，所以这里没有做过多的特殊处理。

我们主要观看`abstract class AbstractExtract`，通过这个类，我们通过 `extractValue()` , `extractKey()`，可以拿到javabean下的所有属性和所有属性值。该方法的原理是通过java的`反射`和`递归`实现的，和我以前实现的`kafka-swoole`的协议实现差不多思路。但是在这里更重要的一个原因是因为我不想写太多重复的字段，我觉得那些字段在代码层面上，都应该只写一次才合理，如果重复写了或者直接通过静态代码写死的方式，在后续想修改代码是很麻烦的一个事情，所以通过这种方式，后续不管是否需要加字段去解析，我都只需要找到对应的结构体下的类，添加或者删除一个字段即可，为后续的大大减少的工作量而考虑。

经过测试，通过spark解析数据再到写入orc和分区处理，整个过程处理`2k万条（每条数据大概在3.3kb）`的数据大概需要10分钟即可。所以处理数据的一个tps是在`33k/s`左右。