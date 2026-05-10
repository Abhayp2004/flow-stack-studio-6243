import { useState, useCallback } from "react";
import {
  Globe, ChevronRight, Copy, Download, Moon, Sun,
  Layers, GitBranch, Code2, CheckCircle2, AlertCircle, Info,
  ExternalLink, TerminalSquare, Zap, ArrowRight, ChevronDown, ChevronUp,
  Upload,
} from "lucide-react";
import { Logo } from "../components/logo";
import { ConfidenceBadge, ConfidenceDot } from "../components/confidence-badge";
import { FlowDiagram } from "../components/flow-diagram";
import { SchemaExplorer } from "../components/schema-explorer";
import { RequestImport } from "../components/request-import";
import { LoadingSteps } from "../components/loading-steps";
import { SAMPLE_EXAMPLES, SAMPLE_JSON } from "../lib/mock-analysis";
import type { AnalysisResult } from "../../../types";

type Tab = "overview" | "flow" | "payload";

const MODE_COLORS = {
  saas: { color: "#8b72e8", bg: "rgba(139,114,232,0.1)", label: "SaaS App" },
  ecommerce: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "E-commerce" },
  blog: { color: "#06b6d4", bg: "rgba(6,182,212,0.1)", label: "Blog / Content" },
};

export default function Index() {
  const [darkMode, setDarkMode] = useState(true);
  const [url, setUrl] = useState("");
  const [json, setJson] = useState("");
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);
  const [showEvidence, setShowEvidence] = useState<Record<string, boolean>>({});

  const handleImportResult = useCallback((imported: AnalysisResult) => {
    setResult(imported);
    setActiveTab("flow");
    setImportMode(false);
  }, []);

  const handleAnalyze = useCallback(async (targetUrl?: string) => {
    const finalUrl = targetUrl || url;
    if (!finalUrl.trim()) return;
    setIsLoading(true);
    setResult(null);
    setActiveTab("overview");

    try {
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(finalUrl)}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const analysis: AnalysisResult = await res.json();
      setResult(analysis);
    } catch (err) {
      console.error("[analyze]", err);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  const handleExample = (exUrl: string) => {
    setUrl(exUrl);
    handleAnalyze(exUrl);
  };

  const copyText = useCallback(() => {
    if (!result) return;
    const text = `Flow Stack Studio — Analysis Report
URL: ${result.url}
Analyzed: ${new Date(result.analyzedAt).toLocaleString()}
Confidence: ${result.overallConfidence.toUpperCase()}

Summary:
${result.summary}

Architecture Note:
${result.architectureNote}

Frontend Stack:
${result.frontend.map(t => `  • ${t.name} (${t.category}) — ${t.confidence} confidence`).join("\n")}

Infrastructure:
${result.infrastructure.map(t => `  • ${t.name} (${t.category}) — ${t.confidence} confidence`).join("\n")}

API Type: ${result.apiType.name}
Auth: ${result.authHint}

Third-party:
${result.thirdParty.map(t => `  • ${t.name} (${t.category}) — ${t.confidence} confidence`).join("\n")}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const downloadReport = useCallback(() => {
    if (!result) return;
    const report = {
      meta: { tool: "Flow Stack Studio", version: "1.0", analyzedAt: result.analyzedAt },
      url: result.url,
      confidence: result.overallConfidence,
      mode: result.mode,
      summary: result.summary,
      architectureNote: result.architectureNote,
      frontend: result.frontend,
      infrastructure: result.infrastructure,
      api: result.apiType,
      auth: result.authHint,
      thirdParty: result.thirdParty,
      flow: { nodes: result.flowNodes, edges: result.flowEdges },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fss-report-${Date.now()}.json`;
    a.click();
  }, [result]);

  const toggleEvidence = (key: string) => {
    setShowEvidence(s => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0b",
      color: "#f0f0f2",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 56,
        background: "rgba(10,10,11,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #1e1e22",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={28} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: 14,
            color: "#f0f0f2",
            letterSpacing: "-0.01em",
          }}>
            Flow Stack Studio
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href="#examples"
            style={{
              fontSize: 13,
              color: "#8b8b99",
              textDecoration: "none",
              padding: "5px 10px",
              borderRadius: 6,
              transition: "color 0.15s ease",
            }}
          >
            Examples
          </a>

          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              background: "#1a1a1e",
              border: "1px solid #2a2a2f",
              borderRadius: 7,
              padding: "6px 8px",
              cursor: "pointer",
              color: "#8b8b99",
              display: "flex",
              alignItems: "center",
            }}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </nav>

      {/* Main */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>

        {/* Hero */}
        {!result && !isLoading && (
          <section style={{ paddingTop: 72, paddingBottom: 48, textAlign: "center" }} className="animate-fade-in-up">
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(110,86,207,0.1)", border: "1px solid rgba(110,86,207,0.25)", borderRadius: 100, padding: "4px 12px", marginBottom: 24 }}>
              <Zap size={12} color="#8b72e8" />
              <span style={{ fontSize: 12, color: "#8b72e8", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                DEVELOPER ANALYSIS TOOL
              </span>
            </div>

            <h1 style={{
              fontSize: "clamp(30px, 5vw, 48px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: 16,
              color: "#f0f0f2",
            }}>
              See the stack.{" "}
              <span style={{ color: "#6e56cf" }}>Trace the flow.</span>
              <br />
              Explore the payload.
            </h1>

            <p style={{
              fontSize: 16,
              color: "#8b8b99",
              maxWidth: 480,
              margin: "0 auto 48px",
              lineHeight: 1.6,
            }}>
              Paste a URL and instantly understand what powers it —
              stack, request flow, and data shape. Visual. Fast. Honest.
            </p>
          </section>
        )}

        {/* Input Card */}
        {!result && !isLoading && (
          <div style={{
            background: "#111113",
            border: "1px solid #2a2a2f",
            borderRadius: 12,
            padding: 24,
            marginBottom: 16,
          }} className="animate-fade-in-up stagger-2">

            {/* Mode toggle: Analyze URL / Import Request */}
            <div style={{ display: "flex", gap: 6, background: "#0e0e10", border: "1px solid #2a2a2f", borderRadius: 9, padding: 4, marginBottom: 20, width: "fit-content" }}>
              {[
                { key: false, label: "Analyze URL", icon: <Globe size={13} /> },
                { key: true,  label: "Import Request", icon: <Upload size={13} /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={String(key)}
                  onClick={() => { setImportMode(key); setShowJsonInput(false); }}
                  style={{
                    background: importMode === key ? "#1a1a1e" : "none",
                    border: importMode === key ? "1px solid #2a2a2f" : "1px solid transparent",
                    borderRadius: 7,
                    padding: "7px 16px",
                    cursor: "pointer",
                    color: importMode === key ? "#f0f0f2" : "#5a5a6a",
                    fontSize: 13,
                    fontWeight: importMode === key ? 600 : 400,
                    fontFamily: "'Inter', sans-serif",
                    display: "flex", alignItems: "center", gap: 7,
                    transition: "all 0.15s ease",
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Import Request mode */}
            {importMode && (
              <RequestImport onResult={handleImportResult} />
            )}

            {/* URL Input + JSON toggle (hidden in import mode) */}
            {!importMode && (<>
            <div style={{ display: "flex", gap: 10, marginBottom: showJsonInput ? 16 : 0 }}>
              <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                background: "#0e0e10",
                border: "1px solid #2a2a2f",
                borderRadius: 8,
                padding: "0 14px",
                gap: 10,
                transition: "border-color 0.15s ease",
              }}
                onFocusCapture={e => (e.currentTarget.style.borderColor = "#6e56cf")}
                onBlurCapture={e => (e.currentTarget.style.borderColor = "#2a2a2f")}
              >
                <Globe size={15} color="#5a5a6a" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="https://app.example.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "#f0f0f2",
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "13px 0",
                  }}
                />
              </div>

              <button
                onClick={() => handleAnalyze()}
                disabled={!url.trim()}
                style={{
                  background: url.trim() ? "#6e56cf" : "#252529",
                  color: url.trim() ? "#fff" : "#5a5a6a",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: url.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  whiteSpace: "nowrap",
                  transition: "background 0.15s ease",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Analyze
                <ArrowRight size={14} />
              </button>
            </div>

            {/* JSON Toggle */}
            <button
              onClick={() => setShowJsonInput(!showJsonInput)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#5a5a6a",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "8px 0 0 0",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#8b8b99")}
              onMouseLeave={e => (e.currentTarget.style.color = "#5a5a6a")}
            >
              <Code2 size={12} />
              {showJsonInput ? "Hide" : "Add"} sample JSON (optional)
              {showJsonInput ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showJsonInput && (
              <div style={{ marginTop: 12 }} className="animate-fade-in">
                <textarea
                  placeholder='Paste sample JSON payload here...'
                  value={json}
                  onChange={e => setJson(e.target.value)}
                  rows={8}
                  style={{
                    width: "100%",
                    background: "#0e0e10",
                    border: "1px solid #2a2a2f",
                    borderRadius: 8,
                    color: "#f0f0f2",
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "12px 14px",
                    resize: "vertical",
                    outline: "none",
                    lineHeight: 1.6,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setJson(SAMPLE_JSON)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#5a5a6a",
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "6px 0 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <TerminalSquare size={12} />
                  Use sample payload
                </button>
              </div>
            )}
            </>)}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ paddingTop: 80, paddingBottom: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }} className="animate-fade-in">
            {/* Animated ring */}
            <div style={{ position: "relative", width: 72, height: 72 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: "absolute", inset: 0 }}>
                <circle cx="36" cy="36" r="30" fill="none" stroke="#1a1a1e" strokeWidth="3" />
                <circle
                  cx="36" cy="36" r="30"
                  fill="none" stroke="#6e56cf" strokeWidth="3"
                  strokeDasharray="50 140"
                  strokeLinecap="round"
                  style={{ transformOrigin: "50% 50%", animation: "spin 1.2s linear infinite" }}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Logo size={28} />
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2", marginBottom: 4 }}>Analyzing {url}</div>
              <div style={{ fontSize: 13, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>Running analysis pipeline...</div>
            </div>

            <div style={{
              background: "#111113",
              border: "1px solid #2a2a2f",
              borderRadius: 10,
              padding: "16px 20px",
              width: "100%",
              maxWidth: 360,
            }}>
              <LoadingSteps />
            </div>
          </div>
        )}

        {/* Examples Section */}
        {!result && !isLoading && (
          <section id="examples" style={{ paddingTop: 24, paddingBottom: 64 }} className="animate-fade-in-up stagger-3">
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5a5a6a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
              Try an example
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {SAMPLE_EXAMPLES.map(ex => (
                <button
                  key={ex.url}
                  onClick={() => handleExample(ex.url)}
                  style={{
                    background: "#111113",
                    border: "1px solid #2a2a2f",
                    borderRadius: 8,
                    padding: "10px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    transition: "border-color 0.15s ease, background 0.15s ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#3d3d45";
                    (e.currentTarget as HTMLButtonElement).style.background = "#1a1a1e";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2f";
                    (e.currentTarget as HTMLButtonElement).style.background = "#111113";
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f2", marginBottom: 2 }}>{ex.label}</div>
                    <div style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>{ex.url}</div>
                  </div>
                  <ChevronRight size={14} color="#3d3d45" style={{ marginLeft: "auto" }} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div style={{ paddingTop: 20, paddingBottom: 64 }} className="animate-fade-in-up">

            {/* Summary bar */}
            <div style={{
              background: "#111113",
              border: "1px solid #2a2a2f",
              borderRadius: 10,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={14} color="#5a5a6a" />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#8b8b99" }}>
                  {result.url}
                </span>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: MODE_COLORS[result.mode].bg,
                  border: `1px solid ${MODE_COLORS[result.mode].color}33`,
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: MODE_COLORS[result.mode].color,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {MODE_COLORS[result.mode].label}
              </div>

              <ConfidenceBadge level={result.overallConfidence} />

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  onClick={copyText}
                  style={{
                    background: copied ? "rgba(34,197,94,0.1)" : "#1a1a1e",
                    border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "#2a2a2f"}`,
                    borderRadius: 7,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: copied ? "#22c55e" : "#8b8b99",
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                >
                  {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy summary"}
                </button>

                <button
                  onClick={downloadReport}
                  style={{
                    background: "#1a1a1e",
                    border: "1px solid #2a2a2f",
                    borderRadius: 7,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "#8b8b99",
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Download size={13} />
                  Download JSON
                </button>

                <button
                  onClick={() => { setResult(null); setUrl(""); setJson(""); setImportMode(false); }}
                  style={{
                    background: "#1a1a1e",
                    border: "1px solid #2a2a2f",
                    borderRadius: 7,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "#8b8b99",
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  New analysis
                </button>
              </div>
            </div>

            {/* Architecture note */}
            <div style={{
              background: "rgba(110,86,207,0.08)",
              border: "1px solid rgba(110,86,207,0.2)",
              borderRadius: 8,
              padding: "10px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 20,
            }}>
              <Info size={14} color="#8b72e8" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#c0b0f0", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>
                {result.architectureNote}
              </span>
            </div>

            {/* Tabs */}
            <div style={{
              display: "flex",
              gap: 2,
              background: "#0e0e10",
              border: "1px solid #2a2a2f",
              borderRadius: 9,
              padding: 4,
              marginBottom: 20,
            }}>
              {(["overview", "flow", "payload"] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    background: activeTab === tab ? "#1a1a1e" : "none",
                    border: activeTab === tab ? "1px solid #2a2a2f" : "1px solid transparent",
                    borderRadius: 7,
                    padding: "8px 12px",
                    cursor: "pointer",
                    color: activeTab === tab ? "#f0f0f2" : "#5a5a6a",
                    fontSize: 13,
                    fontWeight: activeTab === tab ? 600 : 400,
                    fontFamily: "'Inter', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab === "overview" && <Layers size={13} />}
                  {tab === "flow" && <GitBranch size={13} />}
                  {tab === "payload" && <Code2 size={13} />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* ---- OVERVIEW TAB ---- */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="animate-fade-in">
                {/* Summary */}
                <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5a5a6a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    Plain-English Summary
                  </div>
                  <p style={{ fontSize: 14, color: "#c0c0cc", lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
                </div>

                {/* Two columns */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Frontend */}
                  <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5a5a6a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                      Frontend Stack
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {result.frontend.map(tech => (
                        <div key={tech.name}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <ConfidenceDot level={tech.confidence} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2" }}>{tech.name}</span>
                            <span style={{ marginLeft: "auto" }}>
                              <ConfidenceBadge level={tech.confidence} showLabel={false} />
                            </span>
                          </div>
                          <div style={{ paddingLeft: 14, fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                            {tech.category}
                          </div>
                          <button
                            onClick={() => toggleEvidence(tech.name)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "#3d3d45", fontSize: 11,
                              fontFamily: "'JetBrains Mono', monospace",
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "4px 0 0 14px",
                            }}
                          >
                            {showEvidence[tech.name] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            {showEvidence[tech.name] ? "hide" : "show"} evidence
                          </button>
                          {showEvidence[tech.name] && (
                            <div style={{
                              marginLeft: 14, marginTop: 4,
                              padding: "8px 10px",
                              background: "#0e0e10",
                              border: "1px solid #2a2a2f",
                              borderRadius: 6,
                              fontSize: 12,
                              color: "#8b8b99",
                              fontFamily: "'JetBrains Mono', monospace",
                              lineHeight: 1.5,
                            }} className="animate-fade-in">
                              {tech.evidence}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Infrastructure */}
                  <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5a5a6a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                      Infrastructure
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {result.infrastructure.map(tech => (
                        <div key={tech.name}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <ConfidenceDot level={tech.confidence} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2" }}>{tech.name}</span>
                            <span style={{ marginLeft: "auto" }}>
                              <ConfidenceBadge level={tech.confidence} showLabel={false} />
                            </span>
                          </div>
                          <div style={{ paddingLeft: 14, fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                            {tech.category}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* API + Auth */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5a5a6a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                      API Type
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#8b72e8" }}>{result.apiType.name}</span>
                      <ConfidenceBadge level={result.apiType.confidence} showLabel={false} />
                    </div>
                    <p style={{ fontSize: 13, color: "#8b8b99", lineHeight: 1.6, margin: 0 }}>{result.apiType.details}</p>
                  </div>

                  <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5a5a6a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                      Auth Hint
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ fontSize: 13, color: "#c0c0cc", lineHeight: 1.6, margin: 0 }}>{result.authHint}</p>
                    </div>
                  </div>
                </div>

                {/* Third party */}
                <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5a5a6a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                    Third-party Services
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {result.thirdParty.map(tp => (
                      <div
                        key={tp.name}
                        style={{
                          background: "#1a1a1e",
                          border: "1px solid #2a2a2f",
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 160,
                        }}
                      >
                        <ConfidenceDot level={tp.confidence} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f2" }}>{tp.name}</div>
                          <div style={{ fontSize: 11, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>{tp.category}</div>
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                          <ConfidenceBadge level={tp.confidence} showLabel={false} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---- FLOW TAB ---- */}
            {activeTab === "flow" && (
              <div className="animate-fade-in">
                <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                    <GitBranch size={15} color="#6e56cf" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2" }}>Request Flow Map</span>
                    <span style={{ fontSize: 12, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", marginLeft: 4 }}>
                      · {result.flowNodes.length} nodes · {result.flowEdges.length} connections
                    </span>
                  </div>
                  <FlowDiagram nodes={result.flowNodes} edges={result.flowEdges} analysis={result} />
                </div>
              </div>
            )}

            {/* ---- PAYLOAD TAB ---- */}
            {activeTab === "payload" && (() => {
              const payloadData = json || result.payloadSample;
              return (
                <div className="animate-fade-in">
                  {payloadData ? (
                    <div style={{ background: "#111113", border: "1px solid #2a2a2f", borderRadius: 10, padding: "20px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <Code2 size={15} color="#6e56cf" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2" }}>Payload Explorer</span>
                        <div style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: json ? "#22c55e" : "#8b72e8",
                          background: json ? "rgba(34,197,94,0.08)" : "rgba(110,86,207,0.1)",
                          border: `1px solid ${json ? "rgba(34,197,94,0.2)" : "rgba(110,86,207,0.2)"}`,
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {json ? "user-provided payload" : result.payloadHint}
                        </div>
                      </div>

                      {/* Color key */}
                      <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                        {[
                          { label: "key", color: "#8b72e8" },
                          { label: "string", color: "#22c55e" },
                          { label: "number", color: "#f59e0b" },
                          { label: "boolean", color: "#06b6d4" },
                          { label: "null", color: "#ef4444" },
                        ].map(item => (
                          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                            <span style={{ fontSize: 11, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>{item.label}</span>
                          </div>
                        ))}
                      </div>

                      <SchemaExplorer json={payloadData} />
                    </div>
                  ) : (
                    <div style={{
                      background: "#111113",
                      border: "1px dashed #2a2a2f",
                      borderRadius: 10,
                      padding: "48px 24px",
                      textAlign: "center",
                    }}>
                      <Code2 size={32} color="#2a2a2f" style={{ marginBottom: 12 }} />
                      <div style={{ fontSize: 14, color: "#5a5a6a", marginBottom: 12 }}>No payload data available</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Spin keyframe inline */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
