/**
 * Content for the /about page. Written as Team VENLAX: no individual names or portraits.
 * The page is live as soon as `story` has text. Check every sentence is true for the team before publishing.
 */
export const ABOUT = {
  byline: "Team VENLAX",
  headline: "Why we built VENLAX",
  subhead: "Built by people who play the game—and build the software behind it.",
  photo: "/photos/p3-sunset.webp",
  photoAlt: "Pickleball players on court at sunset",
  story: [
    "We play competitive tennis and pickleball, and we build software for a living. VENLAX started with a problem we kept running into: finding meaningful, well-matched competition is harder than it should be.",
    "Great leagues exist, but too many still rely on spreadsheets, group chats, and results that are difficult to find. Players spend too much time organizing instead of playing. Matches fall through, progress is hard to track, and local competition feels fragmented.",
    "So we built VENLAX: one place to join a ranked season, play opponents at your level, schedule matches, report scores, and follow the standings. No club membership required. One simple fee per season.",
  ],
  mission: "More players playing more matches against people at their level.",
  beliefs: [
    "Competition should be fair, welcoming, and enjoyable at every level.",
    "Technology should remove admin, not add it.",
    "Strong local communities are the future of the game.",
    "Every match is an opportunity to improve, compete, and connect.",
  ],
  closing: "One match, one player, one city at a time.",
  links: [],
};

export const hasFounderPage = ABOUT.story.length > 0;
