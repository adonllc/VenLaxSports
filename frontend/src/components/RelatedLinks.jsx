import { Link } from "react-router-dom";

/**
 * Related pages block: a handful of links chosen by hand per page, so every content page is linked
 * from other content pages and not only from the nav, footer and sitemap.
 * links: [{ to, label }]
 */
export default function RelatedLinks({ links, testId = "related-links" }) {
  return (
    <aside aria-label="Related" className="max-w-5xl mx-auto px-4 sm:px-6 py-10 border-t" style={{ borderColor: "#E5E7EB" }} data-testid={testId}>
      <h2 className="font-bold text-2xl mb-4" style={{ color: "#3D3D3D", fontFamily: "Rubik, system-ui, sans-serif" }}>Related</h2>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="font-bold underline" style={{ color: "#00765C" }}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
