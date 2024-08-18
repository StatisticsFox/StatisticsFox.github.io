---
emoji: 🏓
title: nginx로 Spark, Yarn, kafka 등 리소스 관리 Web ui 구성하기
date: '2024-08-18 20:30:00'
author: 최지혁
tags: Data nginx
categories: Data_Engineering
---
## 들어가기에 앞서
kafka 토픽관리나 메모리 관리 그리고 SPARK 메모리나 yarn 그리고 프로케테우스와 그라파나 등이 잘 작동하는지 모두 cli로 관리하는것은 명백한 한계가 존재한다. 너무 불편하고 그게 다 시간 자원 빼먹는거다. 때문에 Web ui로 관리하는 것이 보통 굉장히 편한데 사용하는 리소스와 툴이 늘어나는 만큼 많은 Web ui를 띄워야 한다.

그동안 나는 포트 포워딩으로 모든 ui를 띄웠다. 이렇게 됐을 경우 단점은 <font color="#c00000">인스턴스를 끄고 킬때마다 매번 포트포워딩을 수동으로 해주어야 한다는 것이다.</font>그동안은 한번에 포트 포워딩을 해주는 .sh파일을 길게 만들어서 해결해왔으나 점점 감당하기 어려운 수준까지 갔다. 때문에 도입한 것이 바로 우리 팀원 로컬 내부의 hosts에 ip주소와 도메인 이름을 지정해두고 nginx로 ui를 띄울 수 있도록 설정해두는 방향이었다.

<div align="center">
    <img src= https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21211&authkey=%21AInaQqp_g1hhKd0&width=564&height=311 alt="시작해보자" />
</div>

## nginx 설정
### public-nat에 nginx 설치하여 http rewrite할 수 있도록 설정
먼저 nginx를 public-nat에 설치해 주고 nginx.conf를 관리자 권한으로 수정해준다.
```bash
ec2-user$ sudo yum install nginx
ec2-user$ cd /etc/nginx
ec2-user$ sudo vi nginx.conf
```

그 후 include 바로 아래 server 블록 기존 내용 삭제 후 아래 resolver와 server 블록 삽입하면 된다. 간편함을 위해 우선 kafka web ui만 들고왔다. 
```sh
# include /etc/nginx/conf.d/*.conf; <- 요 아래에 작성

    resolver 127.0.0.1;
 		server {
        listen 8080;
        server_name kafka03;
        location / {
            proxy_pass http://<private IP address>:<port>;  # 실제 백엔드 주소로 변경
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
```
위 양식으로 모든 포트를 다 지정해 주면 된다. 지금 위 양식으로 conf에 지정하면 server_name에 지정한 이름이 바로 도메인 이름이다. 나중에 로컬에도 적용해줄 예정이니 잘 기억해주자.

## Nginx 서비스 시작
### nginx.conf 작성 완료되면 nginx 서비스 시작
```bash
ec2-user$ sudo systemctl start nginx
ec2-user$ sudo systemctl enable nginx
```
### 로컬의 /etc/hosts 를 이용하여 resolve 하도록 추가 패키지 설치
다음은 필요한 패키지를 하나 더 설치해 줄거다. `dnsmasq`라는 건데 경량 DNS 포워더 및 DHCP 서버다. 이걸로 로컬 호스트 파일(/etc/hosts)을 사용하여 도메인 이름을 IP 주소로 변환할 수 있다. 우리는 로컬에서 접속할 것이기 때문에 ip주솔르 변환해주는 핵심 패키지이다.
```bash
ec2-user$ sudo yum install dnsmasq
ec2-user$ sudo systemctl start dnsmasq
ec2-user$ sudo systemctl enable dnsmasq
```
### 서버 방화벽해제 및 영구저장
방화벽을 해제해주고
```bash
ec2-user$ sudo iptables –F
ec2-user$ sudo service iptables save
```

## 로컬의 hosts 파일 수정
### 로컬 환경의 hosts 파일에 호스트 등록
/etc/hosts 파일에 아래 public-nat에 할당된 Elastic IP 확인 후 바로 입력해주도록 한다.
본인 로컬의 /etc/hosts 밑에 아래처럼 적용해준다. 이름은 아까 nginx.conf에서 설정했던 server_name임을 잊지말자
```bash
{Elastic IP} kafka01 # Elastic IP <- public NAT IP
{Elastic IP} kafka02
{Elastic IP} kafka03
```

## 확인
그러면! 짠! 굳이 public nat의 ip 주소와 포트포워딩을 이용하지 않아도 이제는 언제든지 서버를 키면 설정해둔 도메인 이름으로 원하는 webui에 접속이 가능하다. 
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQNF77uX7iyER6tUXEZYC-EMAV7SE2amV7b9rzz7SGpVVKM?width=1024 alt="kafka_web_ui" />
</div>
