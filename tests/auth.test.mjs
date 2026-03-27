import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}
if (!globalThis.atob) {
  globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
}
if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
}

const auth = await import("../.tmp-test/utils/auth.js");

function createBasicAuthHeader(username, password) {
  return `Basic ${auth.encodeBasicAuth(username, password)}`;
}

function createContext({ path = "docs/readme.md", headers = {}, env = {} } = {}) {
  return {
    request: new Request(
      `https://example.com/api/write/items/${encodeURIComponent(path)}`,
      { headers }
    ),
    env,
  };
}

async function runCase(name, fn) {
  await fn();
  console.log(`  ok - ${name}`);
}

export async function run() {
  await runCase("同步写权限检查会拒绝 readonly 用户", async () => {
    const context = createContext({
      headers: {
        Authorization: createBasicAuthHeader("alice", "secret"),
      },
      env: {
        "alice:secret": "/docs,readonly",
      },
    });

    assert.equal(auth.getWriteAuthStatus(context), false);
  });

  await runCase("异步写权限检查会允许拥有目录权限的用户写入", async () => {
    const context = createContext({
      headers: {
        Authorization: createBasicAuthHeader("alice", "secret"),
      },
      env: {
        "alice:secret": "/docs",
      },
    });

    assert.equal(await auth.getWriteAuthStatusAsync(context), true);
  });

  await runCase("访客写入在配置上传密码时必须校验密码", async () => {
    const baseEnv = {
      GUEST: "uploads",
      GUEST_UPLOAD_PASSWORD: "letmein",
    };

    const deniedContext = createContext({
      path: "uploads/demo.txt",
      headers: {
        "X-Guest-Password": "wrong",
      },
      env: baseEnv,
    });
    assert.equal(await auth.getWriteAuthStatusAsync(deniedContext), false);

    const allowedContext = createContext({
      path: "uploads/demo.txt",
      headers: {
        "X-Guest-Password": "letmein",
      },
      env: baseEnv,
    });
    assert.equal(await auth.getWriteAuthStatusAsync(allowedContext), true);
  });
}
