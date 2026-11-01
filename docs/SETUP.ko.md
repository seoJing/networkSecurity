# 팀원 세팅 가이드 (VMware + Docker)

이 저장소는 **정상적인 세션 기반 웹서비스의 공통 베이스**입니다. 스니핑·스푸핑·세션 하이재킹·방어·우회 구현은 포함되어 있지 않으며, 공격과 방어는 허가받은 격리 실습망에서 담당 팀원이 별도로 수행합니다.

## 1. 개인 개발 환경

필요한 것은 Docker Engine 또는 Docker Desktop, Docker Compose v2, Bash, OpenSSL, Python 3입니다.

```bash
cp .env.example .env
bash scripts/generate-cert.sh local
openssl rand -hex 32
# 생성한 난수로 .env의 SESSION_SECRET을 교체하고, 예제 비밀번호도 변경합니다.
docker compose up -d --build
```

`https://localhost:8443`에 접속합니다. 생성된 서버 인증서에는 `localhost`와 `127.0.0.1` SAN이 들어 있습니다. 브라우저 경고 없이 접속하려면 공개 인증서인 `certs/ca.crt`를 개발 PC의 신뢰 저장소에 추가합니다. `certs/ca.key`와 `certs/server.key`는 신뢰 저장소에 넣거나 다른 장비에 복사하지 마세요. 기본 테스트 사용자는 `alice`, `bob`이며 비밀번호는 `.env`의 `SEED_PASSWORD`입니다. 세션과 문서는 PostgreSQL에 저장됩니다.

```bash
docker compose ps
docker compose logs -f backend
set -a; source .env; set +a
bash scripts/smoke.sh
```

스모크 테스트는 HTTPS 인증서를 `.env`의 `TLS_CA_CERT_PATH`로 검증하며 `curl -k`를 사용하지 않습니다. Healthcheck, 로그인, 세션 쿠키의 `Secure` 속성, 사용자별 문서 조회, 본인 문서 정상 수정, 타인 문서 조회·수정 거부, 로그아웃과 세션 무효화를 확인합니다. 실행하지 않은 테스트를 성공했다고 보고하지 마세요.

인증서 파일은 기본적으로 `certs/`에 생성되며 Git에서 제외됩니다. 스크립트는 기존 키를 덮어쓰지 않습니다. 다른 디렉터리를 쓰려면 `bash scripts/generate-cert.sh local "/공백이 있는/경로"`처럼 경로를 따옴표로 감싸고, `.env`의 `TLS_CERT_PATH`, `TLS_KEY_PATH`, `TLS_CA_CERT_PATH`에도 따옴표로 감싼 경로를 설정하세요. 인증서와 키는 이미지에 복사되지 않고 Nginx 컨테이너에 읽기 전용으로 마운트됩니다.

## 2. VMware 공방 환경

서버·피해자·공격자 VM을 별도의 VMware **Host-only** 네트워크에 연결합니다. 예시 IP는 `192.168.56.10/20/30`이지만, VMware가 제공한 실제 Host-only 대역으로 바꾸세요. 캠퍼스 LAN에 브리지하지 마세요.

서버 VM에서:

```bash
cp .env.lab.example .env.lab
# WEB_BIND_IP에 서버 VM의 Host-only IP 입력
# SESSION_SECRET, POSTGRES_PASSWORD, SEED_PASSWORD 변경
WEB_BIND_IP=192.168.56.10 bash scripts/generate-cert.sh lab
```

위 `192.168.56.10`은 예시입니다. 반드시 `.env.lab`에 설정한 실제 `WEB_BIND_IP`로 인증서를 생성해야 하며, 이 주소가 서버 인증서의 IP SAN에 들어갑니다.

**이미지 준비 단계:** npm 설치와 Docker 이미지 다운로드에는 일시적인 업데이트용 인터넷 경로가 필요할 수 있습니다. 공격 실험을 시작하기 전에 이미지를 미리 다운로드·빌드하세요.

```bash
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml pull db
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml build
```

준비가 끝나면 업데이트용 NAT/브리지 어댑터를 분리하고 Host-only 연결만 남았는지 확인합니다. 그다음 캐시된 이미지로 실행합니다.

```bash
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d --no-build --pull never
```

피해자 VM에는 서버의 `certs/ca.crt`만 안전한 실습 경로로 복사하여 신뢰 CA로 설치합니다. 개인키인 `ca.key`, `server.key`는 절대 복사하지 않습니다.

Ubuntu/Debian 피해자 VM:

```bash
sudo install -m 0644 ca.crt /usr/local/share/ca-certificates/mini-office-lab-ca.crt
sudo update-ca-certificates
```

Windows 피해자 VM은 관리자 터미널에서 `certutil -addstore -f Root ca.crt`를 실행합니다. 자체 인증서 저장소를 쓰는 Firefox라면 설정 → 개인정보 및 보안 → 인증서 → 인증 기관에서 `ca.crt`를 가져와 웹사이트 신뢰를 허용합니다. 신뢰 설정 후 브라우저를 다시 시작하세요.

피해자 VM 브라우저에서 `https://<서버-Host-only-IP>/` 접속을 확인합니다. 실습 기본 포트는 443입니다. 외부 공개 포트는 Nginx HTTPS뿐이며, 백엔드(3000)와 DB(5432)는 호스트에 직접 노출하지 않습니다. Nginx에서 Express로 가는 `http://backend:3000`과 DB 통신은 Docker 내부 네트워크에만 남습니다.

서버 VM에서 정상 기능 전체를 확인합니다.

```bash
set -a; source .env.lab; set +a
BASE_URL="https://$WEB_BIND_IP" bash scripts/smoke.sh
```

## 3. AI 작업 구분

| 담당 | 변경 가능한 기본 위치 | 금지 사항 |
|---|---|---|
| 플랫폼 | `apps/web`, 정상 서버 코드, `infra`, 공통 계약 | 공격·방어 구현 선점 |
| 공격자 | `experiments/attacker` | 인증 서버 코드 수정 |
| 방어자 | `apps/server/src/security/policies`, `experiments/defender` | 공격 코드·성공 조건 임의 수정 |

루트 `AGENTS.md`와 `.harness/` 계약을 먼저 읽도록 AI에 지시합니다. 공통 API나 하네스 변경은 플랫폼 담당자에게 PR로 요청합니다. 실제 접근 제어는 PR 리뷰 및 브랜치 보호 설정으로 유지해야 합니다.

## 4. 자주 겪는 문제

- **브라우저 접속 불가:** `docker compose ps`, 서버 VM IP, Host-only 연결, OS 방화벽의 웹 포트 허용 여부를 확인합니다.
- **인증서 이름 불일치:** 접속 주소가 인증서 생성 시 사용한 실제 `WEB_BIND_IP`와 같은지 확인하고 인증서를 다시 생성합니다.
- **인증서 신뢰 오류:** 피해자 VM에는 현재 `ca.crt`만 설치했는지 확인합니다. `curl -k`나 브라우저의 경고 무시는 정상 검증으로 인정하지 않습니다.
- **502 오류:** 백엔드·DB Healthcheck를 확인합니다. `docker compose logs backend db`로 원인을 확인합니다.
- **테스트 계정 로그인 실패:** 최초 생성된 DB 볼륨에는 과거 비밀번호 해시가 남아 있을 수 있습니다. `SEED_PASSWORD` 변경은 기존 계정 비밀번호를 자동 변경하지 않습니다.
- **Docker 빌드 실패:** 인터넷이 분리되어 있다면 빌드 전에 npm 패키지와 베이스 이미지를 캐시했는지 확인합니다.
- **로그에 개인정보 기록:** 요청 본문이나 쿠키를 임의로 추가 기록하지 마세요. 실험 보고에는 비식별화한 결과만 첨부하세요.
- **전체 DB 삭제:** `docker compose down -v`는 모든 PostgreSQL 데이터를 삭제합니다. 공유 실습 환경에서는 사용하지 마세요.

프로젝트는 수업용 격리 실습을 전제로 하며, 개발용 CA를 사용하는 이 구성을 공개·운영 서비스에 그대로 배포하면 안 됩니다. HSTS, mTLS, rate limit, 세션 이상 탐지 같은 방어 정책은 이번 플랫폼 변경에 포함되지 않습니다.
