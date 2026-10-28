import { baselinePolicy, type SessionPolicy } from '../sessionPolicy';
import { ipBindingPolicy } from './ipBindingPolicy';
import { uaBindingPolicy } from './uaBindingPolicy';
import { combinedPolicy } from './combinedPolicy';

/**
 * 방어 토글 — 한 곳에서 활성 정책을 고른다.
 * 환경변수 DEFENSE_POLICY 로 라운드를 전환한다(재빌드 없이 재시작만):
 *   off (기본) = 방어 없음(baseline)   |   ip = R2 IP 바인딩   |   ua = R4 UA 핑거프린트
 *   token = R6 토큰 회전(validate는 기본, 회전은 tokenRotationGuard가 담당)
 *   combined = R7 복합(IP + UA + 토큰 회전 모두 ON)
 */
const policies: Record<string, SessionPolicy> = {
  off: baselinePolicy,
  ip: ipBindingPolicy,
  ua: uaBindingPolicy,
  token: baselinePolicy,
  combined: combinedPolicy,
};

const selected = process.env.DEFENSE_POLICY ?? 'off';

/** Defender extension point. Keep baseline behavior and normal-user tests intact. */
export const activeSessionPolicy: SessionPolicy = policies[selected] ?? baselinePolicy;
