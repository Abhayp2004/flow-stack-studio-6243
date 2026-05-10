import { useEffect, useState } from "react";

const STEPS = [
  "Resolving domain",
  "Inspecting headers",
  "Detecting framework",
  "Mapping request flow",
  "Parsing payload schema",
  "Generating report",
];

export function LoadingSteps() {
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState<number[]>([]);

  useEffect(() => {
    if (currentStep >= STEPS.length) return;
    const t = setTimeout(() => {
      setDone(d => [...d, currentStep]);
      setCurrentStep(s => s + 1);
    }, 380);
    return () => clearTimeout(t);
  }, [currentStep]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
      {STEPS.map((step, i) => {
        const isDone = done.includes(i);
        const isActive = i === currentStep;

        return (
          <div
            key={step}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: i > currentStep ? 0.3 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            {/* Indicator */}
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="7" fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1" />
                  <path d="M4 7l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : isActive ? (
                <div style={{ display: "flex", gap: 2 }}>
                  {[0, 1, 2].map(d => (
                    <div
                      key={d}
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: "#6e56cf",
                        animation: "pulse-dot 1s ease infinite",
                        animationDelay: `${d * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#2a2a2f" }} />
              )}
            </div>

            <span
              style={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                color: isDone ? "#8b8b99" : isActive ? "#f0f0f2" : "#3d3d45",
                transition: "color 0.3s ease",
              }}
            >
              {step}
            </span>

            {isDone && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: "#22c55e",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                done
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
