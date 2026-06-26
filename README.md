# 9–5 Reset

A Chrome extension that finds natural gaps in your workday calendar and reminds you to take a short stretch or movement break — timed to fit between your meetings.

## What it does

- **Calendar-aware scheduling** — reads your Google Calendar (read-only) and detects gaps of 10+ minutes between meetings. Suggests a reset window at the start of each gap, with a 3-minute buffer before the next meeting.
- **Manual mode** — set your own work hours (start, end, lunch break) and get a reset reminder every 90 minutes (or every hour).
- **Sample calendar** — built-in mock schedule for testing without connecting a real calendar.
- **Exercise library** — 25 guided stretches and movements across five categories: neck, back, posture, energy, and quick resets.
- **Daily energy check** — pick Low / Medium / High each morning; the session length adapts (3–5 exercises, ~7–12 min).
- **OS notifications** — native Chrome notification fires at each reset window with Start / Skip buttons.
- **Badge countdown** — the toolbar icon shows a live MM:SS countdown while a session is running.
- **Free / Pro tiers** — free users see 2 reset windows per day; Pro unlocks all windows and Google Calendar sync.
- **Passwordless sign-in** — email OTP via Supabase (no password required).
- **English + Russian** — full UI and exercise text in both languages.

## Installing from source

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.

The extension works immediately in **sample calendar** mode. To use Google Calendar sync or Pro features, complete the setup steps below.

## Setup

### Google Calendar OAuth

Calendar sync requires a **Web application** OAuth 2.0 client (not a "Chrome Extension" client — those are bound to the Chrome Web Store and can't show an account picker for arbitrary Google accounts).

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create a **Web application** OAuth client.
3. Add `chrome-extension://<YOUR_EXTENSION_ID>/` as an **Authorized JavaScript origin**.
4. Add the output of `chrome.identity.getRedirectURL()` as an **Authorized redirect URI**.  
   To find it: open the extension's background service worker in DevTools and run `chrome.identity.getRedirectURL()`. It looks like `https://<hash>.chromiumapp.org/`.
5. Copy the **Client ID** and paste it into `background.js` as `GOOGLE_OAUTH_CLIENT_ID`.
6. Enable the **Google Calendar API** in your Cloud project.

### Supabase (auth + Pro entitlement)

1. Create a Supabase project.
2. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `background.js`.
3. Run the following SQL to create the required tables:

**`subscribers` table** (Pro entitlement, RLS-protected):
```sql
create table subscribers (
  email text primary key,
  is_pro boolean not null default false,
  plan text
);

alter table subscribers enable row level security;

-- Users can only read their own row
create policy "read own row" on subscribers
  for select using (email ilike auth.jwt() ->> 'email');
```

**`onboarding_status` table** (skip re-onboarding on reinstall):
```sql
create table onboarding_status (
  email text primary key,
  onboarded boolean not null default false
);

alter table onboarding_status enable row level security;

create policy "read own row" on onboarding_status
  for select using (email ilike auth.jwt() ->> 'email');

create policy "upsert own row" on onboarding_status
  for insert with check (email ilike auth.jwt() ->> 'email');

create policy "update own row" on onboarding_status
  for update using (email ilike auth.jwt() ->> 'email');
```

4. In Supabase → **Authentication → Email Templates → Magic Link**, add `{{ .Token }}` to the template body so the 6-digit OTP code is included in the email.

### Contact opt-in webhook (optional)

If you want to capture emails from users who check "Email me occasional product updates":

1. Create a Google Apps Script Web App that appends `{ email, timestamp }` to a Google Sheet.
2. Deploy it as a Web App (execute as yourself, accessible to anyone).
3. Paste the deployment URL into `background.js` as `CONTACT_SHEET_WEBHOOK_URL`.

### Subscription management (optional)

The extension links to `UPGRADE_PAGE_URL` and `MANAGE_SUBSCRIPTION_URL` in `background.js`. Point these at your own upgrade page and subscription portal (the main repo uses Polar via a Next.js landing page).

## Project structure

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker — calendar fetch, gap detection, notification scheduling, session timer, Supabase auth |
| `popup.html` | Extension popup UI (all states in one file) |
| `popup.css` | Popup styles |
| `popup.js` | Popup logic — state machine, message passing to background |
| `i18n.js` | EN/RU string dictionary, shared by popup and background |
| `icon*.png` | Toolbar icons (16/32/48/128 px) |
| `giraffe-neutral.png` | Mascot image used in popup and notifications |

## Free vs Pro

| Feature | Free | Pro |
|---|---|---|
| Manual work hours | ✓ | ✓ |
| Sample calendar | ✓ | ✓ |
| Reset windows visible | 2/day | All |
| Notifications | First 2 windows | All windows |
| Google Calendar sync | — | ✓ |

## Architecture notes

- **No SDK bundled** — Supabase and Google Calendar are called via raw `fetch()`. MV3 service workers are killed and respawned frequently, so no long-lived SDK session can be maintained. The Supabase session is persisted in `chrome.storage.local` and refreshed on demand.
- **Gap detection** — events are sorted by start time; any consecutive pair with a 10+ minute gap produces a reset opportunity. A 3-minute buffer is trimmed from the end (so the notification doesn't fire right before the next meeting), and the remaining window must be at least 7 minutes to qualify.
- **Notification deduplication** — `notifiedOpportunities` in storage tracks which windows have already fired, so a 30-minute background refresh doesn't re-send the same reminder.
- **Standalone popup fallback** — `chrome.action.openPopup()` only works when a Chrome window is focused. Clicking a native OS notification button doesn't satisfy that, so the extension falls back to opening a small standalone window positioned in the top-right corner.
