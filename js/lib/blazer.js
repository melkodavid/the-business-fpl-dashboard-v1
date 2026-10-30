// The Champion's Blazer -- the Grassroots Cup's own jacket. Drawn inline (no
// asset files) so it can be stamped at any size: big on the Cup page, tiny as
// the holder's badge beside their club name across the site.
export function blazerSvg(cls = "") {
  return `
    <svg class="${cls}" viewBox="0 0 200 200" aria-hidden="true">
      <path d="M60 34 36 50 20 150l22 7 15-62Z" fill="#0a4f35"/>
      <path d="M140 34l24 16 16 100-22 7-15-62Z" fill="#0a4f35"/>
      <circle cx="31" cy="146" r="2.6" fill="#f2c500"/><circle cx="38" cy="148" r="2.6" fill="#f2c500"/>
      <circle cx="169" cy="146" r="2.6" fill="#f2c500"/><circle cx="162" cy="148" r="2.6" fill="#f2c500"/>
      <path d="M60 34 86 22l14 18 14-18 26 12 10 86-4 58H54l-4-58Z" fill="#0b5a3c"/>
      <path d="M80 26q20-12 40 0l-20 14Z" fill="#08472f"/>
      <path d="M88 24h24l-12 16Z" fill="#fbf8ec"/>
      <path d="M86 22l14 18-8 60-20-48 8-22Z" fill="#0d6b47"/>
      <path d="M114 22l-14 18 8 60 20-48-8-22Z" fill="#0d6b47"/>
      <path d="M100 100v78" stroke="#063823" stroke-width="2"/>
      <circle cx="100" cy="114" r="4" fill="#f2c500"/><circle cx="100" cy="134" r="4" fill="#f2c500"/>
      <path d="M62 142h26M112 142h26" stroke="#063823" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M118 84h22v14c0 8-7 12-11 13-4-1-11-5-11-13Z" fill="#08472f" stroke="#f2c500" stroke-width="2"/>
      <path d="M126 90v14" stroke="#fbf8ec" stroke-width="1.6"/><path d="M126 90l8 3-8 3Z" fill="#f2c500"/>
    </svg>`;
}

// Small badge for the current holder, shown next to their club name site-wide.
export function blazerBadgeHtml() {
  return `<span class="blazer-badge" title="Holder of the Champion's Blazer">${blazerSvg()}</span>`;
}
