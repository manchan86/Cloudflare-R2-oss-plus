import assert from "node:assert/strict";

import {
  FOLDER_DOWNLOAD_LIMITS,
  fetchAllItemsRecursively,
  fetchFolderTreeRecursively,
  getFolderDownloadLimitMessage,
  getRelativeZipPath,
  summarizeDownloadItems,
} from "../assets/file-ops.mjs";
import {
  getPathName,
  stripFolderMarker,
  toFolderMarkerKey,
} from "../assets/item-paths.mjs";

async function runCase(name, fn) {
  await fn();
  console.log(`  ok - ${name}`);
}

function createPages() {
  return new Map([
    ["", { value: [{ key: "root.txt", size: 1 }], folders: ["docs/", "empty/"], marker: null }],
    ["docs/", { value: [{ key: "docs/readme.md", size: 2 }], folders: ["docs/nested/"], marker: null }],
    ["docs/nested/", { value: [{ key: "docs/nested/a.txt", size: 3 }], folders: [], marker: null }],
    ["empty/", { value: [], folders: [], marker: null }],
  ]);
}

function createFetchImpl(pages, requestedPrefixes, requestHeaders) {
  return async (url, { headers }) => {
    const prefix = url.searchParams.get("prefix") || "";
    requestedPrefixes.push(prefix);
    requestHeaders.push(headers.Authorization);

    return new Response(JSON.stringify(pages.get(prefix)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

export async function run() {
  await runCase("相对压缩路径会正确去掉目录前缀", async () => {
    assert.equal(getRelativeZipPath("docs", "docs/readme.md"), "readme.md");
    assert.equal(getRelativeZipPath("docs/", "docs/nested/a.txt"), "nested/a.txt");
    assert.equal(getRelativeZipPath("", "root.txt"), "root.txt");
  });

  await runCase("目录递归抓取会返回文件和文件夹标记", async () => {
    const pages = createPages();
    const requestedPrefixes = [];
    const requestHeaders = [];

    const items = await fetchAllItemsRecursively({
      prefix: "",
      buildChildrenUrl: (prefix) => `/children?prefix=${encodeURIComponent(prefix)}`,
      getHeaders: () => ({ Authorization: "Basic token" }),
      fetchImpl: createFetchImpl(pages, requestedPrefixes, requestHeaders),
      concurrency: 2,
    });

    assert.deepEqual(
      requestedPrefixes.sort(),
      ["", "docs/", "docs/nested/", "empty/"].sort()
    );
    assert.deepEqual(requestHeaders, ["Basic token", "Basic token", "Basic token", "Basic token"]);
    assert.ok(items.some((item) => item.key === "root.txt"));
    assert.ok(items.some((item) => item.key === toFolderMarkerKey("docs/")));
    assert.ok(items.some((item) => item.key === toFolderMarkerKey("docs/nested/")));
    assert.ok(items.some((item) => item.key === toFolderMarkerKey("empty/")));
    assert.ok(items.some((item) => item.key === "docs/nested/a.txt"));
  });

  await runCase("递归目录树会区分空目录", async () => {
    const tree = await fetchFolderTreeRecursively({
      prefix: "",
      buildChildrenUrl: (prefix) => `/children?prefix=${encodeURIComponent(prefix)}`,
      getHeaders: () => ({ Authorization: "Basic token" }),
      fetchImpl: createFetchImpl(createPages(), [], []),
      concurrency: 2,
    });

    assert.deepEqual(
      tree.files.map((file) => file.key).sort(),
      ["root.txt", "docs/readme.md", "docs/nested/a.txt"].sort()
    );
    assert.ok(tree.folders.some((folder) => folder.prefix === "docs/" && !folder.isEmpty));
    assert.ok(tree.folders.some((folder) => folder.prefix === "docs/nested/" && !folder.isEmpty));
    assert.ok(tree.folders.some((folder) => folder.prefix === "empty/" && folder.isEmpty));
  });

  await runCase("文件夹标记后缀会被正确剥离", async () => {
    assert.equal(stripFolderMarker("docs/demo/_$folder$"), "docs/demo");
    assert.equal(getPathName("docs/demo/_$folder$"), "demo");
    assert.equal(toFolderMarkerKey("docs/demo/"), "docs/demo/_$folder$");
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
