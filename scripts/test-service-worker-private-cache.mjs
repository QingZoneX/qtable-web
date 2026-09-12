import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const swSource = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

const createHarness = () => {
  const listeners = new Map();
  const cacheStores = new Map();
  const deleted = [];
  let fetchImpl = async (request) => ({
    ok: true,
    status: 200,
    type: 'basic',
    body: `network:${request.url}`,
    clone() { return { ...this, clone: this.clone }; },
  });
  let cacheMatchCount = 0;
  let cachePutCount = 0;

  const caches = {
    async keys() { return [...cacheStores.keys()]; },
    async delete(name) { deleted.push(name); return cacheStores.delete(name); },
    async open(name) {
      if (!cacheStores.has(name)) cacheStores.set(name, new Map());
      const store = cacheStores.get(name);
      return {
        async match(request) {
          cacheMatchCount += 1;
          return store.get(request.url);
        },
        async put(request, response) {
          cachePutCount += 1;
          store.set(request.url, response);
        },
      };
    },
  };

  const self = {
    location: { origin: 'https://qtable.example' },
    clients: { claim() {} },
    skipWaiting() {},
    addEventListener(type, listener) { listeners.set(type, listener); },
  };

  vm.runInNewContext(swSource, {
    self,
    caches,
    URL,
    console,
    fetch: (request) => fetchImpl(request),
    Set,
    Promise,
  });

  const dispatchFetch = async (pathname, { destination = '', offline = false } = {}) => {
    const request = {
      method: 'GET',
      url: `https://qtable.example${pathname}`,
      destination,
    };
    if (offline) fetchImpl = async () => { throw new Error('backend down'); };
    else fetchImpl = async (req) => ({
      ok: true,
      status: 200,
      type: 'basic',
      body: `network:${req.url}`,
      clone() { return { ...this, clone: this.clone }; },
    });
    let responsePromise;
    listeners.get('fetch')({ request, respondWith(value) { responsePromise = Promise.resolve(value); } });
    return responsePromise;
  };

  const dispatchWaitUntil = async (type, data) => {
    let waitPromise = Promise.resolve();
    listeners.get(type)({ data, waitUntil(value) { waitPromise = Promise.resolve(value); } });
    await waitPromise;
  };

  return {
    cacheStores,
    deleted,
    dispatchFetch,
    dispatchWaitUntil,
    counts: () => ({ cacheMatchCount, cachePutCount }),
  };
};

for (const path of [
  '/api/private-record',
  '/graphql?query=private',
  '/auth/session',
  '/oauth/authorize',
  '/ws/private',
]) {
  test(`${path} is network-only and never enters Cache Storage`, async () => {
    const harness = createHarness();
    const response = await harness.dispatchFetch(path);
    assert.equal(response.body, `network:https://qtable.example${path}`);
    assert.deepEqual(harness.counts(), { cacheMatchCount: 0, cachePutCount: 0 });

    await assert.rejects(() => harness.dispatchFetch(path, { offline: true }), /backend down/);
    assert.deepEqual(harness.counts(), { cacheMatchCount: 0, cachePutCount: 0 });
  });
}

test('only same-origin hashed build assets are cached', async () => {
  const harness = createHarness();
  await harness.dispatchFetch('/assets/app.abc123.js', { destination: 'script' });
  assert.deepEqual(harness.counts(), { cacheMatchCount: 1, cachePutCount: 1 });
  assert.ok(harness.cacheStores.get('qtable-static-v2')?.has('https://qtable.example/assets/app.abc123.js'));

  const before = harness.counts();
  const html = await harness.dispatchFetch('/workspace/private-table');
  assert.equal(html, undefined, 'SPA/navigation requests must be left to the network by default');
  assert.deepEqual(harness.counts(), before);
});

test('activate removes legacy business caches and keeps only current static cache', async () => {
  const harness = createHarness();
  harness.cacheStores.set('api-v1', new Map());
  harness.cacheStores.set('static-v1', new Map());
  harness.cacheStores.set('qtable-cache-v1', new Map());
  harness.cacheStores.set('qtable-private-v9', new Map());
  harness.cacheStores.set('qtable-static-v2', new Map());

  await harness.dispatchWaitUntil('activate');
  assert.deepEqual(new Set(harness.deleted), new Set([
    'api-v1', 'static-v1', 'qtable-cache-v1', 'qtable-private-v9',
  ]));
  assert.ok(harness.cacheStores.has('qtable-static-v2'));
});

test('logout cleanup deletes every non-current cache as fail-safe', async () => {
  const harness = createHarness();
  harness.cacheStores.set('qtable-static-v2', new Map());
  harness.cacheStores.set('api-v1', new Map());
  harness.cacheStores.set('future-business-cache', new Map());

  await harness.dispatchWaitUntil('message', { type: 'CLEAR_PRIVATE_CACHES' });
  assert.ok(harness.cacheStores.has('qtable-static-v2'));
  assert.equal(harness.cacheStores.has('api-v1'), false);
  assert.equal(harness.cacheStores.has('future-business-cache'), false);
});
