export function buildScoreSummary(sport, scoreData, p1Name, p2Name) {
  if (sport === "tennis") {
    const sets = [];
    let p1Sets = 0;
    let p2Sets = 0;
    for (let i = 1; i <= 3; i++) {
      const a = scoreData[`set${i}_p1`];
      const b = scoreData[`set${i}_p2`];
      if (a !== "" && a !== undefined && b !== "" && b !== undefined) {
        const n1 = parseInt(a, 10);
        const n2 = parseInt(b, 10);
        if (!isNaN(n1) && !isNaN(n2)) {
          sets.push(`${n1}-${n2}`);
          if (n1 > n2) p1Sets++;
          else if (n2 > n1) p2Sets++;
        }
      }
    }
    if (sets.length === 0) return null;
    const inferredWinner = p1Sets > p2Sets ? "p1" : p2Sets > p1Sets ? "p2" : null;
    return { scoreStr: sets.join(", "), p1Sets, p2Sets, inferredWinner };
  }

  if (sport === "pickleball") {
    const games = [];
    let p1Games = 0;
    let p2Games = 0;
    for (let i = 1; i <= 3; i++) {
      const a = scoreData[`game${i}_p1`];
      const b = scoreData[`game${i}_p2`];
      if (a !== "" && a !== undefined && b !== "" && b !== undefined) {
        const n1 = parseInt(a, 10);
        const n2 = parseInt(b, 10);
        if (!isNaN(n1) && !isNaN(n2)) {
          games.push(`${n1}-${n2}`);
          if (n1 > n2) p1Games++;
          else if (n2 > n1) p2Games++;
        }
      }
    }
    if (games.length === 0) return null;
    const inferredWinner = p1Games > p2Games ? "p1" : p2Games > p1Games ? "p2" : null;
    return { scoreStr: games.join(", "), p1Sets: p1Games, p2Sets: p2Games, inferredWinner };
  }

  if (sport === "cricket") {
    const p1r = scoreData.p1_runs;
    const p2r = scoreData.p2_runs;
    if (!p1r && !p2r) return null;
    const fmt = (prefix, name) =>
      scoreData[`${prefix}_runs`]
        ? `${name}: ${scoreData[`${prefix}_runs`]}/${scoreData[`${prefix}_wickets`] || 0} (${scoreData[`${prefix}_overs`] || "0"})`
        : null;
    const parts = [fmt("p1", p1Name), fmt("p2", p2Name)].filter(Boolean);
    return { scoreStr: parts.join(" · "), inferredWinner: null };
  }

  return null;
}
