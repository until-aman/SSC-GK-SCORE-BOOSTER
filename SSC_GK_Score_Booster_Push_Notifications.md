# SSC GK Score Booster — Web Push Notifications PRD

---

## PASTE THIS MESSAGE INTO CLAUDE CODE AFTER UPLOADING THIS FILE

```
I am uploading SSC_GK_Score_Booster_Push_Notifications.md

Read the ENTIRE file before writing a single line of code.
This feature adds free browser Web Push Notifications using the
browser's built-in Push API + Service Worker. Zero cost. Zero new
infrastructure. No Firebase. No external service.

Do not change any existing API files, quiz logic, scoring, or
leaderboard code. Only add the new files listed and modify the
specific components listed.

Implement in the order listed under IMPLEMENTATION ORDER at the bottom.
```

---

## 1. How It Works (Technical Overview)

```
Browser Push API (free, built-in):
  1. User taps bell icon → browser asks "Allow notifications?"
  2. If allowed → browser gives us a subscription object
  3. We store subscription in localStorage (no server needed)
  4. A Service Worker runs in background and shows notifications
  5. We use the Notifications API to schedule a daily reminder

Important limitations to know:
  - Notifications only work if user has visited the site at least once
    in the current browser session OR if service worker is registered
  - On iOS Safari: Web Push only works on iOS 16.4+ when app is added
    to home screen (PWA mode)
  - On Android Chrome: works reliably
  - On desktop Chrome/Firefox/Edge: works reliably
  - Cannot send notifications from server for free — we use a
    client-side scheduled notification instead (setTimeout/alarm)
```

---

## 2. Files to Create / Modify

| File | Action |
|---|---|
| `/public/sw.js` | CREATE — Service Worker |
| `/public/manifest.json` | CREATE or UPDATE — PWA manifest |
| `/lib/notifications.js` | CREATE — notification helper functions |
| `/components/NotificationBell.js` | CREATE — bell icon component |
| `/pages/_document.js` | MODIFY — register service worker |
| `/pages/dashboard.js` | MODIFY — replace bell icon with component |

---

## 3. Service Worker — `/public/sw.js`

```javascript
// Service Worker for SSC GK Score Booster
// Handles push notification display

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Handle push events (for future server-side push — not used in V2)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "ssc-reminder",
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});

// Handle notification click — open/focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(
            event.notification.data?.url || "/"
          );
        }
      })
  );
});

// Handle scheduled notification alarm (message from main thread)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "ssc-daily-reminder",
      renotify: true,
      data: { url: "/" },
      actions: [
        { action: "play", title: "Play Now 🎯" },
        { action: "dismiss", title: "Later" },
      ],
    });
  }
});
```

---

## 4. PWA Manifest — `/public/manifest.json`

Create this file if it does not exist. If it exists, merge these fields:

```json
{
  "name": "SSC GK Score Booster",
  "short_name": "SSC GK",
  "description": "Practice SSC GK daily. Rank higher.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#10b981",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Icon files:** Create two simple placeholder PNG icons:
- `/public/icon-192.png` — 192×192px
- `/public/icon-512.png` — 512×512px

If no icon assets are available, generate them programmatically
using a canvas script or use the existing logo/lightbulb image
resized. The notification will still show without icons but looks
better with them.

---

## 5. Notification Helpers — `/lib/notifications.js`

```javascript
// Check if browser supports notifications
export function isNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

// Get current permission status
export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

// Register the service worker
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (err) {
    console.error("[SW] Registration failed:", err);
    return null;
  }
}

// Request notification permission from user
export async function requestPermission() {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

// Schedule a daily reminder notification at a target hour (IST)
// targetHour: 0-23 in IST (e.g. 19 = 7 PM IST)
export function scheduleDailyReminder(targetHour = 19) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  // Clear any existing scheduled reminder
  clearScheduledReminder();

  // Compute ms until next occurrence of targetHour in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // UTC+5:30
  const nowIST = new Date(now.getTime() + istOffset);

  let targetIST = new Date(nowIST);
  targetIST.setHours(targetHour, 0, 0, 0);

  // If target time already passed today, schedule for tomorrow
  if (nowIST >= targetIST) {
    targetIST.setDate(targetIST.getDate() + 1);
  }

  const msUntilTarget = targetIST - nowIST;

  // Store the scheduled time so we can clear it later
  try {
    localStorage.setItem(
      "ssc_reminder_scheduled",
      JSON.stringify({
        targetHour,
        scheduledAt: now.toISOString(),
      })
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
  if (typeof window !== "undefined" && window.__sscReminderTimer) {
    clearTimeout(window.__sscReminderTimer);
    window.__sscReminderTimer = null;
  }
  try {
    localStorage.removeItem("ssc_reminder_scheduled");
  } catch {}
}

// Show the streak reminder notification immediately
// (called by setTimeout or directly for testing)
export async function showStreakReminder(streakCount = 0) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  // Choose message based on streak
  let title, body;
  if (streakCount === 0) {
    title = "📚 Time to practice SSC GK!";
    body = "Play a quiz today and start your streak. Every day counts!";
  } else if (streakCount === 1) {
    title = "🔥 Keep your streak alive!";
    body = "You started a streak yesterday. Play today to keep it going!";
  } else if (streakCount < 7) {
    title = `🔥 ${streakCount} day streak — don't break it!`;
    body = "One quiz is all it takes. Your rank is waiting!";
  } else if (streakCount < 30) {
    title = `⚡ ${streakCount} days strong!`;
    body = "You're on fire! Keep your streak going with today's quiz.";
  } else {
    title = `🏆 ${streakCount} day legend streak!`;
    body = "Incredible consistency! Don't let it end now.";
  }

  // Try to show via service worker (better on mobile)
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "ssc-daily-reminder",
      renotify: true,
      data: { url: "/dashboard" },
      actions: [
        { action: "play", title: "Play Now 🎯" },
        { action: "dismiss", title: "Later" },
      ],
    });
    return;
  } catch {}

  // Fallback: use basic Notification API
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      tag: "ssc-daily-reminder",
    });
  } catch {}
}

// Save user's preferred reminder time to localStorage
export function saveReminderTime(hour) {
  try {
    localStorage.setItem("ssc_reminder_hour", String(hour));
  } catch {}
}

// Get user's saved reminder time (default 19 = 7 PM IST)
export function getReminderHour() {
  try {
    const saved = localStorage.getItem("ssc_reminder_hour");
    if (saved) return parseInt(saved, 10);
  } catch {}
  return 19; // default 7 PM IST
}

// Check if user has enabled notifications
export function isNotificationEnabled() {
  return getNotificationPermission() === "granted";
}
```

---

## 6. NotificationBell Component — `/components/NotificationBell.js`

```jsx
import { useState, useEffect } from "react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestPermission,
  registerServiceWorker,
  scheduleDailyReminder,
  clearScheduledReminder,
  saveReminderTime,
  getReminderHour,
  isNotificationEnabled,
} from "../lib/notifications";

export default function NotificationBell({ streakCount = 0 }) {
  const [permission, setPermission] = useState("default");
  const [showSheet, setShowSheet] = useState(false);
  const [reminderHour, setReminderHour] = useState(19);
  const [supported, setSupported] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSupported(isNotificationSupported());
    setPermission(getNotificationPermission());
    setReminderHour(getReminderHour());

    // Re-schedule reminder on every app open (in case browser restarted)
    if (isNotificationEnabled()) {
      registerServiceWorker().then(() => {
        scheduleDailyReminder(getReminderHour());
      });
    }
  }, []);

  async function handleBellTap() {
    if (!supported) {
      // Show unsupported message in sheet
      setShowSheet(true);
      return;
    }
    setShowSheet(true);
  }

  async function handleEnable() {
    setSaving(true);
    const reg = await registerServiceWorker();
    if (!reg) {
      setSaving(false);
      return;
    }
    const result = await requestPermission();
    setPermission(result);
    if (result === "granted") {
      saveReminderTime(reminderHour);
      scheduleDailyReminder(reminderHour);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setShowSheet(false);
      }, 2000);
    }
    setSaving(false);
  }

  function handleDisable() {
    clearScheduledReminder();
    setShowSheet(false);
  }

  function handleTimeChange(hour) {
    setReminderHour(hour);
    if (permission === "granted") {
      saveReminderTime(hour);
      scheduleDailyReminder(hour);
    }
  }

  const isEnabled = permission === "granted";
  const isDenied = permission === "denied";

  return (
    <>
      {/* Bell icon button */}
      <button
        onClick={handleBellTap}
        className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700
                   flex items-center justify-center relative
                   active:scale-90 transition-transform"
      >
        {/* Bell SVG */}
        <svg
          viewBox="0 0 24 24"
          fill={isEnabled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={`w-5 h-5 ${isEnabled ? "text-emerald-400" : "text-slate-400"}`}
        >
          <path
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
               6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388
               6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3
               0 11-6 0v-1m6 0H9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Green dot when enabled */}
        {isEnabled && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2
                           bg-emerald-400 rounded-full border border-slate-800" />
        )}
      </button>

      {/* Bottom sheet overlay */}
      {showSheet && (
        <>
          <div
            className="sheet-overlay"
            onClick={() => setShowSheet(false)}
          />
          <div className="sheet-panel bg-slate-900 rounded-t-3xl px-6 pt-5 pb-10">

            {/* Handle bar */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5" />

            {/* Title */}
            <h2 className="font-display font-black text-xl text-white mb-1">
              Daily Reminder
            </h2>
            <p className="font-sans text-sm text-slate-400 mb-6">
              Get a push notification to play your daily quiz and protect
              your streak.
            </p>

            {/* Unsupported state */}
            {!supported && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-2">😕</p>
                <p className="font-sans text-sm text-slate-300">
                  Your browser does not support push notifications.
                </p>
                <p className="font-sans text-xs text-slate-500 mt-1">
                  Try Chrome on Android or add this app to your home screen on iOS 16.4+.
                </p>
              </div>
            )}

            {/* Denied state */}
            {supported && isDenied && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <p className="font-sans text-sm text-red-400 font-medium">
                  Notifications are blocked
                </p>
                <p className="font-sans text-xs text-slate-400 mt-1">
                  To enable: tap the lock icon in your browser address bar →
                  Notifications → Allow. Then come back and tap Enable.
                </p>
              </div>
            )}

            {/* Normal state — not yet enabled */}
            {supported && !isDenied && !isEnabled && (
              <>
                {/* Time picker */}
                <div className="mb-5">
                  <p className="font-sans font-medium text-xs text-slate-400
                                uppercase tracking-wide mb-3">
                    Remind me at
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "6 AM", hour: 6 },
                      { label: "8 AM", hour: 8 },
                      { label: "12 PM", hour: 12 },
                      { label: "6 PM", hour: 18 },
                      { label: "7 PM", hour: 19 },
                      { label: "9 PM", hour: 21 },
                      { label: "10 PM", hour: 22 },
                    ].map(({ label, hour }) => (
                      <button
                        key={hour}
                        onClick={() => handleTimeChange(hour)}
                        className={`px-4 py-2 rounded-full font-sans font-semibold
                                    text-sm transition-all active:scale-95
                                    ${reminderHour === hour
                                      ? "bg-emerald-500 text-white"
                                      : "bg-slate-800 border border-slate-700 text-slate-400"
                                    }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="font-sans text-xs text-slate-500 mt-2">
                    All times are in IST
                  </p>
                </div>

                {/* Enable button */}
                <button
                  onClick={handleEnable}
                  disabled={saving}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-white
                             font-display font-bold text-base
                             active:scale-95 transition-transform
                             disabled:opacity-60 disabled:cursor-not-allowed
                             shadow-[0_4px_14px_rgba(16,185,129,0.3)]"
                >
                  {saving ? "Enabling..." : "Enable Daily Reminder 🔔"}
                </button>
              </>
            )}

            {/* Enabled state */}
            {supported && isEnabled && (
              <>
                {saved ? (
                  <div className="text-center py-4">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="font-display font-bold text-base text-emerald-400">
                      Reminder set!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Current schedule */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20
                                    rounded-2xl p-4 mb-5">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🔔</span>
                        <div>
                          <p className="font-display font-bold text-sm text-emerald-400">
                            Reminders enabled
                          </p>
                          <p className="font-sans text-xs text-slate-400 mt-0.5">
                            Daily at{" "}
                            {new Date(2000, 0, 1, reminderHour)
                              .toLocaleTimeString("en-IN", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}{" "}
                            IST
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Change time */}
                    <p className="font-sans font-medium text-xs text-slate-400
                                  uppercase tracking-wide mb-3">
                      Change reminder time
                    </p>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {[
                        { label: "6 AM", hour: 6 },
                        { label: "8 AM", hour: 8 },
                        { label: "12 PM", hour: 12 },
                        { label: "6 PM", hour: 18 },
                        { label: "7 PM", hour: 19 },
                        { label: "9 PM", hour: 21 },
                        { label: "10 PM", hour: 22 },
                      ].map(({ label, hour }) => (
                        <button
                          key={hour}
                          onClick={() => handleTimeChange(hour)}
                          className={`px-4 py-2 rounded-full font-sans font-semibold
                                      text-sm transition-all active:scale-95
                                      ${reminderHour === hour
                                        ? "bg-emerald-500 text-white"
                                        : "bg-slate-800 border border-slate-700 text-slate-400"
                                      }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Disable button */}
                    <button
                      onClick={handleDisable}
                      className="w-full py-4 rounded-2xl
                                 bg-red-500/10 border border-red-500/20
                                 text-red-400 font-display font-bold text-base
                                 active:scale-95 transition-transform"
                    >
                      Turn Off Reminders
                    </button>
                  </>
                )}
              </>
            )}

          </div>
        </>
      )}
    </>
  );
}
```

---

## 7. Register Service Worker — `pages/_document.js`

Add this script inside the `<Head>` tag to register the service worker
and link the manifest. Do not remove existing Head content:

```jsx
<Head>
  {/* existing font imports stay here */}

  {/* PWA manifest */}
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#10b981" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="SSC GK" />

  {/* Register service worker */}
  <script
    dangerouslySetInnerHTML={{
      __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js').catch(function(err) {
              console.log('SW registration failed:', err);
            });
          });
        }
      `,
    }}
  />
</Head>
```

---

## 8. Dashboard Changes — `/pages/dashboard.js`

Find the existing bell icon button in the profile bar (top right).
Replace it with the `NotificationBell` component:

```jsx
// Add import at top of dashboard.js
import NotificationBell from "../components/NotificationBell";

// In the profile bar JSX, replace the existing bell button with:
<NotificationBell streakCount={userProfile?.streakCount || 0} />
```

The `streakCount` prop is passed so the reminder message is
personalised based on the user's actual streak.

---

## 9. Limitations to Document (add as a code comment in notifications.js)

```javascript
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
```

---

## 10. Implementation Order

```
STEP 1 — /public/sw.js
  Create service worker file exactly as in Section 3.
  Must be in /public/ so it is served from the root path /sw.js.
  Verify by visiting https://your-domain/sw.js in browser.

STEP 2 — /public/manifest.json
  Create manifest file as in Section 4.
  Create placeholder icon files (icon-192.png, icon-512.png)
  in /public/. Use any 192px and 512px square image — the existing
  lightbulb/logo image resized is fine.

STEP 3 — /lib/notifications.js
  Create helpers file exactly as in Section 5.
  Do not modify — all logic is self-contained.

STEP 4 — /pages/_document.js
  Add manifest link, meta tags, and SW registration script
  as in Section 7. Do not remove existing Head content.

STEP 5 — /components/NotificationBell.js
  Create component exactly as in Section 6.
  This is a self-contained component — no props needed except
  optional streakCount.

STEP 6 — /pages/dashboard.js
  Import NotificationBell and replace existing bell button
  as in Section 8.
  Pass streakCount from userProfile.
```

---

## 11. Verification Checklist

```
[ ] Visit https://your-domain/sw.js — shows the service worker JS code
    (not a 404)

[ ] Visit https://your-domain/manifest.json — shows the JSON manifest

[ ] Open app in Chrome on Android or desktop Chrome
[ ] Tap bell icon → bottom sheet slides up

[ ] Sheet shows time picker chips and "Enable Daily Reminder" button

[ ] Tap "Enable Daily Reminder" → browser shows permission prompt
    "Allow SSC GK Score Booster to send notifications?"

[ ] Tap "Allow" → sheet shows "✅ Reminder set!" then closes

[ ] Bell icon now shows green dot indicator

[ ] Tap bell again → shows "Reminders enabled" card with current time
    and option to change time or turn off

[ ] Change time → updates immediately, new time shown

[ ] Tap "Turn Off Reminders" → reminder cancelled, bell returns to
    outline/grey state

[ ] Tap bell when notifications are blocked by browser →
    shows red "Notifications are blocked" message with instructions

[ ] On a browser that doesn't support push →
    shows "Your browser does not support push notifications" message

[ ] On desktop: set reminder to 2 minutes from now (edit hour in
    getReminderHour temporarily), keep tab open, verify notification
    appears at correct time

[ ] Notification click → opens/focuses the app
```

---

*End of SSC GK Score Booster Push Notifications PRD*
*Paste the message at the top of this file into Claude Code after uploading.*
