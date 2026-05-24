/*
 * KNOWN LIMITATIONS — Web Push without a server:
 *
 * 1. setTimeout-based scheduling resets if browser is closed.
 *    The reminder will only fire if the user has the app open
 *    (or has visited it recently enough for the SW to be active).
 *    True background push requires a push server (costs money).
 *
 * 2. iOS requires the app to be added to Home Screen (PWA mode)
 *    for notifications to work. iOS 16.4+ only.
 *
 * 3. On desktop, works in Chrome, Firefox, Edge. Not Safari < 16.
 *
 * 4. The service worker re-schedules the reminder every time the
 *    app is opened, so daily users will get their reminder reliably.
 *
 * Future upgrade path (when budget allows):
 *    Add a push server (e.g. web-push npm package on a free Railway
 *    instance) to send true background notifications to all users.
 */

// Check if browser supports notifications
export function isNotificationSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

// Get current permission status
export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission; // "default" | "granted" | "denied"
}

// Register the service worker
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}

// Request notification permission from user
export async function requestPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

// Schedule a daily reminder notification at a target hour (IST)
// targetHour: 0-23 in IST (e.g. 19 = 7 PM IST)
export function scheduleDailyReminder(targetHour = 19) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  // Clear any existing scheduled reminder
  clearScheduledReminder();

  // Compute ms until next occurrence of targetHour in IST
  const now       = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // UTC+5:30
  const nowIST    = new Date(now.getTime() + istOffset);

  const targetIST = new Date(nowIST);
  targetIST.setHours(targetHour, 0, 0, 0);

  // If target time already passed today, schedule for tomorrow
  if (nowIST >= targetIST) {
    targetIST.setDate(targetIST.getDate() + 1);
  }

  const msUntilTarget = targetIST - nowIST;

  // Store the scheduled time so we can display it
  try {
    localStorage.setItem(
      'ssc_reminder_scheduled',
      JSON.stringify({ targetHour, scheduledAt: now.toISOString() })
    );
  } catch {}

  // Set timeout to show notification
  const timerId = setTimeout(async () => {
    await showStreakReminder();
    // Reschedule for next day
    scheduleDailyReminder(targetHour);
  }, msUntilTarget);

  // Store timer ID in window so we can clear it
  window.__sscReminderTimer = timerId;

  console.log(
    `[Notifications] Reminder scheduled in ${Math.round(msUntilTarget / 60000)} minutes`
  );
}

// Clear any existing scheduled reminder
export function clearScheduledReminder() {
  if (typeof window !== 'undefined' && window.__sscReminderTimer) {
    clearTimeout(window.__sscReminderTimer);
    window.__sscReminderTimer = null;
  }
  try {
    localStorage.removeItem('ssc_reminder_scheduled');
  } catch {}
}

// Show the streak reminder notification immediately
// (called by setTimeout or directly for testing)
export async function showStreakReminder(streakCount = 0) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  let title, body;
  if (streakCount === 0) {
    title = '📚 Time to practice SSC GK!';
    body  = 'Play a quiz today and start your streak. Every day counts!';
  } else if (streakCount === 1) {
    title = '🔥 Keep your streak alive!';
    body  = 'You started a streak yesterday. Play today to keep it going!';
  } else if (streakCount < 7) {
    title = `🔥 ${streakCount} day streak — don't break it!`;
    body  = 'One quiz is all it takes. Your rank is waiting!';
  } else if (streakCount < 30) {
    title = `⚡ ${streakCount} days strong!`;
    body  = "You're on fire! Keep your streak going with today's quiz.";
  } else {
    title = `🏆 ${streakCount} day legend streak!`;
    body  = "Incredible consistency! Don't let it end now.";
  }

  // Try to show via service worker (better on mobile)
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      tag:      'ssc-daily-reminder',
      renotify: true,
      data:     { url: '/dashboard' },
      actions:  [
        { action: 'play',    title: 'Play Now 🎯' },
        { action: 'dismiss', title: 'Later' },
      ],
    });
    return;
  } catch {}

  // Fallback: basic Notification API
  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag:  'ssc-daily-reminder',
    });
  } catch {}
}

// Save user's preferred reminder time to localStorage
export function saveReminderTime(hour) {
  try {
    localStorage.setItem('ssc_reminder_hour', String(hour));
  } catch {}
}

// Get user's saved reminder time (default 19 = 7 PM IST)
export function getReminderHour() {
  try {
    const saved = localStorage.getItem('ssc_reminder_hour');
    if (saved) return parseInt(saved, 10);
  } catch {}
  return 19; // default 7 PM IST
}

// Check if user has enabled notifications
export function isNotificationEnabled() {
  return getNotificationPermission() === 'granted';
}
