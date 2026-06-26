// 9-5 Reset — popup logic
// Renders one of several states based on chrome.storage.local:
//   0. state-signin-* — mandatory sign-in gate, shown whenever there's no session
//   1. state-onb-*     — first-run onboarding (workday type, pain points, setup)
//   2. state-energy    — once-per-day energy check
//   3. state-today     — today's gaps and upcoming sessions
//   4. state-session   — a reset session is active

const STATE_IDS = [
  'state-onb-workday',
  'state-onb-pain',
  'state-onb-setup',
  'state-energy',
  'state-today',
  'state-session',
  'state-session-done',
  'state-signin-email',
  'state-signin-code',
  'state-paywall-calendar',
];

const FREE_VISIBLE_SESSIONS = 2;

const ONBOARDING_STEPS = ['state-onb-workday', 'state-onb-pain', 'state-onb-setup'];

document.addEventListener('DOMContentLoaded', init);

let currentLang = 'en';

async function init() {
  const { language } = await chrome.storage.local.get('language');
  currentLang = language || 'en';

  wireLangSwitch();
  wireOnboarding();
  wireEnergy();
  wireQuickExercises();
  wireSessionControls();
  wireAuth();
  wireAccountWidget();
  wireModeWidget();
  wirePaywallCalendar();
  wireSessionUpsell();
  wireNotifPermissionBanner();

  // A reset session can start from a notification button click while this
  // popup is already open (or just before it finishes opening) — re-render
  // so it jumps straight to the session view.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.session) {
      render();
    }
  });

  await render();
}

function wireLangSwitch() {
  const btn = document.getElementById('lang-switch-btn');
  const menu = document.getElementById('lang-menu');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  document.querySelectorAll('.lang-option').forEach((opt) => {
    opt.addEventListener('click', async () => {
      currentLang = opt.dataset.lang;
      await chrome.storage.local.set({ language: currentLang });
      menu.classList.add('hidden');
      await render();
    });
  });

  document.addEventListener('click', () => menu.classList.add('hidden'));
  updateLangMenuActive();
}

function updateLangMenuActive() {
  document.querySelectorAll('.lang-option').forEach((opt) => {
    opt.classList.toggle('active', opt.dataset.lang === currentLang);
  });
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = I18N.t(currentLang, el.dataset.i18n);
  });
  updateLangMenuActive();
}

async function render() {
  applyStaticTranslations();
  const { session, onboarding, energyMode, uiOverlay, authSession } = await chrome.storage.local.get([
    'session',
    'onboarding',
    'energyMode',
    'uiOverlay',
    'authSession',
  ]);

  if (session?.active) {
    renderSession(session);
    showState('state-session');
    return;
  }

  stopSessionTimer();

  if (session?.justCompleted) {
    showState('state-session-done');
    return;
  }

  if (uiOverlay) {
    await renderUiOverlay(uiOverlay);
    return;
  }

  // Sign-in is the mandatory front gate: nothing else (onboarding, today)
  // renders until there's a session. Onboarding's own completed/not-completed
  // state (set locally, untouched by sign-out) is what then distinguishes a
  // brand-new run from a returning one on this install.
  if (!authSession) {
    document.getElementById('signin-email-error').classList.add('hidden');
    document.getElementById('signin-back-btn').classList.add('hidden');
    showState('state-signin-email');
    return;
  }

  if (!onboarding?.completed) {
    await renderOnboardingStep(onboarding);
    return;
  }

  if (!energyMode || energyMode.date !== todayKey()) {
    showState('state-energy');
    return;
  }

  await chrome.runtime.sendMessage({ type: 'refresh' });
  await renderToday();
  showState('state-today');
}

function showState(activeId) {
  STATE_IDS.forEach((id) => {
    document.getElementById(id).classList.toggle('hidden', id !== activeId);
  });
  updateLangSwitchPlacement(activeId);
}

/**
 * #lang-switch normally floats fixed in the top-right corner (fine on
 * screens with no header). The today view has its own header row with
 * mode-badge/account-btn already in that corner, so there move the same
 * node (not a clone — keeps its existing listeners) into .header-right as
 * a real flex child, which is what actually lines it up via
 * align-items: center instead of an independent fixed position.
 */
function updateLangSwitchPlacement(activeId) {
  const langSwitch = document.getElementById('lang-switch');
  const headerRight = document.getElementById('header-right');

  if (activeId === 'state-today') {
    headerRight.appendChild(langSwitch);
    langSwitch.classList.add('lang-switch--inline');
  } else if (langSwitch.classList.contains('lang-switch--inline')) {
    document.body.insertBefore(langSwitch, document.body.firstChild);
    langSwitch.classList.remove('lang-switch--inline');
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Onboarding (steps 1-3)
// ---------------------------------------------------------------------------

async function renderOnboardingStep(onboarding) {
  const step = onboarding?.step ?? 0;
  const stepId = ONBOARDING_STEPS[Math.min(step, ONBOARDING_STEPS.length - 1)];

  if (stepId === 'state-onb-workday') {
    setSingleSelection('workday', onboarding?.workdayType);
  }
  if (stepId === 'state-onb-pain') {
    setMultiSelection('pain', onboarding?.painPoints || []);
    updatePainContinueState();
  }
  if (stepId === 'state-onb-setup') {
    const { isPro } = await getAuthAndProState();
    document.getElementById('connect-btn-pro-badge').classList.toggle('hidden', isPro);
  }

  showState(stepId);
}

function setSingleSelection(group, value) {
  document
    .querySelectorAll(`[data-group="${group}"] .option-btn, [data-group="${group}"] .segmented-btn`)
    .forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.value === value);
    });
}

function setMultiSelection(group, values) {
  document.querySelectorAll(`.option-list[data-group="${group}"] .option-btn`).forEach((btn) => {
    btn.classList.toggle('selected', values.includes(btn.dataset.value));
  });
}

function wireOnboarding() {
  // Back button: return to the previous onboarding step
  document.querySelectorAll('.onboarding-back-btn').forEach((btn) => {
    btn.addEventListener('click', onOnboardingBack);
  });

  // Step 1: workday type (single-select, auto-advance)
  wireSingleSelect('workday', async (value) => {
    await saveOnboarding({ workdayType: value, step: 1 });
    await render();
  });

  // Step 2: pain points (multi-select, Continue button)
  document.querySelectorAll('.option-list[data-group="pain"] .option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      updatePainContinueState();
    });
  });

  document.getElementById('pain-continue-btn').addEventListener('click', async () => {
    const selected = Array.from(
      document.querySelectorAll('.option-list[data-group="pain"] .option-btn.selected')
    ).map((btn) => btn.dataset.value);
    await saveOnboarding({ painPoints: selected, step: 2 });
    await render();
  });

  // Step 3: connect calendar, set work hours manually, or use the sample calendar
  // Calendar sync is Pro-only — requirePro() shows sign-in / the paywall
  // screen first if needed, and only calls onConnect() once the user is
  // actually signed in and Pro.
  document.getElementById('connect-btn').addEventListener('click', () => requirePro('connect_calendar'));
  document.getElementById('manual-toggle-btn').addEventListener('click', () => {
    document.getElementById('manual-form').classList.toggle('hidden');
  });
  document.getElementById('manual-save-btn').addEventListener('click', onSaveManualSchedule);
  document.getElementById('skip-btn').addEventListener('click', onSkip);
}

function wireSingleSelect(group, onSelect) {
  document.querySelectorAll(`.option-list[data-group="${group}"] .option-btn`).forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.value));
  });
}

function updatePainContinueState() {
  const anySelected =
    document.querySelectorAll('.option-list[data-group="pain"] .option-btn.selected').length > 0;
  document.getElementById('pain-continue-btn').disabled = !anySelected;
}

async function saveOnboarding(patch) {
  const { onboarding = {} } = await chrome.storage.local.get('onboarding');
  await chrome.storage.local.set({ onboarding: { ...onboarding, ...patch } });
}

// Local onboarding.completed is per-install, so a returning email signing in
// on a fresh install/profile would otherwise be asked the questions again.
// Called right after sign-in to pull the server-side answer (see
// background.js's checkOnboardingStatus) into the local flag.
async function syncOnboardingStatusFromServer() {
  const { onboarded } = await chrome.runtime.sendMessage({ type: 'check_onboarding_status' });
  if (onboarded) {
    await saveOnboarding({ completed: true });
  }
}

// The three onboarding exit points (connect calendar, save manual hours,
// skip to sample calendar) all funnel through here so the server-side flag
// is always kept in sync with the local one.
async function completeOnboarding() {
  await saveOnboarding({ completed: true });
  await chrome.runtime.sendMessage({ type: 'mark_onboarding_complete' });
}

async function onOnboardingBack() {
  const { onboarding = {} } = await chrome.storage.local.get('onboarding');
  const step = onboarding?.step ?? 0;
  if (step <= 0) return;
  await saveOnboarding({ step: step - 1 });
  await render();
}

async function onConnect() {
  const button = document.getElementById('connect-btn');
  button.disabled = true;
  button.textContent = I18N.t(currentLang, 'connectBtnConnecting');

  const contactOptIn = document.getElementById('contact-optin').checked;
  const result = await chrome.runtime.sendMessage({ type: 'connect_calendar', contactOptIn });

  if (result?.ok) {
    await completeOnboarding();
    await render();
    return;
  }

  button.disabled = false;
  button.textContent = I18N.t(currentLang, 'connectBtnRetry');

  if (result?.error === 'oauth_not_configured') {
    // eslint-disable-next-line no-alert
    alert(I18N.t(currentLang, 'oauthNotConfiguredAlert'));
    return;
  }

  // eslint-disable-next-line no-alert
  alert(I18N.t(currentLang, 'connectFailedAlert'));
}

async function onSaveManualSchedule() {
  const start = document.getElementById('manual-start').value || '09:00';
  const end = document.getElementById('manual-end').value || '17:00';
  const lunchStart = document.getElementById('manual-lunch-start').value || '12:00';
  const lunchEnd = document.getElementById('manual-lunch-end').value || '13:00';
  const hourly = document.getElementById('manual-hourly').checked;
  await chrome.runtime.sendMessage({
    type: 'set_manual_schedule',
    schedule: { start, end, lunchStart, lunchEnd, hourly },
  });
  await completeOnboarding();
  await render();
}

async function onSkip() {
  await chrome.runtime.sendMessage({ type: 'use_mock' });
  await completeOnboarding();
  await render();
}

// ---------------------------------------------------------------------------
// Daily energy check
// ---------------------------------------------------------------------------

function wireEnergy() {
  wireSingleSelect('energy', async (value) => {
    await chrome.storage.local.set({ energyMode: { date: todayKey(), level: value } });
    await render();
  });
}

// ---------------------------------------------------------------------------
// Reset anytime (quick-start buttons)
// ---------------------------------------------------------------------------

function wireQuickExercises() {
  document.querySelectorAll('.exercise-quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => onStartExercise(btn.dataset.category));
  });
}

async function onStartExercise(category) {
  await chrome.runtime.sendMessage({ type: 'start_exercise', category });
  await render();
}

// ---------------------------------------------------------------------------
// Today view
// ---------------------------------------------------------------------------

async function renderToday() {
  const { opportunities = [], mode, manualSchedule } = await chrome.storage.local.get([
    'opportunities',
    'mode',
    'manualSchedule',
  ]);

  document.getElementById('mode-badge').textContent = I18N.t(
    currentLang,
    mode === 'manual' ? 'modeManual' : mode === 'mock' ? 'modeMock' : 'modeCalendar'
  );
  renderModeSwitchOptions(mode, manualSchedule);

  // Re-checks Pro status (TTL-cached in background.js, so this doesn't hit
  // Supabase on every single popup open — only once the cache goes stale).
  const proState = await getAuthAndProState();
  renderAccountWidget(proState);

  renderCountdown(opportunities, proState.isPro);
  renderSessionList(opportunities, proState.isPro);
  await renderNotifPermissionBanner();
}

// background.js sets this whenever a scheduled reminder couldn't actually be
// shown because the user (or their OS) has notifications blocked — without
// this banner that failure is invisible to the user.
async function renderNotifPermissionBanner() {
  const { notificationsBlocked } = await chrome.storage.local.get('notificationsBlocked');
  document.getElementById('notif-permission-banner').classList.toggle('hidden', !notificationsBlocked);
}

function wireNotifPermissionBanner() {
  document.getElementById('notif-permission-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open_notification_settings' });
  });
}

// Tapping the mode-badge opens a panel offering the opposite schedule
// source: a calendar user is offered "set manually" and vice versa. 'mock'
// (sample calendar, used when onboarding was skipped) isn't really either,
// so both options are offered.
function renderModeSwitchOptions(mode, manualSchedule) {
  document.getElementById('mode-connect-btn').classList.toggle('hidden', mode === 'calendar');
  document.getElementById('mode-manual-toggle-btn').classList.toggle('hidden', mode === 'manual');
  if (mode === 'manual') {
    document.getElementById('mode-manual-form').classList.add('hidden');
  }

  if (manualSchedule) {
    document.getElementById('mode-manual-start').value = manualSchedule.start || '09:00';
    document.getElementById('mode-manual-end').value = manualSchedule.end || '17:00';
    document.getElementById('mode-manual-lunch-start').value = manualSchedule.lunchStart || '12:00';
    document.getElementById('mode-manual-lunch-end').value = manualSchedule.lunchEnd || '13:00';
    document.getElementById('mode-manual-hourly').checked = !!manualSchedule.hourly;
  }
}

function renderCountdown(opportunities, isPro) {
  const now = Date.now();
  const upcoming = opportunities
    .map((opportunity, index) => ({ ...opportunity, index, notifyAtMs: new Date(opportunity.notifyAt).getTime() }))
    .filter((opportunity) => opportunity.notifyAtMs > now);

  // Free tier can only ever count down to one of the first FREE_VISIBLE_SESSIONS
  // slots — counting down to a later, still-locked slot would let the timer
  // promise a session the paywall is about to block.
  const next = upcoming
    .filter((opportunity) => isPro || opportunity.index < FREE_VISIBLE_SESSIONS)
    .sort((a, b) => a.notifyAtMs - b.notifyAtMs)[0];

  const valueEl = document.getElementById('countdown-value');
  const subEl = document.getElementById('countdown-sub');

  if (!next) {
    valueEl.textContent = '—';
    const freeSessionsExhausted = !isPro && upcoming.some((opportunity) => opportunity.index >= FREE_VISIBLE_SESSIONS);
    subEl.textContent = I18N.t(currentLang, freeSessionsExhausted ? 'noMoreFreeResets' : 'noMoreResets');
    return;
  }

  const minutesUntil = Math.max(0, Math.round((next.notifyAtMs - now) / 60000));
  valueEl.textContent = minutesUntil <= 1 ? '<1 min' : `${minutesUntil} min`;
  subEl.textContent = I18N.t(currentLang, 'beforeEvent', { event: next.beforeEvent });
}

function renderSessionList(opportunities, isPro) {
  const list = document.getElementById('session-list');
  const upsell = document.getElementById('session-list-upsell');
  list.innerHTML = '';

  if (opportunities.length === 0) {
    const li = document.createElement('li');
    li.className = 'session-item empty';
    li.textContent = I18N.t(currentLang, 'noResetWindows');
    list.appendChild(li);
    upsell.classList.add('hidden');
    return;
  }

  opportunities.forEach((opportunity, index) => {
    const locked = !isPro && index >= FREE_VISIBLE_SESSIONS;

    const li = document.createElement('li');
    li.className = locked ? 'session-item session-item-locked' : 'session-item';

    const label = document.createElement('span');
    label.textContent = I18N.t(currentLang, 'afterEvent', { event: opportunity.afterEvent });

    const time = document.createElement('span');
    time.className = 'session-time';
    time.textContent = formatTimeRange(opportunity.windowStart, opportunity.windowEnd);

    li.append(label, time);
    list.appendChild(li);
  });

  const hasLocked = !isPro && opportunities.length > FREE_VISIBLE_SESSIONS;
  upsell.classList.toggle('hidden', !hasLocked);
}

function formatTimeRange(startIso, endIso) {
  const formatter = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
  return `${formatter.format(new Date(startIso))} – ${formatter.format(new Date(endIso))}`;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const SESSION_TIMER_CIRCUMFERENCE = 2 * Math.PI * 45;
let sessionTimerInterval = null;

function localizedExercise(exercise) {
  const translated = I18N.exercises[currentLang]?.[exercise.id];
  return translated || exercise;
}

function renderSession(session) {
  const exercise = localizedExercise(session.exercise);
  document.getElementById('exercise-name').textContent = exercise.name;
  document.getElementById('exercise-instruction').textContent = exercise.instruction;
  renderSessionProgress(session);
  renderSessionControls(session);
  startSessionTimer(session);
}

function renderSessionProgress(session) {
  const progressEl = document.getElementById('session-progress');
  const total = session.exercises?.length ?? 0;

  if (total <= 1) {
    progressEl.classList.add('hidden');
    return;
  }

  progressEl.textContent = I18N.t(currentLang, 'exerciseProgress', {
    current: session.currentIndex + 1,
    total,
  });
  progressEl.classList.remove('hidden');
}

function renderSessionControls(session) {
  const total = session.exercises?.length ?? 1;
  const isLast = session.currentIndex === total - 1;

  document.getElementById('session-back-btn').disabled = session.currentIndex === 0;
  document.getElementById('session-next-btn').textContent = I18N.t(
    currentLang,
    isLast ? 'sessionDone' : 'sessionNext'
  );
}

function wireSessionControls() {
  document.getElementById('session-back-btn').addEventListener('click', onSessionBack);
  document.getElementById('session-next-btn').addEventListener('click', onSessionNext);
  document
    .getElementById('session-done-back-btn')
    .addEventListener('click', onSessionDoneAcknowledge);
}

function startSessionTimer(session) {
  stopSessionTimer();

  const progress = document.getElementById('session-timer-progress');
  const valueEl = document.getElementById('session-timer-value');
  const totalMs = session.endTime - session.startTime;

  progress.style.strokeDasharray = `${SESSION_TIMER_CIRCUMFERENCE} ${SESSION_TIMER_CIRCUMFERENCE}`;

  const tick = () => {
    const remainingMs = Math.max(0, session.endTime - Date.now());
    const fraction = totalMs > 0 ? remainingMs / totalMs : 0;
    progress.style.strokeDashoffset = `${SESSION_TIMER_CIRCUMFERENCE * (1 - fraction)}`;
    valueEl.textContent = formatTimer(remainingMs);

    if (remainingMs <= 0) {
      stopSessionTimer();
      advanceSession();
    }
  };

  tick();
  sessionTimerInterval = setInterval(tick, 1000);
}

function stopSessionTimer() {
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }
}

function formatTimer(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function advanceSession() {
  const { session } = await chrome.storage.local.get('session');
  const total = session?.exercises?.length ?? 1;
  const isLast = (session?.currentIndex ?? 0) === total - 1;

  stopSessionTimer();

  if (isLast) {
    await chrome.runtime.sendMessage({ type: 'session_done' });
  } else {
    await chrome.runtime.sendMessage({ type: 'session_next' });
  }

  await render();
}

async function onSessionNext() {
  await advanceSession();
}

async function onSessionBack() {
  stopSessionTimer();
  await chrome.runtime.sendMessage({ type: 'session_prev' });
  await render();
}

async function onSessionDoneAcknowledge() {
  const { session } = await chrome.storage.local.get('session');
  await chrome.storage.local.set({ session: null });

  // "Reset anytime" sessions run inside the popup the user already had
  // open — finishing one should drop them back at the today view, not
  // close the whole popup out from under them. Notification-started
  // sessions can spawn their own standalone window (see openExtensionUi in
  // background.js), so closing on completion is still right for those.
  if (session?.origin === 'quick') {
    await render();
    return;
  }

  window.close();
}

// ---------------------------------------------------------------------------
// Sign-in (Supabase email OTP) + Pro gating
//
// Sign-in is the mandatory front gate (see the `!authSession` check in
// render()) — nothing else renders until there's a session, so by the time
// onboarding or today is on screen, requirePro()'s own "not signed in" branch
// below only fires defensively (e.g. a refresh-token failure mid-session).
// uiOverlay/pendingSignin/pendingIntent are transient chrome.storage.local
// flags used for that on-demand case (Pro-only actions, the account button)
// to interrupt the normal onboarding/today render() flow and show a sign-in
// or paywall screen; they're cleared once that flow resolves.
// ---------------------------------------------------------------------------

async function getAuthAndProState() {
  const { authSession } = await chrome.storage.local.get('authSession');
  if (!authSession) return { signedIn: false, email: null, isPro: false, plan: null };

  const proResult = await chrome.runtime.sendMessage({ type: 'check_pro_status' });
  return {
    signedIn: true,
    email: authSession.email,
    isPro: !!proResult?.isPro,
    plan: proResult?.plan ?? null,
  };
}

async function startSignIn(pendingIntent) {
  await chrome.storage.local.set({ uiOverlay: 'signin-email', pendingIntent: pendingIntent || null });
  await render();
}

async function renderUiOverlay(overlay) {
  if (overlay === 'signin-email') {
    document.getElementById('signin-email-error').classList.add('hidden');
    document.getElementById('signin-back-btn').classList.remove('hidden');
    showState('state-signin-email');
    return;
  }
  if (overlay === 'signin-code') {
    const { pendingSignin } = await chrome.storage.local.get('pendingSignin');
    document.getElementById('signin-code-subtitle').textContent = I18N.t(currentLang, 'signinCodeSubtitle', {
      email: pendingSignin?.email || '',
    });
    document.getElementById('signin-code-error').classList.add('hidden');
    showState('state-signin-code');
    return;
  }
  if (overlay === 'paywall-calendar') {
    showState('state-paywall-calendar');
  }
}

/**
 * Gate for anything Pro-only: 'connect_calendar' (the onboarding Connect
 * Google calendar button), 'connect_calendar_mode' (the same action from the
 * today view's mode-switch panel) or 'open_upgrade' (the various "Unlock
 * with Pro" CTAs). Routes through sign-in first if needed, remembering the
 * intent so it can resume right after — then either runs the action
 * (already Pro) or shows the right upsell.
 */
async function requirePro(intent) {
  const { signedIn, isPro } = await getAuthAndProState();

  if (!signedIn) {
    await startSignIn(intent);
    return;
  }

  if (isPro) {
    await runIntent(intent);
    return;
  }

  if (intent === 'connect_calendar' || intent === 'connect_calendar_mode') {
    await chrome.storage.local.set({ uiOverlay: 'paywall-calendar' });
    await render();
    return;
  }

  await openUpgradePage();
}

async function runIntent(intent) {
  if (intent === 'connect_calendar') {
    await onConnect();
  }
  if (intent === 'connect_calendar_mode') {
    await onModeConnect();
  }
  // 'open_upgrade' for an already-Pro user is a no-op: nothing left to unlock.
}

async function openUpgradePage() {
  const { authSession } = await chrome.storage.local.get('authSession');
  await chrome.runtime.sendMessage({ type: 'open_upgrade_page', email: authSession?.email || '' });
}

async function onManageSubscription() {
  document.getElementById('account-panel').classList.add('hidden');
  const { authSession } = await chrome.storage.local.get('authSession');
  await chrome.runtime.sendMessage({ type: 'open_manage_subscription', email: authSession?.email || '' });
}

function wireAuth() {
  document.getElementById('signin-back-btn').addEventListener('click', cancelSignIn);
  document.getElementById('signin-code-back-btn').addEventListener('click', async () => {
    await chrome.storage.local.set({ uiOverlay: 'signin-email' });
    await render();
  });
  document.getElementById('signin-send-code-btn').addEventListener('click', onSendCode);
  document.getElementById('signin-verify-code-btn').addEventListener('click', onVerifyCode);
  document.getElementById('signin-resend-btn').addEventListener('click', onSendCode);

  document.getElementById('signin-email-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSendCode();
  });
  document.getElementById('signin-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onVerifyCode();
  });
}

async function cancelSignIn() {
  await chrome.storage.local.remove(['uiOverlay', 'pendingIntent', 'pendingSignin']);
  await render();
}

function showFormError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.remove('hidden');
}

async function onSendCode() {
  const email = document.getElementById('signin-email-input').value.trim();
  document.getElementById('signin-email-error').classList.add('hidden');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormError('signin-email-error', I18N.t(currentLang, 'signinEmailInvalid'));
    return;
  }

  const button = document.getElementById('signin-send-code-btn');
  button.disabled = true;
  button.textContent = I18N.t(currentLang, 'signinSendingCodeBtn');

  const result = await chrome.runtime.sendMessage({ type: 'auth_send_code', email });

  button.disabled = false;
  button.textContent = I18N.t(currentLang, 'signinSendCodeBtn');

  if (!result?.ok) {
    const detail = result?.error ? ` (${result.error})` : '';
    showFormError('signin-email-error', I18N.t(currentLang, 'signinSendFailed') + detail);
    return;
  }

  await chrome.storage.local.set({ uiOverlay: 'signin-code', pendingSignin: { email } });
  await render();
}

async function onVerifyCode() {
  const { pendingSignin } = await chrome.storage.local.get('pendingSignin');
  const email = pendingSignin?.email;
  const code = document.getElementById('signin-code-input').value.trim();
  document.getElementById('signin-code-error').classList.add('hidden');

  if (!email || !code) {
    showFormError('signin-code-error', I18N.t(currentLang, 'signinCodeInvalid'));
    return;
  }

  const button = document.getElementById('signin-verify-code-btn');
  button.disabled = true;
  button.textContent = I18N.t(currentLang, 'signinVerifyingBtn');

  const result = await chrome.runtime.sendMessage({ type: 'auth_verify_code', email, code });

  button.disabled = false;
  button.textContent = I18N.t(currentLang, 'signinVerifyBtn');

  if (!result?.ok) {
    showFormError('signin-code-error', I18N.t(currentLang, 'signinCodeInvalid'));
    return;
  }

  await syncOnboardingStatusFromServer();

  const { pendingIntent } = await chrome.storage.local.get('pendingIntent');
  await chrome.storage.local.remove(['uiOverlay', 'pendingSignin', 'pendingIntent']);

  if (pendingIntent) {
    await requirePro(pendingIntent);
    return;
  }

  await render();
}

function wirePaywallCalendar() {
  document.getElementById('paywall-calendar-back-btn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['uiOverlay']);
    await render();
  });
  document.getElementById('paywall-calendar-unlock-btn').addEventListener('click', () => requirePro('open_upgrade'));
}

function wireSessionUpsell() {
  document.getElementById('session-upsell-btn').addEventListener('click', () => requirePro('open_upgrade'));
}

function wireAccountWidget() {
  document.getElementById('account-btn').addEventListener('click', onAccountBtnClick);
  document.getElementById('account-upgrade-btn').addEventListener('click', () => requirePro('open_upgrade'));
  document.getElementById('account-manage-sub-btn').addEventListener('click', onManageSubscription);
  document.getElementById('account-signout-btn').addEventListener('click', onSignOut);

  document.addEventListener('click', (e) => {
    if (!document.getElementById('account-widget').contains(e.target)) {
      document.getElementById('account-panel').classList.add('hidden');
    }
  });
}

async function onAccountBtnClick(e) {
  e.stopPropagation();
  const { signedIn } = await getAuthAndProState();
  if (!signedIn) {
    await startSignIn(null);
    return;
  }
  document.getElementById('account-panel').classList.toggle('hidden');
}

async function onSignOut() {
  document.getElementById('account-panel').classList.add('hidden');
  await chrome.runtime.sendMessage({ type: 'auth_sign_out' });
  await render();
}

// Tapping the mode-badge (e.g. "Calendar connected") opens a panel to
// switch to the opposite schedule source — mirrors wireAccountWidget below.
function wireModeWidget() {
  document.getElementById('mode-badge').addEventListener('click', onModeBadgeClick);
  document.getElementById('mode-connect-btn').addEventListener('click', () => requirePro('connect_calendar_mode'));
  document.getElementById('mode-manual-toggle-btn').addEventListener('click', () => {
    document.getElementById('mode-manual-form').classList.toggle('hidden');
  });
  document.getElementById('mode-manual-save-btn').addEventListener('click', onModeSaveManualSchedule);

  document.addEventListener('click', (e) => {
    if (!document.getElementById('mode-widget').contains(e.target)) {
      document.getElementById('mode-panel').classList.add('hidden');
    }
  });
}

function onModeBadgeClick(e) {
  e.stopPropagation();
  document.getElementById('mode-panel').classList.toggle('hidden');
}

async function onModeConnect() {
  const button = document.getElementById('mode-connect-btn');
  button.disabled = true;
  button.textContent = I18N.t(currentLang, 'connectBtnConnecting');

  const result = await chrome.runtime.sendMessage({ type: 'connect_calendar', contactOptIn: false });

  button.disabled = false;
  button.textContent = I18N.t(currentLang, 'connectBtn');

  if (result?.ok) {
    document.getElementById('mode-panel').classList.add('hidden');
    await render();
    return;
  }

  if (result?.error === 'oauth_not_configured') {
    // eslint-disable-next-line no-alert
    alert(I18N.t(currentLang, 'oauthNotConfiguredAlert'));
    return;
  }

  // eslint-disable-next-line no-alert
  alert(I18N.t(currentLang, 'connectFailedAlert'));
}

async function onModeSaveManualSchedule() {
  const start = document.getElementById('mode-manual-start').value || '09:00';
  const end = document.getElementById('mode-manual-end').value || '17:00';
  const lunchStart = document.getElementById('mode-manual-lunch-start').value || '12:00';
  const lunchEnd = document.getElementById('mode-manual-lunch-end').value || '13:00';
  const hourly = document.getElementById('mode-manual-hourly').checked;
  await chrome.runtime.sendMessage({
    type: 'set_manual_schedule',
    schedule: { start, end, lunchStart, lunchEnd, hourly },
  });
  document.getElementById('mode-panel').classList.add('hidden');
  await render();
}

function renderAccountWidget({ signedIn, email, isPro, plan }) {
  const btn = document.getElementById('account-btn');
  const emailEl = document.getElementById('account-email');
  const upgradeBtn = document.getElementById('account-upgrade-btn');
  const manageSubBtn = document.getElementById('account-manage-sub-btn');
  const signOutBtn = document.getElementById('account-signout-btn');

  if (!signedIn) {
    btn.textContent = I18N.t(currentLang, 'accountSignInBtn');
    emailEl.textContent = '';
    upgradeBtn.classList.add('hidden');
    manageSubBtn.classList.add('hidden');
    signOutBtn.classList.add('hidden');
    return;
  }

  btn.textContent = isPro
    ? `★ ${I18N.t(currentLang, 'accountProBadge')}`
    : I18N.t(currentLang, 'accountFreeBadge');
  emailEl.textContent = email;
  upgradeBtn.classList.toggle('hidden', isPro);
  // Lifetime is a one-time purchase — nothing recurring to cancel, so only
  // monthly subscribers get a portal link.
  manageSubBtn.classList.toggle('hidden', !(isPro && plan === 'monthly'));
  signOutBtn.classList.remove('hidden');
}
