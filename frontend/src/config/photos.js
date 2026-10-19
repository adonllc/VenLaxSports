/**
 * Photography slots for the Produck-style layout (Home).
 * Same Unsplash photos the sport landing pages already use (free-use licence).
 * To swap in your own: put files in frontend/public/photos/ and set e.g. "/photos/hero.jpg".
 * Empty string = branded colour fallback. Recommended: 2400px wide JPG/WebP, < 300KB.
 */
const TENNIS = "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=1920&q=80";
const PICKLEBALL = "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=1920&q=80";

export const PHOTOS = {
  hero: TENNIS,
  tennis: TENNIS,
  pickleball: PICKLEBALL,
  community: PICKLEBALL,
};
