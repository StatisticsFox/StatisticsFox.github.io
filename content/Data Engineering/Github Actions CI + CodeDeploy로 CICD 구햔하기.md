---
emoji: 🪐
title: Implementing CI/CD with Github Actions CI + AWS CodeDeploy
date: '2024-05-31 01:20:27'
author: 최지혁
tags: DevOps CI/CD
categories: Data_Engineering Cloud
---
## 들어가기에 앞서
이번에 AWS EC2를 이용해 NAT instance를 활용해 [kafka broker](https://statisticsfox.github.io/Cloud/)를 구축했다. 이제 producer를 실행하면 자연스럽게 카프카를 사용할 수 있다.(리소스 비용 이슈로 프로듀서 서버를 따로 분리하지 않았다.ㅎㅎ) 

다만 producer는 아직 본격적으로 개발한 상태가 아닐뿐더러 나중에 대시보드를 배포할 때 <font color="#c00000">producer를 지속적으로 수정해야 한다.</font> 때문에 계속해서 TEST를 해야 하는데 그 과정이 여간 불편한게 아니다. 매번 Ec2 키고 접속해서 주키퍼랑 카프카 올리고... 아무튼 생각보다 노력을 필요로 한다. 또 Github와 같이 <font color="#c00000">producer의 버전을 관리하고 다른 사람들에게 공유도 용이</font>하게 하기 위해서는 응당 구축해야할 것이 있다.

그것이 바로.. CI/CD다!! Devops의 기본 소양이자 DE라면 당연히 알아야 하는 CI/CD를 구현해보기로 했다. 다행히도 학교에서 젠킨스를 이용한 CI/CD 구현 수업을 들었기에 개념 정도는 꿰고 있었다. 

> CI/CD란? <br>
> 지속적 통합/지속적 배포 라는 뜻으로 <font color="#c00000">코드 변경 사항을 자동으로 통합하고 배포하는 과정</font>을 말한다. 이를 통해 개발 과정이 자동화되어 개발자의 삶의 질을 향상시킨다. 지속적 통합(CI)은 코드 변경을 자주 통합하여 문제를 신속히 발견하고, 지속적 배포(CD)는 변경 사항을 자동으로 배포하여<font color="#c00000"> 사용자에게 빠르게 제공</font>할 수 있게 한다.

본격적으로 시작해보자 <br>
<div align="center">
    <img src= https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21211&authkey=%21AInaQqp_g1hhKd0&width=564&height=311 alt="나 개쩔어" />
</div>

## BASE
먼저 빠르게 아키텍쳐부터 살펴보자 다음은 이번에 설계한 CI/CD 아키텍쳐다. 
<div align="center">
    <img src= https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21216&authkey=%21AMsEjwlcUVpGtUk&width=2264&height=1284 alt="아키텍쳐" />
</div>

### CI/CD를 위해 GIthub action과 Code Deploy를 섞은 이유

GitHub action(CI)과 AWS의 Code Deploy(CD) 제품을 함께 사용했다. 이유는 다음과 같다.

- 먼저 나는 최종적으로 AWS EC2에 배포를 해야한다. 다만 <font color="#c00000">Github Action 만으로는 EC2내부에 배포하는 것이 어렵다.</font> 때문에 <font color="#c00000">EC2 CD에 최적화된 Codedeploy</font>를 섞어서 사용했다. ~~(그리고 싸다 ㅎ)~~
- Jenkins도 내가 한번 사용해본 도구였기에 CI의 고려 대상이었으나 결국 기각되었다. 이유는 다음과 같다.
	- Jenkins를 담당하는<font color="#c00000"> 서버가 따로 필요</font>하다.
	- 반면에 github action은 MS Azure Cloud를 통해 runner 서버를<font color="#c00000"> 무료로 제공</font>한다.
	- <font color="#c00000">workflow 공유가 용이하지 않다.</font>
- <font color="#c00000">비용이 거의 들지 않는다. </font>물론 소량의 S3 저장 비용과 NW 트래픽 비용이 들기는 하지만 서버 한 대 증설하는 것에 비할 바가 아니다.

무엇보다 Github action은 <font color="#c00000">정말 사용하기 편했다. </font>모든 job, hooks 등을 yaml 파일 형식 하나로 커스터마이징 할 수 있다는 점이 마음에 들었다.

## CORE1 - CI/CD Setting
그럼 구성하는 과정을 알아보자. 크게 총 3가지의 설정이 필요하다.

1. 권한 설정 & CodeDeploy Agent 설치 <br>
	a. (EC2 할당용)EC2가 CodeDeploy 및 S3에 접속할 수 있도록 하는 권한 <br>
	b. (CodeDeploy 할당용) 배포를 위해 CodeDeploy가 가지는 권한. <br>
2. S3 버킷 생성 
3. Github에 AWS 접근 가능한 ACCESS KEY 설정

### 권한 설정 & CodeDeploy Agent 설치
먼저 Ec2에 할당할 권한을 만들어야 한다. 결국 최종적으로 배포할 곳은 Ec2기 때문에 Ec2 권한 설정은 당연한 수순이다. <br>
먼저 AWS 페이지에서 다음과 같은 경로로 들어간다. <br>
**IAM -> 역할 -> 역할생성** <br>
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNqsyIntaXbRKCxmcf_Z9r-Abe34AfYKDGNrgI1vCSdZ40?width=1024 alt="아키텍쳐" />
</div> <br>
그 후 아래와 같이 설정
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQO7h4n1sBMXTb0r3cUVS_wNAUKQh08ymvDTGBcg3itiYco?width=1024 alt="아키텍쳐" />
</div><br>
AWSCodeDeployFullAccess 와 AmazonS3FullAccess 2개 선택 <br>
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNi53WlbB_NR4xGnwe--w8PATwtAkMOar9T3XrpI4164yM?width=1024 alt="아키텍쳐" />
</div><br>
이름지정 
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQPGSdrNw4qlQrqHDkOl984nAeqsejEfMqOffkNUaHPH_kY?width=1024 alt="아키텍쳐" />
</div>
브로커에 할당 <br>
**EC2 -> 작업 -> IAM 역할 수정 -> 방금 만든 IAM role** 할당 <br>
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNvQ7oDInPFQ6Sm1zlMcKanAcDEYys6R8r8M0SQLSjnZiw?width=1024 alt="아키텍쳐" />
</div>
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQN9s4bdplthSYlp77TSaQ3tAcCcy7bAolqhEe4RjNXEa8w?width=1024 alt="아키텍쳐" />
</div>

다음으로 Ec2가 아닌 codedeploy에 대한 권한도 설정해주어야 한다. 바로 위에서 진행한 EC2 할당용과 권한만 다르고 나머지는 똑같이 해서 생성해주도록 하자 <br>

**달라지는 점**
1. 엔티티 선택에서 EC2가 아니라 <font color="#c00000">CodeDeploy</font> 선택
2. 권한 추가시 <font color="#c00000">AWSCodeDeployRole </font>하나만 추가

### CodeDeploy 생성(Application)
**Codedeploy -> 애플리케이션 -> 애플리케이션 생성** <br>
권한을 생성했으니 이제 CodeDeploy 앱을 생성해보자 위 경로로 들어가 아래 처럼 설정해주자
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQOy6-SiWWpsQZ5VgULLahR4AeBrDMbWlBp5qhxN_PkSERc?width=1024 alt="CodeDeploy 생성" />
</div>

### 배포그룹 생성
이제 만든 애플리케이션이 어디에 배포할 것인지 배포 그룹을 설정해줄 차례이다. 아래 과정을 잘 따라가 보자
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQPkLTtAxD9USrDW7MleoM_tATL1KL9o4BlXR9zGJf6Y_08?width=1024 alt="배포그룹 생성" />
</div>
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQPCexHjBrlATLgmnszA71S2AZ4TSBNXG5oQqwiSSLYz__A?width=1024 alt="배포 유형 및 환경 구성" />
</div>

여기까지 잘따라왔으면 배포 설정을 선택해 주어야 한다. 
배포설정은 <font color="#c00000">AllatOnce로 설정</font> 하도록 하자 <br>나는 실시간 처리 특성상 가용성을 위해 AllAtTime으로 설정했다. 
>배포 설정
>- OneAtATime: 한 번에 하나의 인스턴스에 배포, 전체가 배포 성공해야 성공으로 간주
>- HalfAtATime: 절반씩 나누어 배포, 최종적으로 절반 이상의 인스턴스에 배포 성공하면 성공으로 간주
>- AllAtTime: 최대한 한번에 많은 인스턴스에 배포, 1개의 인스턴스에 라도 배포 성공하면 성공으로 간주
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQOBPhjqqNLMR6dv2mJibzX1Aeq4pvImkSMUitv8l8rfH0M?width=1024 alt="배포 유형 및 환경 구성" />
</div><br>
마지막으로 로드 밸런서 해제만 체크 해주면 비로소 Codedeploy 설정이 끝나게 된다. 우리는 CD 즉, 지속적 배포가 목적이기 때문에 로드 밸런서는 따로 필요하지 않다. 
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNOB1rbSW0kT4_sXYCji7DEAfaMG5LiSHjAijUuLKkDVm8?width=1200&height=280 alt="로드 밸런서" />
</div>

### CodeDeploy Agent 설치
이제 CodeDeploy Agent라는 것을 브로커에 설치해주어야 한다. codedeploy가 ec2 내에서 동작할 수 있도록 해주는 것인데 아래 공식문서 기반으로 각각 카프카 브로커에 설치한다. <br>
[CodeDeploy Agent 설치 공식문서](https://docs.aws.amazon.com/ko_kr/codedeploy/latest/userguide/codedeploy-agent-operations-install-ubuntu.html)

### S3 생성
S3 버킷은 우리가 중요한 저장소를 만들어서 관리하다기 보다 그냥 배포할 tar 파일이 잠깐 저장되는 휴계소? 검문소? 같은 곳이라 크게 중요하지 않다. 그냥 모든 설정을 디폴트로 설정해주면 된다.
아래처럼 버킷 =이름과 디렉토리만 하나 생성해주도록 하자
- 버킷이름: datalake-actions-deploy으로 설정(사실 이름도 본인이 원하는 형태로 설정해줘도 된다.)
- 디렉토리 추가하기: 폴더 이름은 kafka-producer

### AWS -  USER 생성 (github 접근용)
#### 사용자 생성
마찬가지로 굉장히 간단한 과정이다.
먼저 **IAM -> 사용자 -> 사용자 생성**으로 들어간다. 
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNgbYU2G0IzRplnvx_DafMvAdkBXLJrmcDdf1OSnAYxMaE?width=1340&height=622 alt="github 접근용 AWS USER 생성" />
</div>

이때 사용자를 생성해 주는데 권한은 EC2 할당용과 마찬가지로 <font color="#c00000">S3FullAccess & CodeDeployFullAccess</font> 2가지를 지정해준다. 
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQMUJc61pBy2T6DVHzFBZlJKAfaXjy6up3eHLIYGi-R1qL0?width=1246&height=508 alt="github 접근용 AWS USER 생성" />
</div>

### 엑세스 키 생성
전 단계에서 만든 사용자 -> 엑세스 키 생성을 선택한다.
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNrZmzeyJROTYK7LreOLlp8ARJIfFVmyH6xJNw4ZwuuSak?width=1322&height=548 alt="엑세스 키 생성" />
</div><br>
그럼 다음과 같이 <font color="#c00000">ACCESS KEY</font>와 <font color="#c00000">SECRET ACCESS KEY</font>가 만들어진다.
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNVa_UAh0MRQaXVmeec5O_iAWHPbVQ9Vx0i0fz4eUWm9kk?width=1102&height=544 alt="엑세스 키 저장" />
</div>

<font color="#c00000"> *주의! 창을 닫은 후 비밀 엑세스 키는 다시는 볼 수 없기에 꼭 사전에 저장해두기* </font>

#### Github에 엑세스 키 할당
아래 사진의 경로 처럼 들어가 SECRET KEY에 AWS USER ACCESS KEY 할당
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQMAMMyEitDeRoSUFJdefk9CAR0UGp7N8ZGrzM8D3UxTBfo?width=1028&height=638 alt="엑세스 키 저장" />
</div>
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQP7lJ1rD6wtR4YA73rwRkSqAexTPTQUc1mNqjHr9EEtUTE?width=2472&height=612 alt="엑세스 키 저장" />
</div>

## CORE2 - CI/CD Develope

드디어 막바지 스텝이다 이제 CI/CD를 위한 몇가지 필수 파일을 설정해주면 된다. <br>
필요한 파일은 아래 두 가지다. <br>

- Github action에 필요한 <font color="#c00000">workflow.yaml </font> <br>
- codeDeploy에 필요한 <font color="#c00000">appspec.yaml </font> <br>

두 가지 파일은 아래 github 링크에 가면 자세하게 확인이 가능하다. 아래 appspec.yaml 파일처럼 주석으로 이쁘게 설명해두었기에 별다른 설명은 하지 않겠다. <br>
[Ddareungi-kafka-producer-Github](https://github.com/StatisticsFox/Ddareungi-kafka-producer/tree/main)

appspec.yaml 파일
```yaml
# CodeDeploy의 어플리케이션 스펙을 정의하는 파일입니다. 
# version은 필수적으로 명시해야 하며, 현재는 0.0만 지원됩니다.
version: 0.0

os: linux

# 파일을 복사할 경로를 지정합니다.
# files 항목에서는 source와 destination을 여러 개 지정할 수 있으며,
# 하위 디렉토리별로 destination을 다르게 지정할 수 있습니다.
# source가 디렉토리일 경우, 디렉토리 내부의 파일 및 서브 디렉토리들이 복사됩니다 (지정한 디렉토리 자체는 복사되지 않음).
# source가 파일일 경우, 해당 파일이 복사됩니다.
files:
  - source: /
    destination: /home/ubuntu/kafka-producer
    
# destination 경로에 동일한 파일이 이미 존재할 경우의 행동을 지정합니다.

# 다음 세 가지 옵션 중 하나를 사용할 수 있습니다:
# - DISALLOW: 동일한 파일이 존재할 경우 복사를 허용하지 않습니다.
# - OVERWRITE: 동일한 파일이 존재할 경우 기존 파일을 덮어씁니다.
# - RETAIN: 동일한 파일이 존재할 경우 기존 파일을 유지합니다.
file_exists_behavior: OVERWRITE

# 파일 복사 후 권한을 상세하게 지정할 수 있습니다.
# pattern과 except 키워드를 통해 대상 파일을 구체적으로 지정할 수 있습니다.
permissions:
  - object: /home/ubuntu/kafka-producer
    owner: ubuntu    # 파일의 소유자(owner)를 지정합니다.
    group: ubuntu   # 파일의 그룹(group)을 지정합니다.
    mode: 755      # 파일의 권한(mode)을 지정합니다. 여기서는 rwxr-xr-x로 설정됩니다.


hooks:
  ApplicationStop:
    - location: ./config/applicationstop.sh
      timeout: 60
  
  ApplicationStart:
    - location: ./config/applicationstart.sh
      timeout: 60
```

위와 같이 CI/CD에 필요한 파일들을 작성해서 github 안에 두면 다음과 같이 main에 push가 일어날때마다 빌드가 이루어진다.
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQPKT-L03iPrRbWGolywATIFAU3AY8CACWYpK9UUl9WBdrE?width=1024 alt="CI" />
</div>
<br>
또한 빌드가 완료되면 다음과 같이 codedeploy가 S3의 파일을 가져와 EC2로 배포한다.
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQOyzh6Y8PH6SJJjiY0ytEivARlhptPF-qvm2nXywiFAJEU?width=1024 alt="CD" />
</div>
<br>
마지막으로 카프카 broker에 가서 확인해 보면 3개의 브로커 서버 모두에 kafka producer가 동일하게 배포된것을 확인 가능하다.
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQMsrdT_tUrVSaZ28XefpYS1AR7lO2Et7ZP39mjXqR3v1aE?width=1032&height=888 alt="배포 확인" />
</div>

## FI
이렇게 Github Actions과 AWS CodeDeploy를 이용한 CI/CD구현할 수 있었다. 솔직히 어렵지는 않았으나 이유가 있다. 바로 TEST가 빠졌다는 것이다. 원래 보통 CI/CD는 웹서비스를 배포하거나 도커 파일을 배포할때 지속적으로 배포하기 위해 쓰인다. 그런 형태의 서비스인 경우 다양한 환경에서의 테스트가 굉장히 중요해서 CI파트에서 필수적으로 테스트가 진행되고 테스트에 실패할 시 재개발을 해야한다. <br> <br>
이번 프로젝트에서는 producer 하나만 보는 것이기 때문에 테스트 환경 구축을 CI마다 하는 것보다. 그냥 서버 내에서 수동으로 실행하는게 훨씬 편했고 빠르게 할 수 있었기에 CI에서 많은 시간을 잡아먹는 테스트를 뺐다. <br> <br>
그래도 전체적으로 CI/CD환경을 구축해보고 개발시 굉장한 편리함을 가져가구 있다. 지금 쿠버네티스를 공부중인데 Argo를 이용한 CI/CD도 도전해볼 것이다. 


```toc
```