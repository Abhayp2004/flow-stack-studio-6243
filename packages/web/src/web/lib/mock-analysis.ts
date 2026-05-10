// Re-export shared types so existing imports from this file still work
export type { AnalysisResult, StackTech, FlowNode, FlowEdge, ConfidenceLevel } from "../../../types";

export const SAMPLE_EXAMPLES = [
  { label: "Linear", url: "https://app.linear.app", description: "Project management SaaS" },
  { label: "GitHub", url: "https://github.com", description: "Dev platform" },
  { label: "Notion", url: "https://notion.so", description: "Collaboration workspace" },
  { label: "My App", url: "https://markmanager.vercel.app", description: "Vercel-hosted app" },
];

export const SAMPLE_JSON = `{
  "event": "checkout.completed",
  "id": "evt_01HZXK2M9BVCRP0Q5TNEJD3Y",
  "timestamp": "2024-01-15T14:32:11Z",
  "user": {
    "id": "usr_8f2k",
    "email": "alex@example.com",
    "plan": "pro",
    "metadata": {
      "signup_source": "organic",
      "country": "US"
    }
  },
  "payload": {
    "order_id": "ord_9x4m",
    "total": 129.00,
    "currency": "USD",
    "items": [
      {
        "sku": "PRO-ANNUAL",
        "qty": 1,
        "price": 129.00
      }
    ],
    "billing": {
      "method": "stripe",
      "last4": "4242",
      "status": "succeeded"
    }
  },
  "webhook": {
    "retry_count": 0,
    "delivered": true,
    "endpoints": ["https://api.example.com/hooks/stripe"]
  }
}`;
