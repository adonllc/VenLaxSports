#!/usr/bin/env node
// Generates public/sitemap.xml from the site's indexable routes. Runs before
// `vite build` so the fresh file gets copied into dist/ by Vite's public-dir copy.
//
// Route data (active sports, featured cities) is duplicated from
// src/config/platformConfig.js rather than imported, because that file reads
// import.meta.env and isn't loadable outside Vite. Keep both in sync manually
// if Phase 1's active sports or featured cities change.
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = "https://venlaxsports.com";

const ACTIVE_SPORTS = ["tennis", "pickleball"];
const FEATURED_CITIES = ["New York", "Los Angeles", "Chicago", "San Francisco", "Atlanta", "Houston"];

// /join is excluded: it's gated behind auth (redirects guests to /auth before
// any content renders), so it has no unique indexable content and the prior
// inclusion here caused it to self-canonicalize to the homepage.
const STATIC_ROUTES = [
  "/",
  "/tennis-pickleball-leagues",
  "/leagues",
  "/ladders",
  "/rules",
  "/handbook",
  "/terms",
  "/privacy",
  "/waiver",
];

const sportRoutes = ACTIVE_SPORTS.map((sport) => `/sport/${sport}`);

const cityRoutes = FEATURED_CITIES.flatMap((city) =>
  ACTIVE_SPORTS.map((sport) => `/city/${encodeURIComponent(city)}/sport/${sport}`),
);

const routes = [...STATIC_ROUTES, ...sportRoutes, ...cityRoutes];

// lastmod is the build date — Google ignores priority/changefreq, so we don't
// emit them (they added noise with no ranking effect).
const lastmod = new Date().toISOString().slice(0, 10);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (loc) => `  <url>
    <loc>${SITE}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const outPath = path.join(__dirname, "..", "public", "sitemap.xml");
writeFileSync(outPath, xml);
console.log(`sitemap.xml written with ${routes.length} URLs -> ${outPath}`);
