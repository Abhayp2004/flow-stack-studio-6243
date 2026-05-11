import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Globe, Code2, Layers, GitBranch, Copy, Download, CheckCircle2,
  Zap, ArrowRight, Database, ChevronDown, ChevronUp, Key, Table2,
  FileJson, FileText, Terminal, Package, Link2,
} from "lucide-react";
import { Logo } from "../components/logo";
import { FlowDiagram } from "../components/flow-diagram";
import { HeroBackground } from "../components/hero-background";
import { parseJSONInput, parseCSVInput, parseSQLInput } from "../lib/data-schema-parser";
import { generateAPI } from "../lib/api-code-generator";
import { createZipArchive } from "../lib/zip";
import type { GeneratedAPI, LiveDeploymentInfo } from "../lib/api-code-generator";

type InputMode = "json" | "csv" | "sql";
type ResultTab = "endpoints" | "schema" | "code" | "flow";
type CodeLang = "curl" | "typescript" | "hono" | "drizzle";

const METHOD_COLOR: Record<string, { bg: string; text: string }> = {
  GET:    { bg: "rgba(34,197,94,0.12)",  text: "#22c55e" },
  POST:   { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
  PUT:    { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  DELETE: { bg: "rgba(239,68,68,0.12)",  text: "#ef4444" },
};

const FIELD_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  string:  { bg: "rgba(139,139,153,0.12)", text: "#8b8b99" },
  number:  { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  boolean: { bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  date:    { bg: "rgba(34,197,94,0.12)",   text: "#22c55e" },
  uuid:    { bg: "rgba(110,86,207,0.12)",  text: "#8b72e8" },
  email:   { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  object:  { bg: "rgba(110,86,207,0.12)",  text: "#6e56cf" },
  array:   { bg: "rgba(110,86,207,0.12)",  text: "#6e56cf" },
};

const SAMPLE_INPUTS: Record<InputMode, string> = {
  json: `[
  {
    "id": "usr_8f2k",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "role": "admin",
    "created_at": "2024-01-15T14:32:11Z",
    "is_active": true,
    "score": 98.5
  },
  {
    "id": "usr_9g3m",
    "name": "Bob Smith",
    "email": "bob@example.com",
    "role": "user",
    "created_at": "2024-02-20T09:15:00Z",
    "is_active": true,
    "score": 75.0
  }
]`,
  csv: `id,name,email,role,created_at,score,is_active
1,Alice Johnson,alice@example.com,admin,2024-01-15,98.5,true
2,Bob Smith,bob@example.com,user,2024-02-20,75.0,true
3,Charlie Brown,charlie@example.com,user,2024-03-10,82.3,false`,
  sql: `CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  is_published BOOLEAN NOT NULL DEFAULT false
);`,
};

const INPUT_TABS: { key: InputMode; label: string; icon: React.ReactNode }[] = [
  { key: "json", label: "JSON",       icon: <FileJson size={13} /> },
  { key: "csv",  label: "CSV / Excel", icon: <Table2  size={13} /> },
  { key: "sql",  label: "SQL Schema", icon: <Database size={13} /> },
];

const CODE_TABS: { key: CodeLang; label: string }[] = [
  { key: "curl",       label: "cURL" },
  { key: "typescript", label: "TypeScript" },
  { key: "hono",       label: "Hono.js" },
  { key: "drizzle",    label: "Drizzle ORM" },
];

function TypeBadge({ type }: { type: string }) {
  const c = FIELD_TYPE_COLOR[type] ?? FIELD_TYPE_COLOR.string;
  return (
    <span style={{
      background: c.bg, color: c.text,
      border: `1px solid ${c.text}33`, borderRadius: 4,
      padding: "1px 7px", fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
    }}>{type}</span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const c = METHOD_COLOR[method] ?? METHOD_COLOR.GET;
  return (
    <span style={{
      background: c.bg, color: c.text,
      border: `1px solid ${c.text}44`, borderRadius: 4,
      padding: "2px 8px", fontSize: 11, minWidth: 58, textAlign: "center",
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, display: "inline-block",
    }}>{method}</span>
  );
}

export default function ApiBuilder() {
  const [, navigate] = useLocation();
  const [inputMode, setInputMode] = useState<InputMode>("json");
  const [inputValue, setInputValue] = useState(SAMPLE_INPUTS.json);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedAPI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("endpoints");
  const [codeLang, setCodeLang] = useState<CodeLang>("curl");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [deployingLive, setDeployingLive] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const handleModeSwitch = useCallback((mode: InputMode) => {
    setInputMode(mode);
    setInputValue(SAMPLE_INPUTS[mode]);
    setError(null);
  }, []);

  const deployLive = useCallback(async (api: GeneratedAPI): Promise<LiveDeploymentInfo> => {
    const res = await fetch("/api/live/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceName: api.resourceName,
        pluralName: api.pluralName,
        apiSlug: api.apiSlug,
        apiKey: api.apiKey,
        fields: api.schema.fields,
        openApiSpec: api.openApiSpec,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string })?.error ?? `Live deployment failed (${res.status})`);
    }
    return await res.json() as LiveDeploymentInfo;
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!inputValue.trim()) return;
    setGenerating(true);
    setDeployingLive(true);
    setError(null);
    setDeploymentError(null);
    setResult(null);

    // Brief artificial delay for perceived complexity
    await new Promise(r => setTimeout(r, 600));

    try {
      let schema;
      if (inputMode === "json")      schema = parseJSONInput(inputValue);
      else if (inputMode === "csv")  schema = parseCSVInput(inputValue);
      else                           schema = parseSQLInput(inputValue);

      const api = generateAPI(schema);
      setResult(api);
      setResultTab("endpoints");
      const deployment = await deployLive(api);
      setResult({
        ...api,
        liveUrl: deployment.liveBaseUrl,
        docsUrl: deployment.docsUrl,
        monitoringUrl: deployment.monitoringUrl,
        analyticsUrl: deployment.analyticsUrl,
        openApiUrl: deployment.openApiUrl,
        deployment,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to build API";
      if (message.toLowerCase().includes("parse")) setError(message);
      else setDeploymentError(message);
    } finally {
      setGenerating(false);
      setDeployingLive(false);
    }
  }, [inputValue, inputMode, deployLive]);

  const redeploy = useCallback(async () => {
    if (!result) return;
    setDeployingLive(true);
    setDeploymentError(null);
    try {
      const deployment = await deployLive(result);
      setResult({
        ...result,
        liveUrl: deployment.liveBaseUrl,
        docsUrl: deployment.docsUrl,
        monitoringUrl: deployment.monitoringUrl,
        analyticsUrl: deployment.analyticsUrl,
        openApiUrl: deployment.openApiUrl,
        deployment,
      });
    } catch (e) {
      setDeploymentError(e instanceof Error ? e.message : "Redeploy failed");
    } finally {
      setDeployingLive(false);
    }
  }, [deployLive, result]);

  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const downloadSpec = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.openApiSpec, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.resourceName}-openapi.json`;
    a.click();
  }, [result]);

  const downloadCode = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.code.hono], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.resourceName}-api.ts`;
    a.click();
  }, [result]);

  const downloadApiKit = useCallback(() => {
    if (!result) return;
    const typeName = result.resourceName.charAt(0).toUpperCase() + result.resourceName.slice(1);
    const root = `${result.resourceName}-api-kit`;
    const readme = `# ${typeName} API Kit

This bundle was generated by StackRun API Builder.

## Includes
- runtime/index.ts (Hono API runtime)
- client/${result.resourceName}.client.ts (TypeScript client)
- openapi/openapi.json (OpenAPI 3 spec)
- examples/curl.txt (cURL examples)
- secrets/api-key.txt (generated API key)

## Quickstart (Bun)
1. bun create hono@latest my-api
2. Replace src/index.ts with runtime/index.ts
3. export API_KEY=$(cat secrets/api-key.txt)
4. bun run dev
`;

    const files = [
      { path: `${root}/README.md`, content: readme },
      { path: `${root}/runtime/index.ts`, content: result.code.hono },
      { path: `${root}/client/${result.resourceName}.client.ts`, content: result.code.typescript },
      { path: `${root}/examples/curl.txt`, content: result.code.curl },
      { path: `${root}/openapi/openapi.json`, content: JSON.stringify(result.openApiSpec, null, 2) },
      { path: `${root}/secrets/api-key.txt`, content: result.apiKey },
      {
        path: `${root}/metadata/stackrun.json`,
        content: JSON.stringify({
          name: root,
          version: "1.0.0",
          generatedAt: new Date().toISOString(),
          resource: {
            resourceName: result.resourceName,
            pluralName: result.pluralName,
            apiSlug: result.apiSlug,
          },
        }, null, 2),
      },
    ];

    const zipBytes = createZipArchive(files);
    const blob = new Blob([zipBytes], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.resourceName}-api-kit.zip`;
    a.click();
  }, [result]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0b",
      backgroundImage: "url('/hero-bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      color: "#f0f0f2",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(6,6,9,0.84)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center, transparent 40%, rgba(4,4,7,0.7) 100%)", pointerEvents: "none", zIndex: 0 }} />
      <HeroBackground />
      <div className="scan-line" />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Nav */}
        <nav className="glass-nav" style={{ position: "sticky", top: 0, zIndex: 50, height: 56, display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
            <Logo size={28} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: "#f0f0f2", letterSpacing: "-0.01em" }}>
              Flow Stack Studio
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a5a6a", fontSize: 13, padding: "5px 10px", borderRadius: 6 }}>
              Analyzer
            </button>
            <div style={{ background: "rgba(110,86,207,0.15)", border: "1px solid rgba(110,86,207,0.35)", borderRadius: 6, padding: "5px 12px", fontSize: 13, color: "#8b72e8", fontWeight: 600 }}>
              API Builder
            </div>
          </div>
        </nav>

        <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
          {/* Hero */}
          <section style={{ paddingTop: 64, paddingBottom: 40, textAlign: "center" }} className="animate-fade-in-up">
            <div className="badge-shimmer" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid rgba(110,86,207,0.35)", borderRadius: 100, padding: "4px 12px", marginBottom: 20 }}>
              <Zap size={12} color="#8b72e8" />
              <span style={{ fontSize: 12, color: "#8b72e8", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                DATA → REST API
              </span>
            </div>
            <h1 className="hero-glow" style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 14, color: "#f0f0f2" }}>
              Turn any data source into a{" "}
              <span style={{ color: "#6e56cf" }}>production-ready API.</span>
            </h1>
            <p style={{ fontSize: 15, color: "#8b8b99", maxWidth: 460, margin: "0 auto 0", lineHeight: 1.6 }}>
              Paste JSON, CSV, or a SQL schema — get CRUD endpoints,
              typed clients, OpenAPI docs, monitoring, analytics, and a direct-use downloadable API kit.
            </p>
            <div className="accent-line" style={{ width: 100, marginTop: 28 }} />
          </section>

          {/* Input Card */}
          <div className="glow-card animate-fade-in-up stagger-2" style={{ borderRadius: 12, padding: 24, marginBottom: 20 }}>
            {/* Mode Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#0e0e10", border: "1px solid #2a2a2f", borderRadius: 8, padding: 3, width: "fit-content" }}>
              {INPUT_TABS.map(tab => (
                <button key={tab.key} onClick={() => handleModeSwitch(tab.key)} style={{
                  background: inputMode === tab.key ? "#1a1a1e" : "none",
                  border: inputMode === tab.key ? "1px solid #3d3d45" : "1px solid transparent",
                  borderRadius: 6, padding: "6px 14px", cursor: "pointer",
                  color: inputMode === tab.key ? "#f0f0f2" : "#5a5a6a",
                  fontSize: 12, fontWeight: inputMode === tab.key ? 600 : 400,
                  fontFamily: "'Inter', sans-serif",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s ease",
                }}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              rows={10}
              spellCheck={false}
              style={{
                width: "100%", background: "#0a0a0b", border: "1px solid #2a2a2f",
                borderRadius: 8, color: "#f0f0f2", fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace", padding: "12px 14px",
                resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#6e56cf")}
              onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2f")}
            />

            {error && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, fontSize: 13, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <button onClick={handleGenerate} disabled={!inputValue.trim() || generating} style={{
                background: inputValue.trim() && !generating ? "#6e56cf" : "#252529",
                color: inputValue.trim() && !generating ? "#fff" : "#5a5a6a",
                border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600,
                cursor: inputValue.trim() && !generating ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 8,
                fontFamily: "'Inter', sans-serif", transition: "background 0.15s",
              }}>
                {generating ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" stroke="#8b8b99" strokeWidth="2.5" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#f0f0f2" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>Generating…</>
                ) : (
                  <><Zap size={14} />Generate API<ArrowRight size={14} /></>
                )}
              </button>
              <span style={{ fontSize: 12, color: "#3d3d45", fontFamily: "'JetBrains Mono', monospace" }}>
                {inputMode === "json" ? "JSON object or array" : inputMode === "csv" ? "CSV with header row" : "CREATE TABLE statement"}
              </span>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="animate-fade-in-up" style={{ paddingTop: 4 }}>
              {/* Download Kit */}
              <div className="glow-card" style={{ borderRadius: 10, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Package size={14} color="#22c55e" />
                  <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                    Download-ready output
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#22c55e" }}>
                    {result.resourceName}-api-kit.zip
                  </span>
                </div>

                <div style={{ flex: 1 }} />

                <button onClick={downloadApiKit} style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "#22c55e", fontSize: 12, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  <Download size={12} />Download API Kit
                </button>
              </div>

              {/* Stats bar */}
              <div className="glow-card" style={{ borderRadius: 10, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Database size={14} color="#6e56cf" />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#f0f0f2", fontWeight: 600 }}>/{result.pluralName}</span>
                </div>
                <div style={{ width: 1, height: 16, background: "#2a2a2f" }} />
                <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>{result.endpoints.length} endpoints</span>
                <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>{result.schema.fields.length} fields</span>
                {result.schema.rowCount > 0 && <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>{result.schema.rowCount} sample rows</span>}
                {result.deployment && (
                  <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                    {result.deployment.requestCount} requests tracked
                  </span>
                )}
                <div style={{ flex: 1 }} />
                {/* API Key */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0e0e10", border: "1px solid #2a2a2f", borderRadius: 7, padding: "5px 10px" }}>
                  <Key size={12} color="#8b72e8" />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8b72e8", letterSpacing: "0.02em" }}>
                    {result.apiKey.slice(0, 22)}…
                  </span>
                  <button onClick={() => copy(result.apiKey, "apikey")} style={{ background: "none", border: "none", cursor: "pointer", color: copiedKey === "apikey" ? "#22c55e" : "#5a5a6a", display: "flex", padding: 0 }}>
                    {copiedKey === "apikey" ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <button onClick={downloadSpec} style={{ background: "#1a1a1e", border: "1px solid #2a2a2f", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "#8b8b99", fontSize: 12, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                  <Download size={12} />OpenAPI
                </button>
                <button onClick={downloadCode} style={{ background: "#1a1a1e", border: "1px solid #2a2a2f", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "#8b8b99", fontSize: 12, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                  <Download size={12} />Code
                </button>
                <button onClick={redeploy} disabled={deployingLive} style={{
                  background: deployingLive ? "#252529" : "rgba(34,197,94,0.14)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  borderRadius: 7,
                  padding: "5px 10px",
                  cursor: deployingLive ? "not-allowed" : "pointer",
                  color: deployingLive ? "#5a5a6a" : "#22c55e",
                  fontSize: 12,
                  fontFamily: "'Inter', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <Link2 size={12} />
                  {deployingLive ? "Publishing…" : "Republish Live API"}
                </button>
              </div>

              {deployingLive && (
                <div style={{ marginBottom: 12, fontSize: 12, color: "#8b8b99", fontFamily: "'JetBrains Mono', monospace" }}>
                  Provisioning live endpoint, docs, monitoring, and analytics…
                </div>
              )}

              {deploymentError && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, fontSize: 12, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>
                  {deploymentError}
                </div>
              )}

              {/* Result Tabs */}
              <div style={{ display: "flex", gap: 2, background: "#0e0e10", border: "1px solid #2a2a2f", borderRadius: 9, padding: 4, marginBottom: 16 }}>
                {([
                  { key: "endpoints", label: "Endpoints", icon: <Globe size={13} /> },
                  { key: "schema",    label: "Schema",    icon: <Layers size={13} /> },
                  { key: "code",      label: "Code",      icon: <Code2 size={13} /> },
                  { key: "flow",      label: "Flow",      icon: <GitBranch size={13} /> },
                ] as { key: ResultTab; label: string; icon: React.ReactNode }[]).map(t => (
                  <button key={t.key} onClick={() => setResultTab(t.key)} style={{
                    flex: 1, background: resultTab === t.key ? "#1a1a1e" : "none",
                    border: resultTab === t.key ? "1px solid #2a2a2f" : "1px solid transparent",
                    borderRadius: 7, padding: "8px 12px", cursor: "pointer",
                    color: resultTab === t.key ? "#f0f0f2" : "#5a5a6a",
                    fontSize: 13, fontWeight: resultTab === t.key ? 600 : 400,
                    fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "all 0.15s ease",
                  }}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* Endpoints Tab */}
              {resultTab === "endpoints" && (
                <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {result.endpoints.map(ep => {
                    const epKey = ep.method + ep.path;
                    const expanded = expandedEndpoint === epKey;
                    return (
                      <div key={epKey} className="glow-card" style={{ borderRadius: 10, overflow: "hidden" }}>
                        <button onClick={() => setExpandedEndpoint(expanded ? null : epKey)} style={{
                          width: "100%", background: "none", border: "none", cursor: "pointer",
                          padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                        }}>
                          <MethodBadge method={ep.method} />
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#f0f0f2", flex: 1 }}>
                            /v1/{result.apiSlug}{ep.path}
                          </span>
                          <span style={{ fontSize: 12, color: "#5a5a6a" }}>{ep.description}</span>
                          <span style={{
                            fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                            color: ep.statusCode < 300 ? "#22c55e" : "#ef4444",
                            background: ep.statusCode < 300 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                            padding: "2px 6px", borderRadius: 4,
                          }}>{ep.statusCode}</span>
                          {expanded ? <ChevronUp size={14} color="#5a5a6a" /> : <ChevronDown size={14} color="#5a5a6a" />}
                        </button>
                        {expanded && (
                          <div className="animate-fade-in" style={{ padding: "0 20px 16px", borderTop: "1px solid #1e1e22" }}>
                            {ep.requestBody && (
                              <div style={{ marginTop: 14 }}>
                                <div style={{ fontSize: 11, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Request Body</div>
                                <pre style={{ background: "#0a0a0b", border: "1px solid #2a2a2f", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#c0b0f0", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, margin: 0, overflowX: "auto" }}>
                                  {JSON.stringify(ep.requestBody, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontSize: 11, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Example Response</div>
                              <pre style={{ background: "#0a0a0b", border: "1px solid #2a2a2f", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#22c55e", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, margin: 0, overflowX: "auto" }}>
                                {JSON.stringify(ep.response, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Schema Tab */}
              {resultTab === "schema" && (
                <div className="animate-fade-in glow-card" style={{ borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e1e22", display: "flex", alignItems: "center", gap: 8 }}>
                    <Layers size={14} color="#6e56cf" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2" }}>
                      {result.resourceName.charAt(0).toUpperCase() + result.resourceName.slice(1)} Schema
                    </span>
                    <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                      · {result.schema.fields.length} fields · from {result.schema.inputType.toUpperCase()}
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#0e0e10" }}>
                        {["Field", "Type", "Required", "Example"].map(h => (
                          <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #1e1e22" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.schema.fields.map((field, i) => (
                        <tr key={field.name} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(110,86,207,0.04)")}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}
                        >
                          <td style={{ padding: "10px 20px", borderBottom: "1px solid #1a1a1e" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: field.isId ? "#8b72e8" : "#f0f0f2" }}>
                              {field.name}{field.isId ? " 🔑" : ""}
                            </span>
                          </td>
                          <td style={{ padding: "10px 20px", borderBottom: "1px solid #1a1a1e" }}>
                            <TypeBadge type={field.type} />
                          </td>
                          <td style={{ padding: "10px 20px", borderBottom: "1px solid #1a1a1e" }}>
                            <span style={{ fontSize: 12, color: field.required ? "#22c55e" : "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                              {field.required ? "yes" : "no"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 20px", borderBottom: "1px solid #1a1a1e" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8b8b99" }}>
                              {field.example.length > 40 ? field.example.slice(0, 40) + "…" : field.example}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Code Tab */}
              {resultTab === "code" && (
                <div className="animate-fade-in">
                  {/* Language selector */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#0e0e10", border: "1px solid #2a2a2f", borderRadius: 8, padding: 3, width: "fit-content" }}>
                    {CODE_TABS.map(t => (
                      <button key={t.key} onClick={() => setCodeLang(t.key)} style={{
                        background: codeLang === t.key ? "#1a1a1e" : "none",
                        border: codeLang === t.key ? "1px solid #3d3d45" : "1px solid transparent",
                        borderRadius: 6, padding: "6px 14px", cursor: "pointer",
                        color: codeLang === t.key ? "#f0f0f2" : "#5a5a6a",
                        fontSize: 12, fontWeight: codeLang === t.key ? 600 : 400,
                        fontFamily: "'Inter', sans-serif", transition: "all 0.15s ease",
                      }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="glow-card" style={{ borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", background: "#0a0a0b", borderBottom: "1px solid #1e1e22", display: "flex", alignItems: "center", gap: 8 }}>
                      <Terminal size={13} color="#5a5a6a" />
                      <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", flex: 1 }}>
                        {codeLang === "curl" ? "bash" : codeLang === "typescript" ? "typescript" : codeLang === "hono" ? "typescript (hono)" : "typescript (drizzle)"}
                      </span>
                      <button onClick={() => copy(result.code[codeLang], "code")} style={{ background: "none", border: "none", cursor: "pointer", color: copiedKey === "code" ? "#22c55e" : "#5a5a6a", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                        {copiedKey === "code" ? <><CheckCircle2 size={12} />Copied!</> : <><Copy size={12} />Copy</>}
                      </button>
                    </div>
                    <pre style={{ margin: 0, padding: "16px 20px", background: "#080809", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#c0c0cc", lineHeight: 1.7, overflowX: "auto", maxHeight: 420 }}>
                      {result.code[codeLang]}
                    </pre>
                  </div>
                </div>
              )}

              {/* Flow Tab */}
              {resultTab === "flow" && (
                <div className="animate-fade-in glow-card" style={{ borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                    <GitBranch size={15} color="#6e56cf" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2" }}>API Architecture Flow</span>
                    <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                      · {result.flowNodes.length} nodes · {result.flowEdges.length} connections
                    </span>
                  </div>
                  <FlowDiagram nodes={result.flowNodes} edges={result.flowEdges} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
