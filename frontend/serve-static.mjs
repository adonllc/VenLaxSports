#!/usr/bin/env node
// Minimal static file server for dist/, replacing `serve -s` (which always
// rewrites to the root index.html and would silently defeat prerendering).
// Behavior: serve a matching file or <path>/index.html when present (this is
// what makes the prerendered snapshots from scripts/prerender.mjs actually
// get served); for any other route-shaped request (no file extension), fall
// back to the root index.html with a 200 so client-side routing still works
// for routes that weren't prerendered (e.g. /dashboard, /leagues/:id).
// Zero dependencies — plain Node http/fs.
import { createServer } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Security headers on every response. The CSP is Report-Only on purpose: tighten it to an enforcing
// Content-Security-Policy after a week without reports, a strict one on day one can break our own scripts.
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.posthog.com https://in.heycatch.ai https://www.googletagmanager.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https:; connect-src 'self' https://*.venlaxsports.com https://*.posthog.com https://in.heycatch.ai https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com; " +
    "frame-ancestors 'self'",
};

// First path segments the app actually routes (see src/App.jsx). Anything else answers 404 while still
// serving the app shell, so people see the friendly not-found page and crawlers see a real 404.
const KNOWN_ROOTS = new Set([
  "", "auth", "reset-password", "sport", "leagues", "rules", "handbook", "terms", "waiver", "dashboard", "admin",
  "matches", "round-robin", "privacy", "city", "players", "verify-email", "profile-setup", "join",
  "doubles-invite", "ladders", "rewards", "tennis-pickleball-leagues", "about",
]);

const citySlug = (name) => name.toLowerCase().trim().replace(/\s+/g, "-");

function send(res, status, filePath, extraHeaders = {}) {
  const ext = path.extname(filePath);
  res.writeHead(status, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    pathname = req.url;
  }

    // HeyCatch short links: /a../z and /0../9 -> 302 to /?utm_source=heycatch&utm_campaign=<char>
  if (/^\/[a-z0-9]$/.test(pathname)) {
    res.writeHead(302, { Location: `/?utm_source=heycatch&utm_campaign=${pathname[1]}`, ...SECURITY_HEADERS }).end();
    return;
  }

  // Clean city URLs: /city/New%20York/sport/tennis -> 301 /city/new-york/sport/tennis
  const cityMatch = pathname.match(/^\/city\/([^/]+)\/sport\/([^/]+)\/?$/);
  if (cityMatch && citySlug(cityMatch[1]) !== cityMatch[1]) {
    res.writeHead(301, { Location: `/city/${encodeURIComponent(citySlug(cityMatch[1]))}/sport/${cityMatch[2]}`, ...SECURITY_HEADERS }).end();
    return;
  }

  // Prevent path traversal outside dist/.
  const safeRel = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(DIST, safeRel);
  if (!candidate.startsWith(DIST)) {
    res.writeHead(400, SECURITY_HEADERS).end("Bad request");
    return;
  }

  // 1. Exact file match (hashed assets, images, sitemap.xml, robots.txt, ...).
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    const immutable = candidate.includes(`${path.sep}assets${path.sep}`);
    send(res, 200, candidate, {
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300",
    });
    return;
  }

  // 2. Directory with its own prerendered index.html (scripts/prerender.mjs output).
  const dirIndex = path.join(candidate, "index.html");
  if (existsSync(dirIndex) && statSync(dirIndex).isFile()) {
    send(res, 200, dirIndex, { "Cache-Control": "no-cache" });
    return;
  }

  // 3. Route-shaped request (no file extension) with no prerendered snapshot —
  //    SPA fallback so client-side routing still renders it. Serve the bare
  //    CSR shell (scripts/prerender.mjs writes it to app-shell.html) rather
  //    than dist/index.html: index.html is the homepage's own prerendered
  //    snapshot (full marketing copy baked in), and serving that for an
  //    unrelated route like /leagues/:id meant React had to unmount a whole
  //    homepage's worth of content and mount the real page on hydration —
  //    a large, measured layout shift. Falls back to index.html if the shell
  //    wasn't generated (prerender didn't run, e.g. no Chromium in the build
  //    image) so this still works without it.
  const hasExtension = path.extname(pathname) !== "";
  if (!hasExtension) {
    const shell = path.join(DIST, "app-shell.html");
    const fallback = existsSync(shell) ? shell : path.join(DIST, "index.html");
    const known = KNOWN_ROOTS.has(pathname.split("/")[1] || "");
    send(res, known ? 200 : 404, fallback, { "Cache-Control": "no-cache" });
    return;
  }

  // 4. A real static asset request that doesn't exist — genuine 404.
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS }).end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`serve-static listening on 0.0.0.0:${PORT}, serving ${DIST}`);
});
