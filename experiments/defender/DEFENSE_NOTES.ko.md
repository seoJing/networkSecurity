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
| `ua` | R4 | (예정) UA 핑거프린트 |
| `token` | R6 | (예정) 토큰 회전 + 재사용 탐지 |
| `combined` | R7 | (예정) IP+UA+토큰 OR 결합 |

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

## R4 — UA 핑거프린트 ⏳ 예정
## R6 — 토큰 회전 + 재사용 탐지 ⏳ 예정
## R7 — 복합 (OR 결합) ⏳ 예정

---

## 측정(교수 피드백 #4, 예정)
각 라운드에서 실측할 지표: 세션 재사용 성공률 / 유효 쿠키 차단율 / **정상 사용자 오탐률** / 탐지 지연 / 서비스 정상 동작(`scripts/smoke.sh` 통과).

## 검증 현황
- `npm test` (빌드 + 기존 baseline 테스트 2개) 통과.
- `scripts/smoke.sh` (정상 사용자 회귀)는 Docker 기동 환경에서 라운드별로 돌려 기록 예정.
