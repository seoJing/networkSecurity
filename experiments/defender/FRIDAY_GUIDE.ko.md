# 금요일 현장 실행 가이드 (VMware 공방)

방어자(유진형) 코드를 VMware 서버 VM에서 띄우고 라운드별 공방하는 순서.
막히면 이 문서 + 에러 메시지(터미널 글자 그대로)를 폰 Claude에 복붙해서 물어봐.

관련 문서: [DEFENSE_NOTES.ko.md](./DEFENSE_NOTES.ko.md) (방어 코드 설명), 루트 [docs/SETUP.ko.md](../../docs/SETUP.ko.md) (환경 세팅)

---

## 0. 미리 (인터넷 되는 곳에서, 집/핫스팟 아무거나)

**내 PC에서 브랜치 올리기** — 한 번만:
```bash
git push -u origin defender/session-policy
```
→ 이게 돼 있어야 서버 VM에서 받을 수 있음. (push = GitHub에 올리기)

---

## 1. 서버 VM에서 코드 받기 (인터넷 ON 상태에서)

> 인터넷(NAT)이 켜져 있어야 받아짐. 다 받은 뒤 공방 직전에 Host-only만 남긴다.

**레포가 이미 있으면:**
```bash
cd networkSecurity
git fetch origin
git checkout defender/session-policy
git pull
```
**레포가 없으면:**
```bash
git clone https://github.com/seoJing/networkSecurity.git
cd networkSecurity
git checkout defender/session-policy
```

받았는지 확인:
```bash
git branch --show-current      # -> defender/session-policy 가 나와야 함
git log --oneline -5           # R2/R4/R6/R7 커밋 보이면 OK
```

---

## 2. 환경파일 준비 (서버 VM, 최초 1회)

```bash
cp .env.lab.example .env.lab
# .env.lab 편집:
#   WEB_BIND_IP      = 서버 VM의 Host-only IP (예: 192.168.56.10)
#   SESSION_SECRET   = 32자 이상 랜덤 (openssl rand -hex 32)
#   POSTGRES_PASSWORD, SEED_PASSWORD = 원하는 값
```

---

## 3. 이미지 미리 빌드 (인터넷 ON 상태에서)

```bash
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml pull db
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml build
```
→ 여기까지 끝나면 **인터넷(NAT) 떼고 Host-only만** 남긴다.

---

## 4. 라운드별로 띄우기 (공방 본편)

방어 라운드는 `DEFENSE_POLICY` 값만 바꿔서 서버를 다시 띄우면 된다.

```bash
# R0/R1 — 방어 없음 (공격 성공 보여주기)
DEFENSE_POLICY=off      docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d

# R2 — IP 검증
DEFENSE_POLICY=ip       docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d

# R4 — UA 검증
DEFENSE_POLICY=ua       docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d

# R6 — 토큰 회전
DEFENSE_POLICY=token    docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d

# R7 — 복합 (IP+UA+토큰)
DEFENSE_POLICY=combined docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml up -d
```

상태 확인 / 로그:
```bash
docker compose ps
docker compose logs -f backend      # 탈취 탐지 경보(session-theft-detected)가 여기 찍힘
```

피해자 VM 브라우저에서 `http://<서버-Host-only-IP>/` 접속 → alice / bob 로그인 (비번 = SEED_PASSWORD).

---

## 5. 공방 흐름 (친구와 맞물려서)

**준비는 따로, 공방은 맞물려서.** 각자 자기 VM 점검 → "지금 R2" 식으로 라운드를 말로 맞추며 핑퐁.

### 5-0. 공방 시작 전 연결 점검 (둘이 같이, 제일 중요)
여기서 제일 많이 막힌다. 공방 들어가기 전에 반드시 통과:
```bash
# 세 VM이 같은 Host-only 대역인지 (각 VM에서)
ip a                       # 또는 ipconfig — IP가 같은 대역(예: 192.168.56.x)인지

# 서로 보이는지 (피해자/공격자 VM에서 서버 VM IP로)
ping <서버-Host-only-IP>    # 응답 오면 OK

# 서버 웹 열렸는지 (피해자 VM 브라우저)
http://<서버-Host-only-IP>/  → 로그인 화면 뜨면 OK
```
- 안 되면: VM 네트워크 어댑터가 **같은 Host-only**인지, 서버 VM 방화벽이 웹포트 막는지 확인.
- **R2(IP 검증)**을 보려면 공격자 IP ≠ 피해자 IP 여야 함 → `ip a`로 둘 IP 다른지 확인.

### 5-1. 라운드 핑퐁 (한 라운드씩, 말 맞추며)

| 순서 | 너(방어, 서버 VM) | 친구(공격, Kali VM) | 기대 결과 |
|---|---|---|---|
| R1 | `DEFENSE_POLICY=off` 로 띄움 → "방어 꺼짐" | 쿠키 캡처 → 재사용 | **성공** (뚫림) |
| R2 | `DEFENSE_POLICY=ip` 재시작 → "IP 켬" | 같은 공격 재시도 | **차단 403** (다른 IP) |
| R4 | `DEFENSE_POLICY=ua` 재시작 → "UA 켬" | 쿠키만 복사 재사용 | **차단 403** (UA 불일치) |
| R5 | (그대로 ua) | UA까지 복제(`curl -H "User-Agent: ..."`) | **통과** (단일 조건 한계) |
| R6 | `DEFENSE_POLICY=token` 재시작 → "토큰 켬" | 훔친 옛 토큰 재사용 | **탐지 401** + 로그 경보 |
| R7 | `DEFENSE_POLICY=combined` 재시작 | IP·UA 다 맞춰도 재사용 | 토큰에서 **탐지** |

**핑퐁 규칙:**
1. 너가 라운드 바꾸고 **"지금 Rn 켰어"** 라고 말함 (반드시 `up -d`로 재시작해야 반영됨)
2. 친구가 그 상태에서 **같은 공격**을 다시 돌림
3. 둘이 화면/로그로 결과 같이 확인 → 다음 라운드로

### 5-2. 라운드마다 확인할 것
- **공격 결과**: HTTP 코드 (성공=200 / 차단=403 / 탈취탐지=401)
- **서버 로그**: `docker compose logs -f backend` — R6/R7에서 `session-theft-detected` 뜨는지
- **정상 사용자 회귀**: 방어 켠 상태에서 **피해자 본인은 정상 동작**하는지 (로그인·문서 조회). 이게 깨지면 오탐 = 방어 실패.

### 5-3. 혼자 미리 연습 (친구 없이, 방법 A)
친구 공격 대신 서버 VM 안에서 curl로 공격자 흉내:
```bash
# R4 연습: 쿠키만 복사(다른 UA)로 재사용 → 403 나오면 성공
# R6 연습: 로그인 쿠키 저장 → 요청 1번(회전) → 옛 쿠키로 재사용 → 401 나오면 성공
```
(구체 명령은 DEFENSE_NOTES.ko.md의 각 라운드 '작동/시연법' 참고)

---

## 6. 자주 나는 문제

- **브라우저 접속 불가**: `docker compose ps`로 컨테이너 상태, 서버 VM Host-only IP, 방화벽 확인.
- **502 에러**: 백엔드/DB 헬스체크. `docker compose logs backend db`.
- **로그인 실패**: `SEED_PASSWORD` 바꿔도 기존 DB 계정 비번은 자동 변경 안 됨. 깨끗이 하려면(주의: 데이터 삭제) `docker compose ... down -v` 후 다시 up.
- **R2 차단이 안 보임**: 공격자와 피해자 IP가 실제로 달라야 함(VM 2대). 같은 IP면 IP 검증은 통과가 정상.
- **token 모드에서 정상 사용자가 막힘(오탐처럼 보임)**: `scripts/smoke.sh`는 회전 쿠키를 저장 안 해서 그럼(테스트 클라이언트 특성). 실제 브라우저는 정상. 자세한 건 DEFENSE_NOTES.ko.md의 R6 주의 참고.
- **라운드 바꿨는데 안 바뀜**: `DEFENSE_POLICY`는 서버 시작 시 읽음. 값 바꾸고 반드시 `up -d`로 재시작.

---

## 7. 측정 기록 (교수 피드백 #4)

각 라운드에서 숫자 기록 → 발표 표:
| 라운드 | 세션 재사용 | 정상 사용자 | 탐지/차단 |
|---|---|---|---|
| R0/off | 성공 | 정상 | — |
| R2/ip | ? | 정상 | 다른 IP 차단 |
| R4/ua | ? | 정상 | UA 불일치 차단 |
| R6/token | ? | 정상 | 폐기 토큰 탐지 |
| R7/combined | ? | 정상 | 복합 |

---

## 8. 끝나면
```bash
docker compose --env-file .env.lab -f compose.yaml -f compose.lab.yaml down
# 데이터까지 지우려면 down -v (공유 환경에선 주의)
```
