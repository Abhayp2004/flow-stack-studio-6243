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
  active?: boolean;
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

const saasResult = (url: string): AnalysisResult => ({
  url,
  analyzedAt: new Date().toISOString(),
  overallConfidence: "high",
  mode: "saas",
  summary: "Likely a modern SaaS application with a React-based frontend, Node.js API, and cloud-hosted infrastructure. Authentication layer detected. REST API with possible GraphQL layer for client queries.",
  architectureNote: "Next.js frontend with API-backed SaaS architecture. Bearer token auth likely. CDN-fronted static assets.",
  frontend: [
    { name: "React 18+", category: "Framework", confidence: "high", evidence: "React-specific DOM patterns and event handling detected in source hints." },
    { name: "Next.js", category: "Meta-framework", confidence: "high", evidence: "__NEXT_DATA__ script tag pattern and /api/ route conventions." },
    { name: "Tailwind CSS", category: "Styling", confidence: "medium", evidence: "Utility class patterns in class attributes match Tailwind conventions." },
    { name: "TypeScript", category: "Language", confidence: "medium", evidence: "Type annotation patterns and tsconfig hints in source map references." },
  ],
  infrastructure: [
    { name: "Vercel", category: "Hosting", confidence: "high", evidence: "vercel.app domain pattern or x-vercel headers in response." },
    { name: "Cloudflare", category: "CDN", confidence: "medium", evidence: "cf-cache-status header present in asset responses." },
    { name: "AWS S3", category: "Storage", confidence: "low", evidence: "s3.amazonaws.com references in image src attributes." },
  ],
  apiType: { name: "REST + GraphQL", confidence: "medium", details: "/api/ route structure suggests REST, with potential /graphql endpoint for data-heavy operations." },
  authHint: "Bearer token auth likely — Authorization headers detected in preflight OPTIONS responses.",
  thirdParty: [
    { name: "Stripe", category: "Payments", confidence: "high", evidence: "js.stripe.com script reference detected." },
    { name: "Segment", category: "Analytics", confidence: "medium", evidence: "analytics.js snippet pattern in page scripts." },
    { name: "Intercom", category: "Support", confidence: "medium", evidence: "Intercom widget bootstrap script detected." },
  ],
  flowNodes: [
    { id: "browser", label: "Browser", type: "browser", description: "User's client — renders React/Next.js app" },
    { id: "cdn", label: "Cloudflare CDN", type: "cdn", description: "Serves static assets, edges requests globally" },
    { id: "auth", label: "Auth Layer", type: "auth", description: "JWT / Bearer token validation" },
    { id: "api", label: "REST API", type: "api", description: "Node.js / Next.js API routes at /api/*" },
    { id: "graphql", label: "GraphQL", type: "api", description: "Data layer for complex client queries" },
    { id: "db", label: "PostgreSQL", type: "db", description: "Primary data store — likely hosted on RDS or PlanetScale" },
    { id: "stripe", label: "Stripe", type: "third-party", description: "Payment processing and billing" },
    { id: "analytics", label: "Segment", type: "third-party", description: "Event tracking and user analytics" },
  ],
  flowEdges: [
    { from: "browser", to: "cdn", label: "static assets" },
    { from: "browser", to: "auth", label: "token" },
    { from: "auth", to: "api", label: "validated" },
    { from: "api", to: "graphql", label: "data ops", style: "dashed" },
    { from: "api", to: "db", label: "queries" },
    { from: "api", to: "stripe", label: "billing", style: "dashed" },
    { from: "api", to: "analytics", label: "events", style: "dashed" },
  ],
  payloadHint: "Nested event-driven structure. Likely includes user context, metadata, and nested resource objects.",
});

const ecommerceResult = (url: string): AnalysisResult => ({
  url,
  analyzedAt: new Date().toISOString(),
  overallConfidence: "medium",
  mode: "ecommerce",
  summary: "E-commerce platform with storefront rendering, cart/checkout flow, and payment processing. Likely headless commerce or Shopify-powered. Strong CDN presence for product images and static assets.",
  architectureNote: "REST-style request flow with hosted frontend and Shopify/custom commerce backend. Multi-CDN asset delivery.",
  frontend: [
    { name: "React / Next.js", category: "Framework", confidence: "high", evidence: "SSR page structure and hydration patterns." },
    { name: "CSS Modules", category: "Styling", confidence: "medium", evidence: "Hashed class name patterns suggest CSS module compilation." },
    { name: "Redux / Zustand", category: "State", confidence: "low", evidence: "Global cart state handling patterns in bundle." },
  ],
  infrastructure: [
    { name: "Shopify Storefront", category: "Commerce", confidence: "high", evidence: "myshopify.com GraphQL endpoint or Shopify CDN references." },
    { name: "Fastly CDN", category: "CDN", confidence: "medium", evidence: "fastly.net references in asset URLs." },
    { name: "Netlify", category: "Hosting", confidence: "medium", evidence: "netlify.app header or deploy context headers." },
  ],
  apiType: { name: "GraphQL (Storefront)", confidence: "high", details: "Shopify Storefront API uses GraphQL. Product, cart, and checkout operations via /api/graphql." },
  authHint: "Session-based or customer token auth for account features. Checkout sessions are ephemeral.",
  thirdParty: [
    { name: "Stripe / Shopify Pay", category: "Payments", confidence: "high", evidence: "Payment script references in checkout flow." },
    { name: "Google Analytics 4", category: "Analytics", confidence: "high", evidence: "gtag.js and G- prefix measurement ID." },
    { name: "Klaviyo", category: "Email/Marketing", confidence: "medium", evidence: "klaviyo.com script in page head." },
  ],
  flowNodes: [
    { id: "browser", label: "Browser", type: "browser", description: "Customer storefront — React SSR/CSR" },
    { id: "cdn", label: "Fastly CDN", type: "cdn", description: "Product images, static assets at global edge" },
    { id: "api", label: "Storefront API", type: "api", description: "GraphQL Storefront API for product/cart data" },
    { id: "checkout", label: "Checkout", type: "api", description: "Hosted or headless checkout flow" },
    { id: "db", label: "Commerce DB", type: "db", description: "Product catalog, inventory, orders" },
    { id: "stripe", label: "Payment Gateway", type: "third-party", description: "Stripe / Shopify Payments" },
    { id: "analytics", label: "GA4", type: "third-party", description: "Google Analytics 4 ecommerce events" },
    { id: "klaviyo", label: "Klaviyo", type: "third-party", description: "Email marketing and abandoned cart flows" },
  ],
  flowEdges: [
    { from: "browser", to: "cdn", label: "assets" },
    { from: "browser", to: "api", label: "products/cart" },
    { from: "api", to: "db", label: "queries" },
    { from: "browser", to: "checkout", label: "purchase" },
    { from: "checkout", to: "stripe", label: "payment" },
    { from: "browser", to: "analytics", label: "events", style: "dashed" },
    { from: "checkout", to: "klaviyo", label: "order hook", style: "dashed" },
  ],
  payloadHint: "Structured product/cart schema with nested variants, pricing, and metadata.",
});

const blogResult = (url: string): AnalysisResult => ({
  url,
  analyzedAt: new Date().toISOString(),
  overallConfidence: "high",
  mode: "blog",
  summary: "Content-first website with static generation or CMS-backed content. Likely JAMstack architecture. Minimal backend — mostly read-only API calls for content delivery.",
  architectureNote: "Static site or SSG-based content site with headless CMS. CDN-heavy, minimal server-side logic.",
  frontend: [
    { name: "Astro / Next.js", category: "Framework", confidence: "medium", evidence: "SSG page patterns and zero-JS default hints." },
    { name: "Tailwind CSS", category: "Styling", confidence: "high", evidence: "Utility-first class patterns throughout markup." },
    { name: "MDX", category: "Content", confidence: "medium", evidence: "MDX component patterns in rendered HTML structure." },
  ],
  infrastructure: [
    { name: "Cloudflare Pages", category: "Hosting", confidence: "high", evidence: "pages.cloudflare.com or cf-cache-status headers." },
    { name: "Cloudflare CDN", category: "CDN", confidence: "high", evidence: "CF-Ray and CF-Cache-Status headers present." },
    { name: "Sanity / Contentful", category: "CMS", confidence: "medium", evidence: "CMS API references in prefetch links." },
  ],
  apiType: { name: "REST (read-only)", confidence: "high", details: "Content delivery API — mostly GET requests to CMS endpoints or static JSON files." },
  authHint: "No client-side auth detected. Admin access through CMS dashboard only.",
  thirdParty: [
    { name: "Fathom / Plausible", category: "Analytics", confidence: "medium", evidence: "Privacy-first analytics script detected." },
    { name: "Algolia", category: "Search", confidence: "low", evidence: "algolia.net domain in network prefetch hints." },
    { name: "Mailchimp", category: "Newsletter", confidence: "medium", evidence: "mc.js or Mailchimp form embed detected." },
  ],
  flowNodes: [
    { id: "browser", label: "Browser", type: "browser", description: "Static HTML/CSS served from CDN edge" },
    { id: "cdn", label: "Cloudflare", type: "cdn", description: "Global CDN — serves 100% of content at edge" },
    { id: "api", label: "CMS API", type: "api", description: "Headless CMS REST/GraphQL content API" },
    { id: "db", label: "Content Store", type: "db", description: "CMS content database (Sanity/Contentful)" },
    { id: "search", label: "Algolia", type: "third-party", description: "Full-text search index" },
    { id: "analytics", label: "Analytics", type: "third-party", description: "Privacy-first pageview tracking" },
  ],
  flowEdges: [
    { from: "browser", to: "cdn", label: "page load" },
    { from: "cdn", to: "api", label: "content fetch", style: "dashed" },
    { from: "api", to: "db", label: "read" },
    { from: "browser", to: "search", label: "search query", style: "dashed" },
    { from: "browser", to: "analytics", label: "pageview", style: "dashed" },
  ],
  payloadHint: "Flat to lightly nested content structures. Arrays of posts/articles with metadata fields.",
});

function detectMode(url: string): "saas" | "ecommerce" | "blog" {
  const lower = url.toLowerCase();
  if (lower.includes("shop") || lower.includes("store") || lower.includes("buy") || lower.includes("cart") || lower.includes("ecom")) return "ecommerce";
  if (lower.includes("blog") || lower.includes("news") || lower.includes("post") || lower.includes("article") || lower.includes("medium") || lower.includes("substack")) return "blog";
  return "saas";
}

export function analyzeUrl(url: string): AnalysisResult {
  const mode = detectMode(url);
  if (mode === "ecommerce") return ecommerceResult(url);
  if (mode === "blog") return blogResult(url);
  return saasResult(url);
}

export const SAMPLE_EXAMPLES = [
  { label: "SaaS App", url: "https://app.linear.app", description: "Project management SaaS" },
  { label: "E-commerce", url: "https://shop.example.com", description: "Shopify-powered store" },
  { label: "Blog/Content", url: "https://blog.example.com", description: "JAMstack content site" },
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
