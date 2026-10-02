import { signed, escapeHtml } from "../format.js";

// Plain-English "how is Luck calculated" panel, with a worked example pulled
// from the league's own live numbers so it never goes stale.
export function luckExplainerHtml(data, managers, myId) {
  const { standings, perGw } = data.allPlay;
  const gws = Object.keys(perGw).map(Number).sort((a, b) => a - b);
  if (!standings.length || !gws.length) return "";

  const subject = standings.find((s) => s.managerId === myId) ?? standings.reduce((a, b) => (b.luckScore > a.luckScore ? b : a));
  const latestGw = gws[gws.length - 1];
  const row = perGw[latestGw]?.find((r) => r.managerId === subject.managerId);
  const opponents = (perGw[latestGw]?.length ?? 12) - 1;
  const beaten = row ? Math.round(row.allPlayWinPct * opponents * 2) / 2 : null;
  const name = escapeHtml(managers.name(subject.managerId));

  const example = row
    ? `<p class="luck-example"><strong>Live example:</strong> in GW${latestGw}, ${name} scored <strong>${row.score}</strong>, which would have beaten <strong>${beaten}</strong> of the other ${opponents} teams &rarr; <strong>${row.allPlayWinPct.toFixed(2)}</strong> expected wins for that week. Add up every week and ${name} has <strong>${subject.expectedWins.toFixed(1)}</strong> expected wins against <strong>${subject.actualWins}</strong> actual wins &rarr; luck score <strong>${signed(subject.luckScore)}</strong>.</p>`
    : "";

  return `
    <details class="card luck-explainer">
      <summary>How is Luck calculated?</summary>
      <div class="luck-body">
        <p>In a head-to-head league you only play <em>one</em> opponent each week, so a great score can still lose to someone who had a monster week &mdash; and a bad score can win against someone who flopped. The Luck column measures how much the schedule has helped or hurt you.</p>
        <ol>
          <li><strong>All-play:</strong> each week, your score is compared against <em>every</em> other team, not just your opponent. Beat 9 of 11 and you "expected" to win 9/11 &asymp; 0.82 of a match (a tie counts as half).</li>
          <li><strong>Expected wins:</strong> add those weekly fractions across the season.</li>
          <li><strong>Luck score:</strong> actual wins &minus; expected wins.</li>
        </ol>
        <p><span class="pos">Positive</span> = you've won more matches than your scoring deserved (lucky draws). <span class="neg">Negative</span> = you've scored well enough to win more than you have (unlucky). Around <strong>0</strong> means your record matches how you've really played.</p>
        ${example}
      </div>
    </details>`;
}
