export interface ParsedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  response?: { status: number; headers: Record<string, string>; body?: string };
  format: "curl" | "fetch" | "http" | "har";
}

// ── cURL ──────────────────────────────────────────────────────────────────────

function parseCurl(input: string): ParsedRequest | null {
  // Remove line-continuation backslashes and normalize whitespace
  const normalized = input.replace(/\\\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();

  // URL: first https?:// token or after --url flag
  const urlMatch =
    normalized.match(/--url\s+['"]?(https?:\/\/[^\s'"]+)['"]?/) ||
    normalized.match(/curl\s+(?:-[a-zA-Z0-9]+\s+\S+\s+)*['"]?(https?:\/\/[^\s'"\\]+)['"]?/) ||
    normalized.match(/['"]?(https?:\/\/[^\s'"\\]+)['"]?/);
  if (!urlMatch) return null;
  const url = urlMatch[1].replace(/['"]/g, "").replace(/\\$/, "");

  // Method
  const methodMatch = normalized.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/);
  const hasData = /(?:--data(?:-raw|-binary|-urlencode)?|-d)\s+/.test(normalized);
  const method = methodMatch ? methodMatch[1].toUpperCase() : hasData ? "POST" : "GET";

  // Headers: -H 'Key: Value' or --header "Key: Value"
  const headers: Record<string, string> = {};
  const headerRe = /(?:-H|--header)\s+['"]([^'"]+)['"]/g;
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(normalized)) !== null) {
    const colon = hm[1].indexOf(":");
    if (colon > 0) {
      headers[hm[1].slice(0, colon).trim().toLowerCase()] = hm[1].slice(colon + 1).trim();
    }
  }

  // Body: --data* or -d, supporting single/double quotes and unquoted JSON
  const bodyMatch =
    normalized.match(/(?:--data-raw|--data-binary|--data-urlencode|--data|-d)\s+'([\s\S]+?)'(?:\s|$)/) ||
    normalized.match(/(?:--data-raw|--data-binary|--data-urlencode|--data|-d)\s+"([\s\S]+?)"(?:\s|$)/) ||
    normalized.match(/(?:--data-raw|--data-binary|--data-urlencode|--data|-d)\s+(\{[\s\S]+\})/);
  const body = bodyMatch ? bodyMatch[1] : undefined;

  return { url, method, headers, body, format: "curl" };
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

function parseFetch(input: string): ParsedRequest | null {
  const urlMatch = input.match(/fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/);
  if (!urlMatch) return null;
  const url = urlMatch[1];

  const methodMatch = input.match(/method\s*:\s*[`'"]([A-Z]+)[`'"]/i);
  const method = methodMatch ? methodMatch[1].toUpperCase() : "GET";

  // Extract headers block — find balanced braces after "headers:"
  const headers: Record<string, string> = {};
  const hdrsStart = input.indexOf("headers");
  if (hdrsStart !== -1) {
    const braceOpen = input.indexOf("{", hdrsStart);
    if (braceOpen !== -1) {
      let depth = 0, end = braceOpen;
      for (let i = braceOpen; i < input.length; i++) {
        if (input[i] === "{") depth++;
        else if (input[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
      }
      const hBlock = input.slice(braceOpen + 1, end);
      const pairsRe = /[`'"]?([A-Za-z0-9_\-]+)[`'"]?\s*:\s*[`'"]([^`'"]+)[`'"]/g;
      let pm: RegExpExecArray | null;
      while ((pm = pairsRe.exec(hBlock)) !== null) {
        headers[pm[1].trim().toLowerCase()] = pm[2].trim();
      }
    }
  }

  // Body
  let body: string | undefined;
  const jsStringify = input.match(/body\s*:\s*JSON\.stringify\((\{[\s\S]*?\})\)/);
  if (jsStringify) {
    body = jsStringify[1];
  } else {
    const bodyLiteral = input.match(/body\s*:\s*[`'"]([^`'"]*)[`'"]/);
    if (bodyLiteral) body = bodyLiteral[1];
  }

  return { url, method, headers, body, format: "fetch" };
}

// ── HTTP raw ──────────────────────────────────────────────────────────────────

function parseHttp(input: string): ParsedRequest | null {
  const lines = input.trim().split(/\r?\n/);
  const requestLineMatch = lines[0].match(/^([A-Z]+)\s+(\S+)\s+HTTP\/[\d.]+/i);
  if (!requestLineMatch) return null;

  const method = requestLineMatch[1].toUpperCase();
  const path = requestLineMatch[2];
  const headers: Record<string, string> = {};
  let bodyStart = lines.length;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "") { bodyStart = i + 1; break; }
    const colon = lines[i].indexOf(":");
    if (colon > 0) {
      headers[lines[i].slice(0, colon).trim().toLowerCase()] = lines[i].slice(colon + 1).trim();
    }
  }

  const host = headers["host"] || "localhost";
  const url = `https://${host}${path}`;
  const body = bodyStart < lines.length ? lines.slice(bodyStart).join("\n").trim() || undefined : undefined;

  return { url, method, headers, body, format: "http" };
}

// ── HAR ───────────────────────────────────────────────────────────────────────

function parseHar(input: string): ParsedRequest | null {
  let har: any;
  try { har = JSON.parse(input); } catch { return null; }
  const entries = har?.log?.entries;
  if (!Array.isArray(entries) || entries.length === 0) return null;

  // Prefer entries with JSON response
  const entry = entries.find((e: any) =>
    (e.response?.content?.mimeType || "").includes("json")
  ) || entries[0];

  const req = entry.request;
  const res = entry.response;

  const headers: Record<string, string> = {};
  for (const h of (req.headers || [])) headers[h.name.toLowerCase()] = h.value;

  const body = req.postData?.text || undefined;

  const resHeaders: Record<string, string> = {};
  for (const h of (res?.headers || [])) resHeaders[h.name.toLowerCase()] = h.value;
  const resBody = res?.content?.text || undefined;

  return {
    url: req.url,
    method: (req.method || "GET").toUpperCase(),
    headers,
    body,
    response: resBody ? { status: res.status ?? 200, headers: resHeaders, body: resBody } : undefined,
    format: "har",
  };
}

// ── public API ────────────────────────────────────────────────────────────────

export function detectFormat(input: string): "curl" | "fetch" | "http" | "har" | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith("{") && (t.includes('"entries"') || t.includes('"log"'))) return "har";
  if (/^curl\s/i.test(t)) return "curl";
  if (/^(?:const\s+\w+\s*=\s*(?:await\s+)?)?(?:await\s+)?fetch\s*\(/i.test(t)) return "fetch";
  if (/^[A-Z]+\s+\/\S*\s+HTTP\//i.test(t)) return "http";
  return null;
}

export function parseRequest(input: string): ParsedRequest | null {
  const fmt = detectFormat(input.trim());
  if (fmt === "har") return parseHar(input.trim());
  if (fmt === "curl") return parseCurl(input.trim());
  if (fmt === "fetch") return parseFetch(input.trim());
  if (fmt === "http") return parseHttp(input.trim());
  // Fallback: try all
  return parseCurl(input.trim()) ?? parseFetch(input.trim()) ?? parseHttp(input.trim()) ?? parseHar(input.trim());
}
