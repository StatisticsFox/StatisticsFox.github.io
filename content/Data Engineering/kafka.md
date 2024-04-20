---
emoji: 💫
title: Apache Kafka에 대해 전반적으로 알아보자
date: '2024-04-19 21:46:20'
author: 최지혁
tags: kafka
categories: Data_Engineering
---
![사진](https://fs.buttercms.com/resize=width:940/308TQEVTEe468SWNPWwn)
이번에 카프카를 로컬에서도 돌려보고 클라우드 환경에서도 다뤄보게 되었다. 그래서 카프카의 구조나 기본 개념에 대해 정리를 하고 가야할 필요성을 느꼈다. 

물론 실제 구축을 할때는 인프라적인 측면에서 더 애를 먹는다. 방화벽 설정이라던지.. 그래서 기본적인 개념에 대해서는 약간 소홀해 지는 경향이 있었다. 

아래 토픽 생성할 때의 shell 명령어를 보자
```zsh
$>./bin/kafka-topics.sh --create --topic fastcampus \
--bootstrap-server localhost:9092 --partitions 3 --replication-factor 2
```
사실 이 문구를 그냥 copy/paste 한다면야 생성 가능하겠지만 `--replication-factor 2`라는 명령어가 어떤 의미인지 잘 모른다면 사실상 kafka를 사용하는 의미가 없다.

때문에 이번 기회에 깊이있게는 아니더라도 대략적으로 정리를 해보려고 한다.
# Back ground of Kafka
## Kafka는 왜 Kafka일까?
카프카의 창시자인 Jay Kreps는 <font color="#c00000">kafka는 쓰기에 최적화된 시스템</font>이기에 작가의 이름을 붙이는게 낫다고 생각하여 본인이 좋아하는 작가인 프란츠 카프카의 이름을 오픈소스 프로젝트 이름으로 명명했다.

## Before Kafka & After kafka
### Before Kafka
1. 앱이 하나의 서버 혹은 여러 서버에 직접 메트릭을 전송
![사진](https://genmwill.wordpress.com/wp-content/uploads/2015/09/data-flow-ugly.png)
### After kafka
1. 중앙집중형의 Pub/sub 메시징 시스템을 통해 여러 앱으로부터 메트릭을 수신한다.
![사진](https://genmwill.wordpress.com/wp-content/uploads/2015/09/stream-centric-architecture1.png)

## kafka의 장점이자 목표
> push/pull 모델을 사용하여 <font color="#c00000"><u>producer 와 consummer의 분리</u></font>
> 여러 Consumer를 허용하도록 메시징 시스템 내에서 <u><font color="#c00000">메시지 데이터에 대한 지속성 제공</font></u>(데이터를 소비해도 삭제되지 않음)
> <u><font color="#c00000">높은 메시지 처리량</font></u>을 위한 최적화 분산 처리로 속도를 최적화 함
> 시스템의<font color="#c00000"> <u>수평적 확장</u></font>이 쉽다.

# Kafka - Core
## kafka의 기본 아이디어
 ![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21191&authkey=%21AC2HGNuR6n4NqmI&width=1799&height=691)
#### 카프카에 <u>데이터를 넣는</u> <font color="#c00000">Producer</font>
#### 그 <u>데이터를 꺼내가는</u> <font color="#c00000">consumer</font>
#### 그 <u>데이터가 들어가는</u> 공간인 <font color="#c00000">Topic</font>
- topic은 사실상 <u>카프카를 사용하는 이유</u>이다.
 - 카프카에서 메시지를 구분하는 단위다.(파일 시스템의 폴더와 유사)
 - 어러 토픽으로 이뤄질 수 있고 목적에 따라 이름을 붙일 수 있다. -> 폴더에 이름 붙이는거와 같음

![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21200&authkey=%21ANuASgyQOYKM1og&width=1450&height=472)

## kafka의 구성요소
### Topic
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21205&authkey=%21AL8SRGxSZtDDeuM&width=1192&height=428)
- <u><font color="#c00000">메시지의 구분 단위</font></u>이며 내부에서 여러 개의 파티션으로 구성된다. 
- 파티션은 병렬 처리를 위한 <font color="#c00000"><u>데이터를 담는 공간</u></font>이며 파티션에 담긴 <u><font color="#c00000">데이터를 레코드</font></u>라고 한다.
### broker
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21196&authkey=%21ALBdoeTxvLTO6S0&width=1230&height=284)
- 카프카가 설치되어 있는 서버 -> 보통 3개 이상의 브로커로 구성한다.
### partition
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21200&authkey=%21ANuASgyQOYKM1og&width=1450&height=472)
- **파티션마다** 각 메시지가 0부터 1씩 증가하는 offset 값을 갖는다
- 큐(queue)와 비슷한 구조로 FIFO처럼 먼저 들어간 레코드는 컨슈머가 먼저 가져가게 된다.
    → <u><font color="#c00000">하지만 데이터를 가져간다고 레코드가 삭제되지 않는다.</font></u>

> ➡️ 레코드가 삭제되는 지점은 설정가능하다.
> 	- 레코드 보존시간 -> `log.retension.ms`
> 	- 레코드 보존크기 -> `log.retension.type`
> ➡️ 삭제되지 않는다의 의미
> 	- 다른 Consumer가 다시 0qjs offset부터 가져갈 수 있다는 것을 의미한다.

![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21195&authkey=%21ACDfXcKNr5aL7qA&width=1264&height=519)
- 카프카 병렬처리의 핵심
- Topic 생성 시 partition 개수를 지정 가능하며 이를 늘릴 수는 있으나, 줄일 수는 없다.
- 레코드가 어느 파티션으로 갈지 결정하는 방법
	- key 값이 존재하지 않는 경우 → Round-robin 방식으로 고르게 분배
	- key 값이 존재하는 경우 → key를 hash 함수에 넣어서 파티션 결정

### ISR(In Sync Replica)
파티션 복제는 곧 -> 고가용성을 의미한다.
- 원본이 Leader, 복사본이 Follower -> 리더에 장애 날 경우 follower가 leader로 승격한다.
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21199&authkey=%21APFnyOcvfXPurao&width=1167&height=385)

### producer
- 토픽에 해당하는 메시지 생성, 특정 토픽으로 데이터를 Publish

#### producer의 내부 구조
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21204&authkey=%21AJtaBMq0c8chJjo&width=720&height=319)
- **ProducerRecord** : 프로듀서에서 생성하는 레코드
- **send()** : 레코드 전송 요청 메소드
- **Partitioner** : 어느 파티션으로 전송할지 지정
- **Accumulator** : 배치로 묶어 전송할 데이터를 모으는 버퍼
- **Sender** : Accumulator의 메시지를 Fetch하여 브로커로 전송

#### ACK 설정에 따른 가용성과 속도의 Trade off
보통 요구 사항에 따라 결정한다.
##### <font color="#c00000">**ACK = 0**</font>
- 리더에게 전송하고 <u><font color="#c00000">응답값을 받지 않는다.</font></u>
- 리더에 잘 갔는지도, 복제되었는지도 알 수 없다.
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21194&authkey=%21AMZSSrIZN5UirAY&width=1184&height=362)
##### <font color="#c00000">**ACK = 1**</font>
- 리더에게 전송하고, <u><font color="#c00000">리더에게만 응답값을 받는다.</font></u>
- 리더에게는 잘 갔는지 알 수 있지만, 잘 복제되었는지는 알 수 없다.
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21192&authkey=%21AKxo8F3KmEECInw&width=1171&height=345)
##### <font color="#c00000">**ACK = all**</font>
- 리더에게 전송하고, 리더와 팔로워 <u><font color="#c00000">모두에게 응답값을 받는다.</font></u>
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21193&authkey=%21AIPcapuAQe40qDI&width=1163&height=364)
### Consumer
- 토픽의 파티션으로부터 데이터 polling
#### Consumer의 내부 구조
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21198&authkey=%21AF1Gh5erXuILV_s&width=720&height=284)
- **Fetcher** : 리더 파티션으로부터 레코드들을 가져와서 대기
- **poll()** : Fetcher에 있는 레코드를 리턴
- **ConsumerRecord** : 처리하고자 하는 레코드 모임

#### 파티션 offset 위치 기록
- 파티션에 들어간 데이터는 <font color="#c00000"><u>파티션 내에서 고유한 번호(offset)를 갔는다</u></font>
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21202&authkey=%21AO9KwJqCCmTw_Ok&width=1129&height=269)
- consumer가 어느 지점까지 읽었는지 확인하기위한 용도이다.
	- 장애로 인해 재실행 되었을때 중단시점을 알기에 <font color="#c00000"><u>데이터 중복 및 손실이 일어나는 것을 방지</u></font>한다.
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21203&authkey=%21AMAdXiS0iJTbALA&width=720&height=205)

#### Consumer group
- 여러 파티션을 가진 토픽에 대해서 consumer를 병렬 처리할 때 사용한다.
- 서로 다른 그룹에 속하면 영향을 미치지 않으므로 동일한 파티션 접근이 가능하다.
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21197&authkey=%21AAYbCKdPKW-lGnM&width=1150&height=412)

#### Lag metric
- <font color="#c00000"> 컨슈머가 마지막으로 읽은 offset과 프로듀서가 마지막으로 넣은 offset의 차이</font>
-  파티션 마다 lag 값을 특정할 수 있다.
- lag의 차이가 크게 되면 실시간이 실시간이 아니게 되어 버리거나 할 수 있으므로 성능이 나오지 않거나, 비정상 동작을 할 때 모니터링할 수 있다.
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21201&authkey=%21AAkRS3QCoBy9wz8&width=434&height=705)


# 마무리
이렇게 kafka의 기본 개념과 구성요소에 대해서 간단하게나마 정리를 해보았다. 사실 kafka를 잘 아시는 분이라면 '하나 빠졌는데!!!!'하실 수 있을 것 같다. 

바로 metadata 보관 장소이자 브로커가 사춘기 왔을때 잡아주는 엄마같은 존재인 zookeeper다. 

사실 zookeeper를 다루지 않은 이유는 kafka 3.x.x버전에서는 zookeeper를 더 이상 사용하지 않고 <font color="#c00000">KRaft</font>를 사용한다. zookeeper는 kafka와 완전 별개의 애플리케이션이기에 사실상 계모같은 존재였다. 때문에 안전성이나 확장성 측면에서 불안하여 3.x.x버전 부터는 KRaft라는 kafka 단일 애플리케이션 즉, 진짜 엄마를 찾아서 사용한다. 

그래서 나중에 둘의 차이에 대해서 다로 포스팅하고자 이번 포스팅에서는 제외하기로 하였다. 

```toc
```