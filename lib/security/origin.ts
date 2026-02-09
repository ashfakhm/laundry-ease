type HeadersLike = {
  get(name: string): string | null;
};

const UNSAFE_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LOOPBACK_ALIASES = ["localhost", "127.0.0.1", "[::1]"];

export function isUnsafeHttpMethod(method: string): boolean {
  return UNSAFE_HTTP_METHODS.has(method.toUpperCase());
}

export function normalizeOrigin(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value || value.toLowerCase() === "null") return null;

  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeLoopbackHost(hostname: string): string {
  if (hostname === "::1") {
    return "[::1]";
  }
  return hostname.toLowerCase();
}

function toOrigin(protocol: string, hostname: string, port: string): string {
  const normalizedHost = normalizeLoopbackHost(hostname);
  const isIpv6 =
    normalizedHost.includes(":") && !normalizedHost.startsWith("[");
  const host = isIpv6 ? `[${normalizedHost}]` : normalizedHost;
  return `${protocol}//${host}${port ? `:${port}` : ""}`.toLowerCase();
}

function addOriginWithLoopbackAliases(
  origins: Set<string>,
  normalizedOrigin: string,
): void {
  origins.add(normalizedOrigin);

  try {
    const url = new URL(normalizedOrigin);
    const hostname = normalizeLoopbackHost(url.hostname);
    if (!LOOPBACK_HOSTS.has(hostname)) {
      return;
    }

    for (const alias of LOOPBACK_ALIASES) {
      origins.add(toOrigin(url.protocol, alias, url.port));
    }
  } catch {
    // Ignore malformed values; caller already validated normalizedOrigin.
  }
}

function getOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null;

  try {
    return new URL(referer).origin.toLowerCase();
  } catch {
    return null;
  }
}

function resolveProtocol(url: string, headers: HeadersLike): string {
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim().toLowerCase();
  }

  try {
    return new URL(url).protocol.replace(":", "").toLowerCase();
  } catch {
    return "https";
  }
}

export function extractRequestOrigin(headers: HeadersLike): string | null {
  const fromOriginHeader = normalizeOrigin(headers.get("origin"));
  if (fromOriginHeader) return fromOriginHeader;
  return getOriginFromReferer(headers.get("referer"));
}

type CollectAllowedOriginsOptions = {
  requestUrl: string;
  headers: HeadersLike;
  envOrigins?: Array<string | undefined>;
};

export function collectAllowedOriginsFromRequest(
  options: CollectAllowedOriginsOptions,
): string[] {
  const { requestUrl, headers, envOrigins = [] } = options;

  const origins = new Set<string>();
  const reqOrigin = normalizeOrigin(requestUrl);
  if (reqOrigin) addOriginWithLoopbackAliases(origins, reqOrigin);

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto = resolveProtocol(requestUrl, headers);
    const hostOrigin = normalizeOrigin(`${proto}://${host}`);
    if (hostOrigin) addOriginWithLoopbackAliases(origins, hostOrigin);
  }

  for (const origin of envOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) addOriginWithLoopbackAliases(origins, normalized);
  }

  return [...origins];
}
