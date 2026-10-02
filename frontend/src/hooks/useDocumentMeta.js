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

    // og:*/twitter:* previously stayed on the index.html defaults for every
    // route, so sharing any inner page (a league, a city, a sport) rendered
    // a social card for the homepage instead. Mirror title/description into
    // them too.
    const ogTitleTag = document.querySelector('meta[property="og:title"]');
    const ogDescTag = document.querySelector('meta[property="og:description"]');
    const twitterTitleTag = document.querySelector('meta[name="twitter:title"]');
    const twitterDescTag = document.querySelector('meta[name="twitter:description"]');
    const prevOgTitle = ogTitleTag?.getAttribute("content");
    const prevOgDesc = ogDescTag?.getAttribute("content");
    const prevTwitterTitle = twitterTitleTag?.getAttribute("content");
    const prevTwitterDesc = twitterDescTag?.getAttribute("content");

    if (title) {
      document.title = title;
      if (ogTitleTag) ogTitleTag.setAttribute("content", title);
      if (twitterTitleTag) twitterTitleTag.setAttribute("content", title);
    }
    if (description) {
      if (descTag) descTag.setAttribute("content", description);
      if (ogDescTag) ogDescTag.setAttribute("content", description);
      if (twitterDescTag) twitterDescTag.setAttribute("content", description);
    }

    let canonicalTag;
    if (canonicalPath) {
      canonicalTag = document.querySelector('link[rel="canonical"]');
      if (canonicalTag) canonicalTag.setAttribute("href", `https://venlaxsports.com${canonicalPath}`);
    }

    let scriptTag;
    if (jsonLd) {
      // Remove any script this hook already injected (prior mount, or baked
      // into the prerendered snapshot) so navigating between pages — or
      // hydrating over a prerendered page — never leaves two copies in <head>.
      document.querySelectorAll('script[data-page-jsonld]').forEach((el) => el.remove());
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute("data-page-jsonld", "true");
      scriptTag.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(scriptTag);
    }

    return () => {
      document.title = prevTitle;
      if (descTag && prevDescription != null) descTag.setAttribute("content", prevDescription);
      if (ogTitleTag && prevOgTitle != null) ogTitleTag.setAttribute("content", prevOgTitle);
      if (ogDescTag && prevOgDesc != null) ogDescTag.setAttribute("content", prevOgDesc);
      if (twitterTitleTag && prevTwitterTitle != null) twitterTitleTag.setAttribute("content", prevTwitterTitle);
      if (twitterDescTag && prevTwitterDesc != null) twitterDescTag.setAttribute("content", prevTwitterDesc);
      if (canonicalTag) canonicalTag.setAttribute("href", "https://venlaxsports.com");
      if (scriptTag) document.head.removeChild(scriptTag);
    };
  }, [title, description, canonicalPath, jsonLd]);
}
