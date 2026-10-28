# 방어 구현 정리본 (유진형 / defender)

세션 하이재킹 **5단계(쿠키 재사용, T1550.004)**를 막는 서버 측 방어 코드 정리.
공격 1~4단계(정찰·ARP·스니핑·SSLstrip)는 네트워크/전송 계층이라 이 코드의 범위가 아님 → 근본 해법은 HTTPS(R8 결론).

브랜치: `defender/session-policy`

---

## 큰 그림

- 내 방어는 **"쿠키를 못 훔치게"** 막는 게 아니라, **"훔친 쿠키를 재사용하는 순간"** 막거나 탐지한다.
- 모든 판정은 한 곳에서: `apps/server/src/security/policies/activePolicy.ts` 가 고른 정책의 `validate(ctx)`.
- 라운드 전환은 환경변수 **`DEFENSE_POLICY`** 하나로 (재빌드 없이 재시작만).

| DEFENSE_POLICY | 라운드 | 동작 |
|---|---|---|
| `off` (기본) | R0 / R1 | 방어 없음 (userId만 확인) |
| `ip` | R2 | IP 바인딩 검증 |
| `ua` | R4 | UA 핑거프린트 |
| `token` | R6 | 토큰 회전 + 재사용 탐지 |
| `combined` | R7 | IP+UA+토큰 모두 ON (하나라도 걸리면 차단) |

---

## 계약 확장 (플랫폼 공유 파일 — 서진규 승인받고 수정)

방어 정책이 "발급 시점 기준값"과 비교할 수 있게, 로그인 때 기준값을 세션에 저장하도록 배선.

| 파일 | 변경 |
|---|---|
| `apps/server/src/types/express-session.d.ts` | 세션에 `boundIp` / `boundUa` 저장 공간 추가 |
| `apps/server/src/security/sessionPolicy.ts` | `SessionContext`에 `boundIp` / `boundUa` (선택) 추가 |
| `apps/server/src/routes/auth.ts` | 로그인 성공(세션 재발급) 시 `boundIp=req.ip`, `boundUa=UA` 저장 |
| `apps/server/src/middleware/requireAuth.ts` | 매 요청 검사 때 세션의 기준값을 `validate()`에 전달 |

> 이게 없으면 `validate()`는 "지금 요청의 IP/UA"만 받고 "발급 시점 값"을 몰라서 비교 자체가 불가능함.

---

## R2 — IP 바인딩 검증 ✅ 구현됨

파일: `apps/server/src/security/policies/ipBindingPolicy.ts`

- 로직: `발급 IP(boundIp) !== 요청 IP(sourceIp)` 이면 거부 → `requireAuth`가 403 반환.
- D3FEND: Web Session Activity Analysis 계열 (정확한 D3-번호는 d3fend.mitre.org에서 확정).
- 막는 것: 공격자가 훔친 쿠키를 **자기 VM(다른 IP)**에서 재사용 → 차단.
- 한계: 공격자가 피해자와 **같은 출구 IP(같은 NAT/네트워크 완전 장악)**면 구분 불가 → R4/R6으로 보완 (= R3 설명).
- 오탐 주의: 정상 사용자도 네트워크 이동 시 IP가 바뀔 수 있음. 실습망은 IP 고정이라 데모에선 안전.
- 참고: nginx가 `X-Forwarded-For`를 실제 접속 IP로 덮어쓰고(`trust proxy 1`), 공격자가 `X-Forwarded-For` 헤더를 위조해도 안 먹힘.

### 작동/시연법
```bash
# R1 (방어 OFF): 훔친 쿠키 재사용 성공
DEFENSE_POLICY=off   docker compose up -d --build

# R2 (IP 검증 ON): 피해자 로그인 후, 다른 IP에서 같은 쿠키 쓰면 403
DEFENSE_POLICY=ip    docker compose up -d --build
```
(로컬 개발은 `apps/server`에서 `DEFENSE_POLICY=ip npm start` 식으로도 전환 가능)

---

## R4 — UA 핑거프린트 ✅ 구현됨

파일: `apps/server/src/security/policies/uaBindingPolicy.ts`

- 로직: `발급 UA(boundUa) !== 요청 UA(userAgent)` 이면 거부 → 403.
- D3FEND: Session/Credential 상관분석 계열.
- 막는 것: 공격자가 **쿠키만 복사**해서 다른 클라이언트(curl 등)로 재사용 → UA 불일치로 차단.
- IP와 독립: R4에서는 IP를 끄고 UA 단독으로 켜서, IP와 무관하게 막히는 걸 보여줌.
- 한계: 공격자가 스니핑으로 본 피해자 UA를 복제(`curl -H "User-Agent: <피해자UA>"`)하면 통과 = **R5 우회** → R6(토큰)으로 보완.
- 오탐 주의: UA는 브라우저 업데이트로도 바뀔 수 있음. 실습망은 고정이라 데모에선 안전.

### 작동/시연법
```bash
# R4 (UA 검증 ON): 쿠키만 복사하면 UA 불일치로 403
DEFENSE_POLICY=ua    docker compose up -d --build
# R5 (우회): 공격자가 피해자 UA까지 복제하면 통과 → 단일 조건의 한계
curl -b "mini-office.sid=<탈취값>" -H "User-Agent: <피해자UA>" .../api/auth/me
```

---

## R6 — 토큰 회전 + 재사용 탐지 ✅ 구현됨

파일: `apps/server/src/security/policies/tokenRotation.ts` (+ 계약 확장: `express-session.d.ts`, `auth.ts`, `requireAuth.ts`)

R2/R4와 달리 `validate()` true/false로 안 됨 → **쿠키 재발급·세션 무효화·경보**가 필요해서 **미들웨어**로 구현.

- 로직:
  - 매 요청마다 토큰(`mo-rt` 쿠키)을 새로 발급하고 직전 토큰은 `retired`(폐기목록)에 넣음
  - 보낸 토큰 == 현재 → 정상, 회전 | 보낸 토큰 ∈ 폐기목록 → **탈취 탐지**(세션 destroy + 401 + 경보 로그)
- D3FEND: Credential Rotation + 재사용 분석 계열.
- 막는 것: 공격자가 IP·UA를 다 베껴도(R5 통과) **훔친 토큰을 재사용하는 순간 폐기 충돌로 탐지**.
- 한계(정직하게): 공격자가 피해자보다 **먼저** 쓰면 그 1회는 통과(이후 충돌에서 탐지). 즉시 차단이 아니라 **탐지+축출**. 근본 예방은 HTTPS.
- 배선: 로그인 시 첫 토큰 발급(`seedLoginToken`), 로그아웃 시 토큰쿠키 정리(`clearLoginToken`), 인증 통과 후 `tokenRotationGuard` 실행.

### 작동/시연법
```bash
DEFENSE_POLICY=token docker compose up -d --build
# 피해자 로그인 → mo-rt 쿠키 받음 → 요청마다 회전
# 공격자가 훔친 (옛) 토큰 재사용 → 401 "token reuse detected" + 서버 로그에 session-theft-detected
```

### ⚠️ 측정 시 주의 (smoke.sh)
`scripts/smoke.sh`는 로그인에만 `-c`(쿠키 저장)를 쓰고 이후 요청엔 `-b`(읽기)만 써서 **회전된 토큰을 저장하지 않음** → token 모드에선 두 번째 요청이 옛 토큰을 보내 "재사용"으로 걸릴 수 있음. 이건 테스트 클라이언트 특성이지 실제 브라우저(쿠키 자동 갱신)와는 다름. token 모드 정상 회귀 측정은 **매 요청 `-c`로 쿠키를 갱신하는 별도 스크립트**(`tests/defense/`)로 돌릴 것. (측정 단계에서 처리 예정)

---

## R7 — 복합 방어 ✅ 구현됨

파일: `apps/server/src/security/policies/combinedPolicy.ts`

- 새 로직이 아니라 기존 걸 **조립**: `ipBindingPolicy.validate(ctx) && uaBindingPolicy.validate(ctx)` (IP 통과 AND UA 통과).
- R6(토큰 회전)은 `combined` 모드에서 `tokenRotationGuard`가 자동으로 함께 돎 → 최종 상태 = **IP + UA + 토큰 회전 모두 ON**.
- 결합 규칙: "통과하려면 셋 다 통과(AND)" = "하나라도 걸리면 차단(OR)" — 같은 말.
- 각 단독 방어의 구멍을 서로 메움:
  - 다른 IP → IP에서 차단
  - UA 안 베낌 → UA에서 차단
  - IP·UA 다 복제(R5) → validate는 통과하지만 **토큰 재사용에서 탐지**(최후 방어선)
- 메시지: 단일 조건은 각각 뚫려도, 겹치면 성공률 급락 = Defense-in-Depth. 근본 예방은 HTTPS(R8).

### 작동/시연법
```bash
DEFENSE_POLICY=combined docker compose up -d --build
```

### 검증(런타임)
`DEFENSE_POLICY=combined`에서: 정상=통과 / 다른IP=차단 / UA불일치=차단 / R5(IP·UA복제)=validate통과→토큰가드가 탐지.

---

## 측정(교수 피드백 #4, 예정)
각 라운드에서 실측할 지표: 세션 재사용 성공률 / 유효 쿠키 차단율 / **정상 사용자 오탐률** / 탐지 지연 / 서비스 정상 동작(`scripts/smoke.sh` 통과).

## 검증 현황
- `npm test` (빌드 + 기존 baseline 테스트 2개) 통과.
- `scripts/smoke.sh` (정상 사용자 회귀)는 Docker 기동 환경에서 라운드별로 돌려 기록 예정.
