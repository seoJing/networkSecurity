import { baselinePolicy, type SessionPolicy } from '../sessionPolicy';

/**
 * R4 — User-Agent 핑거프린트 검증 (D3FEND: Session/Credential 상관분석 계열).
 *
 * 세션이 "발급된 브라우저(UA)"와 "지금 요청한 UA"가 다르면 거부한다.
 * 공격자가 쿠키만 복사해서 다른 클라이언트(curl 등)로 재사용하면 UA가 안 맞아 403으로 막힌다.
 * IP와 독립적으로 검증되는 걸 보여주려고 R4에서는 IP를 끄고 UA 단독으로 켠다.
 *
 * 한계: 공격자가 스니핑으로 본 피해자 UA를 복제(curl -H "User-Agent: ...")하면 통과(= R5 우회) → R6(토큰)으로 보완.
 * 오탐 주의: UA는 브라우저 업데이트로도 바뀔 수 있다. 실습망은 고정이라 데모에선 안전.
 */
export const uaBindingPolicy: SessionPolicy = {
  validate(ctx) {
    if (!baselinePolicy.validate(ctx)) return false; // 기존 userId 검사 유지
    if (!ctx.boundUa) return true;                    // 발급 UA가 없으면(구세션) 비교 불가 → 통과
    return ctx.userAgent === ctx.boundUa;
  },
};
