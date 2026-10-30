// The Grassroots Cup's traditions (see render/cup.js). For now: the Champion's
// Blazer -- the Cup's own jacket, with its holder's name.
import { blazerSvg } from "../lib/blazer.js";

export function blazerSectionHtml(cup, managers) {
  const holder = cup?.status === "complete" && cup.champion ? managers.name(cup.champion).replace(/\s*\*+$/, "") : null;
  return `
    <section class="cup-blazer">
      <div class="cbz-art">${blazerSvg("cbz-svg")}</div>
      <div class="cbz-copy">
        <p class="cup-eyebrow">A Grassroots Cup tradition</p>
        <h2 class="cbz-title">The Champion's Blazer</h2>
        <p class="cbz-text">The Cup's own jacket. The winner wears it for a year, with their name stitched inside, and hands it on to next season's champion. Until then it's the holder's alone: a little blazer sits next to their club name everywhere on the site.</p>
        <p class="cbz-holder">${holder ? `Held by <b>${holder}</b>` : "Inaugural holder: decided at GW36"}</p>
      </div>
    </section>`;
}
