import { randomBytes } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';

/**
 * R6 — 세션 토큰 회전 + 재사용 탐지 (D3FEND: Credential Rotation + 재사용 분석 계열).
 *
 * 아이디어: 매 요청마다 일회용 토큰을 새로 발급하고 직전 토큰은 "폐기목록"에 넣는다.
 *  - 보낸 토큰 == 현재 토큰  → 정상, 즉시 회전(새 토큰 발급)
 *  - 보낸 토큰 ∈ 폐기목록     → 탈취 탐지: 세션 무효화 + 경보 로그 + 재인증 요구
 *
 * 왜 효과: 공격자가 훔친 토큰은 피해자가 한 번만 더 요청하면 폐기된다. 폐기된 토큰이 다시
 *          들어오면 "둘이 같은 세션을 쓰고 있다 = 탈취"로 들통난다.
 * 한계: 공격자가 피해자보다 먼저 쓰면 그 1회는 통과(이후 충돌에서 탐지). 즉시 차단이 아니라 탐지+축출.
 *       근본 예방은 전송 암호화(HTTPS). 토큰 쿠키도 HTTP 평문에선 같이 스니핑되지만, 핵심은 비밀이 아니라 "재사용 탐지"다.
 */

const RT_COOKIE = 'mo-rt';
const RETIRED_CAP = 50; // 폐기목록 상한(메모리 보호)
const RT_MAX_AGE = 30 * 60 * 1000;

export function tokenRotationEnabled(): boolean {
  const mode = process.env.DEFENSE_POLICY ?? 'off';
  return mode === 'token' || mode === 'combined';
}

function newToken(): string {
  return randomBytes(18).toString('hex');
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function setToken(res: Response, value: string): void {
  res.cookie(RT_COOKIE, value, {
    httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: RT_MAX_AGE,
  });
}

/** 로그인 시 첫 토큰 발급(회전이 켜진 라운드에서만). */
export function seedLoginToken(req: Request, res: Response): void {
  if (!tokenRotationEnabled()) return;
  const first = newToken();
  req.session.tokenState = { current: first, retired: [] };
  setToken(res, first);
}

/** 로그아웃 시 토큰 쿠키 정리(항상). */
export function clearLoginToken(res: Response): void {
  res.clearCookie(RT_COOKIE, { path: '/' });
}

/** 인증 통과 후 실행되는 회전 가드. 꺼진 라운드에선 그냥 통과. */
export const tokenRotationGuard: RequestHandler = (req, res, next) => {
  if (!tokenRotationEnabled()) { next(); return; }

  const ts = req.session.tokenState;
  const presented = readCookie(req.headers.cookie, RT_COOKIE);

  // 회전이 켜지기 전 발급된 세션: 지금 바인딩(최초 1회 fail-open)
  if (!ts) {
    const first = newToken();
    req.session.tokenState = { current: first, retired: [] };
    setToken(res, first);
    next();
    return;
  }

  // 폐기된 토큰이 다시 등장 → 탈취 탐지
  if (presented && ts.retired.includes(presented)) {
    console.warn(JSON.stringify({
      event: 'session-theft-detected', reason: 'retired-token-replay', userId: req.session.userId ?? null,
    }));
    req.session.destroy(() => {
      clearLoginToken(res);
      res.status(401).json({ error: 'Session invalidated: token reuse detected' });
    });
    return;
  }

  // 현재 토큰과 불일치(없거나 모르는 값) → 거부
  if (presented !== ts.current) {
    res.status(401).json({ error: 'Invalid session token' });
    return;
  }

  // 정상 → 회전
  ts.retired.push(ts.current);
  if (ts.retired.length > RETIRED_CAP) ts.retired.shift();
  ts.current = newToken();
  setToken(res, ts.current);
  next();
};
