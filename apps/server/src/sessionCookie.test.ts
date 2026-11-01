import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearSessionCookieOptions,
  parseSessionCookieSecure,
  sessionCookieOptions,
} from './sessionCookie';

test('HTTPS session cookies are secure by default', () => {
  assert.equal(parseSessionCookieSecure(undefined), true);
  assert.equal(sessionCookieOptions.secure, true);
  assert.equal(clearSessionCookieOptions.secure, sessionCookieOptions.secure);
});

test('SESSION_COOKIE_SECURE accepts only explicit booleans', () => {
  assert.equal(parseSessionCookieSecure('true'), true);
  assert.equal(parseSessionCookieSecure('false'), false);
  assert.throws(() => parseSessionCookieSecure('yes'), /must be true or false/);
});
