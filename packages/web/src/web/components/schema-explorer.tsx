import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { JsonTree } from "./json-tree";
import { extractSchema, groupByType, type FieldType, type FieldPattern, type SchemaField } from "../lib/schema-extractor";

// ── Pattern chips ─────────────────────────────────────────────────────────────
const PATTERN_CFG: Record<FieldPattern, { label: string; color: string; bg: string }> = {
  id:        { label: "id",        color: "#8b72e8", bg: "rgba(139,114,232,0.15)" },
  uuid:      { label: "uuid",      color: "#6e56cf", bg: "rgba(110,86,207,0.15)" },
  email:     { label: "email",     color: "#06b6d4", bg: "rgba(6,182,212,0.12)"  },
  url:       { label: "url",       color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  timestamp: { label: "datetime",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  currency:  { label: "currency",  color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  slug:      { label: "slug",      color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  color:     { label: "color",     color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
};

const TYPE_CFG: Record<FieldType, { color: string; bg: string }> = {
  string:  { color: "#22c55e", bg: "rgba(34,197,94,0.1)"   },
  number:  { color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  boolean: { color: "#06b6d4", bg: "rgba(6,182,212,0.1)"   },
  null:    { color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  object:  { color: "#8b72e8", bg: "rgba(139,114,232,0.1)" },
  array:   { color: "#f97316", bg: "rgba(249,115,22,0.1)"  },
};

type ExplorerMode = "tree" | "schema" | "types";

const TAB_ICONS: Record<ExplorerMode, string> = { tree: "⌥", schema: "⊞", types: "≡" };

function PatternChip({ pattern }: { pattern: FieldPattern }) {
  const c = PATTERN_CFG[pattern];
  return (
    <span style={{
      fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
      color: c.color, background: c.bg, border: `1px solid ${c.color}33`,
      borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em", textTransform: "uppercase",
      flexShrink: 0,
    }}>
      {c.label}
    </span>
  );
}

function TypeChip({ type }: { type: FieldType }) {
  const c = TYPE_CFG[type];
  return (
    <span style={{
      fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
      color: c.color, background: c.bg, border: `1px solid ${c.color}22`,
      borderRadius: 3, padding: "1px 6px", flexShrink: 0,
    }}>
      {type}
    </span>
  );
}

function SchemaRow({ field }: { field: SchemaField }) {
  const exStr = field.example === null ? "null"
    : typeof field.example === "string" ? `"${field.example.slice(0, 40)}${field.example.length > 40 ? "…" : ""}"`
    : String(field.example);

  const isLeaf = field.type !== "object" && field.type !== "array";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 70px 90px minmax(0, 1.2fr)",
      gap: 10,
      alignItems: "center",
      padding: "7px 14px",
      borderBottom: "1px solid #1a1a22",
      transition: "background 0.1s ease",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "#111118")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Path */}
      <div style={{
        fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
        color: isLeaf ? "#c0c0cc" : "#5a5a6a",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {field.path}
      </div>
      {/* Type */}
      <div><TypeChip type={field.type} /></div>
      {/* Pattern */}
      <div>{field.pattern ? <PatternChip pattern={field.pattern} /> : <span style={{ fontSize: 11, color: "#2a2a3a" }}>—</span>}</div>
      {/* Example */}
      <div style={{
        fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        color: field.type === "string" ? "#22c55e" : field.type === "number" ? "#f59e0b" : field.type === "boolean" ? "#06b6d4" : field.type === "null" ? "#ef4444" : "#5a5a6a",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {isLeaf ? exStr : <span style={{ color: "#3a3a50" }}>{exStr}</span>}
      </div>
    </div>
  );
}

const TYPE_ORDER: FieldType[] = ["string", "number", "boolean", "object", "array", "null"];

interface SchemaExplorerProps {
  json: string;
}

export function SchemaExplorer({ json }: SchemaExplorerProps) {
  const [mode, setMode] = useState<ExplorerMode>("tree");
  const [search, setSearch] = useState("");

  const fields = useMemo(() => extractSchema(json), [json]);
  const groups = useMemo(() => groupByType(fields), [fields]);

  const filtered = useMemo(() => {
    if (!search.trim()) return fields;
    const q = search.toLowerCase();
    return fields.filter(f => f.path.toLowerCase().includes(q) || f.type.includes(q) || (f.pattern ?? "").includes(q));
  }, [fields, search]);

  const leafCount = fields.filter(f => f.type !== "object" && f.type !== "array").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#0e0e10", border: "1px solid #2a2a2f", borderRadius: 10, overflow: "hidden" }}>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid #1e1e28",
        background: "#0c0c18",
      }}>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 2, background: "#0a0a12", border: "1px solid #2a2a2f", borderRadius: 7, padding: 3 }}>
          {(["tree", "schema", "types"] as ExplorerMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? "#1e1e2e" : "none",
                border: mode === m ? "1px solid #2a2a3f" : "1px solid transparent",
                borderRadius: 5,
                padding: "4px 12px",
                cursor: "pointer",
                color: mode === m ? "#f0f0f2" : "#5a5a6a",
                fontSize: 11,
                fontWeight: mode === m ? 600 : 400,
                fontFamily: "'Inter', sans-serif",
                display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontFamily: "monospace", opacity: 0.7 }}>{TAB_ICONS[m]}</span>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        {(mode === "schema" || mode === "types") && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            background: "#0a0a12", border: "1px solid #2a2a2f", borderRadius: 7,
            padding: "5px 10px",
          }}>
            <Search size={12} color="#5a5a6a" />
            <input
              type="text"
              placeholder="Search fields…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "#f0f0f2", fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#5a5a6a", padding: 0, display: "flex" }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#3a3a50", fontFamily: "'JetBrains Mono', monospace" }}>
            {leafCount} fields · {fields.length} nodes
          </span>
          {mode === "schema" && search && (
            <span style={{ fontSize: 11, color: "#6e56cf", fontFamily: "'JetBrains Mono', monospace" }}>
              {filtered.length} match{filtered.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Tree mode */}
      {mode === "tree" && (
        <div style={{ padding: "16px 20px", maxHeight: 520, overflowY: "auto", overflowX: "auto" }}>
          <JsonTree json={json} />
        </div>
      )}

      {/* Schema mode */}
      {mode === "schema" && (
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 70px 90px minmax(0, 1.2fr)",
            gap: 10,
            padding: "6px 14px 6px",
            borderBottom: "1px solid #2a2a2f",
            position: "sticky", top: 0,
            background: "#0e0e10",
          }}>
            {["Field path", "Type", "Pattern", "Example"].map(h => (
              <div key={h} style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#3a3a50", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {h}
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "32px 14px", textAlign: "center", color: "#3a3a50", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
              {search ? `No fields matching "${search}"` : "No fields found"}
            </div>
          ) : (
            filtered.map((f, i) => <SchemaRow key={i} field={f} />)
          )}
        </div>
      )}

      {/* Types mode */}
      {mode === "types" && (
        <div style={{ maxHeight: 520, overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {TYPE_ORDER.filter(t => {
              const g = groups[t];
              if (!g || g.length === 0) return false;
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return g.some(f => f.path.toLowerCase().includes(q) || (f.pattern ?? "").includes(q));
            }).map(type => {
              const c = TYPE_CFG[type];
              const typeFields = search.trim()
                ? groups[type].filter(f => f.path.toLowerCase().includes(search.toLowerCase()) || (f.pattern ?? "").includes(search.toLowerCase()))
                : groups[type];

              return (
                <div key={type} style={{
                  background: "#0c0c18",
                  border: `1px solid ${c.color}22`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}>
                  {/* Type header */}
                  <div style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${c.color}22`,
                    display: "flex", alignItems: "center", gap: 8,
                    background: c.bg,
                  }}>
                    <TypeChip type={type} />
                    <span style={{ fontSize: 12, color: c.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {typeFields.length} field{typeFields.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Fields list */}
                  <div style={{ padding: "8px 0", maxHeight: 200, overflowY: "auto" }}>
                    {typeFields.map((f, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "5px 14px",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#111118")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#c0c0cc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.path}
                        </span>
                        {f.pattern && <PatternChip pattern={f.pattern} />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pattern legend */}
          <div style={{ marginTop: 16, padding: "12px 14px", background: "#0c0c18", border: "1px solid #1e1e28", borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#3a3a50", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Reference Patterns
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(Object.entries(PATTERN_CFG) as [FieldPattern, typeof PATTERN_CFG[FieldPattern]][])
                .filter(([p]) => fields.some(f => f.pattern === p))
                .map(([p, c]) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <PatternChip pattern={p} />
                    <span style={{ fontSize: 11, color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace" }}>
                      {fields.filter(f => f.pattern === p).length}×
                    </span>
                  </div>
                ))}
              {!fields.some(f => f.pattern) && (
                <span style={{ fontSize: 12, color: "#3a3a50", fontFamily: "'JetBrains Mono', monospace" }}>No reference patterns detected</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
