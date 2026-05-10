import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface JsonNodeProps {
  keyName?: string | number;
  value: JsonValue;
  depth?: number;
  defaultExpanded?: boolean;
}

function getType(val: JsonValue): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
}

function JsonScalar({ value }: { value: string | number | boolean | null }) {
  const type = getType(value);
  if (type === "string")  return <span className="json-string">"{String(value)}"</span>;
  if (type === "number")  return <span className="json-number">{String(value)}</span>;
  if (type === "boolean") return <span className="json-boolean">{String(value)}</span>;
  if (type === "null")    return <span className="json-null">null</span>;
  return <span>{String(value)}</span>;
}

function JsonNode({ keyName, value, depth = 0, defaultExpanded = true }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2 ? defaultExpanded : false);
  const type = getType(value);
  const indent = depth * 16;
  const isComplex = type === "object" || type === "array";

  if (!isComplex) {
    return (
      <div style={{ paddingLeft: indent, display: "flex", alignItems: "baseline", gap: 4, minHeight: 22, lineHeight: "22px" }}>
        {keyName !== undefined && (
          <>
            <span className="json-key">"{keyName}"</span>
            <span style={{ color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>:</span>
          </>
        )}
        <JsonScalar value={value as string | number | boolean | null} />
      </div>
    );
  }

  const isArray = type === "array";
  const items = isArray
    ? (value as JsonArray)
    : Object.entries(value as JsonObject);
  const count = items.length;
  const bracket = isArray ? ["[", "]"] : ["{", "}"];

  return (
    <div>
      <div
        style={{ paddingLeft: Math.max(0, indent - 4), display: "flex", alignItems: "center", gap: 4, cursor: "pointer", minHeight: 22, lineHeight: "22px", userSelect: "none" }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ color: "#5a5a6a", display: "flex", alignItems: "center", width: 14, flexShrink: 0 }}>
          {expanded
            ? <ChevronDown size={12} />
            : <ChevronRight size={12} />}
        </span>
        {keyName !== undefined && (
          <>
            <span className="json-key">"{keyName}"</span>
            <span style={{ color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>:</span>
          </>
        )}
        <span style={{ color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{bracket[0]}</span>
        {!expanded && (
          <span
            style={{
              fontSize: 11,
              color: "#5a5a6a",
              background: "#1a1a1e",
              border: "1px solid #2a2a2f",
              borderRadius: 3,
              padding: "0 5px",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {isArray ? `${count} items` : `${count} keys`}
          </span>
        )}
        {!expanded && <span style={{ color: "#5a5a6a", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{bracket[1]}</span>}
      </div>

      {expanded && (
        <div>
          {isArray
            ? (value as JsonArray).map((item, i) => (
                <JsonNode key={i} keyName={i} value={item} depth={depth + 1} defaultExpanded={false} />
              ))
            : Object.entries(value as JsonObject).map(([k, v]) => (
                <JsonNode key={k} keyName={k} value={v} depth={depth + 1} defaultExpanded={false} />
              ))
          }
          <div style={{ paddingLeft: indent, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#5a5a6a", minHeight: 22, lineHeight: "22px" }}>
            {bracket[1]}
          </div>
        </div>
      )}
    </div>
  );
}

interface JsonTreeProps {
  json: string;
}

export function JsonTree({ json }: JsonTreeProps) {
  let parsed: JsonValue;
  let error: string | null = null;

  try {
    parsed = JSON.parse(json);
  } catch (e) {
    error = "Invalid JSON";
    parsed = null;
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
        ✕ {error}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#0e0e10",
        border: "1px solid #2a2a2f",
        borderRadius: 10,
        padding: "16px 20px",
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: 520,
      }}
    >
      <JsonNode value={parsed} defaultExpanded={true} />
    </div>
  );
}
