import type { ConfidenceLevel } from "../lib/mock-analysis";

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const config: Record<ConfidenceLevel, { color: string; bg: string; border: string; label: string }> = {
  high: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", label: "High Confidence" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", label: "Medium Confidence" },
  low: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", label: "Low Confidence" },
};

export function ConfidenceBadge({ level, showLabel = true, size = "sm" }: ConfidenceBadgeProps) {
  const c = config[level];
  const fontSize = size === "sm" ? "10px" : "11px";
  const pad = size === "sm" ? "2px 8px" : "3px 10px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: pad,
        borderRadius: "4px",
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontSize,
        fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
      {showLabel ? c.label : level}
    </span>
  );
}

export function ConfidenceDot({ level }: { level: ConfidenceLevel }) {
  const c = config[level];
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: c.color,
        flexShrink: 0,
      }}
    />
  );
}
