export const FOLDER_MARKER_SUFFIX = "_$folder$";

export function isFolderMarker(key) {
  return String(key || "").endsWith(FOLDER_MARKER_SUFFIX);
}

export function stripFolderMarker(key) {
  return String(key || "").replace(new RegExp(`${FOLDER_MARKER_SUFFIX}$`), "");
}

export function ensureTrailingSlash(path) {
  const normalized = String(path || "");
  if (!normalized) return "";
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export function trimTrailingSlash(path) {
  return String(path || "").replace(/\/+$/, "");
}

export function getPathName(path) {
  const normalized = stripFolderMarker(trimTrailingSlash(path));
  if (!normalized) return "";
  return normalized.split("/").filter(Boolean).pop() || normalized;
}

export function toFolderMarkerKey(path) {
  const normalized = trimTrailingSlash(stripFolderMarker(path));
  return normalized ? `${normalized}${FOLDER_MARKER_SUFFIX}` : FOLDER_MARKER_SUFFIX;
}
