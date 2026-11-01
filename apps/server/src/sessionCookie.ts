export const sessionCookieName = 'mini-office.sid';

export function parseSessionCookieSecure(value: string | undefined): boolean {
  if (value === undefined || value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('SESSION_COOKIE_SECURE must be true or false');
}

const sharedCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: parseSessionCookieSecure(process.env.SESSION_COOKIE_SECURE),
  path: '/',
};

export const sessionCookieOptions = {
  ...sharedCookieOptions,
  maxAge: 30 * 60 * 1000,
};

export const clearSessionCookieOptions = sharedCookieOptions;
