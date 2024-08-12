---
emoji: 🍤
title: Terraform으로 AKS에 airflow 띄우고 git으로 DAG 관리하기
date: '2024-08-11 22:43:23'
author: 최지혁
tags: Data AKS Terraform GIT
categories: Data_Engineering
---
## 들어가기에 앞서
이번에 RAG를 이용한 채용정보 챗봇 구축을 위해 Azure 쿠버네티스 환경(통칭 AKS)에서 ETL 프로젝트를 해보기 위해 아래와 같은 계획을 짰다. 
1. 프로젝트 환경에 airflow를 띄우고 주기적인 크롤링
2. SPARK를 통한 데이터 마트 구축
3. GPT-3 토크나이저를 이용한 데이터 임베딩
4. 크로마 DB에 데이터 적제
   
이거 할 생각에 잔뜩 기대하고 허겁지겁 일단 AKS 위에 쿠버네티스를 올린 후 pod에 airflow를 올리고 DAG를 GIT으로 관리할 수 있게끔 구성했다. ACR(Azure Container Registry)도 만들어 도커로 환경 배포까지 자동화를 해놨으나 <font color="#c00000">결국 무산 되었다...</font><br><br>
그 이유는 바로 비용문제이다. 일단 내가 개발한 크롤러로 데이터를 수집하면 데이터의 형태가 다음과 같다.
```json
{
    "Datetime": "2024-08-10",
    "title": "[강동/통근] 삼성E&A 비서/사무보조 사원 채용",
    "URL": "https://www.saramin.co.kr/zf_user/jobs/relay/view?view_type=search&rec_idx=48782490&location=ts&searchType=search&paid_fl=n&search_uuid=004d110a-a231-41c0-92da-9655708bbb41",
    "metadata": "(주)에스이에스, [강동/통근] 삼성E&A 비서/사무보조 사원 채용, 경력:경력무관, 학력:학력무관, 연봉:2,960 만원, 마감일:2024-08-19, 홈페이지:www.seshr.co.kr",
    "end_date": "2024-08-19,",
    "start_date": "2024.08.09 14:00",
    "Work_history": "무관(신입포함)",
    "Education": "학력무관",
    "Job_type": "계약직, 파견직\n상세보기",
    "Salary": "연봉 2,960 만원 (주 40시간)",
    "근무형태": "상세보기",
    "working time": "주 5일(월~금) 08:00~17:00",
    "working area": "서울 강동구 지도",
    "Co_name": "(주)에스이에스",
    "img_list": [],
    "detail_data": "[강동/통근] 삼성E&A\n비서/사무보조 사원 모집\n모집부문 및 상세내용\n공통 자격요건\nㆍ학력 : 무관\n비서행정 1명\n     담당업무\n    ㆍ비서 업무\n    ㆍ팀 서무 업무(팀 공통 업무 지원)\n    ㆍ예산 및 월별 결산 지원(경비처리, 계산서 등)\n    ㆍ출장 지원(비자신청 및 예약 등)\n\n 자격사항\nㆍ동종업계 경력자 우대\nㆍMS-Office(워드/엑셀/파워포인트) 능통자 우대\nㆍ경리업무 경험자(SAP 또는 ERP시스템 유경험자 우대)\nㆍ근거리 거주자 우대\n\n  ■ 삼성그룹사 경력 쌓을 수 있습니다.\n  ■ 면접합격 이후 빠른 출근 가능\n  ■ 서울,경기,인천권 통근버스 운행\n  ■ 경력 증명서 발급 가능\n\n근무조건\n\n\n근무형태 : 파견계약직 (12개월/연장 시 최대 2년까지 근무가능) \n근무일시 : 주 5일(월~금) 08:00 ~ 17:00 (점심시간 11:30 ~ 13:30 中 1시간)\n근무지역 : 서울 강동구 상일로 6길 26 글로벌엔지니어링센터(상일동역 인근)\n급여수준 : 2,224,000원(세전) + 명절상여금 별도 (설날/추석 각 148만 연 2회) + 연차수당 별도(잔여 발생 시)  = 연봉기준 약 2,960만\n\n복리후생 : 명절상여금(연 2회/근속기간 무관) / 4대보험 / 연차수당 / 경조휴가 / 명절선물 등\n \n\n전형절차\n서류전형\n1차면접\n최종합격\n접수기간 및 방법\nㆍ 접수기간 : ~ 2024년 08월 19일 (월) 09시\nㆍ 접수방법 : 사람인 입사지원 또는  sh0722@seshr.co.kr 메일 접수\nㆍ 이력서양식 : 자사양식 (첨부파일 참조) \n유의사항\nㆍ입사지원 서류에 허위사실이 발견될 경우, 채용확정 이후라도 채용이 취소될 수 있습니다."
}
```
여기서 문제가 바로 'detail_data'다. 이 데이터를 `임베딩하는데 드는 비용`, `학습시키는데 드는 비용`, 그리고 프롬프트만해도 `API 비용`이 엄청나다. 근데 해당 기능은 필수적인 기능이라 데이터 엔지니어링 파트에서 비용 절감을 하는 수밖에 없었고 쿠버네티스를 사용하지 않기로 했다.ㅜㅜㅜ(~~데엔의 희생..~~)  <br><br>
이거 어떻게 할까 알아보는데 <font color="#c00000">EKS는 노드 풀 단계에서 부터 서버리스가 가능</font>한 반면 <font color="#0096FF">AKS</font>는 노드 풀 비용은 필수 그리고 그 후 <font color="#0096FF">스케일 아웃에서만 서버리스가 제공</font>된다는 사실을 알았다. ~~Azure 싫어하는거 아닌데 뭔가 맛이 없다.~~
다만 우리는 한이음 멘토님이 마소 현역이라 AWS 금지령이 내려져서 울며 겨자먹기로 Azure를 써야 하는 상황이다.

결국 그냥 AzureFunction을 사용해서 주기적으로 크롤링을 하고 VM 하나 띄워서 그 안에 Chroma DB를 띄우기로 했다.

그래서 이미 진행한 AKS 구축해 둔게 아무쓸모가 없어졌다! 때문에 이대로 폭파시키기는 너무 아쉬워 그 과정을 기록해 두고자 한다.
<br>
그럼 시작해보자.
<div align="center">
    <img src= https://onedrive.live.com/embed?resid=9DED56BE8CF81C92%21211&authkey=%21AInaQqp_g1hhKd0&width=564&height=311 alt="시작해보자" />
</div>

## Prerequisites
해당 패키지들이 설치되어 있는지 우선 확인하자
- [az cli](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)가 설치되어 있는지
- .kubectl를 설치했는지 [az aks install-cli.](https://learn.microsoft.com/en-us/azure/aks/learn/quick-kubernetes-deploy-cli#connect-to-the-cluster)
- [Terraform CLI](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)가 설치되어 있는지.


## Terraform을 이용한 AKS 구성
본인이 클라우드 환경에서 Portal 만지는게 어렵다?? 그럼 그냥 고개를 들어 Terraform을 보면 된다. <font color="#c00000">Terraform은 인프라를 코드로 관리할 수 있게 해주는 굉장히 편리한 도구</font>로 apply 딸깍 한번에 수많은 설정들이 적용되어 인프라 구축이 가능하다. 물론 러닝커브가 있으나 튜토리얼이 사례 별로 "아니 이 정도까지 친절하다고?"수준으로 잘 나와 있기에 그대로 따라하면된다. GPT가 필요 없을 정도로 친절하다.
<br>
[Terraform 튜토리얼](https://registry.terraform.io)<br>
[Terraform 공식 docs](https://developer.hashicorp.com/terraform/docs)

그럼 코드를 보도록 하자
### providers.tf
providers는 가장 기초적인 파일로 기본적인 패키지나 설정 그리고 내가 어떤 플랫폼의 인프라를 사용할 것인지 사전 정의를 해두는 파일이다.
```json
provider "azurerm" {
  skip_provider_registration = "true"
  features {}
}

terraform {
  required_version = ">=1.0"

  required_providers {
    azapi = {
      source  = "azure/azapi"
      version = "~>1.5"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~>3.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.9.1"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~>2.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~>2.0"
    }
  }
}

provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.aks_cluster.kube_config[0].host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.aks_cluster.kube_config[0].client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.aks_cluster.kube_config[0].client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.aks_cluster.kube_config[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = azurerm_kubernetes_cluster.aks_cluster.kube_config[0].host
    client_certificate     = base64decode(azurerm_kubernetes_cluster.aks_cluster.kube_config[0].client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.aks_cluster.kube_config[0].client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.aks_cluster.kube_config[0].cluster_ca_certificate)
  }
}
```

### variables.tf
main.tf에 정의될 변수들을 미리 선언해둔 파일이다.
```json
variable "app_name" {
  type        = string
  description = "name of the application"
}

variable "location" {
  type        = string
  description = "location for the resources"
}
```

### main.tfvals
variables.tf에 선언된 변수들의 실재값이다.
```json
app_name = "airflow"
location = "koreacentral"
```
### main.tf
해당 파일은 내가 생송하고자 하는 플렛폼과 제품에 따라서 전부 다르기에 따로 리뷰는 하지 않겠다. 위에있는 terraform 가이드를 살펴보고 스스로 구축을 해보면 된다.
간단하게만 언급하면 아래와 같다.
- Airflow 로그를 저장하기 위한 Blob 컨테이너를 프로비저닝 코드
- 이미지를 가져오기 위한 ACR 프로비저닝 코드
- 리소스 그룹 프로비저닝 코드
- 기본 노드 풀이 있는 Kubernetes 클러스터 정의
```json
resource "azurerm_resource_group" "rg" {
  name     = "${var.app_name}rg"
  location = var.location
}

# Azure Kubernetes Cluster

resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.app_name}aks"
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "${var.app_name}-aks"

  default_node_pool {
    name       = "default"
    node_count = 1
    vm_size    = "Standard_DS2_v2"
  }

  identity {
    type = "SystemAssigned"
  }

  storage_profile {
    blob_driver_enabled = true
  }
}
# Azure Container Registry

resource "azurerm_container_registry" "acr" {
  name                = "${var.app_name}acregistry"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.location
  sku                 = "Standard"
  admin_enabled       = true
}

resource "azurerm_role_assignment" "main" {
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  role_definition_name = "AcrPull"
  scope                = azurerm_container_registry.acr.id
}

# Blob storage for Airflow logs

resource "azurerm_storage_account" "airflow" {
  name                     = "${var.app_name}airflowlogs"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "airflow_logs" {
  name                  = "airflow-logs"
  storage_account_name  = azurerm_storage_account.airflow.name
  container_access_type = "private"
}

resource "azurerm_storage_management_policy" "prune_logs" {
  storage_account_id = azurerm_storage_account.airflow.id

  rule {
    name    = "prune-logs"
    enabled = true
    filters {
      prefix_match = ["airflow-logs"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 7
      }
    }
  }
}
```

## Azure 인프라 배포를 위한 서비스 주체 생성
Azure에 인프라를 배포하려면 먼저 인프라를 배포할 권한이 있는 서비스 주체를 만들어야 한다. 아래처럼 진행해주자.
```zsh
az login

export SUBSCRIPTION_ID=$(az account show --query id -o tsv)
export SERVICE_PRINCIPAL_NAME="InfrastructureAccount"

az ad sp create-for-rbac \
    --name $SERVICE_PRINCIPAL_NAME \
    --role "Owner" \
    --scopes "/subscriptions/$SUBSCRIPTION_ID" > credentials.json
```
> <font color="#c00000">주의!⚠️⚠️⚠️⚠️⚠️⚠️</font> <br>
> 다만 credentials.json의 내용은 비밀로 유지해야 한다. 공개적으로 노출하지 않도록 해야 하기에 혹시라도 github에 게시할 때는 `.gitignore`을 사용 하도록 하자.

또한 Terraform이 서비스 주체로 인증하려면 일부 환경 변수를 설정해야 하는데 아래 코드를 통해 진행 가능하다.
```zsh
export ARM_CLIENT_ID=`cat credentials.json | python -c 'import json,sys;obj=json.load(sys.stdin);print(obj["appId"])'`
export ARM_CLIENT_SECRET=`cat credentials.json | python -c 'import json,sys;obj=json.load(sys.stdin);print(obj["password"])'`
export ARM_TENANT_ID=`cat credentials.json | python -c 'import json,sys;obj=json.load(sys.stdin);print(obj["tenant"])'`
export ARM_SUBSCRIPTION_ID=`az account show --query id -o tsv`
```

## AKS 클러스터 배포
이제 배포를 해보자
```zsh
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```
그럼 생각보다 오래걸리는데 그동안 유튜브 한편 보고와도 좋다.
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQMBrL5LviN7QqpIXek04U-uAZtjNP0bDt0Mqceq2lxFbbY?width=1024 alt="생성중" />
</div>
그럼 이렇게 생성되었다고 초록색으로 글씨가 나올 것이다.
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQOwZsSusgahRbOkT2cYObDhATPZGsIU8T2y7KTQlE_vxB0?width=1024 alt="생성완료" />
</div>

이제 모든 포트를 나열해보자
```zsh
NAMESPACE     NAME                                  READY   STATUS    RESTARTS   AGE
kube-system   azure-ip-masq-agent-58pln             1/1     Running   0          20h
kube-system   cloud-node-manager-glrh9              1/1     Running   0          20h
kube-system   coredns-76b9877f49-8h6cz              1/1     Running   0          20h
kube-system   coredns-76b9877f49-pjjdb              1/1     Running   0          20h
kube-system   coredns-autoscaler-85f7d6b75d-wdbwd   1/1     Running   0          20h
kube-system   csi-azuredisk-node-mmpxj              3/3     Running   0          20h
kube-system   csi-azurefile-node-sbw7j              3/3     Running   0          20h
kube-system   csi-blob-node-jhtnr                   3/3     Running   0          17h
kube-system   konnectivity-agent-659478b8b7-gpkwv   1/1     Running   0          20h
kube-system   konnectivity-agent-659478b8b7-zqksv   1/1     Running   0          20h
kube-system   kube-proxy-c48c8                      1/1     Running   0          20h
kube-system   metrics-server-c456c67cb-dqv8f        2/2     Running   0          20h
kube-system   metrics-server-c456c67cb-r9f82        2/2     Running   0          20h
```

## Helm을 사용하여 Airflow 설치
이제 [Airflow Helm 차트](https://github.com/apache/airflow/tree/main/chart)를 이용해서 Airflow를 설치해보자

먼저 아래와 같은 `valuse.yaml` 파일을 만들어준다.
### values.yaml
```yaml

# Select certain nodes for airflow pods.
nodeSelector:
  agentpool: default

# Airflow executor
executor: 'KubernetesExecutor'

# Environment variables for all airflow containers
env:
  - name: ENVIRONMENT
    value: dev

extraEnv: |
  - name: AIRFLOW__CORE__DEFAULT_TIMEZONE
    value: 'Asia/Seoul'

# Configuration for postgresql subchart
# Not recommended for production! Instead, spin up your own Postgresql server and use the `data`
# attribute in this yaml file.
postgresql:
  enabled: true

# Enable pgbouncer.
# See https://airflow.apache.org/docs/helm-chart/stable/production-guide.html#pgbouncer
pgbouncer:
  enabled: true>
```
## DAG를 동기화하기 위한 GitSync
이제 DAG와 Github Repo를 동기화 해주어야 한다. 그 과정에서 SSH 인증키를 만들고 GIt hub 저장소에 배포키로 추가하면 된다.

### ssh-key 생성
```zsh
ssh-keygen -t rsa -b 4096 -C "your@email.com"

cat ~/.ssh/airflowsshkey.pub
```

### namespace 생성 후 values.yaml 마무리
```zsh
kubectl create namespace airflow

kubectl create secret generic -n airflow airflow-git-ssh-secret \
	--from-file=gitSshKey=$HOME/.ssh/airflowsshkey
```

그리고 아래 내용을 values.yaml 파일에 추가해준다.
```yaml
gitSync:
    enabled: true
    repo: <본인 Repo ssh>
    branch: main
    rev: HEAD
    depth: 1
    maxFailures: 0
    subPath: 'dags'
    sshKeySecret: airflow-git-ssh-secret
    knownHosts: |
      github.com ssh-rsa <secret key>
```
위 내용은 main 브렌치의 dags 폴더를 동기화하겠다는 단순한 뜻이다. <br>
다만, 여기서 주의할 점이 ssh-rsa 다음에 오는 key는 방금 생성한 키가 아니라 GitHub 서버의 호스트 키를 말하는 것이다. 아래 공식문서를 잘 살펴보자
- [GitHub의 SSH 키 Fingerprints 공식 문서](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)

## blob을 사용한 로그 저장
다음은 로그 저장소를 설정하는 것이다. 보통 pv 및 pvc를 사용해서 저장한다. 나는 airflow라는 디렉토리를 만들어서 저장했다.

### pv-logs.yaml
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-airflow-logs
  labels:
    type: local
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain # If set as "Delete" container would be removed after pvc deletion
  storageClassName: azureblob-fuse-premium
  mountOptions:
    - -o allow_other
    - --file-cache-timeout-in-seconds=120
  csi:
    driver: blob.csi.azure.com
    readOnly: false
    volumeHandle: airflow-logs-1
    volumeAttributes:
      resourceGroup: airflowrg
      storageAccount: airflowairflowsa
      containerName: airflow-logs
    nodeStageSecretRef:
      name: storage-account-credentials
      namespace: airflow
```
### pvc-logs.yaml
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-airflow-logs
spec:
  storageClassName: azureblob-fuse-premium
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 5Gi
  volumeName: pv-airflow-logs
```
PersistentVolume과 PersistentVolumeClaim을 프로비저닝 하는 코드를 짰으므로 당연히 해당 리소스에 대해서도 secret을 정의해주어야 한다. 아래 코드로 간단하게 만들 수 있다.

```bash
export STORAGE_ACCOUNT_KEY=$(az storage account keys list \
        -g airflowrg \
        -n airflowairflowlogs \
        --query '[0]'.value \
        -o tsv)

kubectl create secret generic -n airflow storage-account-credentials \
	--from-literal azurestorageaccountname=airflowairflowsa \
	--from-literal azurestorageaccountkey=$STORAGE_ACCOUNT_KEY \
	--type=Opaque
```
그리고 적용해주자
```bash
kubectl apply -n airflow -f airflow/pv-logs.yaml
kubectl apply -n airflow -f airflow/pvc-logs.yaml
```

## values.yaml 파일 마무리
이제 설정 파일인 values.yaml파일을 마무리 해줄거다 여기서 logGroomerSidecar 부분은 전부 비활성화 처리 했다 Terraform 코드에서 blob 컨테이너에 대한 로그 정리 정책을 이미 정의했기 때문이다.
```yaml
logs:
  persistence:
    enabled: true
    existingClaim: pvc-airflow-logs
    storageClassName: azureblob-fuse-premium

# We disable the log groomer sidecar because we use Azure Blob Storage for logs,
# where a lifecycle policy is already set
triggerer:
  logGroomerSidecar:
    enabled: false

scheduler:
  logGroomerSidecar:
    enabled: false

workers:
  logGroomerSidecar:
    enabled: false
```

## airflow 설치
이제 설치 하자!
```bash
helm repo add apache-airflow https://airflow.apache.org

helm install airflow apache-airflow/airflow -n airflow -f airflow/values.yaml --debug

kubectl port-forward svc/airflow-webserver 8080:8080 -n airflow
```

## test build를 위해 ACR에 이미지 등록하기
우선 Hello World!가 출력되는 매우 간단한 컨테이너를 만들어 ACR에 업로드 해보자

### DockerFile
```DockerFile
FROM alpine:latest

# The command to run when the container starts
CMD ["echo", "hello world"]
```
```zsh
docker build -t example .
docker run example
```

### docker-build.sh
그 다음 acr에 로그인을 해준 후 ACR Portal에 있는 acr_id와 master key를 가져와준다. Portal에 가면 쉽게 확인이 가능하다.!
```zsh
az acr login --name airflowacregistry
```
```sh
acr_id="airflowacregistry.azurecr.io"
image_name="aksdag" # could be any image name
docker login "$acr_id" -u '<ACR리소스 name>' -p "<ACR master key>"
docker build --tag "$acr_id/$image_name:latest" .
docker push "$acr_id/$image_name:latest"
```
아래 명령어로 이미지가 잘 ACR에 등록되었는지 확인도 가능하다
```zsh
az acr repository list --name airflowacregistry --output table
```

## Airflow에서 첫 번째 DAG 실행
일단 아까전에 gitSync에서 적었던 git링크를 기억하는가?? 그 레포의 다음 경로에 들어가서 airflowsshkey.pub 안에 있는 키를 deploy key에 등록해준다.
- `Setting` -> `DeployKey`

### dags 폴더에 DAG 저장
ACR에 저장 했던 이미지를 빌드하는 코드이다.
```py
from datetime import datetime
from airflow import DAG
from airflow.contrib.operators.kubernetes_pod_operator import KubernetesPodOperator

default_args = {
    "retries": 1,
    "start_date": datetime(2022, 1, 1),
    "image_pull_policy": "Always",
}

with DAG(
    dag_id="simple_kubernetes_dag",
    schedule_interval=None,
    default_args=default_args,
    catchup=False,
    tags=["example"],
    max_active_runs=1,
) as dag:
    simple_task = KubernetesPodOperator(
        task_id="simple_echo_task",
        image="airflowacregistry.azurecr.io/example:latest",
        name="simple-airflow-task"
    )
```

짠! 그럼 이제 아래 처럼 내가 만든 DAG가 무사히 airflow 내에 안착된것을 알 수 있다.ㅎㅎ
<div align="center">
    <img src= https://1drv.ms/i/c/9ded56be8cf81c92/IQMLIOQC3j8iRZogFySybvL_Ae6JgpuQQ6AF8Oali7Wm9L0?width=1024 alt="airflow" />
</div>

DAG를 수동으로 트리거 하고 다음 메세지 까지 떴다면 완료다:)

```shell
[2024-08-05, 08:36:51 UTC] {pod_manager.py:235} INFO - hello world
```

## 마무리 하며..
완성했다!! 사실 더 고도화 하고 싶었는데 일단 현재 Azure Function 만드는데도 여러가지 이슈가 있기에 나중에 기회가 되면 argo CD 등으로 CI/CD 하는 것도 해보려구 한다. 점점 데엔에서 Devops 쪽을 건드리는 기분이지만 아무렴 재밌는데 뭐 어쩌겠는가

위 코드에 대한 정보는 아래 나의 깃허브에 있다:) <br>
[terraform-aks-cluster-setup](https://github.com/StatisticsFox/terraform-aks-cluster-setup)

```toc
```