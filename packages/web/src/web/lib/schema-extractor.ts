export type FieldType = "string" | "number" | "boolean" | "null" | "object" | "array";
export type FieldPattern = "id" | "uuid" | "email" | "url" | "timestamp" | "currency" | "slug" | "color";

export interface SchemaField {
  path: string;
  type: FieldType;
  pattern?: FieldPattern;
  example: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function detectPattern(key: string, value: unknown): FieldPattern | undefined {
  const k = key.toLowerCase();

  if (typeof value === "string") {
    if (UUID_RE.test(value)) return "uuid";
    if (EMAIL_RE.test(value)) return "email";
    if (value.startsWith("http://") || value.startsWith("https://")) return "url";
    if (ISO_DATE_RE.test(value)) return "timestamp";
    if (HEX_COLOR_RE.test(value)) return "color";
  }

  // Key-based heuristics (apply to any type)
  if (k === "id" || k.endsWith("_id") || /\bid\b/.test(k)) return "id";
  if (k.includes("email")) return "email";
  if (k.includes("url") || k.includes("href") || k.includes("link") || k.includes("src") || k.includes("uri")) return "url";
  if (k.includes("at") && (k.includes("created") || k.includes("updated") || k.includes("deleted")) ||
      k.includes("timestamp") || k.includes("date") || k === "createdAt" || k === "updatedAt") return "timestamp";
  if (k.includes("price") || k.includes("amount") || k.includes("cost") || k.includes("total") || k.includes("fee") || k === "currency") return "currency";
  if (k === "slug" || k.endsWith("_slug")) return "slug";
  if (k.includes("color") || k.includes("colour")) return "color";

  return undefined;
}

function walk(value: unknown, path: string, out: SchemaField[], depth: number) {
  if (depth > 12) return;

  if (value === null) { out.push({ path, type: "null", example: null }); return; }
  if (typeof value === "boolean") { out.push({ path, type: "boolean", example: value }); return; }
  if (typeof value === "number") {
    const key = path.split(".").pop() ?? path;
    out.push({ path, type: "number", pattern: detectPattern(key, value), example: value });
    return;
  }
  if (typeof value === "string") {
    const key = path.split(".").pop() ?? path;
    out.push({ path, type: "string", pattern: detectPattern(key, value), example: value });
    return;
  }
  if (Array.isArray(value)) {
    out.push({ path, type: "array", example: `[${value.length} items]` });
    if (value.length > 0) walk(value[0], `${path}[]`, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (path) out.push({ path, type: "object", example: `{${entries.length} keys}` });
    for (const [k, v] of entries) {
      walk(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
  }
}

export function extractSchema(json: string): SchemaField[] {
  try {
    const parsed = JSON.parse(json);
    const fields: SchemaField[] = [];
    if (Array.isArray(parsed)) {
      fields.push({ path: "(root)", type: "array", example: `[${parsed.length} items]` });
      if (parsed.length > 0) walk(parsed[0], "(root)[]", fields, 0);
    } else {
      walk(parsed, "", fields, 0);
    }
    return fields.filter(f => f.path !== "");
  } catch {
    return [];
  }
}

export function groupByType(fields: SchemaField[]): Record<FieldType, SchemaField[]> {
  const g: Record<FieldType, SchemaField[]> = { string: [], number: [], boolean: [], null: [], object: [], array: [] };
  for (const f of fields) (g[f.type] ||= []).push(f);
  return g;
}
