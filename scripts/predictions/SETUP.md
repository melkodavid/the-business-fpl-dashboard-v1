# Weekly predictions — one-time setup (about 5 minutes)

The website is static, so it needs one shared place to keep everyone's picks.
A free Google Sheet with a small script attached does the job. Nobody who plays
needs a Google account — only whoever sets this up.

1. Go to <https://sheets.new> and name the sheet "The Business predictions".
2. **Extensions → Apps Script**. Delete whatever is in the editor and paste in
   the whole of `Code.gs` (this folder). Click the save icon.
3. **Deploy → New deployment**. Click the gear next to "Select type" and choose
   **Web app**, then set:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
4. Click **Deploy**, approve the permissions prompt (it's your own script — if
   Google warns it's unverified, choose *Advanced → Go to … (unsafe)*), and copy
   the **Web app URL** (it ends in `/exec`).
5. Put that URL in `data/predictions-config.json`:

   ```json
   { "endpoint": "https://script.google.com/macros/s/…/exec" }
   ```

   Commit and push. The Predictions page switches on by itself.

## Good to know

- Picks close at each gameweek's official deadline, checked by the script, not
  the browser. Others' picks stay hidden until then, so nobody can copy.
- The sheet is the master record; the site's hourly refresh copies revealed
  picks into `data/predictions.json`, so they're also backed up in git.
- If you change `Code.gs` later: **Deploy → Manage deployments → ✏️ → Version:
  New version → Deploy** (the URL stays the same).
- There are no passwords: anyone can submit under any name before the deadline.
  It's meant for friends. If it ever gets abused, you can delete rows in the
  sheet by hand.

## Live scores (same script)

The site's **Live** page reads the gameweek through this same script, because
the official Draft API won't let a web page read it directly. Nothing to set
up beyond keeping `Code.gs` current. After pasting in a newer `Code.gs`:

**Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.**

The URL stays the same, so `data/predictions-config.json` doesn't change.
Until that's done, the Live page says the script "needs its live-scores update".

To check it's working, open your `/exec` URL with `?action=live` on the end.
You should see a page of JSON starting with `{"ok":true,"gw":…`.
