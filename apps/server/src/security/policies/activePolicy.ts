import { baselinePolicy, type SessionPolicy } from '../sessionPolicy';
import { ipBindingPolicy } from './ipBindingPolicy';

/**
 * 방어 토글 — 한 곳에서 활성 정책을 고른다.
 * 환경변수 DEFENSE_POLICY 로 라운드를 전환한다(재빌드 없이 재시작만):
 *   off (기본) = 방어 없음(baseline)   |   ip = R2 IP 바인딩
 * 앞으로 ua(R4) · token(R6) · combined(R7) 을 만들면서 아래 표에 추가한다.
 */
const policies: Record<string, SessionPolicy> = {
  off: baselinePolicy,
  ip: ipBindingPolicy,
};

const selected = process.env.DEFENSE_POLICY ?? 'off';

/** Defender extension point. Keep baseline behavior and normal-user tests intact. */
export const activeSessionPolicy: SessionPolicy = policies[selected] ?? baselinePolicy;
