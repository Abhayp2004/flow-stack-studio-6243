import { useState, useCallback } from "react";
import { Upload, Zap, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { parseRequest, detectFormat, type ParsedRequest } from "../lib/request-parser";
import { buildAnalysisFromRequest } from "../lib/flow-from-request";
import type { AnalysisResult } from "../../../types";

const FORMAT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  curl:  { label: "cURL",      color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  fetch: { label: "Fetch API", color: "#06b6d4", bg: "rgba(6,182,212,0.1)"  },
  http:  { label: "HTTP raw",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  har:   { label: "HAR",       color: "#8b72e8", bg: "rgba(139,114,232,0.1)" },
};

const EXAMPLES = {
  curl: `curl 'https://api.linear.app/graphql' \\
  -H 'Authorization: Bearer lin_api_xxxxxxxxxxxx' \\
  -H 'Content-Type: application/json' \\
  --data-raw '{"query":"{ viewer { id name email } }"}'`,

  fetch: `const res = await fetch('https://api.stripe.com/v1/customers', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_xxxxxxxxxxxx',
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'email=user@example.com&name=Alex'
});`,

  http: `POST /api/v1/checkout HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{"cart_id":"cart_9x4m","currency":"USD"}`,

  har: `{
  "log": { "entries": [{
    "request": {
      "method": "GET",
      "url": "https://api.example.com/users/me",
      "headers": [
        {"name": "Authorization", "value": "Bearer token123"},
        {"name": "Content-Type", "value": "application/json"}
      ]
    },
    "response": {
      "status": 200,
      "content": { "text": "{\\"id\\":\\"usr_8f2k\\",\\"email\\":\\"alex@example.com\\"}" }
    }
  }]}
}`,
};

interface RequestImportProps {
  onResult: (result: AnalysisResult) => void;
}

export function RequestImport({ onResult }: RequestImportProps) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExample, setShowExample] = useState<keyof typeof EXAMPLES | null>(null);

  const fmt = detectFormat(input);
  const fmtCfg = fmt ? FORMAT_LABELS[fmt] : null;

  const handleChange = useCallback((val: string) => {
    setInput(val);
    setParsed(null);
    setError(null);
  }, []);

  const handleParse = useCallback(() => {
    const result = parseRequest(input.trim());
    if (!result) {
      setError("Could not parse this request. Try pasting a cURL command, Fetch call, raw HTTP, or HAR JSON.");
      setParsed(null);
    } else {
      setParsed(result);
      setError(null);
    }
  }, [input]);

  const handleGenerate = useCallback(() => {
    if (!parsed) return;
    const analysis = buildAnalysisFromRequest(parsed);
    onResult(analysis);
  }, [parsed, onResult]);

  const loadExample = (key: keyof typeof EXAMPLES) => {
    setInput(EXAMPLES[key]);
    setParsed(null);
    setError(null);
    setShowExample(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Examples dropdown */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>Try example:</span>
        {(Object.keys(EXAMPLES) as Array<keyof typeof EXAMPLES>).map(key => {
          const c = FORMAT_LABELS[key];
          return (
            <button
              key={key}
              onClick={() => loadExample(key)}
              style={{
                background: c.bg,
                border: `1px solid ${c.color}33`,
                borderRadius: 5,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                color: c.color,
                letterSpacing: "0.04em",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Textarea */}
      <div style={{ position: "relative" }}>
        <textarea
          value={input}
          onChange={e => handleChange(e.target.value)}
          placeholder={`Paste a cURL command, Fetch call, raw HTTP request, or HAR JSON...\n\nExamples:\n  curl 'https://api.example.com/users' -H 'Authorization: Bearer ...'\n  fetch('https://...', { method: 'POST', headers: {...} })\n  POST /api/users HTTP/1.1`}
          rows={10}
          style={{
            width: "100%",
            background: "#0e0e10",
            border: `1px solid ${error ? "#ef444455" : fmtCfg ? fmtCfg.color + "44" : "#2a2a2f"}`,
            borderRadius: 10,
            color: "#f0f0f2",
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            padding: "14px 16px",
            resize: "vertical",
            outline: "none",
            lineHeight: 1.6,
            boxSizing: "border-box",
            transition: "border-color 0.15s ease",
          }}
        />

        {/* Format badge */}
        {fmtCfg && (
          <div style={{
            position: "absolute", top: 10, right: 12,
            background: fmtCfg.bg,
            border: `1px solid ${fmtCfg.color}44`,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            color: fmtCfg.color,
            letterSpacing: "0.08em",
          }}>
            {fmtCfg.label} detected
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
          <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {/* Parsed preview */}
      {parsed && (
        <div style={{ background: "#0c0c1a", border: "1px solid #22c55e33", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #22c55e22", display: "flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.05)" }}>
            <CheckCircle2 size={14} color="#22c55e" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>
              Parsed successfully
            </span>
          </div>
          <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "Method", value: parsed.method, color: parsed.method === "GET" ? "#06b6d4" : parsed.method === "POST" ? "#22c55e" : "#f59e0b" },
              { label: "URL", value: (() => { try { return new URL(parsed.url).hostname; } catch { return parsed.url.slice(0, 32); } })(), color: "#c0c0cc" },
              { label: "Path", value: (() => { try { return new URL(parsed.url).pathname || "/"; } catch { return "/"; } })(), color: "#8b8b99" },
              { label: "Headers", value: `${Object.keys(parsed.headers).length} headers`, color: "#8b8b99" },
              { label: "Body", value: parsed.body ? `${parsed.body.length} chars` : "none", color: parsed.body ? "#c0c0cc" : "#5a5a6a" },
              { label: "Response", value: parsed.response ? `HTTP ${parsed.response.status}` : "none", color: parsed.response ? "#22c55e" : "#5a5a6a" },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#3a3a50", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: item.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {parsed.headers["authorization"] && (
            <div style={{ padding: "8px 16px", borderTop: "1px solid #22c55e22", fontSize: 12, color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace" }}>
              🔐 Auth header detected: {parsed.headers["authorization"].slice(0, 30)}…
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleParse}
          disabled={!input.trim()}
          style={{
            background: input.trim() ? "#1a1a1e" : "#111113",
            border: "1px solid #2a2a2f",
            borderRadius: 8,
            padding: "10px 20px",
            cursor: input.trim() ? "pointer" : "not-allowed",
            color: input.trim() ? "#f0f0f2" : "#5a5a6a",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 7,
            transition: "all 0.15s ease",
          }}
        >
          <Upload size={14} />
          Parse Request
        </button>

        {parsed && (
          <button
            onClick={handleGenerate}
            style={{
              background: "#6e56cf",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              cursor: "pointer",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 0 20px rgba(110,86,207,0.35)",
            }}
          >
            <Zap size={14} />
            Generate Flow
          </button>
        )}
      </div>
    </div>
  );
}
