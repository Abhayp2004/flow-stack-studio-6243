import type { AnalysisResult, ConfidenceLevel, FlowEdge, FlowNode, StackTech } from "../../../types";
import type { ParsedRequest } from "./request-parser";

// Known third-party API domains
const TP_DOMAINS: Array<{ re: RegExp; name: string; category: string }> = [
  { re: /stripe\.com/, name: "Stripe", category: "Payments" },
  { re: /braintree/, name: "Braintree", category: "Payments" },
  { re: /paypal\.com/, name: "PayPal", category: "Payments" },
  { re: /twilio\.com/, name: "Twilio", category: "Messaging" },
  { re: /sendgrid\.net/, name: "SendGrid", category: "Email" },
  { re: /mailgun\.net/, name: "Mailgun", category: "Email" },
  { re: /algolia\.net|algolia\.io/, name: "Algolia", category: "Search" },
  { re: /supabase\.co/, name: "Supabase", category: "Database / BaaS" },
  { re: /firebase\.googleapis|firestore\.googleapis/, name: "Firebase", category: "Database / BaaS" },
  { re: /openai\.com/, name: "OpenAI", category: "AI" },
  { re: /anthropic\.com/, name: "Anthropic", category: "AI" },
  { re: /pusher\.com/, name: "Pusher", category: "Real-time" },
  { re: /sentry\.io/, name: "Sentry", category: "Error Tracking" },
  { re: /segment\.io|segment\.com/, name: "Segment", category: "Analytics" },
  { re: /intercom\.io/, name: "Intercom", category: "Support Chat" },
  { re: /zendesk\.com/, name: "Zendesk", category: "Support Chat" },
  { re: /mixpanel\.com/, name: "Mixpanel", category: "Analytics" },
  { re: /amplitude\.com/, name: "Amplitude", category: "Analytics" },
  { re: /auth0\.com/, name: "Auth0", category: "Auth / Identity" },
  { re: /clerk\.com|clerk\.dev/, name: "Clerk", category: "Auth / Identity" },
  { re: /resend\.com/, name: "Resend", category: "Email" },
  { re: /loops\.so/, name: "Loops", category: "Email" },
  { re: /upstash\.io/, name: "Upstash", category: "Database / BaaS" },
  { re: /planetscale\.com/, name: "PlanetScale", category: "Database / BaaS" },
  { re: /neon\.tech/, name: "Neon", category: "Database / BaaS" },
];

export function buildAnalysisFromRequest(parsed: ParsedRequest): AnalysisResult {
  let urlObj: URL;
  try { urlObj = new URL(parsed.url); } catch { urlObj = new URL("https://api.example.com"); }

  const hostname = urlObj.hostname;
  const headers = parsed.headers;
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const infrastructure: StackTech[] = [];
  const thirdParty: StackTech[] = [];

  // ── Browser ──────────────────────────────────────────────────────────────────
  nodes.push({ id: "browser", label: "Browser / Client", type: "browser", description: `Initiates ${parsed.method} ${urlObj.pathname || "/"} — imported from ${parsed.format} format.` });

  // ── CDN detection ────────────────────────────────────────────────────────────
  const cdnName =
    "cf-ray" in headers || "cf-cache-status" in headers ? "Cloudflare" :
    "x-vercel-id" in headers || hostname.includes("vercel.app") ? "Vercel Edge" :
    "x-fastly-request-id" in headers ? "Fastly" :
    "x-amz-cf-id" in headers || hostname.includes("cloudfront.net") ? "AWS CloudFront" :
    null;
  if (cdnName) {
    nodes.push({ id: "cdn", label: cdnName, type: "cdn", description: `Request routes through ${cdnName} edge network.` });
    edges.push({ from: "browser", to: "cdn", label: "HTTPS" });
    infrastructure.push({ name: cdnName, category: "CDN", confidence: "high", evidence: `Response header detected.` });
  }

  // ── Auth detection ───────────────────────────────────────────────────────────
  let authHint = "Auth method not detectable from request headers.";
  const authVal = headers["authorization"] || headers["x-api-key"] || headers["api-key"] || headers["x-auth-token"];
  let authNodeAdded = false;
  if (authVal) {
    if (/^Bearer\s/i.test(authVal)) {
      authHint = "Bearer token (JWT / OAuth 2.0). Token present in Authorization header.";
      nodes.push({ id: "auth", label: "JWT / OAuth", type: "auth", description: "OAuth 2.0 Bearer token — likely JWT. Sent via Authorization header on every request." });
      authNodeAdded = true;
    } else if (/^Basic\s/i.test(authVal)) {
      authHint = "HTTP Basic Authentication. Base64-encoded credentials in Authorization header.";
      nodes.push({ id: "auth", label: "Basic Auth", type: "auth", description: "HTTP Basic Auth — Base64(username:password) in Authorization header." });
      authNodeAdded = true;
    } else if (headers["x-api-key"] || headers["api-key"]) {
      authHint = "API Key authentication via request header.";
      nodes.push({ id: "auth", label: "API Key", type: "auth", description: "API key passed in request header (x-api-key / api-key)." });
      authNodeAdded = true;
    } else {
      authHint = `Custom auth header present: ${Object.keys(headers).find(k => k.includes("auth") || k.includes("key") || k.includes("token")) ?? "authorization"}.`;
      nodes.push({ id: "auth", label: "Auth", type: "auth", description: authHint });
      authNodeAdded = true;
    }
  }

  // ── API type ─────────────────────────────────────────────────────────────────
  const ct = headers["content-type"] || headers["accept"] || "";
  const bodyStr = parsed.body || "";
  const isGraphQL = ct.includes("graphql") || bodyStr.includes('"query"') || /\b(query|mutation)\s*\{/.test(bodyStr);
  const isTrpc = hostname.includes("trpc") || parsed.url.includes("/trpc/") || "x-trpc-source" in headers;
  const apiTypeName = isGraphQL ? "GraphQL" : isTrpc ? "tRPC" : "REST";
  const apiType = {
    name: apiTypeName,
    confidence: "high" as ConfidenceLevel,
    details: isGraphQL
      ? `GraphQL — detected from Content-Type or query body structure.`
      : isTrpc
      ? `tRPC — detected from URL pattern or x-trpc-source header.`
      : `REST — ${parsed.method} ${urlObj.pathname || "/"}`,
  };

  const apiLabel = isGraphQL ? "GraphQL API" : isTrpc ? "tRPC API" : "REST API";
  nodes.push({ id: "api", label: apiLabel, type: "api", description: `${parsed.method} ${urlObj.pathname || "/"} on ${hostname}. ${apiType.details}` });
  const apiFrom = authNodeAdded ? "auth" : cdnName ? "cdn" : "browser";
  edges.push({ from: apiFrom, to: "api", label: parsed.method.toLowerCase() });

  // ── Third-party detection from hostname ──────────────────────────────────────
  const tpMatch = TP_DOMAINS.find(d => d.re.test(hostname));
  if (tpMatch) {
    const id = tpMatch.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    nodes.push({ id, label: tpMatch.name, type: "third-party", description: `${tpMatch.category} — this request targets ${hostname} directly.` });
    edges.push({ from: "api", to: id, label: tpMatch.category.toLowerCase(), style: "dashed" });
    thirdParty.push({ name: tpMatch.name, category: tpMatch.category, confidence: "high", evidence: `Request URL is ${hostname}.` });
  }

  // ── Database inference ────────────────────────────────────────────────────────
  const responseBody = parsed.response?.body ?? "";
  const hasSupabase = responseBody.includes('"created_at"') || thirdParty.some(t => t.name === "Supabase");
  const hasFirestore = responseBody.includes('"documents"') && responseBody.includes('"fields"');
  const dbLabel = hasSupabase ? "Supabase (Postgres)" : hasFirestore ? "Firestore" : "Database";
  const dbDesc = hasSupabase
    ? "Supabase PostgreSQL — detected from response field patterns (created_at, updated_at)."
    : hasFirestore
    ? "Firebase Firestore — detected from document/fields structure in response."
    : "Primary data store — type not directly observable from request.";

  if (!tpMatch || !["Database / BaaS"].includes(tpMatch.category)) {
    nodes.push({ id: "db", label: dbLabel, type: "db", description: dbDesc });
    edges.push({ from: "api", to: "db", label: "queries" });
  }

  // ── Payload sample ────────────────────────────────────────────────────────────
  const payloadSample =
    (() => {
      const candidates = [parsed.response?.body, parsed.body].filter(Boolean) as string[];
      for (const c of candidates) {
        try { JSON.parse(c); return c; } catch { /* skip */ }
      }
      return undefined;
    })();

  // ── Summary ───────────────────────────────────────────────────────────────────
  const summaryParts = [
    `${parsed.method} ${urlObj.pathname || "/"} → ${hostname}`,
    authNodeAdded ? authHint.split(".")[0] : null,
    `${apiTypeName} API`,
    tpMatch ? `→ ${tpMatch.name}` : null,
    parsed.format === "har" && parsed.response ? `HTTP ${parsed.response.status} response captured` : null,
  ].filter(Boolean);

  const summary = `Imported from ${parsed.format.toUpperCase()} — ${summaryParts.join(" · ")}.`;

  // ── Mode detection ────────────────────────────────────────────────────────────
  const mode: AnalysisResult["mode"] =
    tpMatch?.category === "Payments" || parsed.url.includes("shop") || parsed.url.includes("product") || parsed.url.includes("cart") ? "ecommerce" :
    parsed.url.includes("blog") || parsed.url.includes("post") || parsed.url.includes("article") ? "blog" :
    "saas";

  // ── frontend (empty for imports) ──────────────────────────────────────────────
  const frontend: StackTech[] = [];

  return {
    url: parsed.url,
    analyzedAt: new Date().toISOString(),
    overallConfidence: "high",
    mode,
    summary,
    architectureNote: `${apiTypeName} request — ${parsed.method} ${urlObj.pathname || "/"}. ${authNodeAdded ? authHint.split(".")[0] + "." : ""} Imported from ${parsed.format.toUpperCase()}.`,
    frontend,
    infrastructure,
    apiType,
    authHint,
    thirdParty,
    flowNodes: nodes,
    flowEdges: edges,
    payloadHint: payloadSample ? "Payload extracted from imported request." : "No JSON body found in imported request.",
    payloadSample,
  };
}
