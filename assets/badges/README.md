# Club badges

Each manager's club (their team this season) can have its own badge, shown next
to the team name on every current-season page. History pages show the manager's
name instead, so the badge is what tells a club apart from the person running it.

## Adding a custom badge

Drop an image here named `{personKey}.png` (e.g. `noah.png`, `lu.png`) -- no
other change needed. `personKey` is the manager's first name, lowercased (see
`data/manager-profiles.json`). A transparent PNG, roughly square or shield
shaped, around 256x256, works best.

## Other options

* **An emoji instead of an image:** in `data/manager-profiles.json` add
  `"badge": "🏴‍☠️"` to that manager's entry.
* **A different file name/format:** set `"badge": "assets/badges/crest.svg"` in
  the same entry (png, jpg, svg, webp and gif all work).

## No badge yet?

Nothing to do: every club gets a generated shield in the manager's team colour
with their abbreviation until a custom badge exists.
