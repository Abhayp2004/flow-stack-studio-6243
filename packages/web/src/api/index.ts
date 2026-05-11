import { Hono, type Context } from 'hono';
import { cors } from "hono/cors"
import { analyzeWebsite } from './analyzer';

type LiveField = {
  name: string;
  type: string;
  required: boolean;
  isId?: boolean;
  example: string;
};

type DeployBody = {
  resourceName: string;
  pluralName: string;
  apiSlug: string;
  apiKey: string;
  fields: LiveField[];
  openApiSpec: unknown;
};

type LiveRecord = Record<string, unknown>;

type LiveDeployment = {
  slug: string;
  resourceName: string;
  pluralName: string;
  apiKey: string;
  idField: string;
  fields: LiveField[];
  openApiSpec: unknown;
  records: Map<string, LiveRecord>;
  createdAt: string;
  requestCount: number;
  errorCount: number;
  lastRequestAt?: string;
  methodCount: Record<string, number>;
  endpointCount: Record<string, number>;
  latencySamples: number[];
};

const liveDeployments = new Map<string, LiveDeployment>();
const DEFAULT_METHOD_COUNTS = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "generated-api";
}

function isLocalHost(host: string): boolean {
  return host.includes("localhost") || host.includes("127.0.0.1");
}

function makeDeploymentUrls(host: string, slug: string) {
  const localProtocol = isLocalHost(host) ? "http" : "https";
  const localBaseUrl = `${localProtocol}://${host}/api/v1/${slug}`;
  const liveBaseUrl = `https://api.stackrun.io/v1/${slug}`;
  return {
    localBaseUrl,
    liveBaseUrl,
    docsLocalUrl: `${localBaseUrl}/docs`,
    docsUrl: `${liveBaseUrl}/docs`,
    monitoringLocalUrl: `${localBaseUrl}/monitoring`,
    monitoringUrl: `${liveBaseUrl}/monitoring`,
    analyticsLocalUrl: `${localBaseUrl}/analytics`,
    analyticsUrl: `${liveBaseUrl}/analytics`,
    openApiLocalUrl: `${localBaseUrl}/openapi.json`,
    openApiUrl: `${liveBaseUrl}/openapi.json`,
  };
}

function recordTelemetry(dep: LiveDeployment, method: string, path: string, status: number, elapsedMs: number) {
  dep.requestCount += 1;
  dep.lastRequestAt = new Date().toISOString();
  dep.methodCount[method] = (dep.methodCount[method] ?? 0) + 1;
  dep.endpointCount[path] = (dep.endpointCount[path] ?? 0) + 1;
  dep.latencySamples.push(elapsedMs);
  if (dep.latencySamples.length > 250) dep.latencySamples.shift();
  if (status >= 400) dep.errorCount += 1;
}

function parseExample(field: LiveField): unknown {
  if (field.type === "number") {
    const n = Number(field.example);
    return Number.isFinite(n) ? n : 0;
  }
  if (field.type === "boolean") {
    return String(field.example).toLowerCase() === "true";
  }
  return field.example;
}

function buildSeedRecord(dep: LiveDeployment): LiveRecord {
  const record: LiveRecord = {};
  for (const field of dep.fields) {
    record[field.name] = parseExample(field);
  }
  return record;
}

function deploymentSummary(dep: LiveDeployment, host: string) {
  const urls = makeDeploymentUrls(host, dep.slug);
  return {
    status: "live",
    slug: dep.slug,
    resourceName: dep.resourceName,
    pluralName: dep.pluralName,
    createdAt: dep.createdAt,
    requestCount: dep.requestCount,
    errorCount: dep.errorCount,
    lastRequestAt: dep.lastRequestAt ?? null,
    ...urls,
  };
}

function getDeployment(c: Context) {
  const slug = slugify(c.req.param("apiSlug"));
  const dep = liveDeployments.get(slug);
  return { slug, dep };
}

function authFailed(c: Context, dep: LiveDeployment) {
  const provided = c.req.header("X-API-Key") ?? "";
  return provided !== dep.apiKey;
}

const app = new Hono()
  .basePath('api')
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true }))
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }))
  .get('/health', (c) => c.json({ status: 'ok' }))
  .get('/analyze', async (c) => {
    const url = c.req.query('url');
    if (!url) return c.json({ error: 'url query param is required' }, 400);
    try {
      const result = await analyzeWebsite(url);
      return c.json(result);
    } catch (err) {
      console.error('[analyze]', err);
      return c.json({ error: String(err) }, 500);
    }
  })
  .post('/live/deploy', async (c) => {
    let body: DeployBody;
    try {
      body = await c.req.json<DeployBody>();
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400);
    }

    if (!body?.resourceName || !body?.pluralName || !body?.apiKey || !Array.isArray(body?.fields)) {
      return c.json({ error: "Missing required deployment fields" }, 400);
    }

    const slug = slugify(body.apiSlug || body.pluralName);
    const host = c.req.header("host") ?? "localhost:5173";
    const existing = liveDeployments.get(slug);
    const idField = body.fields.find(f => f.isId)?.name ?? "id";

    if (existing) {
      existing.fields = body.fields;
      existing.openApiSpec = body.openApiSpec;
      existing.apiKey = body.apiKey;
      existing.idField = idField;
      existing.resourceName = body.resourceName;
      existing.pluralName = body.pluralName;
      return c.json(deploymentSummary(existing, host));
    }

    const deployment: LiveDeployment = {
      slug,
      resourceName: body.resourceName,
      pluralName: body.pluralName,
      apiKey: body.apiKey,
      idField,
      fields: body.fields,
      openApiSpec: body.openApiSpec,
      records: new Map(),
      createdAt: new Date().toISOString(),
      requestCount: 0,
      errorCount: 0,
      methodCount: { ...DEFAULT_METHOD_COUNTS },
      endpointCount: {},
      latencySamples: [],
    };

    const seed = buildSeedRecord(deployment);
    const seedId = String(seed[idField] ?? crypto.randomUUID());
    seed[idField] = seedId;
    deployment.records.set(seedId, seed);
    liveDeployments.set(slug, deployment);
    return c.json(deploymentSummary(deployment, host), 201);
  })
  .get('/live/:apiSlug', (c) => {
    const { dep } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found" }, 404);
    const host = c.req.header("host") ?? "localhost:5173";
    return c.json(deploymentSummary(dep, host));
  })
  .get('/v1/:apiSlug/openapi.json', (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);
    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 200, elapsed);
    return c.json(dep.openApiSpec);
  })
  .get('/v1/:apiSlug/docs', (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);
    const host = c.req.header("host") ?? "localhost:5173";
    const urls = makeDeploymentUrls(host, dep.slug);
    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 200, elapsed);
    return c.json({
      name: `${dep.resourceName} API`,
      version: "1.0.0",
      baseUrl: urls.liveBaseUrl,
      localBaseUrl: urls.localBaseUrl,
      openApiUrl: urls.openApiUrl,
      localOpenApiUrl: urls.openApiLocalUrl,
      endpoints: [
        `GET ${urls.liveBaseUrl}/${dep.pluralName}`,
        `GET ${urls.liveBaseUrl}/${dep.pluralName}/{${dep.idField}}`,
        `POST ${urls.liveBaseUrl}/${dep.pluralName}`,
        `PUT ${urls.liveBaseUrl}/${dep.pluralName}/{${dep.idField}}`,
        `DELETE ${urls.liveBaseUrl}/${dep.pluralName}/{${dep.idField}}`,
      ],
    });
  })
  .get('/v1/:apiSlug/monitoring', (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);

    const now = Date.now();
    const created = new Date(dep.createdAt).getTime();
    const uptimeSeconds = Math.max(0, Math.floor((now - created) / 1000));
    const latencySamples = dep.latencySamples.length ? dep.latencySamples : [0];
    const avgMs = Math.round(latencySamples.reduce((sum, n) => sum + n, 0) / latencySamples.length);
    const sorted = [...latencySamples].sort((a, b) => a - b);
    const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const errorRate = dep.requestCount ? Number((dep.errorCount / dep.requestCount).toFixed(4)) : 0;

    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 200, elapsed);
    return c.json({
      status: "healthy",
      requests: dep.requestCount,
      errors: dep.errorCount,
      errorRate,
      uptimeSeconds,
      avgLatencyMs: avgMs,
      p95LatencyMs: Math.round(p95Ms),
      methods: dep.methodCount,
      lastRequestAt: dep.lastRequestAt ?? null,
    });
  })
  .get('/v1/:apiSlug/analytics', (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);

    const topEndpoints = Object.entries(dep.endpointCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, hits]) => ({ path, hits }));

    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 200, elapsed);
    return c.json({
      totalRequests: dep.requestCount,
      trafficByMethod: dep.methodCount,
      topEndpoints,
      lastRequestAt: dep.lastRequestAt ?? null,
    });
  })
  .get('/v1/:apiSlug/:resource', (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);
    if (authFailed(c, dep)) return c.json({ error: "Unauthorized" }, 401);

    const page = Number(c.req.query("page") ?? 1);
    const limit = Number(c.req.query("limit") ?? 20);
    const all = Array.from(dep.records.values());
    const data = all.slice((page - 1) * limit, page * limit);
    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 200, elapsed);
    return c.json({ data, total: all.length, page, limit });
  })
  .get('/v1/:apiSlug/:resource/:id', (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);
    if (authFailed(c, dep)) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const item = dep.records.get(id);
    if (!item) {
      const elapsedNotFound = Math.round(performance.now() - started);
      recordTelemetry(dep, c.req.method, c.req.path, 404, elapsedNotFound);
      return c.json({ error: "Not found" }, 404);
    }
    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 200, elapsed);
    return c.json(item);
  })
  .post('/v1/:apiSlug/:resource', async (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);
    if (authFailed(c, dep)) return c.json({ error: "Unauthorized" }, 401);

    let body: LiveRecord;
    try {
      body = await c.req.json<LiveRecord>();
    } catch {
      const elapsed = Math.round(performance.now() - started);
      recordTelemetry(dep, c.req.method, c.req.path, 400, elapsed);
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const id = String(body[dep.idField] ?? crypto.randomUUID());
    const record = { ...body, [dep.idField]: id };
    dep.records.set(id, record);
    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 201, elapsed);
    return c.json(record, 201);
  })
  .put('/v1/:apiSlug/:resource/:id', async (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);
    if (authFailed(c, dep)) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const existing = dep.records.get(id);
    if (!existing) {
      const elapsed = Math.round(performance.now() - started);
      recordTelemetry(dep, c.req.method, c.req.path, 404, elapsed);
      return c.json({ error: "Not found" }, 404);
    }

    let body: LiveRecord;
    try {
      body = await c.req.json<LiveRecord>();
    } catch {
      const elapsed = Math.round(performance.now() - started);
      recordTelemetry(dep, c.req.method, c.req.path, 400, elapsed);
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const updated = { ...existing, ...body, [dep.idField]: id };
    dep.records.set(id, updated);
    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 200, elapsed);
    return c.json(updated);
  })
  .delete('/v1/:apiSlug/:resource/:id', (c) => {
    const started = performance.now();
    const { dep, slug } = getDeployment(c);
    if (!dep) return c.json({ error: "Deployment not found", slug }, 404);
    if (authFailed(c, dep)) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const deleted = dep.records.delete(id);
    if (!deleted) {
      const elapsed = Math.round(performance.now() - started);
      recordTelemetry(dep, c.req.method, c.req.path, 404, elapsed);
      return c.json({ error: "Not found" }, 404);
    }
    const elapsed = Math.round(performance.now() - started);
    recordTelemetry(dep, c.req.method, c.req.path, 204, elapsed);
    return c.body(null, 204);
  });

export type AppType = typeof app;
export default app;
