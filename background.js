// 9-5 Reset — background service worker
// Handles: calendar fetch, gap detection, notification scheduling,
// session timer (badge countdown), and completion logging.

importScripts('i18n.js');

const REFRESH_ALARM = 'refresh-calendar';
const BADGE_ALARM_PREFIX = 'notify-';

const BUFFER_END_MIN = 3; // don't notify right before the next meeting starts
const MIN_GAP_MIN = 10; // minimum raw gap to even consider
const MIN_USABLE_MIN = 7; // minimum gap after buffering to schedule a reset

const MANUAL_INTERVAL_MIN = 90; // suggest a reset every 90 minutes of work hours

// Calendar mode has no work-hours input, so these bound the "before first
// meeting" / "after last meeting" gaps on light-meeting days.
const DEFAULT_WORKDAY_START = '09:00';
const DEFAULT_WORKDAY_END = '17:00';

// "Web application" OAuth client (NOT a "Chrome Extension" client — those
// only work with chrome.identity.getAuthToken, which can't show an account
// picker for arbitrary Google accounts). Create one in Google Cloud Console
// and register chrome.identity.getRedirectURL() as an authorized redirect
// URI — see README for the exact steps.
const GOOGLE_OAUTH_CLIENT_ID = '771888688320-j6r5i97q839t8dlh86a5j2lqmh8nrgi1.apps.googleusercontent.com';
const GOOGLE_OAUTH_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const CONTACT_OPT_IN_SCOPE = 'email';

// Apps Script Web App URL (doPost) that appends { email, timestamp } to a
// Google Sheet. Only called when the user checks "email me updates" — see
// README for deployment steps.
const CONTACT_SHEET_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyXAIBpA_ePsvBNF8eF5PI0zompet7iZCe-nWPlmRmt1YboMbjgL_wkxTasMfHfX8cr/exec';

// Supabase project (same project as the landing page waitlist). The anon key
// is safe to ship in the extension — it only ever reads the signed-in user's
// own subscribers row, enforced by RLS (see supabase-pro-subscribers.sql).
const SUPABASE_URL = 'https://dwjygnxecubtsxnelxpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3anlnbnhlY3VidHN4bmVseHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjY2NjQsImV4cCI6MjA5NjQ0MjY2NH0.3thUB8wRjr2dJnKLPykAamG-5o0zWIs7Au41bGtsoXY';

// Deployed landing page's upgrade page (Polar checkout links live there).
const UPGRADE_PAGE_URL = 'https://www.9to5reset.app/upgrade';

// Deployed landing page's route that resolves ?email= to a Polar customer
// ID and redirects into Polar's hosted Customer Portal, where a monthly
// subscriber can cancel. See app/api/portal/route.ts in the landing page repo
// — requires POLAR_ACCESS_TOKEN to be set in that project's Vercel env vars.
const MANAGE_SUBSCRIPTION_URL = 'https://www.9to5reset.app/api/portal';

const PRO_RECHECK_ALARM = 'recheck-pro-status';
const PRO_STATUS_TTL_MS = 60 * 60 * 1000; // re-check Pro status at most once per hour

// Must match popup.js's FREE_VISIBLE_SESSIONS — opportunities are sorted
// chronologically in the same order popup.js renders/blurs them, so index
// >= this cutoff is exactly what's blurred behind "Unlock with Pro" there.
const FREE_VISIBLE_SESSIONS = 2;

// Exercises grouped by the desk-work problem they target. Selected during
// onboarding (chrome.storage.local: onboarding.painPoints), one or more
// categories contribute to the rotation pool used in pickExercise().
const EXERCISE_LIBRARY = {
  neck: [
    {
      id: 'neck-side-tilt',
      name: 'Neck side tilt',
      icon: '🙆',
      instruction:
        'Drop your right ear toward your right shoulder. Hold 20 seconds, then switch sides. Relieves the most common office neck tension pattern.',
      durationSec: 45,
    },
    {
      id: 'chin-tuck',
      name: 'Chin tuck',
      icon: '🙇',
      instruction:
        "Sit tall, gently pull your chin straight back like you're making a double chin. Hold 5 seconds, release. Repeat 10 times.",
      durationSec: 50,
    },
    {
      id: 'neck-rotation',
      name: 'Neck rotation',
      icon: '🔄',
      instruction:
        'Slowly turn your head to look over your right shoulder. Hold 15 seconds, return to center, then repeat on the left.',
      durationSec: 40,
    },
    {
      id: 'upper-trap-stretch',
      name: 'Upper trapezius stretch',
      icon: '🙋',
      instruction:
        'Sit on your right hand to anchor the shoulder. With your left hand, gently pull your head left and slightly forward. Hold 20 seconds each side.',
      durationSec: 45,
    },
    {
      id: 'levator-scapulae-stretch',
      name: 'Levator scapulae stretch',
      icon: '🧘',
      instruction:
        'Turn your head 45 degrees to the right, then tilt your chin down toward your armpit. Hold 20 seconds, then switch sides.',
      durationSec: 45,
    },
  ],
  back: [
    {
      id: 'seated-spinal-twist',
      name: 'Seated spinal twist',
      icon: '🔁',
      instruction:
        'Sit tall, place your right hand on the outside of your left knee. Gently rotate left and look over your left shoulder. Hold 20 seconds, then switch sides.',
      durationSec: 45,
    },
    {
      id: 'seated-cat-cow',
      name: 'Cat-cow at chair',
      icon: '🐱',
      instruction:
        'Hands on knees. Inhale and arch your back, chest forward, shoulders back. Exhale and round your spine, chin to chest. 10 slow cycles.',
      durationSec: 60,
    },
    {
      id: 'seated-forward-fold',
      name: 'Seated forward fold',
      icon: '🙇‍♂️',
      instruction:
        'Sit at the edge of your chair, feet flat. Hinge at your hips and fold forward, letting your hands hang toward the floor. Hold 30 seconds.',
      durationSec: 35,
    },
    {
      id: 'thoracic-extension',
      name: 'Thoracic extension',
      icon: '🪑',
      instruction:
        'Sit with your lower back against the chair back. Interlace fingers behind your head and gently arch backwards over the top of the chair back. Hold 10 seconds, repeat 3 times.',
      durationSec: 35,
    },
    {
      id: 'hip-flexor-stretch',
      name: 'Hip flexor stretch',
      icon: '🦵',
      instruction:
        'Sit at the edge of your chair. Slide your right foot back so the right knee drops lower than the hip. Sit tall and feel the stretch at the front of the right hip. Hold 30 seconds, then switch sides.',
      durationSec: 65,
    },
  ],
  posture: [
    {
      id: 'shoulder-blade-squeeze',
      name: 'Shoulder blade squeeze',
      icon: '💪',
      instruction:
        'Sit tall, arms relaxed at your sides. Squeeze your shoulder blades together, hold 5 seconds, then release. Repeat 10 times.',
      durationSec: 55,
    },
    {
      id: 'chest-opener',
      name: 'Chest opener',
      icon: '🫶',
      instruction:
        'Interlace your fingers behind your back. Straighten your arms, squeeze your shoulder blades, and lift your chest slightly. Hold 20 seconds.',
      durationSec: 30,
    },
    {
      id: 'wall-angel-chair',
      name: 'Wall angel at chair',
      icon: '🧎',
      instruction:
        'Sit tall with your back straight. Raise your arms to 90 degrees like a goalpost, then slowly raise them overhead and back down without letting your elbows drop below shoulder height. 10 reps.',
      durationSec: 50,
    },
    {
      id: 'ear-over-shoulder-check',
      name: 'Ear over shoulder check',
      icon: '🧍',
      instruction:
        'Sit tall. Imagine a string pulling the crown of your head toward the ceiling, and check that your ears are directly over your shoulders, not in front. Hold this position for 30 seconds.',
      durationSec: 35,
    },
    {
      id: 'diaphragm-breath',
      name: 'Diaphragm breath',
      icon: '🌬️',
      instruction:
        'Sit tall, one hand on your chest, one on your belly. Breathe in through your nose for 4 counts so your belly rises and your chest stays still. Hold 2 counts, then breathe out through your mouth for 6 counts. Repeat 5 times.',
      durationSec: 60,
    },
  ],
  energy: [
    {
      id: 'seated-march',
      name: 'Seated march',
      icon: '🏃',
      instruction:
        'Lift your knees alternately at a brisk pace, like marching in your chair, for 1 minute.',
      durationSec: 60,
    },
    {
      id: 'stand-and-reach',
      name: 'Stand & reach',
      icon: '🙌',
      instruction:
        'Stand up, reach both arms overhead, and rise onto your toes. Hold 10 seconds, repeat 5 times.',
      durationSec: 45,
    },
    {
      id: 'desk-pushups',
      name: 'Desk push-ups',
      icon: '🤲',
      instruction:
        'Place your hands on the edge of your desk, walk your feet back, and do 10 incline push-ups.',
      durationSec: 30,
    },
    {
      id: 'quick-walk',
      name: 'Quick walk',
      icon: '🚶',
      instruction:
        'Get up and walk briskly around your space, or grab some water, for 2 minutes.',
      durationSec: 2 * 60,
    },
    {
      id: 'standing-side-steps',
      name: 'Standing side steps',
      icon: '🤾',
      instruction:
        'Step side to side while raising your arms overhead, like a low-impact jumping jack, for 1 minute.',
      durationSec: 60,
    },
  ],
  quick: [
    {
      id: 'sixty-second-reset',
      name: '60-second reset',
      icon: '⏱️',
      instruction:
        'Roll your shoulders back 5 times, then gently tilt your head from side to side. Quick and easy.',
      durationSec: 60,
    },
    {
      id: 'shoulder-rolls',
      name: 'Shoulder rolls',
      icon: '🔄',
      instruction: 'Roll both shoulders backward in slow circles 10 times, then forward 10 times.',
      durationSec: 45,
    },
    {
      id: 'wrist-stretch',
      name: 'Wrist stretch',
      icon: '🤚',
      instruction:
        'Extend one arm with your palm up and gently pull your fingers back with your other hand. Hold 10 seconds each hand.',
      durationSec: 45,
    },
    {
      id: 'eye-break',
      name: 'Eye break (20-20-20)',
      icon: '👀',
      instruction: 'Look at something 20 feet away for 20 seconds to rest your eyes and refocus.',
      durationSec: 30,
    },
    {
      id: 'deep-breaths',
      name: 'Deep breaths',
      icon: '🌬️',
      instruction:
        'Take 5 slow, deep breaths — in through your nose for 4 counts, out through your mouth for 6.',
      durationSec: 60,
    },
  ],
};

// Maps each onboarding pain-point answer to a category in EXERCISE_LIBRARY.
const PAIN_TO_CATEGORY = {
  'neck-pain': 'neck',
  'back-pain': 'back',
  'low-energy': 'energy',
  'poor-posture': 'posture',
  'no-time': 'quick',
};

// Today's energy level sets the session length: how many distinct exercises
// to pull from the pool. Minimum of 3 so every session mixes across
// neck/back/posture instead of leaning on just one or two.
const ENERGY_SESSION_PLAN = {
  low: { exerciseCount: 3 }, // ~7 min
  medium: { exerciseCount: 4 }, // ~10 min
  high: { exerciseCount: 5 }, // ~12 min
};

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const MOCK_SCHEDULE = [
  { start: '09:00', end: '09:30', title: 'Standup' },
  { start: '11:00', end: '11:18', title: 'Design Review' },
  { start: '11:30', end: '12:00', title: 'Sprint Planning' },
  { start: '14:00', end: '14:30', title: '1:1' },
  { start: '15:30', end: '16:15', title: 'Team sync' },
];

let badgeTimer = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 30 });
  chrome.alarms.create(PRO_RECHECK_ALARM, { periodInMinutes: 60 });
  refreshCalendarAndSchedule();
  checkProStatus();
});

chrome.runtime.onStartup.addListener(() => {
  refreshCalendarAndSchedule();
  checkProStatus();
});

// Service workers can be evicted and re-spawned at any time. Re-run this on
// every wake so an in-progress session badge keeps counting down.
restoreSessionIfNeeded();

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    refreshCalendarAndSchedule();
    return;
  }
  if (alarm.name === PRO_RECHECK_ALARM) {
    checkProStatus({ force: true });
    return;
  }
  if (alarm.name.startsWith(BADGE_ALARM_PREFIX)) {
    fireResetNotification(alarm.name);
  }
});

// ---------------------------------------------------------------------------
// Notification interactions
// ---------------------------------------------------------------------------

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (!notificationId.startsWith(BADGE_ALARM_PREFIX)) return;

  if (buttonIndex === 0) {
    openExtensionUi();
  }

  handleNotificationButton(notificationId, buttonIndex);
});

/**
 * chrome.action.openPopup() only works while a Chrome window is focused and
 * the toolbar button is reachable — clicking a native OS notification button
 * doesn't satisfy that, so it silently rejects. Fall back to a small
 * standalone window showing the same popup.html, sized and positioned like
 * the toolbar popup (top-right corner of the browser window).
 */
async function openExtensionUi() {
  try {
    await chrome.action.openPopup();
    return;
  } catch {
    // No focused window to anchor the toolbar popup to — open a standalone one.
  }

  const width = 376;
  const height = 600;
  let left;
  let top;

  try {
    const current = await chrome.windows.getLastFocused();
    left = (current.left ?? 0) + (current.width ?? width) - width - 16;
    top = (current.top ?? 0) + 72;
  } catch {
    // No browser window at all — let Chrome pick a default position.
  }

  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width,
    height,
    left,
    top,
    focused: true,
  });
}

async function handleNotificationButton(notificationId, buttonIndex) {
  const { pendingNotifications = {} } = await chrome.storage.local.get('pendingNotifications');
  const receivedAt = pendingNotifications[notificationId];
  delete pendingNotifications[notificationId];
  await chrome.storage.local.set({ pendingNotifications });

  if (buttonIndex === 0) {
    // Start session
    await startSession(receivedAt);
  } else {
    // Skip
    await logEvent('skip', {
      timestamp: Date.now(),
      timeSinceNotificationMs: receivedAt ? Date.now() - receivedAt : null,
    });
  }

  chrome.notifications.clear(notificationId);
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith(BADGE_ALARM_PREFIX)) return;
  openExtensionUi();
});

// ---------------------------------------------------------------------------
// Messages from the popup
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'connect_calendar') {
    connectCalendar(message.contactOptIn).then(sendResponse);
    return true;
  }
  if (message?.type === 'use_mock') {
    useMockSchedule().then(sendResponse);
    return true;
  }
  if (message?.type === 'set_manual_schedule') {
    setManualSchedule(message.schedule).then(sendResponse);
    return true;
  }
  if (message?.type === 'refresh') {
    refreshCalendarAndSchedule().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'start_exercise') {
    startSession(null, message.category).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'session_next') {
    stepSession(1).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'session_prev') {
    stepSession(-1).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'session_done') {
    completeSession().then(sendResponse);
    return true;
  }
  if (message?.type === 'auth_send_code') {
    sendOtpCode(message.email).then(sendResponse);
    return true;
  }
  if (message?.type === 'auth_verify_code') {
    verifyOtpCode(message.email, message.code).then(sendResponse);
    return true;
  }
  if (message?.type === 'auth_sign_out') {
    signOut().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'check_pro_status') {
    checkProStatus({ force: !!message.force }).then(sendResponse);
    return true;
  }
  if (message?.type === 'check_onboarding_status') {
    checkOnboardingStatus().then(sendResponse);
    return true;
  }
  if (message?.type === 'mark_onboarding_complete') {
    markOnboardingComplete().then(sendResponse);
    return true;
  }
  if (message?.type === 'open_upgrade_page') {
    const url = `${UPGRADE_PAGE_URL}?email=${encodeURIComponent(message.email || '')}`;
    // Marks an upgrade as pending so checkProStatus bypasses its cache on
    // every popup open until the payment lands, instead of waiting up to
    // PRO_STATUS_TTL_MS to notice the user is now Pro.
    chrome.storage.local.set({ awaitingUpgrade: true })
      .then(() => chrome.tabs.create({ url }))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'open_manage_subscription') {
    const url = `${MANAGE_SUBSCRIPTION_URL}?email=${encodeURIComponent(message.email || '')}`;
    chrome.tabs.create({ url }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'open_notification_settings') {
    chrome.tabs.create({ url: 'chrome://settings/content/notifications' }).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

// ---------------------------------------------------------------------------
// Calendar connection
// ---------------------------------------------------------------------------

function connectCalendar(contactOptIn) {
  if (
    !GOOGLE_OAUTH_CLIENT_ID ||
    GOOGLE_OAUTH_CLIENT_ID.startsWith('YOUR_WEB_OAUTH_CLIENT_ID')
  ) {
    return Promise.resolve({ ok: false, error: 'oauth_not_configured' });
  }

  const scopes = contactOptIn
    ? [...GOOGLE_OAUTH_SCOPES, CONTACT_OPT_IN_SCOPE]
    : GOOGLE_OAUTH_SCOPES;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_OAUTH_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', chrome.identity.getRedirectURL());
  authUrl.searchParams.set('scope', scopes.join(' '));
  // Forces Google's account chooser every time, instead of silently
  // reusing whichever account was authorized last.
  authUrl.searchParams.set('prompt', 'select_account consent');

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          resolve({ ok: false, error: chrome.runtime.lastError?.message ?? 'No response from Google' });
          return;
        }

        const params = new URLSearchParams(new URL(responseUrl).hash.slice(1));
        const token = params.get('access_token');
        if (!token) {
          resolve({ ok: false, error: params.get('error') ?? 'No access token returned' });
          return;
        }

        await chrome.storage.local.set({ authToken: token, mode: 'calendar' });
        await refreshCalendarAndSchedule();
        if (contactOptIn) {
          await reportContactOptIn(token);
        }
        resolve({ ok: true });
      }
    );
  });
}

// Only ever called when the user explicitly checked "email me updates" in
// the popup — see popup.html's #contact-optin checkbox.
async function reportContactOptIn(token) {
  if (!CONTACT_SHEET_WEBHOOK_URL || CONTACT_SHEET_WEBHOOK_URL === 'YOUR_APPS_SCRIPT_WEBHOOK_URL') {
    console.warn('[9-5 Reset] CONTACT_SHEET_WEBHOOK_URL not configured — skipping contact capture.');
    return;
  }
  try {
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userInfo = await userInfoResponse.json();
    if (!userInfo.email) return;

    // text/plain + no-cors avoids a CORS preflight: Apps Script web apps
    // don't send Access-Control-Allow-Origin, so a normal JSON fetch() gets
    // blocked before the request ever reaches the script.
    await fetch(CONTACT_SHEET_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ email: userInfo.email, timestamp: Date.now() }),
    });
  } catch (err) {
    console.error('[9-5 Reset] reportContactOptIn failed:', err);
  }
}

async function useMockSchedule() {
  await chrome.storage.local.set({ mode: 'mock', authToken: null });
  await refreshCalendarAndSchedule();
  return { ok: true };
}

async function setManualSchedule(schedule) {
  await chrome.storage.local.set({ mode: 'manual', manualSchedule: schedule, authToken: null });
  await refreshCalendarAndSchedule();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Calendar fetch + gap detection
// ---------------------------------------------------------------------------

async function refreshCalendarAndSchedule() {
  const { authToken, mode, manualSchedule, language = 'en' } = await chrome.storage.local.get([
    'authToken',
    'mode',
    'manualSchedule',
    'language',
  ]);

  // Onboarding hasn't picked a schedule source yet — nothing to compute.
  if (!mode) return;

  let effectiveMode = mode;
  let events = [];
  let opportunities;

  if (effectiveMode === 'manual') {
    opportunities = generateManualOpportunities(manualSchedule, language);
  } else {
    if (effectiveMode === 'calendar' && authToken) {
      try {
        events = await fetchCalendarEvents(authToken, language);
      } catch (err) {
        console.warn('[9-5 Reset] calendar fetch failed, falling back to mock schedule', err);
        events = getMockEvents();
        effectiveMode = 'mock';
      }
    } else {
      events = getMockEvents();
      effectiveMode = 'mock';
    }
    opportunities = detectGaps(
      effectiveMode === 'calendar' ? withWorkdayBoundaries(events, language) : events
    );
  }

  await chrome.storage.local.set({
    events,
    opportunities,
    mode: effectiveMode,
    lastRefresh: Date.now(),
  });

  const { isPro } = await checkProStatus();
  await scheduleNotifications(opportunities, isPro);
}

async function fetchCalendarEvents(token, language = 'en') {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    if (response.status === 401) {
      await chrome.identity.removeCachedAuthToken({ token });
    }
    throw new Error(`Calendar API responded with ${response.status}`);
  }

  const data = await response.json();
  return (data.items ?? [])
    .filter((item) => item.start?.dateTime && item.end?.dateTime) // drop all-day events
    .map((item) => ({
      title: item.summary || I18N.t(language, 'noEventTitle'),
      start: item.start.dateTime,
      end: item.end.dateTime,
    }));
}

function getMockEvents() {
  return MOCK_SCHEDULE.map(({ start, end, title }) => ({
    title,
    start: todayAtTime(start),
    end: todayAtTime(end),
  }));
}

function todayAtTime(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * Manual-schedule mode: no calendar to find gaps in, so instead suggest a
 * reset every MANUAL_INTERVAL_MIN within the user's work hours, using the
 * same buffer/window sizing as calendar-based opportunities.
 */
function generateManualOpportunities(manualSchedule, language = 'en') {
  const { start = '09:00', end = '17:00', lunchStart, lunchEnd, hourly } = manualSchedule || {};
  const dayStartMs = new Date(todayAtTime(start)).getTime();
  const dayEndMs = new Date(todayAtTime(end)).getTime();
  const lunchStartMs = lunchStart ? new Date(todayAtTime(lunchStart)).getTime() : null;
  const lunchEndMs = lunchEnd ? new Date(todayAtTime(lunchEnd)).getTime() : null;

  const intervalMin = hourly ? 60 : MANUAL_INTERVAL_MIN;
  const blockMin = MIN_USABLE_MIN + BUFFER_END_MIN;
  const opportunities = [];

  let gapStartMs = dayStartMs + intervalMin * 60000;
  while (gapStartMs + blockMin * 60000 <= dayEndMs) {
    const gapEndMs = gapStartMs + blockMin * 60000;
    const windowStartMs = gapStartMs;
    const windowEndMs = gapEndMs - BUFFER_END_MIN * 60000;

    // Skip reset windows that overlap the user's lunch break — that's
    // already a break, no notification needed.
    const overlapsLunch =
      lunchStartMs != null &&
      lunchEndMs != null &&
      windowStartMs < lunchEndMs &&
      windowEndMs > lunchStartMs;

    if (!overlapsLunch) {
      opportunities.push({
        afterEvent: I18N.t(language, 'placeholderWorkSession'),
        beforeEvent: I18N.t(language, 'placeholderNextWorkSession'),
        gapStart: new Date(gapStartMs).toISOString(),
        gapEnd: new Date(gapEndMs).toISOString(),
        windowStart: new Date(windowStartMs).toISOString(),
        windowEnd: new Date(windowEndMs).toISOString(),
        notifyAt: new Date(windowStartMs).toISOString(),
      });
    }

    gapStartMs += intervalMin * 60000;
  }

  return opportunities;
}

/**
 * Bookends fetched calendar events with zero-duration markers for the
 * default workday start/end, so detectGaps can also surface a reset before
 * the first meeting and after the last one (otherwise a day with 0-1
 * meetings produces zero opportunities).
 */
function withWorkdayBoundaries(events, language = 'en') {
  return [
    ...events,
    {
      title: I18N.t(language, 'placeholderDayStarts'),
      start: todayAtTime(DEFAULT_WORKDAY_START),
      end: todayAtTime(DEFAULT_WORKDAY_START),
    },
    {
      title: I18N.t(language, 'placeholderDayEnds'),
      start: todayAtTime(DEFAULT_WORKDAY_END),
      end: todayAtTime(DEFAULT_WORKDAY_END),
    },
  ];
}

/**
 * Gap detection algorithm:
 * - Sort events by start time
 * - For each consecutive pair, gap = next.start - current.end
 * - If gap >= 10 min, buffer 3 min off the end (don't notify right before
 *   the next meeting starts)
 * - If the buffered window is still >= 7 min, it's a reset opportunity,
 *   notified at window start (== the moment the previous meeting ends)
 */
function detectGaps(events) {
  const sorted = [...events]
    .map((event) => ({
      ...event,
      startMs: new Date(event.start).getTime(),
      endMs: new Date(event.end).getTime(),
    }))
    .sort((a, b) => a.startMs - b.startMs);

  const opportunities = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gapMin = (next.startMs - current.endMs) / 60000;
    if (gapMin < MIN_GAP_MIN) continue;

    const windowStartMs = current.endMs;
    const windowEndMs = next.startMs - BUFFER_END_MIN * 60000;
    const usableMin = (windowEndMs - windowStartMs) / 60000;
    if (usableMin < MIN_USABLE_MIN) continue;

    opportunities.push({
      afterEvent: current.title,
      beforeEvent: next.title,
      gapStart: new Date(current.endMs).toISOString(),
      gapEnd: new Date(next.startMs).toISOString(),
      windowStart: new Date(windowStartMs).toISOString(),
      windowEnd: new Date(windowEndMs).toISOString(),
      notifyAt: new Date(windowStartMs).toISOString(),
    });
  }

  return opportunities;
}

async function scheduleNotifications(opportunities, isPro) {
  const existing = await chrome.alarms.getAll();
  await Promise.all(
    existing
      .filter((alarm) => alarm.name.startsWith(BADGE_ALARM_PREFIX))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );

  // refreshCalendarAndSchedule() can run again (popup reopened, 30-min
  // refresh alarm) while an opportunity's window is still open. Track which
  // opportunities have already fired so we don't re-notify for the same one.
  const { notifiedOpportunities = [] } = await chrome.storage.local.get('notifiedOpportunities');
  const notifyAtKeys = new Set(opportunities.map((o) => o.notifyAt));
  const prunedNotified = notifiedOpportunities.filter((notifyAt) => notifyAtKeys.has(notifyAt));
  if (prunedNotified.length !== notifiedOpportunities.length) {
    await chrome.storage.local.set({ notifiedOpportunities: prunedNotified });
  }
  const notifiedSet = new Set(prunedNotified);

  const now = Date.now();
  opportunities.forEach((opportunity, index) => {
    // Free tier only gets notified for the same first FREE_VISIBLE_SESSIONS
    // opportunities it can actually see unblurred in the popup — otherwise
    // tapping "Start session" on the notification would unlock a session
    // the paywall is supposed to be hiding. Once Pro is active, all fire.
    if (!isPro && index >= FREE_VISIBLE_SESSIONS) return;

    if (notifiedSet.has(opportunity.notifyAt)) return; // already notified for this window

    const notifyAtMs = new Date(opportunity.notifyAt).getTime();
    const windowEndMs = new Date(opportunity.windowEnd).getTime();
    if (windowEndMs <= now) return; // the whole gap has already passed

    // If notifyAt already passed (e.g. the service worker woke up late),
    // fire as soon as possible rather than skipping the reset entirely.
    const when = Math.max(notifyAtMs, now + 1000);
    chrome.alarms.create(`${BADGE_ALARM_PREFIX}${index}`, { when });
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function fireResetNotification(alarmName) {
  const index = Number(alarmName.slice(BADGE_ALARM_PREFIX.length));
  const { opportunities = [] } = await chrome.storage.local.get('opportunities');
  const opportunity = opportunities[index];
  if (!opportunity) {
    await logEvent('notification_skipped', {
      timestamp: Date.now(),
      alarmName,
      reason: 'no_opportunity',
    });
    return;
  }

  const minutesUntilNext = Math.max(
    1,
    Math.round((new Date(opportunity.gapEnd).getTime() - Date.now()) / 60000)
  );

  const permissionLevel = await chrome.notifications.getPermissionLevel();
  const { language = 'en' } = await chrome.storage.local.get('language');

  // Without this, create() below silently no-ops (no toast, no error) and
  // we'd log a false "notification_received" — exactly the kind of failure
  // a user reports as "I never got the reminder" with nothing in our logs.
  if (permissionLevel !== 'granted') {
    await chrome.storage.local.set({ notificationsBlocked: true });
    await logEvent('notification_skipped', {
      timestamp: Date.now(),
      alarmName,
      reason: 'permission_denied',
      permissionLevel,
    });
    return;
  }
  await chrome.storage.local.set({ notificationsBlocked: false });

  // Each fire gets a unique notification ID. Chrome treats notifications.create()
  // with an ID that's already on screen as an in-place update — on Windows that
  // does not re-pop the toast banner, so reusing `alarmName` made repeat resets
  // (notify-0, notify-1, ...) silently fail to appear after the first time.
  const notificationId = `${alarmName}-${Date.now()}`;

  let notificationError = null;
  const createdId = await new Promise((resolve) => {
    chrome.notifications.create(
      notificationId,
      {
        type: 'basic',
        iconUrl: 'giraffe-neutral.png',
        title: I18N.t(language, 'notifyTitle', {
          min: minutesUntilNext,
          event: opportunity.beforeEvent,
        }),
        message: I18N.t(language, 'notifyMessage'),
        buttons: [
          { title: I18N.t(language, 'notifyStart') },
          { title: I18N.t(language, 'notifySkip') },
        ],
        priority: 2,
        requireInteraction: true,
      },
      (id) => {
        // chrome.runtime.lastError is only valid synchronously inside this
        // callback — read it here, not after the `await` above, or it's
        // already been cleared and every failure looks like a success.
        notificationError = chrome.runtime.lastError?.message ?? null;
        resolve(id);
      }
    );
  });
  if (notificationError) {
    console.error('[9-5 Reset] notifications.create failed:', notificationError);
  }

  const receivedAt = Date.now();
  const { pendingNotifications = {} } = await chrome.storage.local.get('pendingNotifications');
  pendingNotifications[createdId] = receivedAt;
  await chrome.storage.local.set({ pendingNotifications });

  // Mark this opportunity as notified so a later refresh doesn't re-fire it.
  const { notifiedOpportunities = [] } = await chrome.storage.local.get('notifiedOpportunities');
  if (!notifiedOpportunities.includes(opportunity.notifyAt)) {
    await chrome.storage.local.set({
      notifiedOpportunities: [...notifiedOpportunities, opportunity.notifyAt],
    });
  }

  const gapDurationMin = Math.round(
    (new Date(opportunity.gapEnd).getTime() - new Date(opportunity.gapStart).getTime()) / 60000
  );

  await logEvent('notification_received', {
    timestamp: receivedAt,
    gapDurationMin,
    meetingName: opportunity.beforeEvent,
    permissionLevel,
    notificationId,
    notificationError,
  });
}

// ---------------------------------------------------------------------------
// Session timer + badge
// ---------------------------------------------------------------------------

/**
 * Picks today's session exercises. If categoryOverride is given (from the
 * "Reset anytime" shortcuts), the pool is that single category; otherwise
 * the general pool always mixes neck + back + posture so sessions don't
 * lean on whichever single pain point the user picked during onboarding.
 * Today's energy level (chrome.storage.local: energyMode.level) sets how
 * many distinct exercises to include via ENERGY_SESSION_PLAN. Selection is
 * randomized (shuffle, no repeats within a session) rather than a fixed
 * rotation, so back-to-back sessions don't feel identical.
 */
async function pickExercises(categoryOverride) {
  const { onboarding = {}, energyMode } = await chrome.storage.local.get([
    'onboarding',
    'energyMode',
  ]);

  // A stale energyMode from a previous day shouldn't silently size today's
  // session — only use it if it was picked today.
  const todaysEnergyLevel = energyMode?.date === todayKey() ? energyMode.level : null;

  let pool;
  if (categoryOverride && EXERCISE_LIBRARY[categoryOverride]) {
    pool = EXERCISE_LIBRARY[categoryOverride];
  } else {
    const painPoints = onboarding.painPoints || [];

    // "No time to exercise" always wins — keep it short regardless of other pains.
    if (painPoints.includes('no-time')) {
      pool = EXERCISE_LIBRARY.quick;
    } else {
      pool = [...EXERCISE_LIBRARY.neck, ...EXERCISE_LIBRARY.back, ...EXERCISE_LIBRARY.posture];

      // Low energy today and the user flagged it as a recurring problem —
      // weight toward energizing movement.
      if (todaysEnergyLevel === 'low' && painPoints.includes('low-energy')) {
        pool = [...EXERCISE_LIBRARY.energy, ...pool];
      }
    }
  }

  const plan = ENERGY_SESSION_PLAN[todaysEnergyLevel] || ENERGY_SESSION_PLAN.medium;
  const exerciseCount = Math.min(plan.exerciseCount, pool.length);

  return shuffle(pool).slice(0, exerciseCount);
}

async function startSession(notificationReceivedAt, category) {
  const exercises = await pickExercises(category);
  // 'quick' = started from a "Reset anytime" button inside the open popup,
  // so completing it should return to state-today, not close the popup.
  // 'notification' = started from a native OS notification's Start button,
  // which can spawn its own standalone popup-type window — closing that one
  // on completion is the right behavior (see onSessionDoneAcknowledge).
  const origin = category ? 'quick' : 'notification';

  const startTime = Date.now();
  await beginSessionExercise(exercises, 0, startTime, origin);

  await logEvent('start_session', {
    timestamp: startTime,
    timeSinceNotificationMs: notificationReceivedAt ? startTime - notificationReceivedAt : null,
    category: category || null,
  });
}

/**
 * Activates exercises[index] as the current exercise, (re)starting its
 * countdown. sequenceStartTime and origin are preserved across steps (via
 * the existing stored session) so completeSession/onSessionDoneAcknowledge
 * can read them at the end of the playlist, not just on the first exercise.
 */
async function beginSessionExercise(exercises, index, sequenceStartTime, origin) {
  const { session: existing } = await chrome.storage.local.get('session');
  const exercise = exercises[index];
  const startTime = Date.now();
  const endTime = startTime + exercise.durationSec * 1000;

  await chrome.storage.local.set({
    session: {
      active: true,
      exercises,
      currentIndex: index,
      exercise,
      startTime,
      endTime,
      sequenceStartTime: sequenceStartTime ?? existing?.sequenceStartTime ?? startTime,
      origin: origin ?? existing?.origin ?? 'notification',
    },
  });

  startBadgeCountdown(endTime);
}

async function stepSession(direction) {
  const { session } = await chrome.storage.local.get('session');
  if (!session?.active) return;

  const nextIndex = session.currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= session.exercises.length) return;

  await beginSessionExercise(session.exercises, nextIndex);
}

async function completeSession() {
  const { session } = await chrome.storage.local.get('session');
  if (!session?.active) return { ok: true };

  await finishSession(session);
  return { ok: true };
}

/**
 * Ends a session (whether the user tapped Done or the last exercise's
 * timer ran out) and marks it justCompleted so the popup shows the
 * "Good job!" screen.
 */
async function finishSession(session) {
  stopBadgeCountdown();

  const sessionDurationSec = Math.round(
    (Date.now() - (session.sequenceStartTime ?? session.startTime)) / 1000
  );
  await logEvent('done', {
    timestamp: Date.now(),
    sessionDurationSec,
    completed: true,
  });

  await chrome.storage.local.set({
    session: { ...session, active: false, justCompleted: true },
  });
}

async function restoreSessionIfNeeded() {
  const { session } = await chrome.storage.local.get('session');
  if (!session?.active) return;

  if (session.endTime > Date.now()) {
    startBadgeCountdown(session.endTime);
  } else {
    await handleSessionExpired();
  }
}

function startBadgeCountdown(endTime) {
  stopBadgeCountdown();
  chrome.action.setBadgeBackgroundColor({ color: '#1D9E75' });
  updateBadge(endTime);
  badgeTimer = setInterval(() => updateBadge(endTime), 1000);
}

function stopBadgeCountdown() {
  if (badgeTimer) {
    clearInterval(badgeTimer);
    badgeTimer = null;
  }
  chrome.action.setBadgeText({ text: '' });
}

function updateBadge(endTime) {
  const remainingMs = endTime - Date.now();
  if (remainingMs <= 0) {
    stopBadgeCountdown();
    handleSessionExpired();
    return;
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  chrome.action.setBadgeText({ text: `${minutes}:${String(seconds).padStart(2, '0')}` });
}

async function handleSessionExpired() {
  const { session } = await chrome.storage.local.get('session');
  if (!session?.active) return;

  await logEvent('timer_expired', { timestamp: Date.now(), completed: false });

  // Only end the whole session if the last exercise in the playlist ran out —
  // earlier exercises sit at 0:00 until the popup's timer (re)opens and
  // advances to the next exercise.
  const isLastExercise = session.currentIndex === session.exercises.length - 1;
  if (isLastExercise) {
    await finishSession(session);
  }
}

// ---------------------------------------------------------------------------
// Completion log
// ---------------------------------------------------------------------------

async function logEvent(type, data) {
  const { log = [] } = await chrome.storage.local.get('log');
  log.push({ type, ...data });
  await chrome.storage.local.set({ log });
}

// ---------------------------------------------------------------------------
// Supabase auth (email OTP) + Pro entitlement
// ---------------------------------------------------------------------------
//
// No Supabase SDK is bundled here. MV3 service workers are killed and
// respawned constantly, so there's no long-lived JS context for the SDK's
// in-memory session/auto-refresh to live in — instead we talk to Supabase's
// Auth (GoTrue) and PostgREST HTTP APIs directly with fetch() and persist
// the session ourselves in chrome.storage.local (key: authSession).
//
// Sign-in is OTP-by-code (not magic link): a link would redirect to a web
// page with no way back into the extension popup, but a 6-digit code typed
// into the popup works regardless. This requires the Supabase email
// template (Authentication -> Email Templates -> Magic Link) to include
// {{ .Token }} — the default template only links {{ .ConfirmationURL }}.

function supabaseHeaders(accessToken) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  };
}

async function sendOtpCode(email) {
  if (!email) return { ok: false, error: 'missing_email' };
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify({ email, create_user: true }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = body.error_description || body.msg || `HTTP ${response.status}`;
      console.error('[9-5 Reset] sendOtpCode failed:', response.status, body);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    console.error('[9-5 Reset] sendOtpCode threw:', err);
    return { ok: false, error: err.message };
  }
}

async function verifyOtpCode(email, code) {
  if (!email || !code) return { ok: false, error: 'missing_email_or_code' };
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify({ email, token: code, type: 'email' }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      return { ok: false, error: body.error_description || body.msg || `HTTP ${response.status}` };
    }

    await saveSession(body, email);
    const proResult = await checkProStatus({ force: true });
    return { ok: true, email, isPro: proResult.isPro };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function saveSession(tokenResponse, fallbackEmail) {
  // Normalized to lowercase/trimmed so it matches the subscribers row
  // regardless of how the email was cased at signup — this is also the
  // value sent to the Polar checkout link as ?customer_email=.
  const email = (tokenResponse.user?.email || fallbackEmail || '').toLowerCase().trim();
  const session = {
    email,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
  };
  await chrome.storage.local.set({ authSession: session });
  return session;
}

async function refreshSessionIfNeeded() {
  const { authSession } = await chrome.storage.local.get('authSession');
  if (!authSession) return null;

  // Refresh a bit before actual expiry so a check right after this still works.
  if (authSession.expiresAt - Date.now() > 60_000) return authSession;

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify({ refresh_token: authSession.refreshToken }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      // Refresh token is dead — the user has to sign in again.
      await chrome.storage.local.set({ authSession: null, proStatus: null });
      return null;
    }
    return await saveSession(body, authSession.email);
  } catch (err) {
    console.error('[9-5 Reset] session refresh failed:', err);
    return authSession; // keep the maybe-stale session rather than signing out on a network blip
  }
}

async function signOut() {
  await chrome.storage.local.set({ authSession: null, proStatus: null });
  await chrome.storage.local.remove('awaitingUpgrade');
}

/**
 * Reads subscribers.is_pro for the signed-in user's email. Cached in
 * chrome.storage.local (proStatus) for PRO_STATUS_TTL_MS so popup renders
 * don't hammer Supabase — only force:true (right after sign-in, or the
 * hourly PRO_RECHECK_ALARM) bypasses the cache.
 */
async function checkProStatus({ force = false } = {}) {

  const session = await refreshSessionIfNeeded();
  if (!session) {
    await chrome.storage.local.set({ proStatus: null });
    return { isPro: false };
  }

  const { awaitingUpgrade } = await chrome.storage.local.get('awaitingUpgrade');

  if (!force && !awaitingUpgrade) {
    const { proStatus } = await chrome.storage.local.get('proStatus');
    if (
      proStatus &&
      proStatus.email === session.email &&
      Date.now() - proStatus.checkedAt < PRO_STATUS_TTL_MS
    ) {
      return proStatus;
    }
  }

  try {
    // ilike (no wildcards) instead of eq: case-insensitive match, so a
    // subscribers row written with different email casing (e.g. from a
    // Polar checkout) is still found. See supabase-pro-subscribers.sql.
    const params = new URLSearchParams({ select: 'is_pro,plan', email: `ilike.${session.email}` });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?${params.toString()}`, {
      headers: supabaseHeaders(session.accessToken),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    const row = rows[0];

    const status = {
      isPro: !!row?.is_pro,
      plan: row?.plan ?? null,
      email: session.email,
      checkedAt: Date.now(),
    };
    await chrome.storage.local.set({ proStatus: status });
    if (status.isPro && awaitingUpgrade) {
      await chrome.storage.local.remove('awaitingUpgrade');
    }
    return status;
  } catch (err) {
    console.error('[9-5 Reset] checkProStatus failed:', err);
    // Keep whatever was cached rather than locking the user out on a network blip.
    const { proStatus } = await chrome.storage.local.get('proStatus');
    return proStatus || { isPro: false };
  }
}

/**
 * Reads onboarding_status.onboarded for the signed-in user's email — this is
 * what lets a returning email (new device, reinstalled extension, cleared
 * storage) skip the onboarding questions instead of being asked again. The
 * local `onboarding.completed` flag alone can't do this since it's per
 * install, not per account. See supabase-onboarding-status.sql.
 */
async function checkOnboardingStatus() {
  const session = await refreshSessionIfNeeded();
  if (!session) return { onboarded: false };

  try {
    const params = new URLSearchParams({ select: 'onboarded', email: `ilike.${session.email}` });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_status?${params.toString()}`, {
      headers: supabaseHeaders(session.accessToken),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    return { onboarded: !!rows[0]?.onboarded };
  } catch (err) {
    console.error('[9-5 Reset] checkOnboardingStatus failed:', err);
    // Unknown rather than false: a network blip shouldn't force a returning
    // user back through onboarding. The caller falls back to the local flag.
    return { onboarded: null };
  }
}

/** Marks the signed-in user's email as onboarded, once onboarding completes locally. */
async function markOnboardingComplete() {
  const session = await refreshSessionIfNeeded();
  if (!session) return { ok: false };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_status`, {
      method: 'POST',
      headers: { ...supabaseHeaders(session.accessToken), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ email: session.email, onboarded: true }]),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { ok: true };
  } catch (err) {
    console.error('[9-5 Reset] markOnboardingComplete failed:', err);
    return { ok: false };
  }
}
