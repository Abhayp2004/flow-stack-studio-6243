import type { AnalysisResult, ConfidenceLevel, FlowEdge, FlowNode, StackTech } from "../types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
    nodes.push({ id: "auth", label: authService, type: "auth", description: authHint.split(".")[0] });
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

// ─── main export ──────────────────────────────────────────────────────────────

export async function analyzeWebsite(rawUrl: string): Promise<AnalysisResult> {
  const { headers, html, finalUrl, status, error } = await fetchPage(rawUrl);

  const infra      = detectHostingAndCDN(finalUrl, headers);
  const frontend   = detectFramework(html, headers);
  const thirdParty = detectThirdParty(html);
  const apiType    = detectApiType(html, headers);
  const authHint   = detectAuth(html, headers);
  const mode       = detectMode(finalUrl, html);
  const { nodes: flowNodes, edges: flowEdges } = buildFlow(infra, frontend, thirdParty, apiType.name, authHint);

  const signalCount = infra.length + frontend.length + thirdParty.length;
  const overallConfidence: ConfidenceLevel =
    error && !html ? "low" :
    signalCount >= 6 ? "high" :
    signalCount >= 3 ? "medium" : "low";

  // Summary
  const fwName  = frontend.find(t => ["Next.js","Nuxt.js","SvelteKit","Remix","Gatsby","Astro","Angular","React","Vue.js","Svelte","WordPress","Shopify","Webflow","Framer"].includes(t.name))?.name;
  const hosting = infra.find(i => i.category.includes("Hosting"))?.name;
  const cdnName = infra.find(i => i.category.includes("CDN") && i.name !== hosting)?.name;
  const tpNames = thirdParty.map(t => t.name);

  const summaryParts: string[] = [];
  if (fwName)   summaryParts.push(`${fwName} frontend`);
  if (hosting)  summaryParts.push(`hosted on ${hosting}`);
  if (cdnName && cdnName !== hosting) summaryParts.push(`${cdnName} for edge delivery`);
  if (tpNames.length) summaryParts.push(`integrates ${tpNames.slice(0, 4).join(", ")}${tpNames.length > 4 ? ` +${tpNames.length - 4} more` : ""}`);
  if (error)    summaryParts.push(`(note: fetch partially failed — ${error.slice(0, 80)})`);
  if (status && status !== 200) summaryParts.push(`(HTTP ${status})`);

  const summary = summaryParts.length
    ? summaryParts.join(". ") + "."
    : "Limited signals detected. The site may block automated access — results are based on what was observable.";

  const archParts: string[] = [];
  if (fwName)  archParts.push(`${fwName} app`);
  if (hosting) archParts.push(`on ${hosting}`);
  if (apiType.name !== "REST (assumed)") archParts.push(`${apiType.name} API`);
  if (authHint && !authHint.includes("not detectable")) archParts.push(authHint.split(".")[0]);

  return {
    url: rawUrl,
    analyzedAt: new Date().toISOString(),
    overallConfidence,
    mode,
    summary,
    architectureNote: archParts.join(". ") || "Architecture signals limited — analysis based on observable HTTP/HTML indicators.",
    frontend,
    infrastructure: infra,
    apiType,
    authHint,
    thirdParty,
    flowNodes,
    flowEdges,
    payloadHint: "Paste a sample JSON response above to explore the payload structure.",
  };
}
