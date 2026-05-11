export type FieldType = "string" | "number" | "boolean" | "date" | "uuid" | "email" | "object" | "array";

export interface SchemaField {
  name: string;
  type: FieldType;
  required: boolean;
  example: string;
  isId: boolean;
}

export interface ParsedSchema {
  resourceName: string;
  fields: SchemaField[];
  inputType: "json" | "csv" | "sql";
  rowCount: number;
}

function inferType(value: unknown): FieldType {
  if (value === null || value === undefined) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  const s = String(value).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "uuid";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "email";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "date";
  if (s !== "" && !isNaN(Number(s))) return "number";
  if (s === "true" || s === "false") return "boolean";
  return "string";
}

function isIdField(name: string): boolean {
  return /^(id|_id|uuid|pk)$/i.test(name);
}

function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

export function parseJSONInput(raw: string): ParsedSchema {
  const parsed = JSON.parse(raw.trim());

  let resourceName = "item";
  let sample: Record<string, unknown>;
  let rowCount = 1;

  if (Array.isArray(parsed)) {
    rowCount = parsed.length;
    sample = (parsed[0] ?? {}) as Record<string, unknown>;
  } else if (typeof parsed === "object" && parsed !== null) {
    const p = parsed as Record<string, unknown>;
    const arrayKey = Object.keys(p).find(
      k => Array.isArray(p[k]) && (p[k] as unknown[]).length > 0 && typeof (p[k] as unknown[])[0] === "object"
    );
    if (arrayKey) {
      resourceName = arrayKey.replace(/s$/, "").toLowerCase();
      rowCount = (p[arrayKey] as unknown[]).length;
      sample = (p[arrayKey] as Record<string, unknown>[])[0];
    } else {
      sample = p;
    }
  } else {
    throw new Error("Input must be a JSON object or array of objects");
  }

  const fields: SchemaField[] = Object.entries(sample).map(([name, value]) => ({
    name,
    type: inferType(value),
    required: true,
    example: Array.isArray(value) ? "[…]" : value === null ? "null" : String(value).slice(0, 60),
    isId: isIdField(name),
  }));

  return { resourceName, fields, inputType: "json", rowCount };
}

export function parseCSVInput(raw: string): ParsedSchema {
  const lines = raw.trim().split("\n").filter(l => l.trim());
  if (lines.length === 0) throw new Error("Empty CSV");

  const headers = parseCSVRow(lines[0]);
  const dataRows = lines.slice(1).map(parseCSVRow);

  const fields: SchemaField[] = headers.map((name, i) => {
    const examples = dataRows.slice(0, 5).map(r => r[i] ?? "");
    const nonEmpty = examples.find(v => v !== "") ?? "";
    return {
      name,
      type: inferType(nonEmpty),
      required: true,
      example: nonEmpty.slice(0, 60),
      isId: isIdField(name),
    };
  });

  return { resourceName: "record", fields, inputType: "csv", rowCount: dataRows.length };
}

export function parseSQLInput(raw: string): ParsedSchema {
  const tableMatch = raw.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(/i);
  if (!tableMatch) throw new Error("Could not find CREATE TABLE statement");

  const resourceName = tableMatch[1].toLowerCase().replace(/s$/, "");

  const start = raw.indexOf("(");
  let depth = 0;
  let end = start;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "(") depth++;
    if (raw[i] === ")") { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = raw.slice(start + 1, end);

  const SQL_TYPES: Record<string, FieldType> = {
    int: "number", integer: "number", bigint: "number", smallint: "number", serial: "number",
    float: "number", double: "number", decimal: "number", numeric: "number", real: "number",
    varchar: "string", text: "string", char: "string", nvarchar: "string",
    bool: "boolean", boolean: "boolean",
    date: "date", datetime: "date", timestamp: "date", timestamptz: "date",
    uuid: "uuid",
    json: "object", jsonb: "object",
  };

  const TYPE_EXAMPLES: Partial<Record<FieldType, string>> = {
    number: "42", boolean: "true", date: "2024-01-01T00:00:00Z",
    uuid: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com",
  };

  const colLines = body.split(",")
    .map(l => l.trim())
    .filter(l => l && !/^(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT|CHECK)/i.test(l));

  const fields: SchemaField[] = colLines.map(line => {
    const m = line.match(/[`"']?(\w+)[`"']?\s+(\w+)/);
    if (!m) return null;
    const [, name, sqlType] = m;
    const type: FieldType = SQL_TYPES[sqlType.toLowerCase()] ?? "string";
    return {
      name,
      type,
      required: /NOT\s+NULL/i.test(line),
      example: TYPE_EXAMPLES[type] ?? `sample_${name}`,
      isId: isIdField(name),
    };
  }).filter((f): f is SchemaField => f !== null);

  return { resourceName, fields, inputType: "sql", rowCount: 0 };
}
