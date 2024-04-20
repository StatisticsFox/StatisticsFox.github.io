---
emoji: 🛠️
title: DataOptimizations - Speed up your pipeline
date: '2024-03-17 22:43:23'
author: 최지혁
tags: Optimization Data
categories: Data_Engineering
---

## 데이터 파이프라인 최적화의 필요성
대 빅데이터 시대인 만큼 **데이터 파이프라인을 최적화하는 것**은 굉장히 중요하다. 특히 **MLOps 분야**에서는 훨씬 더 중요하다. 왜냐하면 AI 성능이 기하급수적으로 발전하면서 그만큼 추론속도나 학습 속도 또한 굉장히 중요해지고 있기 때문이다. 
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21172&authkey=%21AMLVmAUUwVh49k4&width=1568&height=468)

## 보편적인 최적화 방안이 존재할까?
그렇다면 데이터 파이프라인을 최적화하는 보편적인 정답이 존재할까? 내 대답은 **No**!다. 구축하는 파이프라인마다 도메인과 요구사항들이 모두 다르기 때문에 보편적인 요구사항이란 존재할 수 없다. 
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21164&authkey=%21AN1DKoWFA8cD0Yg&width=1246&height=424)
## 보편적인 컴포넌트는 존재할까?
그렇다면 보편적인 컴포넌트는 중요할까? 내 대답은 **Yes**다. 보편적인 컴포넌트는 존재한다. 바로 **DataLake**다. 
데이터 파이프라인은 "수집 -> 적재 -> 처리 -> 활용"의 단계를 거치는데 이때 적재 부분에서 실제 데이터를 운영용으로쓰는 경우에는 Datalake를 사용할 수밖에 없다. 따라서 **datalake를 최적화 하는것이 결국 데이터 파이프라인을 최적화 하는것과 다름없다고 생각한다.** 
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21166&authkey=%21AIeFHkvVBN7IT1w&width=1024&height=270)
## DataLake를 최적화 해보자
> Data Lake를 최적화하다니? DataLake는 이미 나와 있는 제품 아닌가? 

라고할 수 도 있다. 어느정도는 맞는 말이며 마찬가지로 제품 또한 요구사항에 따라 바뀐다. 비용 최적화에 대한 니즈가 높은 경우 데이터 중요도 마다 클래스를 다르게 하여 비용을 더 저렴하게 지불 가능한 S3를 이용할 수 있고, 사용하는 툴에 따라서 호환성에 맞는 gcp나 azure또한 선택 가능하다. 따라서 이번에 할얘기는 Data Format에 관한 이야기다.

## CSV vs Parquet
 오늘은 두가지 데이터 포맷을 비교해 볼 것이다. 바로 **parquet**과 **csv** 파일을 비교해 보고자 한다. 나는 통계학과에 재학 당시(사실 지금도 재학 중..) 대부분의 데이터를 이용할때 CSV 형태의 파일을 이용하였다. 왜냐하면 공공데이터나 데이콘 혹은 인터넷에서 주로 배포된 데이터의 경우 대부분 CSV 파일로 배포가 되었기 때문이다. 지금에서야 이유를 생각해보면 CSV가 아무래도 **마이크로소프트 엑셀로 쉽게 확인이 가능하고 훨씬 친숙**하기 때문에 대부분 csv 파일로 데이터를 배포하는 것 같다. 
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21167&authkey=%21AGSuC2Ee7BHt-n0&width=1202&height=380)
때문에 나도 parquet 보다는 csv를 주로 이용해봤다. 다만 나는 어떤 실험을 통해 더이상 csv 파일은 왠만해서는 사용하지 않는데 오늘은 이 실험에 대해 소개해 보고자 한다. 

## csv와 parquet 비교실험
먼저 실험 환경은 다음과 같다. 
- 컴퓨터: Mac m1 Pro
- 메모리: Ram 16GB
- 대역폭: 100GB/s
- 용량: SSD 1TB
- Processor: 8 core CPU
- Remote Storage: AWS S3

실험 아키텍처는 다음과 같다. 

데이터는 케글의 아마존 [전자제품 리뷰 데이터](https://www.kaggle.com/datasets/muhammedabdulazeem/amazon-electronics-items-reviews)를 사용하였다. 
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21163&authkey=%21ACPWuFhmA36B8YA&width=1192&height=778)
### Size
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21174&authkey=%21AJPPIE-TwZV8B9w&width=1084&height=536)
parquet 파일이 1.84% 더 작은 것을 확인 가능하다.
### download speed
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21168&authkey=%21AKVclBQI-Im_ZGw&width=1018&height=562)
parquet 파일이 1.9% 더 빠른 것을 확인할 수 있다.
### read speed
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21171&authkey=%21AB_V5Mbw64lg4dY&width=1200&height=368)
parquet 파일이 1.78% 더 빠른 것을 확인할 수 있다.
### count speed
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21165&authkey=%21AFupwqOeIrUMUbE&width=1120&height=344)
parquet 파일이 5.9% 더 빠른 것을 확인할 수 있다.


### 실험결과 
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21173&authkey=%21ABA9dtYq23ToNYo&width=1740&height=368)
위와 같이 모든 지표가 parquet 파일이 더 좋다고 말해주고 있다. 즉, datalake 관점에서는 csv보다는 parquet파일을 적재하는 것이 훨씬 바람직하다.

## parquet 파일이 더 좋은 이유
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21169&authkey=%21ANjgskNzhHvUJAw&width=1248&height=634)
parquet 파일은 열 기반과 행기반 스토리지의 장점을 모두 챙긴 hybrid기반의 데이터 포맷이다. 때문에 데이터를 읽어들이거나 인덱싱 할때 단순 행 기반 데이터 포멧인 csv가 가진 단점들을 해결해준다. 

## 마무리
![사진](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21170&authkey=%21AGrwU-T4bZbWuRU&width=1394&height=472)
따라서 나는 사이드 프로덱트나 과제시 클라우드에 데이터를 담을 일이 있으면 주로 parquet 데이터를 이용하는 편이다. 물론 **성능에 대한 니즈가 없다거나 담당자가 자주 바뀌어 범용성이 높아야하는 경우에는 csv 파일을 사용**해도 문제가 없지만 그래도 클라우드를 사용하는 입장에서는 **parquet 포멧으로 데이터를 적재하는 것이 바람직하다**고 생각한다. 

```toc
```