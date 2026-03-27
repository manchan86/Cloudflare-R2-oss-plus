export const FOLDER_DOWNLOAD_LIMITS = Object.freeze({
  maxFiles: 500,
  maxBytes: 1024 * 1024 * 1024,
  concurrency: 4,
});

function normalizeFolderPrefix(prefix) {
  if (!prefix) return "";
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function summarizeDownloadItems(items) {
  return (items || []).reduce(
    (summary, item) => {
      if (!item?.key || item.key.endsWith("_$folder$")) {
        return summary;
      }

      summary.fileCount += 1;
      summary.totalBytes += Number(item.size) || 0;
      return summary;
    },
    { fileCount: 0, totalBytes: 0 }
  );
}

export function getFolderDownloadLimitMessage(summary, limits = FOLDER_DOWNLOAD_LIMITS) {
  if (!summary) return "";
  if (summary.fileCount > limits.maxFiles) {
    return `下载内容过大：共 ${summary.fileCount} 个文件，当前上限为 ${limits.maxFiles} 个`;
  }
  if (summary.totalBytes > limits.maxBytes) {
    return `下载内容过大：约 ${formatBytes(summary.totalBytes)}，当前上限为 ${formatBytes(limits.maxBytes)}`;
  }
  return "";
}

export function getRelativeZipPath(basePath, fileKey) {
  const normalizedBasePath = normalizeFolderPrefix(basePath);
  if (!normalizedBasePath) return fileKey;
  return fileKey.startsWith(normalizedBasePath)
    ? fileKey.substring(normalizedBasePath.length)
    : fileKey;
}

async function fetchChildrenPage({ prefix, marker, buildChildrenUrl, getHeaders, fetchImpl }) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://example.com";
  const url = new URL(buildChildrenUrl(prefix), baseUrl);
  if (marker) {
    url.searchParams.set("marker", marker);
  }

  const response = await fetchImpl(url, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error(`读取目录失败 (${response.status})`);
  }

  return response.json();
}

export async function fetchAllItemsRecursively({
  prefix,
  buildChildrenUrl,
  getHeaders,
  fetchImpl = fetch,
  concurrency = FOLDER_DOWNLOAD_LIMITS.concurrency,
}) {
  const items = [];
  const folderTimestamp = new Date().toISOString();
  const pendingPrefixes = [normalizeFolderPrefix(prefix)];
  let cursor = 0;

  async function drainPrefix(currentPrefix) {
    let marker = null;

    do {
      const data = await fetchChildrenPage({
        prefix: currentPrefix,
        marker,
        buildChildrenUrl,
        getHeaders,
        fetchImpl,
      });

      items.push(...(Array.isArray(data?.value) ? data.value : []));

      for (const folder of Array.isArray(data?.folders) ? data.folders : []) {
        pendingPrefixes.push(folder);
        items.push({
          key: folder.replace(/\/$/, "") + "_$folder$",
          size: 0,
          uploaded: folderTimestamp,
        });
      }

      marker = data?.marker || null;
    } while (marker);
  }

  const batchSize = Math.max(1, Number(concurrency) || 1);
  while (cursor < pendingPrefixes.length) {
    const batch = pendingPrefixes.slice(cursor, cursor + batchSize);
    cursor += batch.length;
    await Promise.all(batch.map((currentPrefix) => drainPrefix(currentPrefix)));
  }

  return items;
}
