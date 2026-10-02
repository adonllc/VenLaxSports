#!/usr/bin/env node
// Prerenders the site's indexable marketing/content routes into static HTML
// snapshots inside dist/, so crawlers get a real per-route <title>, meta
// description, canonical link, and JSON-LD (written client-side today by
// useDocumentMeta) without needing an SSR migration. Real visitors are
// unaffected — React mounts over the snapshot exactly as it does over the
// normal empty CSR shell.
//
// Runs after `vite build`, against the built dist/ output, using Playwright
// (already a devDependency for e2e tests). Best-effort: if Chromium isn't
// installed in the build environment, this logs a warning and exits 0 rather
// than failing the build — `yarn build` must never depend on this succeeding.
// To activate it in CI/deploy, run `npx playwright install --with-deps chromium`
// as part of the build image before `yarn build`.
import { preview } from "vite";
import { mkdirSync, writeFileSync, copyFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const ACTIVE_SPORTS = ["tennis", "pickleball"];
const FEATURED_CITIES = ["New York", "Los Angeles", "Chicago", "San Francisco", "Atlanta", "Houston"];

// /join excluded: it's gated behind auth (redirects guests to /auth on mount
// before useDocumentMeta's cleanup ever settles), so prerendering it captured
// a bad snapshot with the canonical/title reset to the homepage defaults.
const STATIC_ROUTES = [
  "/",
  "/tennis-pickleball-leagues",
  "/leagues",
  "/sport/tennis",
  "/sport/pickleball",
  "/ladders",
  "/rules",
  "/handbook",
  "/terms",
  "/privacy",
  "/waiver",
];

// `url` is what the browser navigates (city names need URL-encoding for the
// space); `dir` is the on-disk output path, which must use the *decoded*
// segment — static file servers decode the request URI before matching the
// filesystem, so a request for `/city/New%20York/...` looks for a directory
// literally named "New York", not "New%20York".
const cityRoutes = FEATURED_CITIES.flatMap((city) =>
  ACTIVE_SPORTS.map((sport) => ({
    url: `/city/${encodeURIComponent(city)}/sport/${sport}`,
    dir: `/city/${city}/sport/${sport}`,
  })),
);

const ROUTES = [
  ...new Set(STATIC_ROUTES),
].map((r) => ({ url: r, dir: r }));
for (const r of cityRoutes) {
  if (!ROUTES.some((existing) => existing.url === r.url)) ROUTES.push(r);
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    console.warn("[prerender] @playwright/test not available — skipping prerender, CSR build stands as-is.");
    return;
  }

  const server = await preview({ root: ROOT, preview: { port: 4173, strictPort: false } });
  const base = server.resolvedUrls.local[0].replace(/\/$/, "");

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.warn(
      "[prerender] Chromium not installed — skipping prerender, CSR build stands as-is.\n" +
        "  Run `npx playwright install --with-deps chromium` in the build image to enable it.\n" +
        `  (${err.message})`,
    );
    await server.httpServer.close();
    return;
  }

  // Save the plain CSR shell (bare <div id="root"></div>, no route content)
  // before the loop below overwrites dist/index.html with the homepage's
  // prerendered snapshot. serve-static.mjs's catch-all falls back to this
  // shell for routes with no prerendered snapshot of their own (e.g.
  // /leagues/:id) — serving the homepage's full prerendered markup there
  // instead caused a real-content-swap layout shift (measured CLS 0.193) once
  // React hydrated and replaced the homepage copy with actual league data.
  try {
    copyFileSync(path.join(ROOT, "dist", "index.html"), path.join(ROOT, "dist", "app-shell.html"));
  } catch (err) {
    console.warn(`[prerender] could not save app-shell.html: ${err.message}`);
  }

  const page = await browser.newPage();
  let ok = 0;

  for (const { url: routeUrl, dir: routeDir } of ROUTES) {
    const url = `${base}${routeUrl}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      // useDocumentMeta writes title/description/canonical/JSON-LD on mount — give it a tick.
      await page.waitForTimeout(150);
      const html = await page.content();

      const outDir = routeDir === "/" ? path.join(ROOT, "dist") : path.join(ROOT, "dist", routeDir.replace(/^\//, ""));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, "index.html"), html);
      ok += 1;
    } catch (err) {
      console.warn(`[prerender] failed for ${routeUrl}: ${err.message}`);
    }
  }

  await browser.close();
  await server.httpServer.close();
  console.log(`[prerender] wrote ${ok}/${ROUTES.length} static snapshots into dist/`);
}

main().catch((err) => {
  console.warn(`[prerender] skipped due to an unexpected error: ${err.message}`);
});
