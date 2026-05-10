import { useState } from "react";
import type { FlowNode, FlowEdge } from "../lib/mock-analysis";

interface FlowDiagramProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const NODE_TYPE_COLORS: Record<FlowNode["type"], { bg: string; border: string; accent: string; icon: string }> = {
  browser:      { bg: "#1a1a2e", border: "#3b82f6", accent: "#3b82f6", icon: "🌐" },
  cdn:          { bg: "#1a2020", border: "#06b6d4", accent: "#06b6d4", icon: "⚡" },
  auth:         { bg: "#1e1a2e", border: "#8b72e8", accent: "#8b72e8", icon: "🔐" },
  api:          { bg: "#1a1e20", border: "#6e56cf", accent: "#6e56cf", icon: "⚙️" },
  db:           { bg: "#201a1a", border: "#f59e0b", accent: "#f59e0b", icon: "🗄️" },
  service:      { bg: "#1a2020", border: "#22c55e", accent: "#22c55e", icon: "🔧" },
  queue:        { bg: "#1e1e1a", border: "#f59e0b", accent: "#f59e0b", icon: "📨" },
  "third-party": { bg: "#201e1a", border: "#8b8b99", accent: "#8b8b99", icon: "🔗" },
};

// Automatic layout engine — arrange nodes in columns by type order
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
  const colW = 180;
  const rowH = 80;
  const startX = 40;
  const startY = 40;

  let col = 0;
  groups.forEach((gnodes, _type) => {
    if (gnodes.length === 0) return;
    gnodes.forEach((n, row) => {
      positions[n.id] = {
        x: startX + col * colW,
        y: startY + row * rowH,
      };
    });
    col++;
  });

  return positions;
}

export function FlowDiagram({ nodes, edges }: FlowDiagramProps) {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const positions = layoutNodes(nodes);

  const nodeW = 140;
  const nodeH = 56;

  // compute canvas size
  const maxX = Math.max(...Object.values(positions).map(p => p.x)) + nodeW + 40;
  const maxY = Math.max(...Object.values(positions).map(p => p.y)) + nodeH + 40;

  const svgW = Math.max(maxX, 700);
  const svgH = Math.max(maxY, 300);

  function getCenter(id: string) {
    const p = positions[id];
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + nodeW / 2, y: p.y + nodeH / 2 };
  }

  const activeNodeData = activeNode ? nodes.find(n => n.id === activeNode) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Diagram */}
      <div
        style={{
          overflowX: "auto",
          overflowY: "auto",
          border: "1px solid #2a2a2f",
          borderRadius: 10,
          background: "#0e0e10",
          padding: 8,
          maxHeight: 420,
        }}
      >
        <svg width={svgW} height={svgH} style={{ display: "block" }}>
          {/* Defs */}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#3d3d45" />
            </marker>
            <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#6e56cf" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = getCenter(edge.from);
            const to = getCenter(edge.to);
            const isActive = activeNode === edge.from || activeNode === edge.to;
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2 - 20;
            const d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;

            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={isActive ? "#6e56cf" : "#2a2a2f"}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeDasharray={edge.style === "dashed" ? "5 4" : undefined}
                  markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow)"}
                  style={{ transition: "stroke 0.2s ease" }}
                />
                {edge.label && (
                  <text
                    x={mx}
                    y={my - 4}
                    textAnchor="middle"
                    fill={isActive ? "#8b72e8" : "#5a5a6a"}
                    fontSize="10"
                    fontFamily="'JetBrains Mono', monospace"
                    style={{ transition: "fill 0.2s ease" }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const p = positions[node.id];
            if (!p) return null;
            const c = NODE_TYPE_COLORS[node.type];
            const isActive = activeNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${p.x}, ${p.y})`}
                onClick={() => setActiveNode(isActive ? null : node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Node bg */}
                <rect
                  x={0} y={0}
                  width={nodeW} height={nodeH}
                  rx={7}
                  fill={isActive ? `${c.bg.replace(")", ", 0.9)")}` : c.bg}
                  stroke={isActive ? c.accent : c.border}
                  strokeWidth={isActive ? 1.5 : 1}
                  style={{ transition: "all 0.15s ease" }}
                  filter={isActive ? "drop-shadow(0 0 6px rgba(110,86,207,0.3))" : undefined}
                />
                {/* Type indicator bar */}
                <rect x={0} y={0} width={3} height={nodeH} rx={7} fill={c.accent} />
                {/* Label */}
                <text
                  x={nodeW / 2 + 2}
                  y={nodeH / 2 - 5}
                  textAnchor="middle"
                  fill={isActive ? "#f0f0f2" : "#c0c0cc"}
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="'Inter', sans-serif"
                >
                  {node.label}
                </text>
                {/* Type badge */}
                <text
                  x={nodeW / 2 + 2}
                  y={nodeH / 2 + 11}
                  textAnchor="middle"
                  fill={c.accent}
                  fontSize="9.5"
                  fontFamily="'JetBrains Mono', monospace"
                  style={{ opacity: 0.85 }}
                >
                  {node.type.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Node detail panel */}
      {activeNodeData && (
        <div
          style={{
            background: "#1a1a1e",
            border: `1px solid ${NODE_TYPE_COLORS[activeNodeData.type].border}`,
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
          className="animate-fade-in"
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: NODE_TYPE_COLORS[activeNodeData.type].bg,
              border: `1px solid ${NODE_TYPE_COLORS[activeNodeData.type].border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {NODE_TYPE_COLORS[activeNodeData.type].icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f2", marginBottom: 3 }}>{activeNodeData.label}</div>
            <div style={{ fontSize: 13, color: "#8b8b99", lineHeight: 1.5 }}>{activeNodeData.description}</div>
          </div>
          <button
            onClick={() => setActiveNode(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#5a5a6a",
              fontSize: 18,
              padding: "0 4px",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {(Object.entries(NODE_TYPE_COLORS) as [FlowNode["type"], typeof NODE_TYPE_COLORS[FlowNode["type"]]][])
          .filter(([type]) => nodes.some(n => n.type === type))
          .map(([type, c]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c.accent }} />
              <span style={{ fontSize: 11, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                {type}
              </span>
            </div>
          ))}
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#3d3d45", fontFamily: "'JetBrains Mono', monospace" }}>
          click node to inspect
        </div>
      </div>
    </div>
  );
}
