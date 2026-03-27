import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const apikey = await import("../.tmp-test/utils/apikey.js");

class MemoryKV {
  constructor() {
    this.store = new Map();
    this.getCalls = [];
  }

  async get(key) {
    this.getCalls.push(key);
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async delete(key) {
    this.store.delete(key);
  }

  resetCalls() {
    this.getCalls = [];
  }
}

function createKey(kv) {
  return apikey.createApiKey(kv, {
    name: "sync-bot",
    permissions: ["/uploads"],
    isReadonly: false,
    expiresAt: null,
    createdBy: "tester",
  });
}

async function runCase(name, fn) {
  await fn();
  console.log(`  ok - ${name}`);
}

export async function run() {
  await runCase("API Key 索引命中时不会回退扫描列表", async () => {
    const kv = new MemoryKV();
    const created = await createKey(kv);

    kv.resetCalls();
    const found = await apikey.getApiKeyByKey(kv, created.key);

    assert.equal(found?.id, created.id);
    assert.ok(kv.getCalls.some((key) => key.startsWith("apikey:keyhash:")));
    assert.ok(!kv.getCalls.includes("apikey:_list"));
  });

  await runCase("缺失索引时会回退扫描并自动重建索引", async () => {
    const kv = new MemoryKV();
    const created = await createKey(kv);
    const hashKey = [...kv.store.keys()].find((key) => key.startsWith("apikey:keyhash:"));

    kv.store.delete(hashKey);
    kv.resetCalls();
    const rebuilt = await apikey.getApiKeyByKey(kv, created.key);

    assert.equal(rebuilt?.id, created.id);
    assert.ok(kv.getCalls.includes("apikey:_list"));
    assert.ok([...kv.store.keys()].some((key) => key.startsWith("apikey:keyhash:")));

    kv.resetCalls();
    await apikey.getApiKeyByKey(kv, created.key);
    assert.ok(!kv.getCalls.includes("apikey:_list"));
  });
}
