/**
 * URL helpers for the net client. Pure: the page location is passed in.
 */

export interface LocationLike {
  protocol: string;
  host: string;
}

/** Path of a room page and of its game socket (same path, HTTP versus WebSocket). */
export function roomPath(code: string): string {
  return `/r/${encodeURIComponent(code)}`;
}

/** WebSocket URL on the page origin: wss:// for HTTPS pages, ws:// otherwise. */
export function wsUrl(location: LocationLike, code: string, token?: string | null): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${scheme}//${location.host}${roomPath(code)}${query}`;
}

/** Extract the Room_Code from a page path like /r/ABCD. Null when the path is not a room path. */
export function roomCodeFromPath(pathname: string): string | null {
  const m = /^\/r\/([^/]+)\/?$/.exec(pathname);
  if (m === null) return null;
  try {
    return decodeURIComponent(m[1] ?? '');
  } catch {
    return null;
  }
}
