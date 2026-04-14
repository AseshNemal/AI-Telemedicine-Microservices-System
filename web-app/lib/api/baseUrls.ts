const DEFAULT_GATEWAY_BASE = "http://localhost:8080";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRootPath(pathname: string): boolean {
  return pathname === "/" || pathname.trim() === "";
}

export function resolveGatewayBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured || configured.trim() === "") {
    return DEFAULT_GATEWAY_BASE;
  }
  return stripTrailingSlash(configured.trim());
}

export function resolveServiceBase(
  configuredBase: string | undefined,
  defaultPathFromGateway: string,
): string {
  const gatewayBase = resolveGatewayBase();
  const normalizedDefaultPath = defaultPathFromGateway.trim();
  const defaultIsAbsolute = /^https?:\/\//i.test(normalizedDefaultPath);

  if (!configuredBase || configuredBase.trim() === "") {
    if (defaultIsAbsolute) {
      return stripTrailingSlash(normalizedDefaultPath);
    }
    return normalizedDefaultPath
      ? `${gatewayBase}${normalizedDefaultPath}`
      : gatewayBase;
  }

  const candidate = stripTrailingSlash(configuredBase.trim());

  try {
    const parsed = new URL(candidate);
    if (normalizedDefaultPath && !defaultIsAbsolute && isRootPath(parsed.pathname)) {
      parsed.pathname = normalizedDefaultPath;
      return stripTrailingSlash(parsed.toString());
    }
    return stripTrailingSlash(parsed.toString());
  } catch {
    // Support relative paths like /api/auth in local overrides.
    if (candidate.startsWith("/")) {
      return candidate;
    }
    if (defaultIsAbsolute) {
      return stripTrailingSlash(normalizedDefaultPath);
    }
    return normalizedDefaultPath
      ? `${gatewayBase}${normalizedDefaultPath}`
      : gatewayBase;
  }
}
