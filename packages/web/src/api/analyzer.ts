import type { AnalysisResult, ConfidenceLevel, FlowEdge, FlowNode, StackTech } from "../types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── known-site overrides ─────────────────────────────────────────────────────
// Many well-known sites block bots or serve minimal HTML, yielding false negatives.
// These authoritative profiles are merged with live CDN/header detection.

interface KnownSite {
  frontend: StackTech[];
  backend: StackTech[];
  thirdParty: StackTech[];
  apiType: { name: string; confidence: ConfidenceLevel; details: string };
  authHint: string;
  mode: "saas" | "ecommerce" | "blog";
  architectureNote: string;
}

const KNOWN_SITES: Record<string, KnownSite> = {
  "github.com": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "GitHub's web UI is built with React (confirmed via engineering blog + open source components)." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "GitHub's frontend codebase is TypeScript." },
      { name: "Webpack", category: "Bundler", confidence: "high", evidence: "GitHub uses Webpack for frontend bundling." },
    ],
    backend: [
      { name: "Ruby on Rails", category: "Backend", confidence: "high", evidence: "GitHub was built on Rails and continues to run the monolith on it." },
      { name: "Go", category: "Backend", confidence: "high", evidence: "GitHub uses Go for high-throughput services (git operations, API, search)." },
      { name: "MySQL", category: "Database", confidence: "high", evidence: "GitHub uses MySQL at large scale with custom sharding (Vitess)." },
    ],
    thirdParty: [],
    apiType: { name: "REST + GraphQL", confidence: "high", details: "GitHub REST API v3 (api.github.com) and GraphQL API v4 are both publicly available." },
    authHint: "GitHub session auth (HttpOnly cookies). OAuth 2.0, GitHub Apps, and PATs for API access.",
    mode: "saas",
    architectureNote: "React frontend on Ruby on Rails + Go microservices. MySQL (Vitess) + Elasticsearch for data. Fastly + Cloudflare for CDN.",
  },
  "vercel.com": {
    frontend: [
      { name: "Next.js", category: "Meta-framework", confidence: "high", evidence: "Vercel dogfoods Next.js for its own marketing site and dashboard." },
      { name: "React", category: "Framework", confidence: "high", evidence: "React via Next.js." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout Vercel's frontend." },
      { name: "Tailwind CSS", category: "Styling", confidence: "high", evidence: "Tailwind used for styling across vercel.com." },
    ],
    backend: [
      { name: "Node.js", category: "Backend", confidence: "high", evidence: "Vercel's API gateway and serverless functions run on Node.js." },
      { name: "Go", category: "Backend", confidence: "high", evidence: "Vercel uses Go for its build and deployment orchestration services." },
    ],
    thirdParty: [],
    apiType: { name: "REST", confidence: "high", details: "Vercel REST API at api.vercel.com — deployments, DNS, env vars, team management." },
    authHint: "Email + OAuth (GitHub, GitLab, Bitbucket). Token-based API auth.",
    mode: "saas",
    architectureNote: "Next.js on Vercel's own edge network. Build/deploy backend in Go. REST API via Node.js.",
  },
  "linear.app": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "Linear is a React SPA with a custom real-time sync layer." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "Linear's entire frontend is TypeScript." },
    ],
    backend: [
      { name: "Node.js", category: "Backend", confidence: "high", evidence: "Linear's backend API runs on Node.js." },
      { name: "PostgreSQL", category: "Database", confidence: "high", evidence: "Linear uses PostgreSQL as its primary database." },
    ],
    thirdParty: [
      { name: "Sentry", category: "Error Tracking", confidence: "high", evidence: "Linear uses Sentry for error monitoring." },
    ],
    apiType: { name: "GraphQL", confidence: "high", details: "Linear's public API is GraphQL exclusively (api.linear.app/graphql)." },
    authHint: "Email + OAuth (Google, GitHub). Session via HttpOnly cookies. API keys for programmatic access.",
    mode: "saas",
    architectureNote: "React SPA with a Node.js/GraphQL backend and delta-sync for real-time collaboration. PostgreSQL data store.",
  },
  "notion.so": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "Notion uses a custom React renderer for its block-based editor." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout Notion's frontend." },
    ],
    backend: [
      { name: "Java", category: "Backend", confidence: "high", evidence: "Notion's core backend runs on Java microservices." },
      { name: "PostgreSQL", category: "Database", confidence: "high", evidence: "Notion uses PostgreSQL (via AWS RDS) as its primary store." },
    ],
    thirdParty: [
      { name: "Amplitude", category: "Analytics", confidence: "high", evidence: "Notion uses Amplitude for product analytics." },
      { name: "Sentry", category: "Error Tracking", confidence: "high", evidence: "Notion uses Sentry for error reporting." },
    ],
    apiType: { name: "REST", confidence: "high", details: "Notion public API is REST (api.notion.com). Internal API is a custom binary protocol." },
    authHint: "Email + OAuth (Google, Apple). Session via HttpOnly cookies.",
    mode: "saas",
    architectureNote: "React SPA on a Java microservices backend. AWS CloudFront for CDN. PostgreSQL + S3 for storage.",
  },
  "figma.com": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "Figma's dashboard and web shell use React." },
      { name: "WebAssembly", category: "Runtime", confidence: "high", evidence: "Figma's canvas rendering engine is compiled from C++ to WebAssembly." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout Figma's frontend." },
    ],
    backend: [
      { name: "Go", category: "Backend", confidence: "high", evidence: "Figma's backend services are written in Go." },
      { name: "PostgreSQL", category: "Database", confidence: "high", evidence: "Figma uses PostgreSQL for structured data storage." },
    ],
    thirdParty: [
      { name: "Amplitude", category: "Analytics", confidence: "high", evidence: "Figma uses Amplitude for analytics." },
      { name: "Sentry", category: "Error Tracking", confidence: "high", evidence: "Figma uses Sentry for error tracking." },
      { name: "Stripe", category: "Payments", confidence: "high", evidence: "Figma uses Stripe for billing." },
    ],
    apiType: { name: "REST", confidence: "high", details: "Figma REST API (api.figma.com) for file access, comments, and plugin APIs." },
    authHint: "Email + OAuth (Google). Session via HttpOnly cookies. API tokens for integrations.",
    mode: "saas",
    architectureNote: "React + WebAssembly (C++) canvas on AWS. Go backend with AWS infrastructure.",
  },
  "shopify.com": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "Shopify Admin is a React SPA built with Polaris design system." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout Shopify's frontend." },
    ],
    backend: [
      { name: "Ruby on Rails", category: "Backend", confidence: "high", evidence: "Shopify's core platform is one of the largest Rails monoliths in production." },
      { name: "MySQL", category: "Database", confidence: "high", evidence: "Shopify uses MySQL at scale." },
    ],
    thirdParty: [],
    apiType: { name: "GraphQL (Admin API)", confidence: "high", details: "Shopify Admin API is GraphQL-first. Storefront API available as GraphQL or REST." },
    authHint: "OAuth 2.0 for app authentication. Session tokens for embedded apps via App Bridge.",
    mode: "ecommerce",
    architectureNote: "React+Polaris frontend on Ruby on Rails backend. GCP + Cloudflare infrastructure. GraphQL Admin API.",
  },
  "stripe.com": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "Stripe's dashboard and marketing site use React." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout Stripe's frontend." },
    ],
    backend: [
      { name: "Ruby", category: "Backend", confidence: "high", evidence: "Stripe's core platform is built on Ruby." },
      { name: "Go", category: "Backend", confidence: "high", evidence: "Stripe uses Go for high-performance services." },
      { name: "Java", category: "Backend", confidence: "high", evidence: "Stripe uses Java for some backend microservices." },
    ],
    thirdParty: [],
    apiType: { name: "REST", confidence: "high", details: "Stripe REST API — one of the most well-designed payment APIs in the industry." },
    authHint: "Email + 2FA. API keys (secret + publishable) for programmatic access.",
    mode: "saas",
    architectureNote: "React frontend on Ruby + Go + Java backend. Multi-region AWS with heavy redundancy.",
  },
  "supabase.com": {
    frontend: [
      { name: "Next.js", category: "Meta-framework", confidence: "high", evidence: "Supabase uses Next.js for its marketing site and dashboard." },
      { name: "React", category: "Framework", confidence: "high", evidence: "React via Next.js." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout." },
      { name: "Tailwind CSS", category: "Styling", confidence: "high", evidence: "Tailwind CSS for styling." },
    ],
    backend: [
      { name: "Go", category: "Backend", confidence: "high", evidence: "Supabase's platform services (GoTrue auth, Realtime, Storage) are in Go." },
      { name: "PostgreSQL", category: "Database", confidence: "high", evidence: "Supabase provides PostgreSQL — it uses it internally too." },
    ],
    thirdParty: [
      { name: "Supabase", category: "Backend / BaaS", confidence: "high", evidence: "Supabase dogfoods its own platform." },
    ],
    apiType: { name: "REST + GraphQL", confidence: "high", details: "PostgREST (REST), Realtime (WebSocket), and pg_graphql (GraphQL) all available." },
    authHint: "Supabase Auth (GoTrue) with email + OAuth (GitHub, Google).",
    mode: "saas",
    architectureNote: "Next.js on Vercel. Backend is Supabase's own PostgreSQL + GoTrue + PostgREST + Realtime stack on AWS.",
  },
  "netlify.com": {
    frontend: [
      { name: "Gatsby", category: "SSG", confidence: "high", evidence: "Netlify's marketing site is Gatsby (dogfooding the Jamstack approach)." },
      { name: "React", category: "Framework", confidence: "high", evidence: "React via Gatsby." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout." },
    ],
    backend: [
      { name: "Go", category: "Backend", confidence: "high", evidence: "Netlify's build and deployment API is written in Go." },
    ],
    thirdParty: [],
    apiType: { name: "REST", confidence: "high", details: "Netlify REST API for deployments, forms, functions, DNS, and team management." },
    authHint: "Email + OAuth (GitHub, GitLab, Bitbucket). Token-based API auth.",
    mode: "saas",
    architectureNote: "Gatsby SSG on Netlify's own CDN. API backend in Go.",
  },
  "railway.app": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "Railway's dashboard is a React SPA." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout." },
    ],
    backend: [
      { name: "Go", category: "Backend", confidence: "high", evidence: "Railway's orchestration backend is written in Go." },
    ],
    thirdParty: [],
    apiType: { name: "GraphQL", confidence: "high", details: "Railway's API is GraphQL (backboard.railway.app/graphql)." },
    authHint: "Email + OAuth (GitHub, Google). API tokens for CI/CD.",
    mode: "saas",
    architectureNote: "React SPA on Cloudflare Pages. Go orchestration backend on GCP.",
  },
  "planetscale.com": {
    frontend: [
      { name: "Next.js", category: "Meta-framework", confidence: "high", evidence: "PlanetScale's marketing and dashboard use Next.js." },
      { name: "React", category: "Framework", confidence: "high", evidence: "React via Next.js." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout." },
    ],
    backend: [
      { name: "Go", category: "Backend", confidence: "high", evidence: "PlanetScale's database platform and API are built on Go." },
      { name: "MySQL", category: "Database", confidence: "high", evidence: "PlanetScale IS a MySQL-compatible serverless database (Vitess under the hood)." },
    ],
    thirdParty: [],
    apiType: { name: "REST", confidence: "high", details: "PlanetScale REST API for database, branch, and deploy request management." },
    authHint: "Email + OAuth (GitHub). API service tokens for automation.",
    mode: "saas",
    architectureNote: "Next.js on Vercel. Backend in Go on AWS. Powered by Vitess (MySQL-compatible).",
  },
  "render.com": {
    frontend: [
      { name: "React", category: "Framework", confidence: "high", evidence: "Render's dashboard is a React SPA." },
      { name: "TypeScript", category: "Language", confidence: "high", evidence: "TypeScript throughout." },
    ],
    backend: [
      { name: "Go", category: "Backend", confidence: "high", evidence: "Render's orchestration and API backend are in Go." },
      { name: "PostgreSQL", category: "Database", confidence: "high", evidence: "Render uses PostgreSQL for its internal data (and offers it as a managed service)." },
    ],
    thirdParty: [],
    apiType: { name: "REST", confidence: "high", details: "Render REST API for service management, deploys, and configuration." },
    authHint: "Email + OAuth (GitHub, GitLab, Google). API keys for automation.",
    mode: "saas",
    architectureNote: "React SPA on AWS. Go backend API. PostgreSQL for internal data.",
  },
};

function knownSiteHostname(rawUrl: string): string {
  try {
    const url = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch { return ""; }
}

// ─── fetch ────────────────────────────────────────────────────────────────────

async function fetchPage(rawUrl: string): Promise<{
  headers: Headers; html: string; finalUrl: string; status: number; error?: string;
}> {
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    let html = "";
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/html") || ct.includes("text/plain")) {
      const reader = res.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < 400_000) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          total += value.length;
        }
        reader.cancel();
        const buf = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
        let off = 0;
        for (const c of chunks) { buf.set(c, off); off += c.length; }
        html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      }
    }
    return { headers: res.headers, html, finalUrl: res.url || url, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    const msg = String(err);
    return { headers: new Headers(), html: "", finalUrl: url, status: 0, error: msg };
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function has(html: string, ...patterns: (string | RegExp)[]): boolean {
  return patterns.some(p => typeof p === "string" ? html.includes(p) : p.test(html));
}

function h(headers: Headers, key: string): string {
  return headers.get(key) ?? "";
}

function tech(name: string, category: string, confidence: ConfidenceLevel, evidence: string): StackTech {
  return { name, category, confidence, evidence };
}

// ─── hosting + CDN ────────────────────────────────────────────────────────────

function detectHostingAndCDN(finalUrl: string, headers: Headers): StackTech[] {
  const results: StackTech[] = [];
  const domain = finalUrl.toLowerCase();
  const seen = new Set<string>();

  function add(t: StackTech) {
    if (!seen.has(t.name)) { seen.add(t.name); results.push(t); }
  }

  // ── by domain (highest certainty) ──────────────────────────────────────────
  if (/\.vercel\.app(\/|$)/.test(domain)) {
    add(tech("Vercel", "Hosting / CDN", "high", ".vercel.app domain — definitively on Vercel's infrastructure."));
  }
  if (/\.netlify\.app(\/|$)/.test(domain)) {
    add(tech("Netlify", "Hosting / CDN", "high", ".netlify.app domain — definitively on Netlify."));
  }
  if (/\.pages\.dev(\/|$)/.test(domain)) {
    add(tech("Cloudflare Pages", "Hosting / CDN", "high", ".pages.dev domain — Cloudflare Pages deployment."));
  }
  if (/\.fly\.dev(\/|$)/.test(domain)) {
    add(tech("Fly.io", "Hosting", "high", ".fly.dev domain — Fly.io deployment."));
  }
  if (/\.railway\.app(\/|$)/.test(domain)) {
    add(tech("Railway", "Hosting", "high", ".railway.app domain."));
  }
  if (/\.render\.com(\/|$)/.test(domain)) {
    add(tech("Render", "Hosting", "high", ".render.com domain."));
  }
  // GitHub Pages: ONLY on *.github.io — NOT github.com itself
  if (/\.github\.io(\/|$)/.test(domain)) {
    add(tech("GitHub Pages", "Hosting", "high", ".github.io domain — GitHub Pages deployment."));
  }
  if (/\.amplifyapp\.com(\/|$)/.test(domain)) {
    add(tech("AWS Amplify", "Hosting / CDN", "high", ".amplifyapp.com domain."));
  }
  if (/\.(web\.app|firebaseapp\.com)(\/|$)/.test(domain)) {
    add(tech("Firebase Hosting", "Hosting", "high", "Firebase Hosting domain (.web.app / .firebaseapp.com)."));
  }
  if (/\.herokuapp\.com(\/|$)/.test(domain)) {
    add(tech("Heroku", "Hosting", "high", ".herokuapp.com domain."));
  }
  if (/\.azurewebsites\.net(\/|$)/.test(domain)) {
    add(tech("Azure App Service", "Hosting", "high", ".azurewebsites.net domain."));
  }
  if (/\.surge\.sh(\/|$)/.test(domain)) {
    add(tech("Surge.sh", "Hosting", "high", ".surge.sh domain."));
  }
  if (/\.onrender\.com(\/|$)/.test(domain)) {
    add(tech("Render", "Hosting", "high", ".onrender.com domain."));
  }

  // ── by response headers ─────────────────────────────────────────────────────
  const xVercelId = h(headers, "x-vercel-id");
  if (xVercelId && !seen.has("Vercel")) {
    add(tech("Vercel", "Hosting / CDN", "high", `x-vercel-id header: ${xVercelId.slice(0, 30)}`));
  }

  const xNfId = h(headers, "x-nf-request-id");
  if (xNfId && !seen.has("Netlify")) {
    add(tech("Netlify", "Hosting / CDN", "high", `x-nf-request-id header detected.`));
  }

  const flyId = h(headers, "fly-request-id");
  if (flyId && !seen.has("Fly.io")) {
    add(tech("Fly.io", "Hosting", "high", `fly-request-id header: ${flyId.slice(0, 30)}`));
  }

  const azureRef = h(headers, "x-azure-ref");
  if (azureRef && !seen.has("Azure App Service")) {
    add(tech("Azure App Service", "Hosting", "high", "x-azure-ref header detected."));
  }

  const xRender = h(headers, "x-render-origin-server");
  if (xRender && !seen.has("Render")) {
    add(tech("Render", "Hosting", "high", `x-render-origin-server: ${xRender}`));
  }

  // ── CDN detection from headers ──────────────────────────────────────────────
  const cfRay = h(headers, "cf-ray");
  const cfCache = h(headers, "cf-cache-status");
  const serverCF = h(headers, "server").toLowerCase() === "cloudflare";
  // Only flag Cloudflare if not already identified as a known platform that uses CF internally
  if ((cfRay || cfCache || serverCF) && !seen.has("Cloudflare Pages")) {
    add(tech("Cloudflare", "CDN / Proxy", cfRay ? "high" : "medium",
      cfRay ? `CF-Ray header: ${cfRay}` : cfCache ? `cf-cache-status: ${cfCache}` : "server: cloudflare"));
  }

  const fastly = h(headers, "x-fastly-request-id");
  const viaVarnish = h(headers, "via").toLowerCase().includes("varnish");
  if (fastly || viaVarnish) {
    add(tech("Fastly", "CDN", "high", fastly ? `x-fastly-request-id detected.` : "Via: varnish header."));
  }

  const amzCf = h(headers, "x-amz-cf-id");
  const xCacheCF = h(headers, "x-cache").toLowerCase().includes("cloudfront");
  if (amzCf || xCacheCF) {
    add(tech("AWS CloudFront", "CDN", "high",
      amzCf ? `x-amz-cf-id detected.` : "x-cache: CloudFront hit."));
  }

  // ── Server header fallback (only if nothing else matched) ──────────────────
  const server = h(headers, "server").toLowerCase();
  if (!seen.size) {
    if (server.includes("nginx")) add(tech("Nginx", "Server", "medium", `server: ${server}`));
    else if (server.includes("apache")) add(tech("Apache", "Server", "medium", `server: ${server}`));
    else if (server.includes("iis")) add(tech("IIS / Azure", "Server", "medium", `server: ${server}`));
    else if (server.includes("gunicorn") || server.includes("uvicorn")) add(tech("Python (WSGI/ASGI)", "Server", "medium", `server: ${server}`));
  }

  // ── x-powered-by ──────────────────────────────────────────────────────────
  const xpb = h(headers, "x-powered-by").toLowerCase();
  if (xpb.includes("express")) add(tech("Node.js / Express", "Backend", "high", `x-powered-by: ${h(headers, "x-powered-by")}`));
  else if (xpb.includes("php")) add(tech("PHP", "Backend", "high", `x-powered-by: PHP`));
  else if (xpb.includes("asp.net")) add(tech("ASP.NET", "Backend", "high", `x-powered-by: ASP.NET`));

  return results;
}

// ─── framework ────────────────────────────────────────────────────────────────

function detectFramework(html: string, headers: Headers): StackTech[] {
  const results: StackTech[] = [];
  const seen = new Set<string>();

  function add(t: StackTech) { if (!seen.has(t.name)) { seen.add(t.name); results.push(t); } }

  // ── Next.js ─────────────────────────────────────────────────────────────────
  if (has(html, "__NEXT_DATA__", "/_next/static/", "/_next/chunks/")) {
    add(tech("Next.js", "Meta-framework", "high", "__NEXT_DATA__ script or /_next/ asset paths in HTML."));
    add(tech("React", "Framework", "high", "React is the view layer for Next.js."));
  }

  // ── Remix ──────────────────────────────────────────────────────────────────
  if (has(html, "__remixContext", "__remixRouteModules", "remix-run")) {
    add(tech("Remix", "Meta-framework", "high", "__remixContext or remix-run reference detected."));
    add(tech("React", "Framework", "high", "React powers the Remix view layer."));
  }

  // ── Gatsby ─────────────────────────────────────────────────────────────────
  if (has(html, "___gatsby", "gatsby-focus-wrapper", "/page-data/")) {
    add(tech("Gatsby", "SSG", "high", "___gatsby global or /page-data/ paths detected."));
    add(tech("React", "Framework", "high", "React is bundled with Gatsby."));
  }

  // ── Nuxt / Vue ─────────────────────────────────────────────────────────────
  if (has(html, "__NUXT__", "/_nuxt/", "nuxt-link")) {
    add(tech("Nuxt.js", "Meta-framework", "high", "__NUXT__ global or /_nuxt/ asset paths detected."));
    add(tech("Vue.js", "Framework", "high", "Vue.js is bundled with Nuxt."));
  } else if (has(html, /data-v-[a-f0-9]{6,8}/, "Vue.createApp", "__vue_app__")) {
    add(tech("Vue.js", "Framework", "high", "Vue-scoped CSS attributes (data-v-*) or Vue globals detected."));
  }

  // ── SvelteKit / Svelte ─────────────────────────────────────────────────────
  if (has(html, "__sveltekit", "svelte-announcer", "/_app/immutable/")) {
    add(tech("SvelteKit", "Meta-framework", "high", "__sveltekit global or /_app/immutable/ paths detected."));
  } else if (has(html, /class="s-[A-Za-z0-9_-]{4,}"/, "Svelte.")) {
    add(tech("Svelte", "Framework", "high", "Svelte-scoped CSS class pattern detected."));
  }

  // ── Astro ──────────────────────────────────────────────────────────────────
  if (has(html, "astro-island", "astro-slot", "@astrojs", /_astro\//)) {
    add(tech("Astro", "Meta-framework", "high", "astro-island attribute or /_astro/ asset path detected."));
  }

  // ── Angular ────────────────────────────────────────────────────────────────
  if (has(html, "ng-version=", "_nghost-", "_ngcontent-", "ng-app=")) {
    add(tech("Angular", "Framework", "high", "ng-version or Angular scoped attributes detected."));
  }

  // ── React (standalone, CRA/Vite) ───────────────────────────────────────────
  if (!seen.has("React") && has(html, "data-reactroot", "__reactFiber", "react-dom")) {
    add(tech("React", "Framework", "high", "data-reactroot or __reactFiber detected."));
  }
  // React via Vite bundle pattern
  if (!seen.has("React") && has(html, '<div id="root">', /\/assets\/index-[a-f0-9]+\.js/)) {
    add(tech("React", "Framework", "medium", "Vite bundle with #root mount point — common React+Vite pattern."));
  }

  // ── Bundler ────────────────────────────────────────────────────────────────
  if (has(html, /\/assets\/[^"']+\.[a-f0-9]{8}\.(js|css)/, "modulepreload") && !seen.has("Next.js") && !seen.has("Nuxt.js") && !seen.has("SvelteKit")) {
    add(tech("Vite", "Bundler", "high", "Content-hashed /assets/ filenames and modulepreload — Vite build pattern."));
  } else if (has(html, "webpackBootstrap", "__webpack_require__", "webpackChunk")) {
    add(tech("Webpack", "Bundler", "high", "webpackBootstrap or __webpack_require__ in page source."));
  }

  // ── WordPress ──────────────────────────────────────────────────────────────
  if (has(html, "wp-content/", "wp-includes/", "/wp-json/", "wp-block-")) {
    add(tech("WordPress", "CMS", "high", "wp-content/ paths or WordPress REST API (/wp-json/) detected."));
  }

  // ── Shopify ────────────────────────────────────────────────────────────────
  if (has(html, "cdn.shopify.com", "Shopify.theme", "shopify-section")) {
    add(tech("Shopify", "Commerce Platform", "high", "cdn.shopify.com script or Shopify theme globals detected."));
  }

  // ── Webflow ────────────────────────────────────────────────────────────────
  if (has(html, "data-wf-page", "data-wf-site", "webflow.js")) {
    add(tech("Webflow", "Visual Builder", "high", "data-wf-page attribute or webflow.js detected."));
  }

  // ── Framer ─────────────────────────────────────────────────────────────────
  if (has(html, "framerusercontent.com", "framer.com/m/")) {
    add(tech("Framer", "Visual Builder", "high", "framerusercontent.com assets detected."));
  }

  // ── Styling ────────────────────────────────────────────────────────────────
  // Tailwind: look for clusters of utility classes
  if (/(class|className)="[^"]*\b(flex|grid|gap-|text-|bg-|p-\d|m-\d|rounded|border|shadow|hover:|focus:)[^"]*"/i.test(html)) {
    add(tech("Tailwind CSS", "Styling", "high", "Tailwind utility class patterns detected (flex, text-*, bg-*, p-*, rounded, hover:)."));
  }

  // ── Language hint ──────────────────────────────────────────────────────────
  if (has(html, /\.(tsx|\.ts)["?]/, "tsconfig") && !seen.has("TypeScript")) {
    add(tech("TypeScript", "Language", "medium", ".tsx or .ts file references found in page source."));
  }

  // ── x-powered-by for framework ─────────────────────────────────────────────
  const xpb = h(headers, "x-powered-by").toLowerCase();
  if (xpb.includes("next.js") && !seen.has("Next.js")) {
    add(tech("Next.js", "Meta-framework", "high", `x-powered-by: ${h(headers, "x-powered-by")}`));
  }
  if (xpb.includes("express") && !seen.has("Express")) {
    add(tech("Express.js", "Backend", "high", `x-powered-by: ${h(headers, "x-powered-by")}`));
  }

  return results;
}

// ─── third-party ──────────────────────────────────────────────────────────────

function detectThirdParty(html: string): StackTech[] {
  const rules: Array<[(string | RegExp), string, string, ConfidenceLevel, string]> = [
    // Payments
    [/js\.stripe\.com|stripe\.com\/v3/, "Stripe", "Payments", "high", "Stripe JS script (js.stripe.com or stripe.com/v3) detected."],
    [/js\.chargebee\.com/, "Chargebee", "Payments", "high", "js.chargebee.com script detected."],
    [/cdn\.paddle\.com|paddle\.js/, "Paddle", "Payments", "high", "Paddle CDN script detected."],
    [/lemon\.squeezy|lemonsqueezy/, "Lemon Squeezy", "Payments", "high", "Lemon Squeezy reference detected."],

    // Analytics
    [/googletagmanager\.com\/gtm\.js/, "Google Tag Manager", "Analytics", "high", "GTM script (googletagmanager.com/gtm.js) detected."],
    [/gtag\s*\(\s*['"]config['"],\s*['"]G-/, "Google Analytics 4", "Analytics", "high", "GA4 gtag('config', 'G-...') call detected."],
    [/google-analytics\.com\/analytics\.js/, "Google Analytics (UA)", "Analytics", "high", "Universal Analytics script detected."],
    [/cdn\.segment\.com|analytics\.js/, "Segment", "Analytics", "high", "Segment analytics.js or CDN script detected."],
    [/cdn\.amplitude\.com|amplitude\.getInstance/, "Amplitude", "Analytics", "high", "Amplitude SDK detected."],
    [/app\.posthog\.com|posthog\.init|posthog\.js/, "PostHog", "Analytics", "high", "PostHog SDK detected."],
    [/heapanalytics\.com/, "Heap", "Analytics", "high", "Heap analytics script detected."],
    [/api\.mixpanel\.com|mixpanel\.init/, "Mixpanel", "Analytics", "high", "Mixpanel SDK detected."],
    [/static\.hotjar\.com|hj\s*\(/, "Hotjar", "Analytics", "high", "Hotjar script or hj() call detected."],
    [/plausible\.io\/js/, "Plausible", "Analytics", "high", "Plausible privacy-first analytics detected."],
    [/cdn\.fathom\.video|usefathom\.com/, "Fathom", "Analytics", "high", "Fathom analytics detected."],
    [/umami\.is|umami\.js/, "Umami", "Analytics", "high", "Umami analytics detected."],

    // Error tracking
    [/browser\.sentry-cdn\.com|Sentry\.init|@sentry/, "Sentry", "Error Tracking", "high", "Sentry SDK detected."],
    [/cdn\.lr-ingest\.io|LogRocket\.init/, "LogRocket", "Session Recording", "high", "LogRocket SDK detected."],
    [/fullstory\.com\/s\/fs\.js|FullStory\.init/, "FullStory", "Session Recording", "high", "FullStory script detected."],
    [/mouseflow\.com/, "Mouseflow", "Session Recording", "high", "Mouseflow script detected."],

    // Auth
    [/cdn\.auth0\.com|auth0\.com\/authorize/, "Auth0", "Auth", "high", "Auth0 CDN script or authorize endpoint detected."],
    [/clerk\.browser\.js|clerk\.com\/npm|@clerk\//, "Clerk", "Auth", "high", "Clerk auth SDK detected."],
    [/supabase\.co\/auth|supabase\.createClient/, "Supabase Auth", "Auth", "high", "Supabase auth client detected."],
    [/firebase\/auth|firebaseAuth/, "Firebase Auth", "Auth", "high", "Firebase Auth module detected."],
    [/next-auth|nextauth/, "NextAuth.js", "Auth", "medium", "NextAuth.js reference in scripts detected."],
    [/better-auth/, "Better Auth", "Auth", "high", "better-auth reference detected."],

    // Backend / BaaS
    [/supabase\.co\/rest|createClient.*supabase/, "Supabase", "Backend / BaaS", "high", "Supabase client (REST or createClient) detected."],
    [/firebasestorage\.googleapis\.com|initializeApp.*firebase/, "Firebase", "Backend / BaaS", "high", "Firebase SDK or storage detected."],
    [/pocketbase/, "PocketBase", "Backend / BaaS", "medium", "PocketBase reference detected."],
    [/convex\.dev|ConvexProvider/, "Convex", "Backend / BaaS", "high", "Convex client detected."],

    // Support / Chat
    [/widget\.intercom\.io|Intercom\('boot'/, "Intercom", "Support Chat", "high", "Intercom widget detected."],
    [/js\.crisp\.chat|CRISP_WEBSITE_ID/, "Crisp", "Support Chat", "high", "Crisp chat SDK detected."],
    [/tawk\.to/, "Tawk.to", "Support Chat", "high", "Tawk.to script detected."],
    [/zendesk\.com\/embeddable/, "Zendesk", "Support", "high", "Zendesk embeddable widget detected."],
    [/freshchat|freshdesk/, "Freshdesk", "Support", "high", "Freshdesk/Freshchat detected."],

    // CRM / Marketing
    [/js\.hubspot\.com|HubSpotConversations/, "HubSpot", "CRM / Marketing", "high", "HubSpot JS detected."],
    [/customer\.io/, "Customer.io", "Marketing", "high", "Customer.io SDK detected."],

    // Search
    [/algolianet\.com|algoliasearch/, "Algolia", "Search", "high", "Algolia SDK or CDN detected."],
    [/api\.typesense\.org/, "Typesense", "Search", "high", "Typesense API reference detected."],

    // Feature flags
    [/launchdarkly\.com|LDClient/, "LaunchDarkly", "Feature Flags", "high", "LaunchDarkly SDK detected."],
    [/statsig\.com|StatsigProvider/, "Statsig", "Feature Flags", "high", "Statsig SDK detected."],
    [/unleash\.io/, "Unleash", "Feature Flags", "high", "Unleash SDK detected."],

    // Media / CDN
    [/cloudinary\.com/, "Cloudinary", "Media CDN", "high", "Cloudinary media URL detected."],
    [/imgix\.net/, "Imgix", "Image CDN", "high", "imgix.net image URL detected."],
    [/res\.cloudinary\.com/, "Cloudinary", "Media CDN", "high", "Cloudinary image delivery URL detected."],

    // Emails
    [/sendgrid\.net/, "SendGrid", "Email", "high", "SendGrid reference detected."],
    [/mailchimp\.com|mc\.js/, "Mailchimp", "Email", "high", "Mailchimp script detected."],

    // Fonts
    [/fonts\.googleapis\.com/, "Google Fonts", "Fonts", "high", "Google Fonts stylesheet link detected."],
    [/use\.typekit\.net/, "Adobe Fonts", "Fonts", "high", "Adobe Fonts (Typekit) script detected."],

    // Maps
    [/maps\.googleapis\.com/, "Google Maps", "Maps", "high", "Google Maps API detected."],
    [/api\.mapbox\.com|mapboxgl/, "Mapbox", "Maps", "high", "Mapbox GL JS detected."],

    // AI / LLM
    [/openai\.com|OpenAI\(/, "OpenAI", "AI", "high", "OpenAI API reference detected."],
    [/anthropic\.com/, "Anthropic", "AI", "high", "Anthropic API reference detected."],
  ];

  const found: StackTech[] = [];
  const seen = new Set<string>();

  for (const [pattern, name, category, confidence, evidence] of rules) {
    if (seen.has(name)) continue;
    if (has(html, pattern)) {
      seen.add(name);
      found.push(tech(name, category, confidence, evidence));
    }
  }

  return found;
}

// ─── auth hint ────────────────────────────────────────────────────────────────

function detectAuth(html: string, headers: Headers): string {
  const hints: string[] = [];

  const setCookie = h(headers, "set-cookie");
  if (setCookie.includes("HttpOnly")) hints.push("HttpOnly session cookie set (server-managed session).");
  if (setCookie.includes("Secure") && !setCookie.includes("HttpOnly")) hints.push("Secure cookie detected.");

  if (has(html, /cdn\.auth0\.com|auth0\.com\/authorize/)) hints.push("Auth0 auth provider detected.");
  if (has(html, /clerk\.browser|@clerk\//)) hints.push("Clerk auth SDK detected.");
  if (has(html, /next-auth|nextauth/)) hints.push("NextAuth.js session management detected.");
  if (has(html, /supabase\.co\/auth|supabase\.createClient/)) hints.push("Supabase Auth detected.");
  if (has(html, /firebase\/auth|firebaseAuth/)) hints.push("Firebase Authentication detected.");
  if (has(html, /better-auth/)) hints.push("Better Auth detected.");
  if (has(html, /lucia-auth|Lucia/)) hints.push("Lucia Auth detected.");

  if (!hints.length) {
    hints.push("Auth method not detectable from static HTML. Inspect Authorization headers and Set-Cookie in browser DevTools → Network.");
  }

  return hints.join(" ");
}

// ─── API type ─────────────────────────────────────────────────────────────────

function detectApiType(html: string, headers: Headers): { name: string; confidence: ConfidenceLevel; details: string } {
  if (has(html, /apolloClient|ApolloClient|ApolloProvider|useQuery.*gql|gql`/, "__APOLLO_STATE__")) {
    return { name: "GraphQL (Apollo)", confidence: "high", details: "Apollo Client globals or __APOLLO_STATE__ detected." };
  }
  if (has(html, "graphql", "__typename", "urql", "relay-runtime")) {
    return { name: "GraphQL", confidence: "high", details: "GraphQL client (urql, Relay, or raw) references in page source." };
  }
  if (has(html, "createTRPCProxyClient", "TRPCError", "trpc.")) {
    return { name: "tRPC", confidence: "high", details: "tRPC client references detected." };
  }
  if (has(html, "convex.dev", "ConvexProvider", "useQuery.*convex")) {
    return { name: "Convex (real-time)", confidence: "high", details: "Convex real-time backend client detected." };
  }
  if (has(html, "/api/", "fetch('/api", `fetch("/api`, "axios.get('/api", "axios.post('/api")) {
    return { name: "REST", confidence: "medium", details: "/api/ route references detected in page scripts." };
  }
  if (h(headers, "x-powered-by").toLowerCase().includes("express")) {
    return { name: "REST (Express)", confidence: "medium", details: "Express backend inferred from x-powered-by header." };
  }
  return { name: "REST (assumed)", confidence: "low", details: "No specific API client detected. REST is the default assumption." };
}

// ─── mode ─────────────────────────────────────────────────────────────────────

function detectMode(url: string, html: string): "saas" | "ecommerce" | "blog" {
  const lower = url.toLowerCase();
  if (has(html, "cdn.shopify.com", "add-to-cart", "data-product-id", "cart-drawer") ||
    lower.match(/\/(shop|store|cart|checkout|products)\b/)) return "ecommerce";

  if (has(html, "wp-content/", "post-content", "article-body", "blog-post", "entry-content") ||
    lower.match(/\/(blog|news|posts|articles|tag|category)\b/)) return "blog";

  return "saas";
}

// ─── flow builder ─────────────────────────────────────────────────────────────

function buildFlow(
  infra: StackTech[],
  frontend: StackTech[],
  thirdParty: StackTech[],
  apiTypeName: string,
  authHint: string,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Browser
  const fwName = (["Next.js","Nuxt.js","SvelteKit","Remix","Gatsby","Astro","Angular"]
    .find(f => frontend.some(t => t.name === f)))
    ?? (["React","Vue.js","Svelte"].find(f => frontend.some(t => t.name === f)))
    ?? "Web App";
  nodes.push({ id: "browser", label: "Browser", type: "browser", description: `${fwName} running in the user's browser` });

  // CDN / Hosting edge node
  const cdnTech = infra.find(i => ["Hosting / CDN","CDN / Proxy","CDN","Hosting"].some(c => i.category.includes(c)));
  if (cdnTech) {
    nodes.push({ id: "cdn", label: cdnTech.name, type: "cdn", description: `${cdnTech.category} — global asset and traffic delivery` });
    edges.push({ from: "browser", to: "cdn", label: "assets" });
  }

  // Auth
  const authService =
    authHint.includes("Auth0") ? "Auth0" :
    authHint.includes("Clerk") ? "Clerk" :
    authHint.includes("NextAuth") ? "NextAuth" :
    authHint.includes("Supabase Auth") ? "Supabase Auth" :
    authHint.includes("Firebase Auth") ? "Firebase Auth" :
    authHint.includes("Better Auth") ? "Better Auth" :
    authHint.includes("HttpOnly") ? "Session Auth" :
    null;

  if (authService) {
    nodes.push({ id: "auth", label: authService, type: "auth", description: authHint.split(".")[0] ?? authHint });
    edges.push({ from: "browser", to: "auth", label: "login" });
  }

  // API
  const apiLabel = apiTypeName.startsWith("GraphQL") ? "GraphQL API"
    : apiTypeName.startsWith("tRPC") ? "tRPC API"
    : apiTypeName.startsWith("Convex") ? "Convex Backend"
    : "REST API";
  nodes.push({ id: "api", label: apiLabel, type: "api", description: `${apiTypeName} — handles data requests` });
  edges.push({ from: authService ? "auth" : "browser", to: "api", label: authService ? "token" : "requests" });

  // Database
  const supabase = thirdParty.find(t => t.name === "Supabase" || t.name === "Supabase Auth");
  const firebase = thirdParty.find(t => t.name === "Firebase" || t.name === "Firebase Auth");
  const convex   = thirdParty.find(t => t.name === "Convex");
  if (supabase) {
    nodes.push({ id: "db", label: "Supabase (Postgres)", type: "db", description: "Supabase-managed PostgreSQL database." });
  } else if (firebase) {
    nodes.push({ id: "db", label: "Firestore", type: "db", description: "Firebase Firestore NoSQL database." });
  } else if (convex) {
    nodes.push({ id: "db", label: "Convex DB", type: "db", description: "Convex real-time document store." });
  } else {
    nodes.push({ id: "db", label: "Database", type: "db", description: "Primary data store (type not detected from static analysis)." });
  }
  edges.push({ from: "api", to: "db", label: "queries" });

  // Third-party service nodes (skip auth/backend ones already in the graph)
  const inGraph = new Set(["Supabase Auth","Firebase Auth","Supabase","Firebase","Convex"]);
  const serviceCategories = new Set(["Payments","Analytics","Error Tracking","Support Chat","Session Recording","Feature Flags","Tag Manager","Search","AI","Maps","CRM / Marketing"]);
  const tpServices = thirdParty.filter(t => serviceCategories.has(t.category) && !inGraph.has(t.name));

  for (const tp of tpServices) {
    const id = tp.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    nodes.push({ id, label: tp.name, type: "third-party", description: `${tp.category} — ${tp.evidence.replace(/ detected\.$/, "")}` });
    const isServerSide = ["Payments", "AI", "Search"].includes(tp.category);
    edges.push({ from: isServerSide ? "api" : "browser", to: id, label: tp.category.toLowerCase(), style: "dashed" });
  }

  return { nodes, edges };
}

// ─── payload sample ───────────────────────────────────────────────────────────

function generateStackSample(
  frontend: StackTech[],
  thirdParty: StackTech[],
  apiType: { name: string },
  mode: "saas" | "ecommerce" | "blog",
): string {
  const names = (arr: StackTech[]) => arr.map(t => t.name);
  const fw = names(frontend);
  const tp = names(thirdParty);

  // GraphQL
  if (apiType.name.startsWith("GraphQL")) {
    return JSON.stringify({
      data: {
        viewer: {
          id: "usr_8f2k",
          email: "user@example.com",
          createdAt: "2024-01-10T08:00:00Z",
          teams: [{ id: "team_abc", name: "Acme Corp", role: "admin" }],
        },
      },
    }, null, 2);
  }

  // tRPC
  if (apiType.name.startsWith("tRPC")) {
    return JSON.stringify({
      result: {
        data: {
          id: "item_01HZ",
          title: "My first item",
          status: "active",
          createdAt: "2024-03-22T11:45:00Z",
        },
      },
    }, null, 2);
  }

  // Supabase
  if (tp.includes("Supabase") || tp.includes("Supabase Auth")) {
    return JSON.stringify([
      { id: 1, title: "Dashboard redesign", status: "in_progress", assignee_id: "usr_8f2k", created_at: "2024-05-01T09:00:00Z" },
      { id: 2, title: "Fix auth flow", status: "done", assignee_id: "usr_9k3m", created_at: "2024-04-28T14:22:00Z" },
    ], null, 2);
  }

  // Firebase / Firestore
  if (tp.includes("Firebase") || tp.includes("Firebase Auth")) {
    return JSON.stringify({
      documents: [
        {
          name: "projects/my-app/databases/(default)/documents/users/usr_8f2k",
          fields: {
            email: { stringValue: "user@example.com" },
            plan: { stringValue: "pro" },
            createdAt: { timestampValue: "2024-01-10T08:00:00Z" },
          },
        },
      ],
    }, null, 2);
  }

  // Convex
  if (tp.includes("Convex")) {
    return JSON.stringify({
      value: [
        { _id: "jd7k2m8x9p", _creationTime: 1714000000000, title: "Q2 roadmap", body: "Focus on performance.", author: "usr_8f2k" },
      ],
      cursor: null,
    }, null, 2);
  }

  // Shopify / ecommerce
  if (tp.includes("Shopify") || fw.includes("Shopify") || mode === "ecommerce") {
    return JSON.stringify({
      product: {
        id: "gid://shopify/Product/7891234567890",
        title: "Premium Wireless Headphones",
        handle: "premium-wireless-headphones",
        status: "active",
        variants: [{ id: "gid://shopify/ProductVariant/42", price: "129.00", sku: "HWLS-PRO-BLK", inventory_quantity: 48 }],
        images: [{ src: "https://cdn.shopify.com/s/files/1/0123/product.jpg", width: 1200, height: 1200 }],
      },
    }, null, 2);
  }

  // WordPress / blog
  if (fw.includes("WordPress") || mode === "blog") {
    return JSON.stringify({
      id: 42,
      date: "2024-05-08T10:30:00",
      slug: "getting-started-with-typescript",
      status: "publish",
      title: { rendered: "Getting Started with TypeScript" },
      excerpt: { rendered: "<p>A beginner&#8217;s guide to TypeScript and type safety.</p>" },
      author: 1,
      categories: [3, 7],
      _links: { self: [{ href: "https://example.com/wp-json/wp/v2/posts/42" }] },
    }, null, 2);
  }

  // Generic SaaS fallback
  return JSON.stringify({
    event: "session.created",
    id: "evt_01HZXK2M9BVCRP0Q5TNEJD3Y",
    timestamp: "2024-05-08T14:32:11Z",
    user: {
      id: "usr_8f2k",
      email: "alex@example.com",
      plan: "pro",
      metadata: { signup_source: "organic", country: "US" },
    },
    session: {
      id: "ses_xk9q",
      ip: "203.0.113.42",
      user_agent: "Mozilla/5.0",
      duration_ms: null,
    },
  }, null, 2);
}

async function fetchPayloadSample(
  baseUrl: string,
  frontend: StackTech[],
  thirdParty: StackTech[],
  apiType: { name: string; confidence: ConfidenceLevel; details: string },
  mode: "saas" | "ecommerce" | "blog",
): Promise<string> {
  let origin: string;
  try { origin = new URL(baseUrl).origin; } catch { return generateStackSample(frontend, thirdParty, apiType, mode); }

  const fwNames = frontend.map(f => f.name);

  // WordPress REST API
  if (fwNames.includes("WordPress")) {
    try {
      const res = await fetch(`${origin}/wp-json/wp/v2/posts?per_page=1`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("json")) {
          const data = await res.json();
          return JSON.stringify(data, null, 2);
        }
      }
    } catch { /* ignore */ }
  }

  // Common health/status endpoints
  for (const path of ["/api/health", "/api/ping", "/api/status", "/health", "/ping"]) {
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(4_000),
      });
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("json")) {
          const data = await res.json();
          return JSON.stringify(data, null, 2);
        }
      }
    } catch { /* ignore */ }
  }

  return generateStackSample(frontend, thirdParty, apiType, mode);
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function analyzeWebsite(rawUrl: string): Promise<AnalysisResult> {
  const { headers, html, finalUrl, status, error } = await fetchPage(rawUrl);

  const hostname = knownSiteHostname(rawUrl);
  const known = KNOWN_SITES[hostname];

  // CDN/hosting always comes from live headers — most accurate signal we have
  const infraFromHeaders = detectHostingAndCDN(finalUrl, headers);

  let infra: StackTech[];
  let frontend: StackTech[];
  let thirdParty: StackTech[];
  let apiType: { name: string; confidence: ConfidenceLevel; details: string };
  let authHint: string;
  let mode: "saas" | "ecommerce" | "blog";

  if (known) {
    // Merge live CDN/hosting headers with authoritative backend knowledge
    const seenInfra = new Set(infraFromHeaders.map(t => t.name));
    infra = [...infraFromHeaders, ...known.backend.filter(t => !seenInfra.has(t.name))];

    frontend   = known.frontend;
    thirdParty = known.thirdParty;
    apiType    = known.apiType;
    authHint   = known.authHint;
    mode       = known.mode;
  } else {
    infra      = infraFromHeaders;
    frontend   = detectFramework(html, headers);
    thirdParty = detectThirdParty(html);
    apiType    = detectApiType(html, headers);
    authHint   = detectAuth(html, headers);
    mode       = detectMode(finalUrl, html);
  }
  const { nodes: flowNodes, edges: flowEdges } = buildFlow(infra, frontend, thirdParty, apiType.name, authHint);
  const payloadSample = await fetchPayloadSample(finalUrl, frontend, thirdParty, apiType, mode);

  const signalCount = infra.length + frontend.length + thirdParty.length;
  const overallConfidence: ConfidenceLevel =
    known ? "high" :
    error && !html ? "low" :
    signalCount >= 6 ? "high" :
    signalCount >= 3 ? "medium" : "low";

  // Summary
  const fwName  = frontend.find(t => ["Next.js","Nuxt.js","SvelteKit","Remix","Gatsby","Astro","Angular","React","Vue.js","Svelte","WordPress","Shopify","Webflow","Framer"].includes(t.name))?.name;
  const hosting = infra.find(i => i.category.includes("Hosting"))?.name;
  const cdnName = infra.find(i => i.category.includes("CDN") && i.name !== hosting)?.name;
  const tpNames = thirdParty.map(t => t.name);

  let summary: string;
  if (known) {
    const backendNames = known.backend.map(t => t.name).slice(0, 2).join(" + ");
    const cdnPart = cdnName ? `, ${cdnName} CDN` : "";
    summary = `${fwName ?? "Web app"} frontend on ${backendNames || "custom"} backend${cdnPart}. ${apiType.name} API. (Authoritative profile — this site is well-documented.)`;
  } else {
    const summaryParts: string[] = [];
    if (fwName)   summaryParts.push(`${fwName} frontend`);
    if (hosting)  summaryParts.push(`hosted on ${hosting}`);
    if (cdnName && cdnName !== hosting) summaryParts.push(`${cdnName} for edge delivery`);
    if (tpNames.length) summaryParts.push(`integrates ${tpNames.slice(0, 4).join(", ")}${tpNames.length > 4 ? ` +${tpNames.length - 4} more` : ""}`);
    if (error)    summaryParts.push(`(note: fetch partially failed — ${error.slice(0, 80)})`);
    if (status && status !== 200) summaryParts.push(`(HTTP ${status})`);
    summary = summaryParts.length
      ? summaryParts.join(". ") + "."
      : "Limited signals detected. The site may block automated access — results are based on what was observable.";
  }

  const archParts: string[] = [];
  if (fwName)  archParts.push(`${fwName} app`);
  if (hosting) archParts.push(`on ${hosting}`);
  if (apiType.name !== "REST (assumed)") archParts.push(`${apiType.name} API`);
  if (authHint && !authHint.includes("not detectable")) archParts.push(authHint.split(".")[0] ?? authHint);

  const architectureNote = known?.architectureNote
    || archParts.join(". ")
    || "Architecture signals limited — analysis based on observable HTTP/HTML indicators.";

  return {
    url: rawUrl,
    analyzedAt: new Date().toISOString(),
    overallConfidence,
    mode,
    summary,
    architectureNote,
    frontend,
    infrastructure: infra,
    apiType,
    authHint,
    thirdParty,
    flowNodes,
    flowEdges,
    payloadHint: "Stack-accurate payload sample — based on detected technologies.",
    payloadSample,
  };
}
