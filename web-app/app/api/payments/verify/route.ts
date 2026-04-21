import { NextRequest, NextResponse } from "next/server";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveGatewayBase(): string {
  const candidates = [
    process.env.API_GATEWAY_INTERNAL_URL,
    process.env.API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ];

  const runningInK8s = Boolean(process.env.KUBERNETES_SERVICE_HOST);

  for (const candidate of candidates) {
    if (!candidate || candidate.trim() === "") {
      continue;
    }

    const normalized = stripTrailingSlash(candidate.trim());
    if (!runningInK8s) {
      return normalized;
    }

    try {
      const parsed = new URL(normalized);
      const host = parsed.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        continue;
      }
      return normalized;
    } catch {
      if (!normalized.includes("localhost") && !normalized.includes("127.0.0.1")) {
        return normalized;
      }
    }
  }

  return runningInK8s ? "http://api-gateway-nginx" : "http://localhost:8080";
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") || "";
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing or invalid Authorization header" }, { status: 401 });
  }

  const endpoint = `${resolveGatewayBase()}/payments/verify?session_id=${encodeURIComponent(sessionId)}`;

  try {
    const upstream = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: authorization,
      },
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const bodyText = await upstream.text();

    return new NextResponse(bodyText, {
      status: upstream.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upstream request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
