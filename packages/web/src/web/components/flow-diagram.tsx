import { useState } from "react";
import type { FlowNode, FlowEdge, AnalysisResult } from "../../../../types";

interface FlowDiagramProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  analysis?: AnalysisResult;
}

const NODE_CFG: Record<FlowNode["type"], { bg: string; border: string; accent: string; glow: string; icon: string }> = {
  browser:       { bg: "#091828", border: "#3b82f6", accent: "#60a5fa", glow: "rgba(59,130,246,0.5)",  icon: "🌐" },
  cdn:           { bg: "#082020", border: "#06b6d4", accent: "#22d3ee", glow: "rgba(6,182,212,0.5)",   icon: "⚡" },
  auth:          { bg: "#130d28", border: "#7c3aed", accent: "#a78bfa", glow: "rgba(124,58,237,0.5)",  icon: "🔐" },
  api:           { bg: "#0d1420", border: "#6e56cf", accent: "#8b72e8", glow: "rgba(110,86,207,0.5)",  icon: "⚙️" },
  db:            { bg: "#1a1000", border: "#d97706", accent: "#fbbf24", glow: "rgba(217,119,6,0.5)",   icon: "🗄️" },
  service:       { bg: "#081a0e", border: "#16a34a", accent: "#4ade80", glow: "rgba(22,163,74,0.5)",   icon: "🔧" },
  queue:         { bg: "#1a1400", border: "#ca8a04", accent: "#facc15", glow: "rgba(202,138,4,0.5)",   icon: "📨" },
  "third-party": { bg: "#141418", border: "#64748b", accent: "#94a3b8", glow: "rgba(100,116,139,0.4)", icon: "🔗" },
};

const TYPE_ORDER: FlowNode["type"][] = ["browser", "cdn", "auth", "api", "db", "service", "queue", "third-party"];

function layoutNodes(nodes: FlowNode[]) {
  const groups = new Map<string, FlowNode[]>();
  TYPE_ORDER.forEach(t => groups.set(t, []));
  nodes.forEach(n => {
    const g = groups.get(n.type) || [];
    g.push(n);
    groups.set(n.type, g);
  });

  const positions: Record<string, { x: number; y: number }> = {};
  const colW = 230;
  const rowH = 110;
  const startX = 40;
  const startY = 60;

  let col = 0;
  groups.forEach((gnodes) => {
    if (gnodes.length === 0) return;
    gnodes.forEach((n, row) => {
      positions[n.id] = { x: startX + col * colW, y: startY + row * rowH };
    });
    col++;
  });

  return positions;
}

function getNodeSignals(node: FlowNode, analysis: AnalysisResult): { label: string; value: string; dim?: boolean }[] {
  const signals: { label: string; value: string; dim?: boolean }[] = [];

  switch (node.type) {
    case "browser":
      signals.push({ label: "Entry point", value: "User's browser / client" });
      signals.push({ label: "Protocol", value: "HTTPS" });
      break;

    case "cdn": {
      const cdnInfra = analysis.infrastructure.filter(i => i.category.includes("CDN") || i.category.includes("Hosting") || i.category.includes("Edge"));
      cdnInfra.forEach(i => signals.push({ label: i.category, value: i.name }));
      if (cdnInfra.length === 0) signals.push({ label: "Note", value: node.description, dim: true });
      break;
    }

    case "auth": {
      if (analysis.authHint && !analysis.authHint.includes("not detectable")) {
        signals.push({ label: "Auth hint", value: analysis.authHint });
      }
      const authTp = analysis.thirdParty.filter(t => t.category === "Auth / Identity");
      authTp.forEach(t => signals.push({ label: "Provider", value: `${t.name} (${t.confidence} confidence)` }));
      if (authTp.length === 0 && !analysis.authHint.includes("not detectable")) {
        signals.push({ label: "Signal", value: "Auth cookies / session headers detected" });
      }
      break;
    }

    case "api":
      signals.push({ label: "API type", value: analysis.apiType.name });
      signals.push({ label: "Confidence", value: analysis.apiType.confidence });
      signals.push({ label: "Details", value: analysis.apiType.details });
      break;

    case "db": {
      const dbTp = analysis.thirdParty.filter(t => ["Database / BaaS", "Backend / BaaS"].includes(t.category));
      dbTp.forEach(t => signals.push({ label: t.category, value: `${t.name} — ${t.evidence}` }));
      if (dbTp.length === 0) signals.push({ label: "Note", value: "DB type inferred — not directly observable from static analysis.", dim: true });
      break;
    }

    case "service": {
      const svcInfra = analysis.infrastructure.filter(i => i.category.includes("Serverless") || i.category.includes("Runtime") || i.category.includes("Server"));
      svcInfra.forEach(i => signals.push({ label: i.category, value: `${i.name} (${i.evidence})` }));
      if (svcInfra.length === 0) signals.push({ label: "Note", value: node.description, dim: true });
      break;
    }

    case "queue": {
      const queueTp = analysis.thirdParty.filter(t => t.category === "Queue / Messaging");
      queueTp.forEach(t => signals.push({ label: "Service", value: `${t.name} — ${t.evidence}` }));
      if (queueTp.length === 0) signals.push({ label: "Note", value: node.description, dim: true });
      break;
    }

    case "third-party": {
      const match = analysis.thirdParty.find(t =>
        t.name.toLowerCase().replace(/[^a-z0-9]/g, "-") === node.id ||
        t.name.toLowerCase() === node.label.toLowerCase()
      );
      if (match) {
        signals.push({ label: "Category", value: match.category });
        signals.push({ label: "Evidence", value: match.evidence });
        signals.push({ label: "Confidence", value: match.confidence });
      } else {
        signals.push({ label: "Note", value: node.description, dim: true });
      }
      break;
    }
  }

  return signals;
}

export function FlowDiagram({ nodes, edges, analysis }: FlowDiagramProps) {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const positions = layoutNodes(nodes);

  const nodeW = 180;
  const nodeH = 72;

  const maxX = Math.max(...Object.values(positions).map(p => p.x)) + nodeW + 50;
  const maxY = Math.max(...Object.values(positions).map(p => p.y)) + nodeH + 60;
  const svgW = Math.max(maxX, 800);
  const svgH = Math.max(maxY, 420);

  function getCenter(id: string) {
    const p = positions[id];
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + nodeW / 2, y: p.y + nodeH / 2 };
  }

  const activeNodeData = activeNode ? nodes.find(n => n.id === activeNode) : null;

  // Compute connections for active node
  const incomingEdges = activeNode ? edges.filter(e => e.to === activeNode) : [];
  const outgoingEdges = activeNode ? edges.filter(e => e.from === activeNode) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes flowDash {
          from { stroke-dashoffset: 40; }
          to   { stroke-dashoffset: 0;  }
        }
        @keyframes flowDashSlow {
          from { stroke-dashoffset: 24; }
          to   { stroke-dashoffset: 0;  }
        }
        .edge-active  { animation: flowDash 0.9s linear infinite; }
        .edge-passive { animation: flowDashSlow 2.5s linear infinite; }
        .node-g { transition: filter 0.2s ease; }
        .node-g:hover rect.node-rect { stroke-opacity: 1 !important; filter: drop-shadow(0 0 10px var(--node-glow)); }
      `}</style>

      <div
        style={{
          overflowX: "auto",
          overflowY: "visible",
          border: "1px solid #1a1a28",
          borderRadius: 16,
          background: "#060610",
          padding: 12,
        }}
      >
        <svg width={svgW} height={svgH} style={{ display: "block" }}>
          <defs>
            {/* Dot grid */}
            <pattern id="dotgrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#1e1e30" />
            </pattern>

            {/* Filters */}
            <filter id="glow-sm" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-lg" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Arrow markers per type */}
            <marker id="arrow-dim" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="#2a2a40" />
            </marker>
            {Object.entries(NODE_CFG).map(([type, c]) => (
              <marker key={type} id={`arr-${type}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill={c.accent} />
              </marker>
            ))}

            {/* Per-node gradients */}
            {nodes.map(node => {
              const c = NODE_CFG[node.type];
              const isA = activeNode === node.id;
              return (
                <linearGradient key={`g-${node.id}`} id={`g-${node.id}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={c.bg} />
                  <stop offset="100%" stopColor={isA ? c.border : c.bg} stopOpacity={isA ? 0.35 : 0.1} />
                </linearGradient>
              );
            })}
          </defs>

          {/* Background */}
          <rect width={svgW} height={svgH} fill="#060610" />
          <rect width={svgW} height={svgH} fill="url(#dotgrid)" />

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = getCenter(edge.from);
            const to   = getCenter(edge.to);
            const fromNode = nodes.find(n => n.id === edge.from);
            const c = fromNode ? NODE_CFG[fromNode.type] : NODE_CFG["api"];
            const isActive = activeNode === edge.from || activeNode === edge.to;

            const dx = to.x - from.x;
            const cx1 = from.x + dx * 0.55;
            const cx2 = to.x - dx * 0.55;
            const d = `M ${from.x} ${from.y} C ${cx1} ${from.y} ${cx2} ${to.y} ${to.x} ${to.y}`;

            const dashArr = edge.style === "dashed" ? "8 8" : "12 8";
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            return (
              <g key={i}>
                {isActive && (
                  <path
                    d={d} fill="none"
                    stroke={c.accent} strokeWidth={6} strokeOpacity={0.18}
                    strokeDasharray={dashArr}
                    className="edge-active"
                    filter="url(#glow-sm)"
                  />
                )}
                <path
                  d={d} fill="none"
                  stroke={isActive ? c.accent : "#1e1e35"}
                  strokeWidth={isActive ? 2 : 1.5}
                  strokeDasharray={dashArr}
                  className={isActive ? "edge-active" : "edge-passive"}
                  strokeOpacity={isActive ? 1 : 0.6}
                  markerEnd={isActive ? `url(#arr-${fromNode?.type ?? "api"})` : "url(#arrow-dim)"}
                />
                {edge.label && (
                  <text
                    x={midX} y={midY - 8}
                    textAnchor="middle"
                    fill={isActive ? c.accent : "#32324a"}
                    fontSize="10" fontFamily="'JetBrains Mono', monospace"
                    fontWeight={isActive ? "700" : "400"}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const p = positions[node.id];
            if (!p) return null;
            const c = NODE_CFG[node.type];
            const isActive = activeNode === node.id;

            return (
              <g
                key={node.id}
                className="node-g"
                transform={`translate(${p.x}, ${p.y})`}
                onClick={() => setActiveNode(isActive ? null : node.id)}
                style={{ cursor: "pointer" }}
              >
                {isActive && (
                  <rect
                    x={-5} y={-5} width={nodeW + 10} height={nodeH + 10}
                    rx={14} fill="none"
                    stroke={c.accent} strokeWidth={1.5} strokeOpacity={0.5}
                    filter="url(#glow-lg)"
                  />
                )}

                <rect
                  className="node-rect"
                  x={0} y={0} width={nodeW} height={nodeH}
                  rx={11}
                  fill={`url(#g-${node.id})`}
                  stroke={c.border}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeOpacity={isActive ? 1 : 0.5}
                />

                <rect x={0} y={10} width={3} height={nodeH - 20} rx={2}
                  fill={c.accent} fillOpacity={isActive ? 1 : 0.8}
                  filter={isActive ? "url(#glow-sm)" : undefined}
                />

                <text x={26} y={nodeH / 2 + 7} textAnchor="middle" fontSize="17">
                  {c.icon}
                </text>

                <text
                  x={42} y={nodeH / 2 - 6}
                  textAnchor="start"
                  fill={isActive ? "#ffffff" : "#c8c8e0"}
                  fontSize="13" fontWeight="700" fontFamily="'Inter', sans-serif"
                >
                  {node.label}
                </text>

                <text
                  x={42} y={nodeH / 2 + 12}
                  textAnchor="start"
                  fill={c.accent} fontSize="9"
                  fontFamily="'JetBrains Mono', monospace" fontWeight="600"
                  fillOpacity={isActive ? 1 : 0.75}
                >
                  {node.type.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Active node detail panel */}
      {activeNodeData && (() => {
        const c = NODE_CFG[activeNodeData.type];
        const signals = analysis ? getNodeSignals(activeNodeData, analysis) : [];

        return (
          <div style={{
            background: "#0c0c1a",
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: `0 0 28px ${c.glow}`,
          }}>
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderBottom: `1px solid ${c.border}22`,
              background: `${c.bg}cc`,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: c.bg, border: `1px solid ${c.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
                boxShadow: `0 0 12px ${c.glow}`,
              }}>
                {c.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 3 }}>
                  {activeNodeData.label}
                </div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: `${c.accent}18`, border: `1px solid ${c.accent}30`,
                  borderRadius: 4, padding: "2px 8px",
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                  color: c.accent, letterSpacing: "0.08em",
                }}>
                  {activeNodeData.type.toUpperCase()}
                </div>
              </div>
              <button
                onClick={() => setActiveNode(null)}
                style={{
                  background: "none", border: "none",
                  cursor: "pointer", color: "#5a5a6a", fontSize: 22,
                  padding: "0 4px", flexShrink: 0, lineHeight: 1,
                }}
              >×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: signals.length > 0 ? "1fr 1fr" : "1fr", gap: 0 }}>
              {/* Description */}
              <div style={{ padding: "16px 20px", borderRight: signals.length > 0 ? `1px solid ${c.border}22` : "none" }}>
                <div style={{
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#3a3a50",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                }}>
                  Description
                </div>
                <div style={{ fontSize: 13, color: "#8b8b99", lineHeight: 1.65 }}>
                  {activeNodeData.description}
                </div>

                {/* Connections */}
                {(incomingEdges.length > 0 || outgoingEdges.length > 0) && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#3a3a50",
                      letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                    }}>
                      Connections
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {incomingEdges.map((e, i) => {
                        const peer = nodes.find(n => n.id === e.from);
                        const pc = peer ? NODE_CFG[peer.type] : NODE_CFG["api"];
                        return (
                          <div key={`in-${i}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 11, color: pc.accent, fontFamily: "'JetBrains Mono', monospace" }}>
                              {peer?.label ?? e.from}
                            </span>
                            <span style={{ fontSize: 10, color: "#3a3a50" }}>→</span>
                            <span style={{ fontSize: 11, color: c.accent, fontFamily: "'JetBrains Mono', monospace" }}>
                              {activeNodeData.label}
                            </span>
                            {e.label && (
                              <span style={{ fontSize: 10, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                                [{e.label}]
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {outgoingEdges.map((e, i) => {
                        const peer = nodes.find(n => n.id === e.to);
                        const pc = peer ? NODE_CFG[peer.type] : NODE_CFG["api"];
                        return (
                          <div key={`out-${i}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 11, color: c.accent, fontFamily: "'JetBrains Mono', monospace" }}>
                              {activeNodeData.label}
                            </span>
                            <span style={{ fontSize: 10, color: "#3a3a50" }}>→</span>
                            <span style={{ fontSize: 11, color: pc.accent, fontFamily: "'JetBrains Mono', monospace" }}>
                              {peer?.label ?? e.to}
                            </span>
                            {e.label && (
                              <span style={{ fontSize: 10, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                                [{e.label}]
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Signals */}
              {signals.length > 0 && (
                <div style={{ padding: "16px 20px" }}>
                  <div style={{
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#3a3a50",
                    letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                  }}>
                    Detection Signals
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {signals.map((s, i) => (
                      <div key={i}>
                        <div style={{
                          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                          color: c.accent, marginBottom: 2, opacity: s.dim ? 0.5 : 1,
                        }}>
                          {s.label}
                        </div>
                        <div style={{
                          fontSize: 12, color: s.dim ? "#4a4a5a" : "#c0c0cc",
                          lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {s.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        {(Object.entries(NODE_CFG) as [FlowNode["type"], typeof NODE_CFG[FlowNode["type"]]][])
          .filter(([type]) => nodes.some(n => n.type === type))
          .map(([type, c]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 2,
                background: c.accent,
                boxShadow: `0 0 6px ${c.glow}`,
              }} />
              <span style={{ fontSize: 11, color: "#4a4a60", fontFamily: "'JetBrains Mono', monospace" }}>
                {type}
              </span>
            </div>
          ))}
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#2a2a40", fontFamily: "'JetBrains Mono', monospace" }}>
          click node to inspect
        </div>
      </div>
    </div>
  );
}
