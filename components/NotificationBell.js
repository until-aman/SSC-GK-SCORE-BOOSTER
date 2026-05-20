import { useState, useEffect } from 'react';
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
} from '@/lib/notifications';

const TIME_SLOTS = [
  { label: '6 AM',  hour: 6  },
  { label: '8 AM',  hour: 8  },
  { label: '12 PM', hour: 12 },
  { label: '6 PM',  hour: 18 },
  { label: '7 PM',  hour: 19 },
  { label: '9 PM',  hour: 21 },
  { label: '10 PM', hour: 22 },
];

export default function NotificationBell({ streakCount = 0 }) {
  const [permission,   setPermission]   = useState('default');
  const [showSheet,    setShowSheet]    = useState(false);
  const [reminderHour, setReminderHour] = useState(19);
  const [supported,    setSupported]    = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  useEffect(() => {
    setSupported(isNotificationSupported());
    setPermission(getNotificationPermission());
    setReminderHour(getReminderHour());

    // Re-schedule on every app open (in case browser restarted)
    if (isNotificationEnabled()) {
      registerServiceWorker().then(() => {
        scheduleDailyReminder(getReminderHour());
      });
    }
  }, []);

  async function handleBellTap() {
    setShowSheet(true);
  }

  async function handleEnable() {
    setSaving(true);
    const reg = await registerServiceWorker();
    if (!reg) { setSaving(false); return; }
    const result = await requestPermission();
    setPermission(result);
    if (result === 'granted') {
      saveReminderTime(reminderHour);
      scheduleDailyReminder(reminderHour);
      setSaved(true);
      setTimeout(() => { setSaved(false); setShowSheet(false); }, 2000);
    }
    setSaving(false);
  }

  function handleDisable() {
    clearScheduledReminder();
    setShowSheet(false);
  }

  function handleTimeChange(hour) {
    setReminderHour(hour);
    if (permission === 'granted') {
      saveReminderTime(hour);
      scheduleDailyReminder(hour);
    }
  }

  const isEnabled = permission === 'granted';
  const isDenied  = permission === 'denied';

  return (
    <>
      {/* Bell icon button */}
      <button
        onClick={handleBellTap}
        className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center relative active:scale-90 transition-transform"
        aria-label="Daily reminder settings"
      >
        <svg
          viewBox="0 0 24 24"
          fill={isEnabled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          className={`w-5 h-5 ${isEnabled ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          <path
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Green dot when enabled */}
        {isEnabled && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-800" />
        )}
      </button>

      {/* Bottom sheet */}
      {showSheet && (
        <>
          <div className="sheet-overlay" onClick={() => setShowSheet(false)} />
          <div className="sheet-panel bg-[#0f172a] border-t border-slate-700/50 rounded-t-3xl px-6 pt-5 pb-10">

            {/* Handle bar */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5" />

            {/* Title */}
            <h2 className="font-display font-black text-xl text-white mb-1">Daily Reminder</h2>
            <p className="font-sans text-sm text-slate-400 mb-6">
              Get a push notification to play your daily quiz and protect your streak.
            </p>

            {/* Unsupported */}
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

            {/* Denied */}
            {supported && isDenied && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <p className="font-sans text-sm text-red-400 font-semibold">Notifications are blocked</p>
                <p className="font-sans text-xs text-slate-400 mt-1 leading-relaxed">
                  To enable: tap the lock icon in your browser address bar → Notifications → Allow. Then come back and tap Enable.
                </p>
              </div>
            )}

            {/* Not yet enabled */}
            {supported && !isDenied && !isEnabled && (
              <>
                <p className="font-sans font-medium text-xs text-slate-400 uppercase tracking-wide mb-3">
                  Remind me at
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {TIME_SLOTS.map(({ label, hour }) => (
                    <button
                      key={hour}
                      onClick={() => handleTimeChange(hour)}
                      className={`px-4 py-2 rounded-full font-sans font-semibold text-sm transition-all active:scale-95 ${
                        reminderHour === hour
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-800 border border-slate-700 text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="font-sans text-xs text-slate-500 mb-5">All times are in IST</p>

                <button
                  onClick={handleEnable}
                  disabled={saving}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-display font-bold text-base active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(16,185,129,0.3)]"
                >
                  {saving ? 'Enabling...' : 'Enable Daily Reminder 🔔'}
                </button>
              </>
            )}

            {/* Enabled */}
            {supported && isEnabled && (
              saved ? (
                <div className="text-center py-4">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="font-display font-bold text-base text-emerald-400">Reminder set!</p>
                </div>
              ) : (
                <>
                  {/* Current schedule */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔔</span>
                      <div>
                        <p className="font-display font-bold text-sm text-emerald-400">Reminders enabled</p>
                        <p className="font-sans text-xs text-slate-400 mt-0.5">
                          Daily at{' '}
                          {new Date(2000, 0, 1, reminderHour).toLocaleTimeString('en-IN', {
                            hour: 'numeric', minute: '2-digit', hour12: true,
                          })}{' '}
                          IST
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Change time */}
                  <p className="font-sans font-medium text-xs text-slate-400 uppercase tracking-wide mb-3">
                    Change reminder time
                  </p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {TIME_SLOTS.map(({ label, hour }) => (
                      <button
                        key={hour}
                        onClick={() => handleTimeChange(hour)}
                        className={`px-4 py-2 rounded-full font-sans font-semibold text-sm transition-all active:scale-95 ${
                          reminderHour === hour
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-800 border border-slate-700 text-slate-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Disable */}
                  <button
                    onClick={handleDisable}
                    className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-display font-bold text-base active:scale-95 transition-transform"
                  >
                    Turn Off Reminders
                  </button>
                </>
              )
            )}

          </div>
        </>
      )}
    </>
  );
}
