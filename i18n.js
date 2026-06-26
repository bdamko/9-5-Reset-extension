// Shared EN/RU dictionary. Loaded as a plain global script by both popup.html
// (<script src="i18n.js">) and background.js (importScripts('i18n.js')) — no
// build step, so it must stay a classic script, not an ES module.

const I18N = {
  strings: {
    en: {
      onbWorkdaySubtitle: "Let's set things up — 2 quick questions.",
      onbWorkdayLabel: 'What type of workday do you have?',
      workdayOffice: 'Office',
      workdayRemote: 'Remote',
      workdayHybrid: 'Hybrid',
      workdayFreelance: 'Freelance',
      workdayStudent: 'Student with desk work',

      backBtn: '‹ Back',

      onbPainSubtitle: 'Question 2 of 2 — select all that apply',
      onbPainLabel: "What's your biggest desk-work problem?",
      painNeck: 'Neck pain',
      painBack: 'Back pain',
      painLowEnergy: 'Low energy',
      painPosture: 'Poor posture',
      painNoTime: 'No time to exercise',
      continueBtn: 'Continue',

      onbSetupTitle: 'Almost done',
      onbSetupSubtitle: 'How should we find your reset windows?',
      onbSetupBody:
        'We read your calendar (read-only) to find natural gaps between meetings. Nothing is shared or stored outside your browser.',
      contactOptin: 'Email me occasional product updates (optional)',
      connectBtn: 'Connect Google calendar',
      connectBtnConnecting: 'Connecting…',
      connectBtnRetry: 'Connect work calendar',
      manualToggleBtn: 'Set my work hours manually',
      manualStart: 'Start',
      manualEnd: 'End',
      manualLunchStart: 'Lunch start',
      manualLunchEnd: 'Lunch end',
      manualHourly: 'Reset every hour (instead of every 90 min)',
      manualSaveBtn: 'Save work hours',
      skipBtn: 'Use sample calendar (for testing)',
      oauthNotConfiguredAlert:
        'Google Calendar isn\'t set up for this extension yet (no OAuth client ID in manifest.json). Use "Set my work hours manually" or "Use sample calendar" for now — see README.md for setup steps.',
      connectFailedAlert: 'Could not connect to your calendar. Try setting your work hours manually instead.',

      energyTitle: "How's your energy?",
      energySubtitle: "We'll pick today's resets to match.",
      energyLow: 'Low',
      energyMedium: 'Medium',
      energyHigh: 'High',

      modeManual: 'Manual schedule',
      modeMock: 'Sample calendar',
      modeCalendar: 'Calendar connected',
      nextResetLabel: 'Next reset',
      noMoreResets: 'No more resets scheduled today',
      noMoreFreeResets: "Today's free sessions are used up — unlock more with Pro",
      beforeEvent: 'Before {event}',
      upcomingSessionsLabel: 'Upcoming sessions',
      noResetWindows: 'No reset windows today',
      afterEvent: 'After {event}',
      resetAnytimeLabel: 'Reset anytime',
      resetAnytimeBody: 'Need a break right now? Pick a stretch — no matter what\'s on the schedule.',
      quickNeck: 'Neck',
      quickBack: 'Back',
      quickPosture: 'Posture',
      nudgeText: 'Stand and stretch every hour, even between scheduled resets.',

      exerciseProgress: 'Exercise {current} of {total}',
      sessionNext: 'Next ›',
      sessionDone: 'Done',

      doneTitle: 'Good job!',
      doneBody: 'You took your reset. Time to get back to it.',
      doneBackBtn: 'Go back to work',

      notifyTitle: '{min} min before {event}',
      notifyMessage: 'Your reset is ready — just a quick stretch.',
      notifyStart: 'Start session',
      notifySkip: 'Skip',

      placeholderWorkSession: 'your work session',
      placeholderNextWorkSession: 'your next work session',
      placeholderDayStarts: 'your day starts',
      placeholderDayEnds: 'your day ends',
      noEventTitle: '(no title)',

      signinTitle: 'Sign in',
      signinSubtitle: "We'll email you a 6-digit code — no password needed.",
      signinEmailLabel: 'Email',
      signinSendCodeBtn: 'Send code',
      signinSendingCodeBtn: 'Sending…',
      signinCodeTitle: 'Enter your code',
      signinCodeSubtitle: 'We sent a code to {email}.',
      signinVerifyBtn: 'Verify & sign in',
      signinVerifyingBtn: 'Verifying…',
      signinResendBtn: 'Resend code',
      signinEmailInvalid: 'Enter a valid email address.',
      signinSendFailed: 'Could not send the code. Try again.',
      signinCodeInvalid: 'That code didn\'t work. Check it and try again.',

      accountSignInBtn: 'Sign in',
      accountProBadge: 'Pro',
      accountFreeBadge: 'Free',
      accountSignOutBtn: 'Sign out',
      accountManageSubBtn: 'Manage subscription',
      upgradeBtn: 'Upgrade to Pro',

      paywallCalendarTitle: 'Calendar sync is a Pro feature',
      paywallCalendarBody:
        "Connecting your Google Calendar and seeing every reset window for the day is part of 9–5 Reset Pro. You can still use manual hours or the sample calendar for free.",
      unlockProBtn: 'Unlock with Pro',

      sessionUpsellBody: 'Unlock every reset window for today.',
      proUnlockedBadge: 'Pro',

      notifBlockedBody: "Notifications are blocked, so reset reminders won't reach you.",
      notifBlockedBtn: 'Enable notifications',
    },
    ru: {
      onbWorkdaySubtitle: 'Давайте всё настроим — 2 быстрых вопроса.',
      onbWorkdayLabel: 'Какой у вас тип рабочего дня?',
      workdayOffice: 'Офис',
      workdayRemote: 'Удалённо',
      workdayHybrid: 'Гибридный',
      workdayFreelance: 'Фриланс',
      workdayStudent: 'Учёба за столом',

      backBtn: '‹ Назад',

      onbPainSubtitle: 'Вопрос 2 из 2 — выберите все подходящие варианты',
      onbPainLabel: 'Какая у вас главная проблема от работы за столом?',
      painNeck: 'Боль в шее',
      painBack: 'Боль в спине',
      painLowEnergy: 'Низкая энергия',
      painPosture: 'Плохая осанка',
      painNoTime: 'Нет времени на упражнения',
      continueBtn: 'Продолжить',

      onbSetupTitle: 'Почти готово',
      onbSetupSubtitle: 'Как нам находить ваши окна для отдыха?',
      onbSetupBody:
        'Мы читаем ваш календарь (только просмотр), чтобы найти промежутки между встречами. Ничего не передаётся и не сохраняется за пределами вашего браузера.',
      contactOptin: 'Присылать мне новости о продукте (опционально)',
      connectBtn: 'Подключить Google Календарь',
      connectBtnConnecting: 'Подключение…',
      connectBtnRetry: 'Подключить рабочий календарь',
      manualToggleBtn: 'Указать рабочие часы вручную',
      manualStart: 'Начало',
      manualEnd: 'Конец',
      manualLunchStart: 'Начало обеда',
      manualLunchEnd: 'Конец обеда',
      manualHourly: 'Сессия каждый час (вместо каждых 90 минут)',
      manualSaveBtn: 'Сохранить рабочие часы',
      skipBtn: 'Использовать пример календаря (для теста)',
      oauthNotConfiguredAlert:
        'Google Календарь пока не настроен для этого расширения (нет OAuth client ID в manifest.json). Используйте «Указать рабочие часы вручную» или «Использовать пример календаря» — см. README.md для настройки.',
      connectFailedAlert: 'Не удалось подключиться к календарю. Попробуйте указать рабочие часы вручную.',

      energyTitle: 'Как ваша энергия?',
      energySubtitle: 'Мы подберём сегодняшние сессии под неё.',
      energyLow: 'Низкая',
      energyMedium: 'Средняя',
      energyHigh: 'Высокая',

      modeManual: 'Ручной график',
      modeMock: 'Пример календаря',
      modeCalendar: 'Календарь подключён',
      nextResetLabel: 'Следующая сессия',
      noMoreResets: 'На сегодня больше сессий не запланировано',
      noMoreFreeResets: 'Бесплатные сессии на сегодня закончились — откройте больше с Pro',
      beforeEvent: 'До «{event}»',
      upcomingSessionsLabel: 'Ближайшие сессии',
      noResetWindows: 'Сегодня нет окон для сессий',
      afterEvent: 'После «{event}»',
      resetAnytimeLabel: 'Сессия в любое время',
      resetAnytimeBody: 'Нужен перерыв прямо сейчас? Выберите растяжку — независимо от расписания.',
      quickNeck: 'Шея',
      quickBack: 'Спина',
      quickPosture: 'Осанка',
      nudgeText: 'Встаньте и потянитесь каждый час, даже между запланированными сессиями.',

      exerciseProgress: 'Упражнение {current} из {total}',
      sessionNext: 'Далее ›',
      sessionDone: 'Готово',

      doneTitle: 'Отличная работа!',
      doneBody: 'Вы прошли свою сессию. Время возвращаться к работе.',
      doneBackBtn: 'Вернуться к работе',

      notifyTitle: '{min} мин до «{event}»',
      notifyMessage: 'Ваша сессия готова — просто быстрая растяжка.',
      notifyStart: 'Начать сессию',
      notifySkip: 'Пропустить',

      placeholderWorkSession: 'вашей рабочей сессии',
      placeholderNextWorkSession: 'вашей следующей рабочей сессии',
      placeholderDayStarts: 'начала вашего дня',
      placeholderDayEnds: 'окончания вашего дня',
      noEventTitle: '(без названия)',

      signinTitle: 'Вход',
      signinSubtitle: 'Мы отправим вам код из 6 цифр на email — пароль не нужен.',
      signinEmailLabel: 'Email',
      signinSendCodeBtn: 'Отправить код',
      signinSendingCodeBtn: 'Отправка…',
      signinCodeTitle: 'Введите код',
      signinCodeSubtitle: 'Мы отправили код на {email}.',
      signinVerifyBtn: 'Подтвердить и войти',
      signinVerifyingBtn: 'Проверка…',
      signinResendBtn: 'Отправить код повторно',
      signinEmailInvalid: 'Введите корректный email.',
      signinSendFailed: 'Не удалось отправить код. Попробуйте снова.',
      signinCodeInvalid: 'Код не подошёл. Проверьте и попробуйте снова.',

      accountSignInBtn: 'Войти',
      accountProBadge: 'Pro',
      accountFreeBadge: 'Free',
      accountSignOutBtn: 'Выйти',
      accountManageSubBtn: 'Управление подпиской',
      upgradeBtn: 'Перейти на Pro',

      paywallCalendarTitle: 'Синхронизация календаря — функция Pro',
      paywallCalendarBody:
        'Подключение Google Календаря и просмотр всех окон для сессий за день доступны в 9–5 Reset Pro. Бесплатно можно использовать ручной график или пример календаря.',
      unlockProBtn: 'Открыть Pro',

      sessionUpsellBody: 'Откройте все окна для сессий на сегодня.',
      proUnlockedBadge: 'Pro',

      notifBlockedBody: 'Уведомления заблокированы, поэтому напоминания о сессиях не дойдут до вас.',
      notifBlockedBtn: 'Включить уведомления',
    },
  },

  // Only need RU overrides — EN exercise text already lives in
  // background.js's EXERCISE_LIBRARY and is used as the fallback.
  exercises: {
    ru: {
      'neck-side-tilt': {
        name: 'Наклон шеи в сторону',
        instruction:
          'Наклоните правое ухо к правому плечу. Удерживайте 20 секунд, затем поменяйте сторону. Снимает самое частое напряжение в шее у офисных работников.',
      },
      'chin-tuck': {
        name: 'Подбородок назад',
        instruction:
          'Сидя прямо, мягко втяните подбородок назад, как будто делаете «двойной подбородок». Удерживайте 5 секунд, отпустите. Повторите 10 раз.',
      },
      'neck-rotation': {
        name: 'Поворот головы',
        instruction:
          'Медленно поверните голову, чтобы посмотреть через правое плечо. Удерживайте 15 секунд, вернитесь в центр, затем повторите влево.',
      },
      'upper-trap-stretch': {
        name: 'Растяжка верхней трапеции',
        instruction:
          'Сядьте на правую руку, чтобы зафиксировать плечо. Левой рукой мягко наклоните голову влево и немного вперёд. Удерживайте 20 секунд с каждой стороны.',
      },
      'levator-scapulae-stretch': {
        name: 'Растяжка мышцы, поднимающей лопатку',
        instruction:
          'Поверните голову на 45 градусов вправо, затем наклоните подбородок к подмышке. Удерживайте 20 секунд, затем поменяйте сторону.',
      },
      'seated-spinal-twist': {
        name: 'Скручивание корпуса сидя',
        instruction:
          'Сидя прямо, положите правую руку на внешнюю сторону левого колена. Мягко повернитесь влево и посмотрите через левое плечо. Удерживайте 20 секунд, затем поменяйте сторону.',
      },
      'seated-cat-cow': {
        name: 'Кошка-корова на стуле',
        instruction:
          'Руки на коленях. На вдохе прогните спину, грудь вперёд, плечи назад. На выдохе округлите спину, подбородок к груди. 10 медленных циклов.',
      },
      'seated-forward-fold': {
        name: 'Наклон вперёд сидя',
        instruction:
          'Сядьте на край стула, ступни на полу. Наклонитесь вперёд от бёдер, опустив руки к полу. Удерживайте 30 секунд.',
      },
      'thoracic-extension': {
        name: 'Разгибание грудного отдела',
        instruction:
          'Сидя, прижмите поясницу к спинке стула. Сцепите пальцы за головой и мягко прогнитесь назад через верх спинки стула. Удерживайте 10 секунд, повторите 3 раза.',
      },
      'hip-flexor-stretch': {
        name: 'Растяжка сгибателей бедра',
        instruction:
          'Сядьте на край стула. Отведите правую ногу назад так, чтобы правое колено опустилось ниже бедра. Сидите прямо и почувствуйте растяжение в передней части правого бедра. Удерживайте 30 секунд, затем поменяйте сторону.',
      },
      'shoulder-blade-squeeze': {
        name: 'Сведение лопаток',
        instruction:
          'Сидя прямо, руки расслаблены вдоль тела. Сведите лопатки вместе, удерживайте 5 секунд, затем отпустите. Повторите 10 раз.',
      },
      'chest-opener': {
        name: 'Раскрытие грудной клетки',
        instruction:
          'Сцепите пальцы за спиной. Выпрямите руки, сведите лопатки и слегка приподнимите грудь. Удерживайте 20 секунд.',
      },
      'wall-angel-chair': {
        name: '«Снежный ангел» на стуле',
        instruction:
          'Сидя прямо со спиной выпрямленной. Поднимите руки под углом 90 градусов, как ворота, затем медленно поднимите их над головой и опустите обратно, не давая локтям опуститься ниже плеч. 10 повторений.',
      },
      'ear-over-shoulder-check': {
        name: 'Проверка «ухо над плечом»',
        instruction:
          'Сидите прямо. Представьте нить, тянущую макушку к потолку, и проверьте, что уши находятся прямо над плечами, а не впереди. Удерживайте позу 30 секунд.',
      },
      'diaphragm-breath': {
        name: 'Диафрагмальное дыхание',
        instruction:
          'Сидя прямо, одна рука на груди, другая на животе. Вдохните через нос на 4 счёта так, чтобы живот поднимался, а грудь оставалась неподвижной. Задержите на 2 счёта, затем выдохните через рот на 6 счётов. Повторите 5 раз.',
      },
      'seated-march': {
        name: 'Ходьба сидя',
        instruction:
          'Поочерёдно поднимайте колени в быстром темпе, как будто шагаете на месте сидя, в течение 1 минуты.',
      },
      'stand-and-reach': {
        name: 'Встать и потянуться',
        instruction:
          'Встаньте, поднимите обе руки над головой и приподнимитесь на носочки. Удерживайте 10 секунд, повторите 5 раз.',
      },
      'desk-pushups': {
        name: 'Отжимания от стола',
        instruction: 'Поставьте руки на край стола, отступите ногами назад и сделайте 10 отжиманий под углом.',
      },
      'quick-walk': {
        name: 'Быстрая прогулка',
        instruction: 'Встаньте и быстро пройдитесь по помещению или возьмите воды в течение 2 минут.',
      },
      'standing-side-steps': {
        name: 'Шаги в стороны стоя',
        instruction:
          'Шагайте из стороны в сторону, поднимая руки над головой, как лёгкая версия «jumping jack», в течение 1 минуты.',
      },
      'sixty-second-reset': {
        name: '60-секундная сессия',
        instruction: 'Покрутите плечами назад 5 раз, затем мягко наклоните голову из стороны в сторону. Быстро и просто.',
      },
      'shoulder-rolls': {
        name: 'Вращения плечами',
        instruction: 'Покрутите оба плеча назад медленными кругами 10 раз, затем вперёд 10 раз.',
      },
      'wrist-stretch': {
        name: 'Растяжка запястья',
        instruction:
          'Вытяните одну руку ладонью вверх и мягко потяните пальцы назад другой рукой. Удерживайте 10 секунд на каждой руке.',
      },
      'eye-break': {
        name: 'Перерыв для глаз (20-20-20)',
        instruction: 'Посмотрите на что-то на расстоянии 20 футов (6 метров) в течение 20 секунд, чтобы отдохнули глаза.',
      },
      'deep-breaths': {
        name: 'Глубокое дыхание',
        instruction: 'Сделайте 5 медленных глубоких вдохов — через нос на 4 счёта, через рот на 6 счётов.',
      },
    },
  },

  t(lang, key, vars) {
    const dict = this.strings[lang] || this.strings.en;
    let str = dict[key] ?? this.strings.en[key] ?? key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(`{${k}}`, vars[k]);
      });
    }
    return str;
  },
};
