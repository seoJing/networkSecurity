import type { SessionPolicy } from '../sessionPolicy';
import { ipBindingPolicy } from './ipBindingPolicy';
import { uaBindingPolicy } from './uaBindingPolicy';

/**
 * R7 — 복합 방어 (Defense-in-Depth).
 *
 * 새 로직이 아니라 R2(IP)와 R4(UA)를 그대로 묶은 것:
 *   통과하려면 IP도 통과 AND UA도 통과  (= 하나라도 걸리면 차단)
 * R6(토큰 회전)은 DEFENSE_POLICY=combined 일 때 tokenRotationGuard가 자동으로 함께 돈다.
 * 따라서 combined = IP + UA + 토큰 회전이 모두 켜진 상태.
 */
export const combinedPolicy: SessionPolicy = {
  async validate(ctx) {
    const ipOk = await ipBindingPolicy.validate(ctx);
    if (!ipOk) return false;
    return uaBindingPolicy.validate(ctx);
  },
};
