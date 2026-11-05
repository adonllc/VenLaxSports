// Dates are only shown for leagues players can join (registration in an open city),
// leagues that are running, and leagues that have finished. Opens-soon and cancelled leagues show none.
export function showLeagueDates(league, isCityOpen) {
  if (!league) return false;
  if (league.status === "registration") return isCityOpen(league.city);
  return league.status === "active" || league.status === "completed";
}
