import { useEffect } from "react";

/**
 * Sets per-page <title>, meta description, canonical URL, and an optional
 * JSON-LD schema block. Reverts title/description on unmount so navigating
 * away restores the app-wide defaults from index.html.
 */
export default function useDocumentMeta({ title, description, canonicalPath, jsonLd }) {
  useEffect(() => {
    const prevTitle = document.title;
    const descTag = document.querySelector('meta[name="description"]');
    const prevDescription = descTag?.getAttribute("content");

    if (title) document.title = title;
    if (description && descTag) descTag.setAttribute("content", description);

    let canonicalTag;
    if (canonicalPath) {
      canonicalTag = document.querySelector('link[rel="canonical"]');
      if (canonicalTag) canonicalTag.setAttribute("href", `https://venlaxsports.com${canonicalPath}`);
    }

    let scriptTag;
    if (jsonLd) {
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(scriptTag);
    }

    return () => {
      document.title = prevTitle;
      if (descTag && prevDescription != null) descTag.setAttribute("content", prevDescription);
      if (canonicalTag) canonicalTag.setAttribute("href", "https://venlaxsports.com");
      if (scriptTag) document.head.removeChild(scriptTag);
    };
  }, [title, description, canonicalPath, jsonLd]);
}
