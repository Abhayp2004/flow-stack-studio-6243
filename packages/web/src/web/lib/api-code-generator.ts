import type { SchemaField, ParsedSchema, FieldType } from "./data-schema-parser";
import type { FlowNode, FlowEdge } from "../../../types";

export interface APIEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  statusCode: number;
  requestBody?: Record<string, unknown>;
  response: unknown;
}

export interface LiveDeploymentInfo {
  status: "live";
  slug: string;
  localBaseUrl: string;
  liveBaseUrl: string;
  docsLocalUrl: string;
  docsUrl: string;
  monitoringLocalUrl: string;
  monitoringUrl: string;
  analyticsLocalUrl: string;
  analyticsUrl: string;
  openApiLocalUrl: string;
  openApiUrl: string;
  requestCount: number;
  errorCount: number;
  createdAt: string;
  lastRequestAt: string | null;
}

export interface GeneratedAPI {
  resourceName: string;
  pluralName: string;
  apiSlug: string;
  apiKey: string;
  liveUrl: string;
  docsUrl: string;
  monitoringUrl: string;
  analyticsUrl: string;
  openApiUrl: string;
  endpoints: APIEndpoint[];
  openApiSpec: unknown;
  code: { curl: string; typescript: string; hono: string; drizzle: string };
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
  schema: ParsedSchema;
  deployment?: LiveDeploymentInfo;
}

function pluralize(w: string): string {
  if (/s$/i.test(w)) return w;
  if (/y$/i.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
}

function generateKey(): string {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return "fss_live_" + Array.from({ length: 32 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "generated-api";
}

function toOAType(t: FieldType): object {
  const map: Record<FieldType, object> = {
    string: { type: "string" }, number: { type: "number" }, boolean: { type: "boolean" },
    date: { type: "string", format: "date-time" }, uuid: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" }, object: { type: "object" },
    array: { type: "array", items: { type: "string" } },
  };
  return map[t] ?? { type: "string" };
}

function exampleObject(fields: SchemaField[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of fields) obj[f.name] = f.example;
  return obj;
}

export function generateAPI(schema: ParsedSchema): GeneratedAPI {
  const { resourceName, fields } = schema;
  const plural = pluralize(resourceName);
  const apiSlug = slugify(plural);
  const apiKey = generateKey();
  const idField = fields.find(f => f.isId)?.name ?? "id";
  const typeName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);
  const example = exampleObject(fields);
  const BASE = `https://api.stackrun.io/v1/${apiSlug}`;
  const docsUrl = `${BASE}/docs`;
  const monitoringUrl = `${BASE}/monitoring`;
  const analyticsUrl = `${BASE}/analytics`;
  const openApiUrl = `${BASE}/openapi.json`;

  const endpoints: APIEndpoint[] = [
    {
      method: "GET", path: `/${plural}`,
      description: `List all ${plural} with pagination and filters`,
      statusCode: 200,
      response: { data: [example], total: 1, page: 1, limit: 20 },
    },
    {
      method: "GET", path: `/${plural}/{${idField}}`,
      description: `Get a single ${resourceName} by ${idField}`,
      statusCode: 200, response: example,
    },
    {
      method: "POST", path: `/${plural}`,
      description: `Create a new ${resourceName}`,
      statusCode: 201, requestBody: example,
      response: { ...example, [idField]: "new_generated_id" },
    },
    {
      method: "PUT", path: `/${plural}/{${idField}}`,
      description: `Update an existing ${resourceName}`,
      statusCode: 200, requestBody: example, response: example,
    },
    {
      method: "DELETE", path: `/${plural}/{${idField}}`,
      description: `Delete a ${resourceName}`,
      statusCode: 204, response: { success: true },
    },
  ];

  const properties: Record<string, object> = {};
  for (const f of fields) {
    properties[f.name] = { ...toOAType(f.type), example: f.example };
  }

  const openApiSpec = {
    openapi: "3.0.0",
    info: { title: `${typeName} API`, version: "1.0.0", description: `Auto-generated REST API for ${plural}` },
    servers: [{ url: BASE, description: "Production" }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } },
      schemas: {
        [typeName]: { type: "object", required: fields.filter(f => f.required).map(f => f.name), properties },
      },
    },
    paths: {
      [`/${plural}`]: {
        get: { summary: `List ${plural}`, tags: [typeName], parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ], responses: { "200": { description: "OK" } } },
        post: { summary: `Create ${resourceName}`, tags: [typeName], responses: { "201": { description: "Created" } } },
      },
      [`/${plural}/{${idField}}`]: {
        parameters: [{ name: idField, in: "path", required: true, schema: { type: "string" } }],
        get: { summary: `Get ${resourceName}`, tags: [typeName], responses: { "200": { description: "OK" }, "404": { description: "Not found" } } },
        put: { summary: `Update ${resourceName}`, tags: [typeName], responses: { "200": { description: "OK" } } },
        delete: { summary: `Delete ${resourceName}`, tags: [typeName], responses: { "204": { description: "Deleted" } } },
      },
    },
  };

  const exStr = JSON.stringify(example, null, 2);

  const curl = `# List all ${plural}
curl "${BASE}/${plural}?page=1&limit=20" \\
  -H "X-API-Key: ${apiKey}"

# Get by ${idField}
curl "${BASE}/${plural}/1" \\
  -H "X-API-Key: ${apiKey}"

# Create
curl -X POST "${BASE}/${plural}" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${exStr}'

# Update
curl -X PUT "${BASE}/${plural}/1" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${exStr}'

# Delete
curl -X DELETE "${BASE}/${plural}/1" \\
  -H "X-API-Key: ${apiKey}"`;

  const tsFields = fields.map(f => {
    const tsType = f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string";
    return `  ${f.name}${f.required ? "" : "?"}: ${tsType};`;
  }).join("\n");

  const typescript = `export interface ${typeName} {
${tsFields}
}

const BASE_URL = "${BASE}";
const headers = { "X-API-Key": "${apiKey}", "Content-Type": "application/json" };

export const ${resourceName}Api = {
  list: (page = 1, limit = 20) =>
    fetch(\`\${BASE_URL}/${plural}?page=\${page}&limit=\${limit}\`, { headers }).then(r => r.json()),

  get: (${idField}: string) =>
    fetch(\`\${BASE_URL}/${plural}/\${${idField}}\`, { headers }).then(r => r.json()),

  create: (body: Omit<${typeName}, "${idField}">) =>
    fetch(\`\${BASE_URL}/${plural}\`, { method: "POST", headers, body: JSON.stringify(body) }).then(r => r.json()),

  update: (${idField}: string, body: Partial<${typeName}>) =>
    fetch(\`\${BASE_URL}/${plural}/\${${idField}}\`, { method: "PUT", headers, body: JSON.stringify(body) }).then(r => r.json()),

  delete: (${idField}: string) =>
    fetch(\`\${BASE_URL}/${plural}/\${${idField}}\`, { method: "DELETE", headers }),
};`;

  const hono = `import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());
app.use("*", async (c, next) => {
  if (c.req.header("X-API-Key") !== process.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// In-memory store — swap in your DB (see Drizzle tab)
const store = new Map<string, ${typeName}>();

app.get("/${plural}", c => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 20);
  const all = Array.from(store.values());
  return c.json({ data: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit });
});

app.get("/${plural}/:${idField}", c => {
  const item = store.get(c.req.param("${idField}"));
  return item ? c.json(item) : c.json({ error: "Not found" }, 404);
});

app.post("/${plural}", async c => {
  const body = await c.req.json<Omit<${typeName}, "${idField}">>();
  const item = { ...body, ${idField}: crypto.randomUUID() };
  store.set(item.${idField} as string, item as ${typeName});
  return c.json(item, 201);
});

app.put("/${plural}/:${idField}", async c => {
  const id = c.req.param("${idField}");
  const existing = store.get(id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const updated = { ...existing, ...await c.req.json() };
  store.set(id, updated);
  return c.json(updated);
});

app.delete("/${plural}/:${idField}", c => {
  const deleted = store.delete(c.req.param("${idField}"));
  return deleted ? c.body(null, 204) : c.json({ error: "Not found" }, 404);
});

export default app;`;

  const DRIZZLE_TYPES: Record<FieldType, string> = {
    string: "text", number: "integer", boolean: "integer",
    date: "text", uuid: "text", email: "text", object: "text", array: "text",
  };

  const colDefs = fields.map(f => {
    const dt = DRIZZLE_TYPES[f.type];
    const pk = f.isId ? ".primaryKey()" : "";
    const nn = f.required ? ".notNull()" : "";
    return `  ${f.name}: ${dt}("${f.name}")${pk}${nn},`;
  }).join("\n");

  const drizzle = `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

export const ${plural}Table = sqliteTable("${plural}", {
${colDefs}
});

export type ${typeName} = typeof ${plural}Table.$inferSelect;
export type New${typeName} = typeof ${plural}Table.$inferInsert;

// DB client
const client = createClient({ url: process.env.DATABASE_URL! });
export const db = drizzle(client);

// Queries
export const queries = {
  list: (page = 1, limit = 20) =>
    db.select().from(${plural}Table).limit(limit).offset((page - 1) * limit),

  getById: (${idField}: string) =>
    db.select().from(${plural}Table).where(eq(${plural}Table.${idField}, ${idField})),

  create: (data: New${typeName}) =>
    db.insert(${plural}Table).values(data).returning(),

  update: (${idField}: string, data: Partial<New${typeName}>) =>
    db.update(${plural}Table).set(data).where(eq(${plural}Table.${idField}, ${idField})).returning(),

  delete: (${idField}: string) =>
    db.delete(${plural}Table).where(eq(${plural}Table.${idField}, ${idField})),
};`;

  const flowNodes: FlowNode[] = [
    { id: "client",   label: "Client",         type: "browser",  description: "API consumer (web / mobile / CLI)" },
    { id: "gateway",  label: "API Gateway",     type: "api",      description: "Rate limiting · CORS · routing" },
    { id: "auth",     label: "API Key Auth",    type: "auth",     description: "X-API-Key header validation" },
    { id: "resource", label: `/${plural}`,      type: "api",      description: `CRUD endpoints for ${resourceName}` },
    { id: "db",       label: "Database",        type: "db",       description: "LibSQL / Turso via Drizzle ORM" },
  ];

  const flowEdges: FlowEdge[] = [
    { from: "client",   to: "gateway",  label: "HTTPS" },
    { from: "gateway",  to: "auth",     label: "Validate",  style: "dashed" },
    { from: "auth",     to: "resource", label: "Authorized", style: "dashed" },
    { from: "gateway",  to: "resource", label: "Route" },
    { from: "resource", to: "db",       label: "Query" },
    { from: "db",       to: "resource", label: "Result",    style: "dashed" },
    { from: "resource", to: "client",   label: "JSON",      style: "dashed" },
  ];

  return {
    resourceName,
    pluralName: plural,
    apiSlug,
    apiKey,
    liveUrl: BASE,
    docsUrl,
    monitoringUrl,
    analyticsUrl,
    openApiUrl,
    endpoints,
    openApiSpec,
    code: { curl, typescript, hono, drizzle },
    flowNodes,
    flowEdges,
    schema,
  };
}
