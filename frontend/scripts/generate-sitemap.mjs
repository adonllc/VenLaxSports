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

const STATIC_ROUTES = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/tennis-pickleball-leagues", changefreq: "monthly", priority: "0.9" },
  { loc: "/leagues", changefreq: "daily", priority: "0.9" },
  { loc: "/ladders", changefreq: "weekly", priority: "0.7" },
  { loc: "/join", changefreq: "monthly", priority: "0.7" },
  { loc: "/rules", changefreq: "monthly", priority: "0.6" },
  { loc: "/handbook", changefreq: "monthly", priority: "0.5" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
  { loc: "/waiver", changefreq: "yearly", priority: "0.3" },
];

const sportRoutes = ACTIVE_SPORTS.map((sport) => ({
  loc: `/sport/${sport}`,
  changefreq: "weekly",
  priority: "0.8",
}));

const cityRoutes = FEATURED_CITIES.flatMap((city) =>
  ACTIVE_SPORTS.map((sport) => ({
    loc: `/city/${encodeURIComponent(city)}/sport/${sport}`,
    changefreq: "weekly",
    priority: "0.6",
  })),
);

const routes = [...STATIC_ROUTES, ...sportRoutes, ...cityRoutes];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${SITE}${r.loc}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const outPath = path.join(__dirname, "..", "public", "sitemap.xml");
writeFileSync(outPath, xml);
console.log(`sitemap.xml written with ${routes.length} URLs -> ${outPath}`);
