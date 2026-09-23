import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchPublicWeb } from './public-search.mjs';

test('public search returns only provider-grounded source URLs', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return { ok: true, json: async () => ({ access_token: 'test-token' }) };
    return {
      ok: true,
      json: async () => ({ candidates: [{
        content: { parts: [{ text: 'Grounded answer.' }] },
        groundingMetadata: { groundingChunks: [
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/source', title: 'Official release', domain: 'example.gov' } },
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/source', title: 'Duplicate' } },
          { web: { uri: 'http://unsafe.example', title: 'Not HTTPS' } },
        ] },
      }] }),
    };
  };
  const result = await searchPublicWeb('recent release', { fetchImpl, project: 'demo-project' });
  assert.equal(result.data_mode, 'public_search');
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].domain, 'example.gov');
  assert.equal(result.summary, 'Grounded answer.');
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1].options.body).tools, [{ googleSearch: {} }]);
});

test('public search rejects ungrounded model text', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, json: async () => calls === 1 ? { access_token: 'test-token' } : { candidates: [{ content: { parts: [{ text: 'Unsupported claim' }] } }] } };
  };
  await assert.rejects(searchPublicWeb('recent release', { fetchImpl, project: 'demo-project' }), /PUBLIC_SEARCH_NO_GROUNDED_SOURCES/);
});
