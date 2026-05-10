export type ConfidenceLevel = "high" | "medium" | "low";

export interface StackTech {
  name: string;
  category: string;
  confidence: ConfidenceLevel;
  evidence: string;
}

export interface FlowNode {
  id: string;
  label: string;
  type: "browser" | "cdn" | "auth" | "api" | "db" | "service" | "queue" | "third-party";
  description: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
}

export interface AnalysisResult {
  url: string;
  analyzedAt: string;
  overallConfidence: ConfidenceLevel;
  mode: "saas" | "ecommerce" | "blog";
  summary: string;
  architectureNote: string;
  frontend: StackTech[];
  infrastructure: StackTech[];
  apiType: { name: string; confidence: ConfidenceLevel; details: string };
  authHint: string;
  thirdParty: StackTech[];
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
  payloadHint: string;
}
