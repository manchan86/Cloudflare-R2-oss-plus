export const FOLDER_MARKER_NAME = "_$folder$";
export const FOLDER_MARKER_SUFFIX = `/${FOLDER_MARKER_NAME}`;

export function isFolderMarker(key) {
  const normalized = String(key || "");
  return normalized === FOLDER_MARKER_NAME || normalized.endsWith(FOLDER_MARKER_SUFFIX);
}

export function stripFolderMarker(key) {
  const normalized = String(key || "");
  if (normalized === FOLDER_MARKER_NAME) return "";
  return normalized.endsWith(FOLDER_MARKER_SUFFIX)
    ? normalized.slice(0, -FOLDER_MARKER_SUFFIX.length)
    : normalized;
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
  const normalized = trimTrailingSlash(stripFolderMarker(path));
  if (!normalized) return "";
  return normalized.split("/").filter(Boolean).pop() || normalized;
}

export function toFolderMarkerKey(path) {
  const normalized = trimTrailingSlash(stripFolderMarker(path));
  return normalized ? `${normalized}${FOLDER_MARKER_SUFFIX}` : FOLDER_MARKER_NAME;
}
