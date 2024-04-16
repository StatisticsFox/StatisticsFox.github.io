---
emoji: 🧰
title: AWS - jammy InRelease & 101 Network is unreachable 해결하기
date: '2024-04-16 22:47:21'
author: 최지혁
tags: AWS, jammy, 101
categories: ERROR Cloud
---
# AWS - jammy InRelease & 101: Network is unreachable
## jammy InRelease 오류
카프카 브로커 Ubuntu 서버에 java를 설치하려고 하는데 아래와 같은 문구가 뜨면서 동작이 되지 않았다. 무슨 jammy가 inrelease된 것 같은데 재미 하나도 없고 머리 아프다
```
Ign: 1 http://ap-northeast-2.ec2.archive.ubuntu.com/ubuntu jammy InRelease
Ign: 2 http://ap-northeast-2.ec2.archive.ubuntu.com/ubuntu jammy-updates InRelease 
Ign: 3 http://ap-northeast-2.ec2.archive.ubuntu.com/ubuntu jammy-backports
Cannot initiate the connection to ap-northeast-2.ec2.archive.ubuntu.com:80 (2406:da12:944:ae00:128:62c8:e? ). - connect (101: Network is unreachable)
```
다행히도 해당 에러에 대해서는 AWS측에서 답변 달아준 부분 있다. 
![](https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21190&authkey=%21ADpusYyw3sAPnzs&width=1232&height=1038)

### 공식 해결 방법
대충 해석을 보면 아래의 포인트들을 다시 체크해봐라 같은데 해석해보면 다음과 같다.
- 현재 EC2가 제대로 작동하는 다른 EC2들과 <font color="#c00000">동일한 VPC 및 서브넷에 배포되었는가</font>?
- 그게 아니라면 VPC가 <font color="#c00000">인터넷 게이트웨이로 인터넷에 접근이 허용</font>되어 있는가?
- 서브넷이 public이라면 인터넷 바운드 트레픽을 <font color="#c00000">인터넷 게이트 웨이로 라우팅</font><font color="#c00000">하는</font> <font color="#c00000">라우팅 테이블이 있는가</font>?
- 서브넷이 private이라면 인터넷 바운드 트래픽을 공용 서브넷의 <font color="#c00000">NAT 게이트 위에이로 라우팅하는 라우팅 테이블이 있는가</font>?

### 체크리스트
첫째로, EC2는 <font color="#245bdb">동일한 VPC에 배포</font>되었으며 각각의 브로커 서브넷은 private로 두기 위해 종류를 다르게 하였다.
둘째로, 나는 비용절감을 위해<font color="#245bdb"> NAT Instance를 구축</font>했고 public NAT 서버는 라우팅 테이블이 잘 설정되어 있으며 <font color="#245bdb">라우팅 테이블은 3개의 브로커 서브넷을 잘 가리키고 있었다.</font>
셋째로 브로커 private 서브넷의 <font color="#245bdb">바운드 규칙 또한 public NAT에 잘 뚫어준 것도  확인</font>했다. 

따라서 해당사항은 없다고 생각했다. 때문에 같이 나온 에러인 <font color="#c00000">80번 포트 접속에 대한 101 에러에 대해서 탐색</font>해보기로 했다. 

## 101: Network is unreachable 오류
해당 사항에 대해서는 구글링 및 AWS 답변을 찾아본 결과 80번 포트가 막혀있어서 그렇단다. 때문에 public nat의 인바운드와 아웃바운드 규칙을 잠시 모든 TCP에 대하여 허용해주었다. 
 하지만 여전히 같은 에러가 났다...

# 오류 해결 방법
## IPtable 설정하기
이렇게 허무할 수가, 알고보니 iptable 설정이 잘 못 되어 있었다... 인프라 설정 덕분에 3시간이 날아가 버렸다..
>iptable이란?
> 리눅스에 저장된 네트워크 패킷 필터링 시스템으로 네트워크 트래픽을 관리하여 패킷을 허용하거나 차단할 수 있다. 

아래처럼 iptable을 설치해주면 이제 인터넷 연결이 될 것이다.
```shell
$ sudo yum install iptables-services -y
$ sudo systemctl enable iptables
$ sudo systemctl start iptables
$ sudo vi /etc/sysctl.d/custom-ip-forwarding.conf
net.ipv4.ip_forward=1

$ sudo sysctl -p /etc/sysctl.d/custom-ip-forwarding.conf
$ sudo /sbin/iptables -t nat -A POSTROUTING -o enXO -j MASQUERADE
$ sudo /sbin/iptables -F FORWARD
$ sudo service iptables
```
# 마무리 
AWS는 삽질을 통한 깨달음을 얻어야 한다!! 해결됐을때 그 시원함도 너무 좋다.

```toc
```