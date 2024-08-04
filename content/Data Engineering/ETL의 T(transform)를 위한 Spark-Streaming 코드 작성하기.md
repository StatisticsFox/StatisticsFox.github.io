---
emoji: 😮
title: ETL의 T(transform)를 위한 Spark-Streaming 코드 작성하기
date: '2024-08-03 18:18:21'
author: 최지혁
tags: ETL Spark-Streaming
categories: Data_Engineering
---
## 들어가기에 앞서..
요새는 학교 과제를 위한 따릉이 대시보드가 아닌 한이음 ICT 공모전을 위한 따릉이 실시간 대시보드 구축을 진행중이다. 원래는 카프카로 데이터를 producing 하자마자 스피드레이어를 구축해서 대시보드에 마이크로 배치 형태로 실시간 대시보드를 구축했다면 이번에는 대시보드를 더 고도화하기 위해 Spark를 이용해 한번 형태 변환을 하고 S3에 적제하는 과정을 거져봤다. 

즉, 아키텍쳐의 변화가 다음과 같다.
#### 이전 아키텍쳐
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/UQOSHPiMvlbtIICdzgAAAAAAALbDIYVRTxIVsFE?width=2400&height=868 alt="아키텍쳐" />
</div>

#### 변경 후 아키텍쳐
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNJRKls7yGMSJpXC5w6SHexAcdcMmCo1u9rPOT7osYAtOQ?width=2918&height=1186 alt="아키텍쳐" />
</div>

좀 많이 힘써봤다. 단순하게 실시간 모니터링만 하는 대시보드는 식상하기도 하고 솔직히 요즘 같이 Chatgpt가 발달한 시대에 그 정도 못만드는 사람 없을 것이다. 다만 이렇게 클라우안에서 다양한 툴과 함께 서비스를 제작한다는 것은 또 다른 개념이라 그 의미가 크다. 나는 위 아키텍쳐에서 <font color="#c00000">카프카로부터 데이터를 실시간으로 받아 SPARK에서 변환 후 S3에 실시간으로 적제하는 Spark-Streaming 코드</font>를 이번에 작성해봤다.~~(사실 아직 개발 중!)~~ <br>
그럼 이제 시작해보자
<div align="center">
    <img src= https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21211&authkey=%21AInaQqp_g1hhKd0&width=564&height=311 alt="시작해보자" />
</div>

## SQL VS DataframeAPI VS 무지성 코딩
자 SPARK를 파이썬으로 작성할 경우 많은 선택지가 있으니... 바로 spark_sql 혹은 dataframe_api 둘 중 무었을 쓸지다.[(이 둘 간의 비교는 이미 노션에 정리 함. 참고!)](https://statisticsfox.notion.site/Spark-RDD-DataFrame-SQL-77b20bc7a90d4c709a002ad75542b396?pvs=4)
<br>

무지성 코딩은 그럼 왜 넣었냐! 내가 처음에 무지성으로 코딩을 했었다. 바로 collect()함수로만 모든 집계를 처리한것이다.😱😱 그럼 절대 안된다. 
> spark에는 Driver와 excutor가 있는데 다음과 같은 역할을 함. <br>
>- driver: 일감(TASK)이 들어오면 excuter에게 일감을 던져준다. <br>
>- excuter: 들어온 일을 처리하고 일한 결과를 driver에게 반환하는 역할을 한다.

근데 collect()함수로만 모든 집계를 처리한다는 것은 driver가 모든 일을 다하도록 코딩한다는 뜻이다. 즉, 사장님이 알바 뽑았는데 알바 놔두고 자기 혼자 일 다하는 꼴이다.💀 이러면 병렬 연산의 장점도 없을 뿐더러 SPARK의 장점들이 아무짝에도 쓸모 없어져 버린다.~~(근데 본인은 초반에 아런 멍청한 짓을 저지름ㅋㅅㅋ)~~ <br>

그래서 우리는 SQL엔진 혹은 Dataframe api를 활용해서 데이터를 집계 해야한다. 또한 이 둘을 사용하면 카탈리스트 옵티마이저라고 Spark 내에서 최적화 및 계획을 수립해 주기에 최선의 결과와 속도를 얻을 수 있다. 자세한 내용은 위 링크를 참고하자.

## 그렇게 선정된 SQL
나는  Spark SQL을 사용하기로 했다. 사실 나는 SQL 보다는 DataFrameAPI를 더 선호한다. 그 이유는 다음과 같다.
1. DataFrame api는 오류가 났을 경우 컴파일 하기 용이하다.
2. 현재 변환하려고 하는 형식은 크게 복잡한 구조가 아니기에 엄청 간단하게 질의할 수 있다. <br>
3. SQL은 쿼리를 짜도 에러가 나면 그냥 쿼리에 문제가 있다고 알려주지 쿼리 어디서 문제가 있는지 알려주지 않는다.

정도 되시겠다. 내가 Spark에서 쿼리를 기이이일게 짰을때 오류가 나면 "그냥 쿼리에 오류가 있다."정도만 표시 되기에 쿼리가 길면 컴파일이 어려워진다. 다만 데이터 프레임은 어디서 오류가 났는지 컴파일이 비교적 명확하고 그렇기에 테스크 별로 모듈화하기가 엄청 좋다. <br>
다만 이번에는 나는 1시간 단위로 집계를 해야 한다. SQL에는 window라는 기능이 있는데 이를 1hour로 설정해주면 내가 수동으로 비교해주지 않아도 자기내들 알아서 1시간 단위로 데이터를 집계해 준다. 


## 코드를 살펴보자
### 무지성 코딩
```python
def update_state(batch_df, batch_id):
    global state, current_hour, batch_accumulator

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)

    if current_hour is None:
        current_hour = now

    # 새로운 시간 창에 들어서면 이전 데이터 집계 및 초기화
    if now != current_hour:
    
        if batch_accumulator:
            result_df = spark.createDataFrame(batch_accumulator, schema=["stationId", "event_time", "parkingBikeTotCnt", "return", "rental"])
            hourly_summary = result_df.groupBy("stationId").agg(
                F.sum("rental").alias("total_rental"),
                F.sum("return").alias("total_return")
            ).withColumn("hour", F.lit(current_hour))

            previous_hour = current_hour - timedelta(hours=2)

            year = previous_hour.strftime('%Y')
            month = previous_hour.strftime('%m')
            day = previous_hour.strftime('%d')
            hour = previous_hour.strftime('%H')

            bucket_name = 'ddareungidatabucket'
            folder_name = 'hourly_summary'
            path = f"s3a://{bucket_name}/{folder_name}/{year}/{month}/{day}/{hour}"
            hourly_summary.repartition(1).write.mode("overwrite").parquet(path)

            hourly_summary.orderBy("stationId").show()

            batch_accumulator = []

        current_hour = now

    batch_data = batch_df.collect() 

    changes = []
    for row in batch_data:
        station_id = row.stationId
        current_count = row.parkingBikeTotCnt
        event_time = row.event_time

        if station_id in state:
            previous_count = state[station_id]
            change = current_count - previous_count
            if change > 0:
                changes.append((station_id, event_time, current_count, change, 0))
                batch_accumulator.append((station_id, event_time, current_count, change, 0))
            elif change < 0:
                changes.append((station_id, event_time, current_count, 0, -change))
                batch_accumulator.append((station_id, event_time, current_count, 0, -change))
            else:
                changes.append((station_id, event_time, current_count, 0, 0))
        else:
            changes.append((station_id, event_time, current_count, 0, 0))
            batch_accumulator.append((station_id, event_time, current_count, 0, 0))

        state[station_id] = current_count


    if changes:
        result_df = spark.createDataFrame(changes, schema=["stationId","event_time", "parkingBikeTotCnt", "return", "rental"])
        result_df.show()
```

위에는 내가 무지성으로 코딩한 코드다 무지성으로 했다는 뜻은 그냥 기능에 충실하게 <font color="#c00000">확장성 고려하지 않고 내가 아는 파이썬 코드대로 짰다는 뜻</font>이다.(~~대충 의식의 흐름대로 짰다는 것~~) 지금 보면 1시간마다 데이터를 쌓아뒀다가 집계를 해야하기 때문에 상태 데이터를 전역변수로 설정해두고 시간창 즉 시간이 변경되지 않으면 계속해서 데이터를 업데이트 시간이 변경되면 한시간이 지났다는 의미이므로 데이터 집계 및 전송 및 상태창 초기화 를 하고 있다. 

근데 자 여기서 보자 지금 보면 데이터를 변환하기 위해 데이터를 읽어 들이는 부분이 아래 코드처럼 묶여있다.
```python
batch_data = batch_df.collect() 
```
아까 말했듯이 이는 데이터를 드라이버 노드로 수집하는 것으로 기껏 구축한 Spark의 최장점인 병렬처리의 이점을 쓰레기통에 박아넣은 행위다.

그래서 코드를 for문과 if문으로만 짜둔 이름하여 더러운 코드가 완성이 되었다. 

### Spark_SQL
```python
def update_state(self, batch_df, batch_id):
        now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        joined_df = batch_df.join(self.state_df, on="stationId", how="left")

        changes_df = joined_df.withColumn(
            "previous_parkingBikeTotCnt", F.coalesce(F.col("previous_parkingBikeTotCnt"), F.lit(0))
        ).withColumn(
            "change", 
            F.col("parkingBikeTotCnt") - F.col("previous_parkingBikeTotCnt")
        ).withColumn(
            "return", 
            F.when(F.col("change") > 0, F.col("change")).otherwise(0)
        ).withColumn(
            "rental", 
            F.when(F.col("change") < 0, -F.col("change")).otherwise(0)
        ).withColumn(
            "change", 
            F.when(F.col("previous_parkingBikeTotCnt") == 0, 0).otherwise(F.col("change"))
        ).withColumn(
            "return", 
            F.when(F.col("previous_parkingBikeTotCnt") == 0, 0).otherwise(F.col("return"))
        ).withColumn(
            "rental", 
            F.when(F.col("previous_parkingBikeTotCnt") == 0, 0).otherwise(F.col("rental"))
        )

        new_state_df = changes_df.select(
            F.col("stationId"),
            F.col("parkingBikeTotCnt").alias("previous_parkingBikeTotCnt")
        )

        self.state_df = new_state_df

        hourly_summary = changes_df.groupBy(
            F.window("event_time", "1 hour"),
            "stationId"
        ).agg(
            F.sum("rental").alias("total_rental"),
            F.sum("return").alias("total_return")
        ).select(
            "window.start",
            "window.end",
            "stationId",
            "total_rental",
            "total_return"
        )
        return hourly_summary
```
너무나도 깔끔(?)해진 코드를 볼 수 있다. 먼저 바뀐점을 알아보자. 처음에 배치 데이터와 기존 상태 데이터를 leftjoin 하는데 우선 초기에 조인 시 오류를 방지하기 위해 `previous_parkingBikeTotCnt`가 0인 경우 `change`, `return`, `rental` 값을 0으로 설정해준다.  <br><br> 그리고 `parkingBikeTotCnt` - `previous_parkingBikeTotCnt` = `change`로 둔 뒤에 change 값이 양수이면 return에 change 값이 음수이면 rental에 저장 하고 그 이외는 0으로 저장한다.
<br><br> 그렇게 데이터가 들어올때 마다 이런 연산이 반복되고 1시간이라는 window 즉 시간창이 지나게 되면 `groupBy`연산이 실행되면서 아래와 같은 한시간 집계 분에 해당하는 데이터 프레임이 완성된다.
| window.start       | window.end         | stationId | total_rental | total_return |
|--------------------|--------------------|-----------|--------------|--------------|
| 2023-08-03 06:00:00| 2023-08-03 07:00:00| station1  | 20           | 23           |
| 2023-08-03 06:00:00| 2023-08-03 07:00:00| station2  | 3            | 6            |
| 2023-08-03 06:00:00| 2023-08-03 07:00:00| station3  | 12           | 9            |
| 2023-08-03 06:00:00| 2023-08-03 07:00:00| station4  | 8            | 7            |

그리고 이제 해당 적제 결과를 S3 양동이에 차곡차곡 담아주면 된다. 
세부적인 코드는 아래에서 확인하자.ㅎㅎ
https://github.com/StatisticsFox/Ddareungi-Spark

## 마무리하며
사실 Spark의 개념에 대해서는 알고 있었다. 근데 이게 코드를 짤때 어떤 영향을 미치는지는 몰랐다. Spark는 어떤거로 구성되어 있는지 특성은 뭔지 등을 알고 있었는데 이렇게 코드를 직접 짜는 과정에서 알고 있는 내용을 코드에 녹여내는건 확실히 프로젝트를 해보면서 몸으로 익혀야 하는 것 같다. 일단 현재는 30초마다 카프카에서 불러오고 있는데 점차 10초 5초로 줄이는 과정에서 메모리가 얼마나 부족해지는지 그럴 경우 얼마나 무엇을 더 최적화해야 하는지 등을 프로젝트를 마무리해 가면서 확인해볼 예정이다. 그때 다시 글로 돌아오겠따!!


