import assert from 'node:assert/strict';
import test from 'node:test';
import { baselinePolicy } from './sessionPolicy';

test('baseline policy accepts authenticated numeric user ID', async () => {
  assert.equal(await baselinePolicy.validate({ userId: 1, sourceIp: '192.168.56.20', userAgent: 'demo' }), true);
});

test('baseline policy rejects invalid session user IDs', async () => {
  assert.equal(await baselinePolicy.validate({ userId: 0, sourceIp: '', userAgent: '' }), false);
});
