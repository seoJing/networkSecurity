import { baselinePolicy, type SessionPolicy } from '../sessionPolicy';

/**
 * R2 — IP 바인딩 검증 (D3FEND: Web Session Activity Analysis 계열).
 *
 * 세션이 "발급된 IP"와 "지금 요청한 IP"가 다르면 거부한다.
 * 훔친 쿠키를 다른 IP(공격자 VM)에서 재사용하면 여기서 403으로 막힌다.
 *
 * 한계: 공격자가 피해자와 같은 출구 IP(같은 NAT)로 보이면 구분 불가 → R4(UA)·R6(토큰)으로 보완.
 * 오탐 주의: 정상 사용자도 네트워크 이동으로 IP가 바뀔 수 있다. 실습망은 IP가 고정이라 데모에선 안전.
 */
export const ipBindingPolicy: SessionPolicy = {
  validate(ctx) {
    if (!baselinePolicy.validate(ctx)) return false; // 기존 userId 검사 유지
    if (!ctx.boundIp) return true;                    // 발급 IP가 없으면(구세션) 비교 불가 → 통과
    return ctx.sourceIp === ctx.boundIp;
  },
};
