/**
 * Founder details for the /about page. The owner fills this in; until `name` and `story` are set the page
 * does not exist (it shows the not-found page) and the footer link stays hidden, so no placeholder is ever public.
 *
 *   name:   "First Last"
 *   role:   "Founder, VENLAX Sports"
 *   photo:  "/photos/founder.webp"   (put the file in frontend/public/photos/; leave "" for an initials block)
 *   story:  ["Paragraph one.", "Paragraph two."]   (about 150 words in total, first person, plain)
 *   links:  [{ label: "LinkedIn", href: "https://..." }]
 */
export const FOUNDER = {
  name: "",
  role: "Founder, VENLAX Sports",
  photo: "",
  story: [],
  links: [],
};

export const hasFounderPage = Boolean(FOUNDER.name && FOUNDER.story.length);
