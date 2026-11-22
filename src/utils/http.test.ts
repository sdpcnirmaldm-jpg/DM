import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonSafe } from './http';

test('parseJsonSafe parses valid application/json responses', async () => {
  const res = new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
  const data = await parseJsonSafe<{ status: string }>(res);
  assert.deepEqual(data, { status: 'ok' });
});

test('parseJsonSafe returns null on HTML responses instead of throwing SyntaxError', async () => {
  const res = new Response('<!doctype html><html><body>SPA</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
  const data = await parseJsonSafe(res);
  assert.equal(data, null);
});

test('parseJsonSafe returns null on malformed JSON body even with JSON header', async () => {
  const res = new Response('<!doctype html>', {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
  const data = await parseJsonSafe(res);
  assert.equal(data, null);
});
