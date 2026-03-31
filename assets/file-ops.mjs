import { isFolderMarker, toFolderMarkerKey } from "./item-paths.mjs";

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
      if (!item?.key || isFolderMarker(item.key)) {
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

export async function fetchFolderTreeRecursively({
  prefix,
  buildChildrenUrl,
  getHeaders,
  fetchImpl = fetch,
  concurrency = FOLDER_DOWNLOAD_LIMITS.concurrency,
}) {
  const files = [];
  const folders = [];
  const pendingPrefixes = [{ prefix: normalizeFolderPrefix(prefix), includeCurrentFolder: false }];
  let cursor = 0;

  async function drainPrefix({ prefix: currentPrefix, includeCurrentFolder }) {
    let marker = null;
    const currentFiles = [];
    const childFolders = [];

    do {
      const data = await fetchChildrenPage({
        prefix: currentPrefix,
        marker,
        buildChildrenUrl,
        getHeaders,
        fetchImpl,
      });

      const pageFiles = Array.isArray(data?.value) ? data.value : [];
      const pageFolders = Array.isArray(data?.folders)
        ? data.folders.map((folder) => normalizeFolderPrefix(folder))
        : [];

      files.push(...pageFiles);
      currentFiles.push(...pageFiles);
      childFolders.push(...pageFolders);
      marker = data?.marker || null;
    } while (marker);

    if (includeCurrentFolder) {
      folders.push({
        prefix: currentPrefix,
        isEmpty: currentFiles.length === 0 && childFolders.length === 0,
      });
    }

    for (const folder of childFolders) {
      pendingPrefixes.push({ prefix: folder, includeCurrentFolder: true });
    }
  }

  const batchSize = Math.max(1, Number(concurrency) || 1);
  while (cursor < pendingPrefixes.length) {
    const batch = pendingPrefixes.slice(cursor, cursor + batchSize);
    cursor += batch.length;
    await Promise.all(batch.map((entry) => drainPrefix(entry)));
  }

  return { files, folders };
}

export async function fetchAllItemsRecursively(options) {
  const { files, folders } = await fetchFolderTreeRecursively(options);
  const folderTimestamp = new Date().toISOString();

  return [
    ...files,
    ...folders.map((folder) => ({
      key: toFolderMarkerKey(folder.prefix),
      size: 0,
      uploaded: folderTimestamp,
    })),
  ];
}
