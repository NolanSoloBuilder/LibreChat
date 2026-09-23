import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionCookie, checkConnection } from './start.mjs';

const session = (payload) => JSON.stringify({ accessToken: Buffer.from(JSON.stringify(payload)).toString('base64') });
test('extracts the SSO cookie rather than forwarding the encoded session', () => {
  assert.equal(sessionCookie(session({ ssoAccessTokenKey: 'test-cookie', ssoAccessToken: 'test-secret', accessToken: 'other' })), 'test-cookie=test-secret');
});
test('rejects malformed sessions and header injection without revealing credentials', () => {
  for (const raw of ['{}', session({ ssoAccessToken: 'secret\r\nInjected: value' }), session({ ssoAccessTokenKey: 'bad:name', ssoAccessToken: 'secret' })]) {
    assert.throws(() => sessionCookie(raw), /session is invalid/);
  }
});
test('uses its actual client identity and stops on source denial', async () => {
  let count = 0;
  await assert.rejects(checkConnection('test-cookie=test-secret', async (url, options) => {
    count++;
    assert.equal(options.headers['X-Adapter-Source'], 'librechat-local-dev');
    assert.equal(options.headers.Cookie, 'test-cookie=test-secret');
    assert.ok(url.endsWith('/v1/messages'));
    return { ok: false, status: 400, json: async () => ({ error: { error_type: 'source_denied' } }) };
  }), /has not authorized/);
  assert.equal(count, 1);
});
test('accepts successful Anthropic responses and sanitizes failures', async () => {
  await checkConnection('cookie=secret', async () => ({ ok: true, status: 200, json: async () => ({ type: 'message', content: [{ type: 'text', text: 'CODEWIZ_OK' }] }) }));
  await assert.rejects(checkConnection('cookie=secret', async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'secret' } }) })), (error) => !error.message.includes('secret') && error.message.includes('401'));
});
