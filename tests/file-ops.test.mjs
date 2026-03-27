import assert from "node:assert/strict";

import {
  FOLDER_DOWNLOAD_LIMITS,
  fetchAllItemsRecursively,
  getFolderDownloadLimitMessage,
  getRelativeZipPath,
  summarizeDownloadItems,
} from "../assets/file-ops.mjs";

async function runCase(name, fn) {
  await fn();
  console.log(`  ok - ${name}`);
}

export async function run() {
  await runCase("相对压缩路径会正确去掉目录前缀", async () => {
    assert.equal(getRelativeZipPath("docs", "docs/readme.md"), "readme.md");
    assert.equal(getRelativeZipPath("docs/", "docs/nested/a.txt"), "nested/a.txt");
    assert.equal(getRelativeZipPath("", "root.txt"), "root.txt");
  });

  await runCase("目录递归抓取会返回文件和文件夹标记", async () => {
    const pages = new Map([
      ["", { value: [{ key: "root.txt", size: 1 }], folders: ["docs/"], marker: null }],
      ["docs/", { value: [{ key: "docs/readme.md", size: 2 }], folders: ["docs/nested/"], marker: null }],
      ["docs/nested/", { value: [{ key: "docs/nested/a.txt", size: 3 }], folders: [], marker: null }],
    ]);
    const requestedPrefixes = [];
    const requestHeaders = [];

    const items = await fetchAllItemsRecursively({
      prefix: "",
      buildChildrenUrl: (prefix) => `/children?prefix=${encodeURIComponent(prefix)}`,
      getHeaders: () => ({ Authorization: "Basic token" }),
      fetchImpl: async (url, { headers }) => {
        const prefix = url.searchParams.get("prefix") || "";
        requestedPrefixes.push(prefix);
        requestHeaders.push(headers.Authorization);

        return new Response(JSON.stringify(pages.get(prefix)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      concurrency: 2,
    });

    assert.deepEqual(
      requestedPrefixes.sort(),
      ["", "docs/", "docs/nested/"].sort()
    );
    assert.deepEqual(requestHeaders, ["Basic token", "Basic token", "Basic token"]);
    assert.ok(items.some((item) => item.key === "root.txt"));
    assert.ok(items.some((item) => item.key === "docs_$folder$"));
    assert.ok(items.some((item) => item.key === "docs/nested_$folder$"));
    assert.ok(items.some((item) => item.key === "docs/nested/a.txt"));
  });

  await runCase("下载保护会在超过限制时给出明确提示", async () => {
    const summary = summarizeDownloadItems([
      { key: "docs/a.txt", size: FOLDER_DOWNLOAD_LIMITS.maxBytes + 1 },
    ]);

    assert.match(
      getFolderDownloadLimitMessage(summary, FOLDER_DOWNLOAD_LIMITS),
      /下载内容过大/
    );
  });
}
