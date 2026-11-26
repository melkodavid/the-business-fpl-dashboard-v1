import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTheme } from "../../js/lib/siteTheme.js";

const schedule = [{ theme: "halloween", from: "10-24", to: "10-31" }, { theme: "christmas", from: "12-01", to: "12-31" }, { theme: "blackout", from: "12-30", to: "01-02" }];

test("off unless switched on, forced by name, or auto and inside a scheduled window", () => {
  assert.equal(pickTheme({ theme: "none", schedule }, { date: "12-10" }), null);
  assert.equal(pickTheme({ theme: "blackout", schedule }, { date: "06-01" }), "blackout");
  assert.equal(pickTheme({ theme: "auto", schedule }, { date: "12-10" }), "christmas");
  assert.equal(pickTheme({ theme: "auto", schedule }, { date: "10-31" }), "halloween");
  assert.equal(pickTheme({ theme: "auto", schedule }, { date: "11-15" }), null);
  assert.equal(pickTheme({ theme: "auto", schedule: [schedule[2]] }, { date: "01-01" }), "blackout"); // wraps the new year
  assert.equal(pickTheme(null), null);
});

test("?theme= in the address previews a theme (or turns it off) for that visit only", () => {
  assert.equal(pickTheme({ theme: "none" }, { search: "?theme=nightvision" }), "nightvision");
  assert.equal(pickTheme({ theme: "christmas" }, { search: "?theme=none" }), null);
  assert.equal(pickTheme({ theme: "none" }, { search: "?theme=nonsense" }), null);
});
