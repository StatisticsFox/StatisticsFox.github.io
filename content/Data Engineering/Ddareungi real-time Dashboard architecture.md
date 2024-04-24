---
emoji: 🚲
title: Realtime data streaming with Apache Kafka, Druid, Superset
date: '2024-04-25 01:20:27'
author: 최지혁
tags: Ddareungi Realtime
categories: Data_Engineering
---
# Base
이번에 한이음의 일환으로 클라우드 환경에서 실시간 따릉이 대시보드를 만들게 되었다. 다만 <span style="background:#fdbfff">내 역할이 데이터 엔지니어링 및 인프라에 국한</span>되어 있어 개인적으로 오픈소스를 활용하여 로컬에서 하나를 더 만들어 보려고 한다. 때문에 레퍼런스를 찾던 도중 다음과 같은 글을 발견했다.
https://medium.com/@emergeit/realtime-data-streaming-with-apache-kafka-apache-pinot-apache-druid-and-apache-superset-e67161eb9666 <br/>
2년이 넘은 자료이기는 하지만 내 요구사항을 모두 만족했기에 아주 적합한 래퍼런스였다.
그럼 이제 시작해보자
![시작해보자](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21211&authkey=%21AInaQqp_g1hhKd0&width=564&height=311)
## Ddareungi real-time Dashboard architecture
![Dashboard architecture](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21206&authkey=%21ALbDIYVRTxIVsFE&width=2400&height=868)

위는 내가 수정한 아키텍처다. 신경 쓴 부분은 아래와 같다.
- Docker는 Superset을 올릴때만 사용하고자 한다.
	- 레퍼런스에서는 모든 프레임워크를 Docker Labs위에서 실행했는데 **<span style="background:#fff88f">Docker Labs는 사용시간 2시간의 제한이 있다</span>**.... 그리고 굳이 docker가 있는데 Docker Labs를 사용해야 할 필요성을 못느꼈다.(옛날에 학교에서 docker 처음 배웠을때 한번 써봤다.)
	
- **Speed Layer는** <font color="#c00000">Druid로 선정</font>하였다.
	- 사실 성능만 생각하면 <font color="#c00000">대규모 데이터 세트로 갈수록 낮은 레이턴시 쿼리를 제공</font>하는 Apache pinot을 선택하는게 맞다. 하지만 다음과 같은 이유에서 Druid로 선정하였다.
	- <font color="#c00000">Druid는 지원하는 데이터 소스가 굉장히 많다</font>. Kafka, RabbitMQ, Flink, Samza, Storm, Spark 등 나중을 위해서라도 Druid 좋다고 생각했다.(원래 남들 다쓰는게 좋은 법)
		- pinot은 링크드인에 집중되어 개발됐기에<font color="#c00000"> kafka 하나만 지원</font>한다.
	- 따릉이 데이터는 대규모 데이터가 아니다. 때문에<font color="#c00000"> 성능에 대한 니즈가</font> 크게 <font color="#c00000">중요하지 않다.</font>
	- <font color="#c00000">전용 커뮤니티 활성화가 엄청 잘되어 있다. </font>Druid가 더 대중적이기에 오류가 나거나 막히는 부분이 있어도 대비할 수 있다. 
	- Pinot과 Druid에 대한 비교는 여기에 포스팅할 예정이다. -> 링크 추가예정
- <font color="#c00000">producer를 새로 개발</font>해야 한다. 
	- 래퍼런스는 fake-user라는 유저를 랜덤으로 생성하는 코드를 작성하였으나  api에 맞추어서 새로운 producer를 개발하고자 한다.

# Core
## Practice environment and framework version
Practice environment
- Computer: Mac m1 Pro
- Memory: Ram 16GB
- bandwidth: 100GB/s
- SSD capacity: 1TB
- Processor: 8 core CPU

Framework version
- Apache kafka: 2.7.1
- Apache Druid: 29.0.1
- Apache superset: latest

데이터는 서울시에서 제공하는 실시간 따릉이 정거장 정보 API를 활용했다. <br/>
Data: https://data.seoul.go.kr/dataList/OA-15493/A/1/datasetView.do
## Set up kafka on Local
### install kafka
원하는 버전의 kafka를 다운 받아준다. kraft 체제의 3점대 버전을 고를까 고민하다가 사실 3점대 버전은 레퍼런스도 많이 없고 익숙하지 않아 2.7점대 버전이자 <font color="#c00000">zookeeper 체제의 latest 버전을 받았다.</font>
```zsh
wget <https://archive.apache.org/dist/kafka/2.7.1/kafka_2.12-2.7.1.tgz> 
tar -xvzf kafka_2.12-2.7.1.tgz 
cd kafka_2.12-2.7.1 
```
### kafka server configuration 
환경변수 설정 및 advertised.listeners를 본인의 호스트로 설정해준다. 나같은 경우는 localhost로 해주었다:)
```zsh
export KAFKA_HEAP_OPTS="-Xmx400m -Xms400m" 
vi config/server.properties 
listeners=PLAINTEXT://:9092 
advertised.listeners=PLAINTEXT://{your_host_name}:9092 
```
### zookeeper server start
여기서 좀 중요하다. 우리는 zookeeper 기반 카프카를 사용할건데 <font color="#c00000">zookeeper의 기본포트는 2181다.</font> 문제는 Apache druid에도 zookeeper 기반에서 돌아가기 때문에 그냥 실행해주면 나중에 <font color="#c00000">포트 충돌이 일어나게 된다.</font> 때문에 <font color="#c00000">zookeeper.properties 파일 속 포트 번호를 다른 번호로 설정</font>해주어야 한다. 
설정 후에는 서버를 시작해준다.
```zsh
./bin/zookeeper-server-start.sh config/zookeeper.properties
```
### kafka server start 
카프카 서버 설정 파일 <font color="#c00000">server.properties</font>속의 주키퍼 포트번호도 위와 동일하게 바꾸어주자
```zsh
./bin/kafka-server-start.sh -daemon config/server.properties 
```
### Create topic 
토픽을 생성해준다. 파티션은 적당하게 3개 정도로 설정해두었다.
```zsh
./bin/kafka-topics.sh --create --topic bike-station-info \
--bootstrap-server localhost:9092 --partitions 3 
```
### Describe 
토픽이 올바르게 생성되었는지 --describe 옵션을 통해 확인해준다.
```zsh
./bin/kafka-topics.sh --describe --topic bike-station-info \
--bootstrap-server localhost:9092
```
### Producer start
서울시 열린데이터광장에서 받아온 API 키를 발급받고 bin파일에 기록하여 <font color="#c00000">보안적인 측면을 신경썼다.</font>
정거장 정보는 2000개지만 한번에 받아올 수 있는 데이터가 1000개로 제한되어 있어 그것에 맞게 코드를 짰다.
```python
import requests
import json
import time
from kafka import KafkaProducer
from datetime import datetime

# Kafka 설정
topicName = "bike-station-info"
producer = KafkaProducer(bootstrap_servers=["localhost:9092"],
value_serializer=lambda x: json.dumps(x).encode("utf-8"))

# 따릉이 API URL
def request_seoul_api(api_key, start_index, end_index):
	g_api_host = "http://openapi.seoul.go.kr:8088"
	g_type = "json"
	g_service = "bikeList"
	url = f"{g_api_host}/{api_key}/{g_type}/{g_service}/{start_index}/{end_index}/"
	return requests.get(url)

  

# API 키 읽기
with open("api_key.bin", "r", encoding="UTF-8") as api_key_file:
	api_key = api_key_file.read().strip()

  

# 무한 루프를 돌면서 실시간으로 데이터를 가져와 Kafka에 전송

while True:
	try:
	# 따릉이 API 호출
		bike_stations = [] # 초기화
		for start_index in range(1, 2001, 1000): # 1부터 2000까지, 1000개 단위로 요청
			end_index = start_index + 999
			response = request_seoul_api(api_key, start_index, end_index)
			if response.status_code == 200:
				bike_stations.extend(response.json()["rentBikeStatus"]["row"])
	
		for station in bike_stations:
			# 필요한 정보 추출
			data = {
				"rackTotCnt": station["rackTotCnt"],
				"stationName": station["stationName"],
				"parkingBikeTotCnt": station["parkingBikeTotCnt"],
				"shared": station["shared"],
				"stationLatitude": station["stationLatitude"],
				"stationLongitude": station["stationLongitude"],
				"stationId": station["stationId"],
				"timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
			}

			# Kafka에 데이터 전송
			producer.send(topicName, value=data)
			print(f"Sent data to Kafka: {data}")
	

		# 대기시간
		time.sleep(60)
	
	except Exception as e:
		print(f"Error: {e}")
```
### Check consumer
```zsh
./bin/kafka-console-consumer.sh \
--bootstrap-server localhost:9092 \
--topic bike-station-info
```
아래와 같이 consumer가 데이터를 잘 받아오고 있으면 성공이다.!
![consumer](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21210&authkey=%21AGde50G47T-iha0&width=2890&height=666)
## Set up Druid on Local
### install Druid
드루이드는 무척이나 간단하나. 사전에 kafka를 설치하면서 zookeeper 포트 이동을 해주었기에 그냥 다운로드 받고 실행하면 된다.
```zsh
### Druid 설치
wget https://dlcdn.apache.org/druid/29.0.1/apache-druid-29.0.1-bin.tar.gz
tar -xvzf apache-druid-29.0.1-bin.tar.gz
cd apache-druid-29.0.1
```
### start druid & connect 
전에 카프카를 올릴때 실수로 zookeeper의 포트를 변경하지 않았다면 2181 포트를 죽여야 한다. 만약 2181 포트가 살아 있다면 아래 명령어를 이용하자
```zsh
### 포트 삭제
lsof -i :2181
kill -9 {PTD 번호}
```

```zsh
### Druid 실행
./bin/start-druid

### Druid 접속
http://localhost:8888
```
### Connect with kafka
아래 사진과 같이 <font color="#c00000">로컬 주소</font>와 <font color="#c00000">토픽 명</font>을 입력하여 드루이드와 카프카를 연동한다.
`아래 사진 topic 명은 fastcampus로 되어 있는데 사진이 사전 테스트 사진으로 되어 있어서 그렇다.. 테스트 구축은 fastcampus 강의를 바탕으로 함.`
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21207&authkey=%21AKza7ja6DdGD3oM&width=3024&height=1724)
 > 데이터 포멧 및 타임 스템프 지정 과 변환 및 필터, 스키마구성과 파티션 설정 등 Druid 내 다양한 환경 설정은 다른 post에서 다루고자 한다. 

## Set up Superset on Docker
먼저 git을 통해 공식 superset을 받아온 후 superset을 실행해준다. 꽤 오래 걸리니 다른거 하다 와도 좋다.
```zsh
### Superset git clone
git clone https://github.com/apache/superset.git

### Superset 실행
docker compose -f docker-compose-non-dev.yml up
```

## Connect superset and Druid
아래처럼 나의 로컬 드루이드 URL을 사용해서 superset과 druid를 연결할 수 있다.
URL의 포맷은 [공식문서](https://superset.apache.org/docs/databases/druid/)를 참고하였다.
![connect druid](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21209&authkey=%21AJOYaH5gbU8sqBU&width=3024&height=1728)

## Create DashBoard on Superset
이제 아래 처럼 Superset을 이용해 Dash보드를 구성할 수 있다. 이번에 Superset을 완전 처음 쓰는거라 아직 기능적인 이해도는 떨어지지만 점차 기능을 추가해나갈 예정이다. 
![dash board](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21208&authkey=%21AEr5A4PxVVTdSBk&width=3248&height=2112)

생각보다 Superset을 쓰는 방법이 쉽지많은 않다. 아래 강의를 통해 조금은 알아보려고 한다. 
[Superset 강의](https://www.udemy.com/course/apache-superset-for-data-engineers-hands-on/?couponCode=ST6MT42324)

# 마무리
일단은 성공적으로 실시간 파이프라인 구축을 마칠 수 있었다. 사실 이번 개인 프로젝트의 목적은 대시보드가 중심이 아니다. <span style="background:#fdbfff">오픈소스와 speed layer을 활용하여 실시간 대시보드를 성공적으로 구축했는가에 초점이 있다. </span>때문에 대시보드를 상세하게 구축하는데 초점을 두지는 않기로 했다. 언젠가 BI 엔지니어와 협업하게 된다면 그때 커뮤니케이션을 통해서 잘 만들어갈 수 있을 것이라 생각한다. 현재 진행중인 클라우드 서비스를 통한 실시간 대시보드 구축 프로젝트에서 BI 담당이신 박지현님과 충분한 커뮤니케이션을 통해 역량을 강화하고자 한다.

## Reference
[Project reference](https://medium.com/@emergeit/realtime-data-streaming-with-apache-kafka-apache-pinot-apache-druid-and-apache-superset-e67161eb9666)<br/>
[Superset에 대하여](https://www.udemy.com/course/apache-superset-for-data-engineers-hands-on/?couponCode=ST6MT42324)<br/>
[Superset git](https://github.com/apache/superset)<br/>
[Druid 기초](https://www.udemy.com/course/apache-druid-a-hands-on-course/)<br/>
[APACHE DRUID](https://www.apache.org/dyn/closer.cgi?path=/druid/29.0.1/apache-druid-29.0.1-bin.tar.gz)<br/>
[Kafka Basic](https://statisticsfox.github.io/Data%20Engineering/kafka/)<br/>
[Pinot VS Druid](https://imply.io/blog/choosing-a-database-for-real-time-analytics-druid-and-pinot/)<br/>

```toc
```