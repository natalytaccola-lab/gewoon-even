# Ads Command Center — Admin Dashboard

Internal dashboard at `gewoon-even.nl/admin/ads`. Password-gated. Pulls live data from Meta Graph API v25.0.

Architecture: single-file static HTML (`admin/ads/index.html`) → calls `/api/meta-ads-data` serverless function → proxies to Meta Graph API. Access token stays server-side.

---

## How to update the password

The password lives in the `ADMIN_PASSWORD` env var on Vercel. Rotating it instantly revokes access for everyone (sessions are validated server-side on every request).

1. Open https://vercel.com/dashboard → project `gewoon-even` → Settings → Environment Variables
2. Find `ADMIN_PASSWORD`, click Edit, paste new value
3. Save → Vercel will prompt to redeploy. Hit "Redeploy" (or wait for next commit)
4. Tell anyone with the old password the new one
5. Old browser sessions: tab refresh → password modal reappears

Current initial password: `ge-ads-w7k9m2qx` (saved in 1Password).

---

## How to update Meta API credentials

The dashboard reads 4 env vars on Vercel:

| Env var | Format | Where to get it |
|---|---|---|
| `META_ACCESS_TOKEN` | `EAAB...` (~200 chars) | Meta Business Suite → Business Settings → Users → System Users → Generate token. Scopes needed: `ads_read`, `pages_read_engagement`. **Use a long-lived token** (Settings → "Never expires" or 60-day refresh). |
| `META_AD_ACCOUNT_ID` | `act_XXXXXXXX` or just `XXXXXXXX` | Meta Ads Manager → top-left dropdown shows it. Or Business Settings → Accounts → Ad Accounts. The proxy auto-prepends `act_` if missing. |
| `META_PIXEL_ID` | numeric (e.g. `1303902808354568`) | Events Manager → Data Sources → your Pixel → top-left ID. Used for display only — Pixel events are tracked client-side, not via this API. |
| `META_PAGE_ID` | numeric | facebook.com/YourPage → About → bottom shows ID. Or Business Settings → Accounts → Pages. |

### Rotating the access token (when it expires)

Long-lived tokens for system users typically expire after 60 days unless marked "never expires". When you see `Token: status unknown` or `Token valid → <past date>` in the dashboard header:

1. Meta Business Suite → Business Settings → Users → System Users
2. Click your system user → "Generate New Token"
3. Select the app (Gewoon Even Pixel app), scopes: `ads_read`, `ads_management` (read-only for the dashboard, but `ads_management` lets you pause/resume if you later add that feature)
4. Copy the new token
5. Vercel → Settings → Environment Variables → Edit `META_ACCESS_TOKEN` → paste → Save → Redeploy

### Verifying the token

The dashboard automatically calls `/debug_token` on every load and shows the expiry date in the header status bar. If you see "Token: status unknown" something's wrong — either the token is invalid, the scopes are missing, or the API is rate-limited.

You can also check manually:

```
curl "https://graph.facebook.com/v25.0/debug_token?input_token=YOUR_TOKEN&access_token=YOUR_TOKEN"
```

Expected response includes `"is_valid": true` and `"expires_at": <unix-timestamp>`.

---

## How to update brand colors

The dashboard uses the same color tokens as `index.html`. They're defined at the top of `admin/ads/index.html` in CSS custom properties:

```css
:root {
    --bg: #F5F2EE;          /* page background */
    --bg-card: #FFFFFF;     /* card background */
    --green: #3D5A50;       /* verde dique — primary brand color */
    --sand: #B8A898;        /* neutral accent */
    --terra: #D4836A;       /* terracotta CTA */
    --text: #2C2C2C;        /* dark charcoal */
    --font-display: 'Fraunces', Georgia, serif;
    --font-body: 'Outfit', -apple-system, sans-serif;
}
```

If the Gewoon Even palette evolves, just edit these tokens in **one place** — every card, button, and heatmap cell reads from them.

The day-parting heatmap colors are defined in JS (`colorForIntensity` function near line ~890). If you want to shift from green to teal/blue, change the 5-color array there. Levels 0–4 = least intense → peak.

---

## How to update interests/targeting display

The Targeting Strategy section (3 cards) is **partially dynamic**:

- **Geography** card → hardcoded (Netherlands-only). Edit the HTML directly if you expand to BE/DE.
- **Demographics** card → dynamic — reads `age_min`, `age_max`, `genders` from the actual ad sets via the Meta API.
- **Interest Targeting** card → dynamic — reads `flexible_spec.interests` or `interests` from each ad set.
- **Audience Evolution** card → hardcoded roadmap (Week 2-3 retargeters, Week 3-4 lookalikes, etc.). Edit HTML directly.

If you reconfigure ad sets in Meta Ads Manager (different interests, age range, new gender split), the dashboard picks up the changes on next page load. No code change needed.

If the interest layer changes structurally (e.g. you switch to Advantage+ Audience which has no explicit interests), the Interests card will say "No interest targeting detected. Either Advantage+ audience or interests not yet configured." — that's expected.

---

## How to add a new product / new tag mapping

This dashboard is **read-only**. It doesn't write to Stripe, Brevo, or Meta. Product tag mapping for purchase webhooks lives in `api/stripe-webhook.js` (separate file, separate concern).

If you add a new product (say, Slaapprotocol €67), the dashboard will:
- Show the campaign + ad sets normally (they're just Meta entities)
- Show purchases as conversions if your campaign is optimized for OFFSITE_CONVERSIONS Purchase

You don't need to touch the dashboard code.

---

## Local testing

To preview the dashboard layout without the Meta API:

1. Open `admin/ads/index.html` directly in a browser (file://)
2. Enter any password — the gate will fail (no /api endpoint locally) but you can edit `getPassword()` in the script to return a stub and inspect the layout

For a real local test:
```
vercel dev
```
Then visit http://localhost:3000/admin/ads with the production env vars in a `.env.local` file.

---

## Security notes

- **Password is server-validated** on every API request. Client-side gate is UX only.
- The Meta access token is **never exposed to the client**. The serverless function fetches Graph API server-side and returns sanitized JSON.
- The `noindex, nofollow` meta tag prevents search engine indexing of the gate page.
- If the password leaks: rotate `ADMIN_PASSWORD` and redeploy. Done in 2 minutes.
- **Do not** add the access token as a build-time variable. It must be a runtime env var so rotation doesn't require a code commit.

---

## Files

```
admin/ads/index.html       — dashboard UI (single-file HTML+CSS+JS)
api/meta-ads-data.js       — serverless proxy to Meta Graph API
README-admin.md            — this file
```

Routing: `gewoon-even.nl/admin/ads` → serves `admin/ads/index.html` (Vercel folder-as-route convention, same as `noodprotocol/index.html`).

API path: `gewoon-even.nl/api/meta-ads-data?endpoint=campaign|adsets|ads|token` with `Authorization: Bearer <password>`.

---

## Performance & cost

- **Hobby plan (€0/mo)** is plenty. Admin-only page, password-gated, low traffic.
- Each dashboard load triggers ~3-5 Meta Graph API calls. Meta rate limit: 200 calls/hour per app — well within budget.
- Insights calls use `date_preset=maximum` (lifetime). If you want a different window, edit `DATE_PRESET` in `api/meta-ads-data.js`.

---

## Troubleshooting

**"Meta env vars not configured on server"** banner → set the 4 Meta env vars in Vercel and redeploy.

**"Wrong password" loop** → check `ADMIN_PASSWORD` in Vercel Settings (no trailing newlines, no quotes around the value).

**"Token: status unknown"** → access token invalid or expired. Generate new token, update env var, redeploy.

**Dashboard shows old data** → click the Refresh button (top-right). Meta insights have ~15 min delay from real ad delivery.

**"meta_api_error" detail mentions rate limit** → wait 1 hour, the app-level limit will reset.

**Section is empty / shows "No data"** → either no ad sets/ads exist yet, or insights have zero data (campaign just started). Check Meta Ads Manager to confirm.
