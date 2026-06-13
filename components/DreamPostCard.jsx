import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getDreamPost, updateDreamPost } from '@/lib/data/profileData';

const DREAM_POST_TARGET = 8000;

const DROPDOWN_OPTIONS = [
  'GST Inspector',
  'Income Tax Inspector',
  'ASO CSS',
  'ASO MEA',
  'CBI SI',
  'Excise Inspector',
  'Preventive Officer',
  'Examiner',
  'AAO',
  'Other',
];

function getMotivationalMessage(progressPercent, dreamPost) {
  const post = dreamPost || 'your Dream Post';
  if (progressPercent >= 100) return `You earned this tag through consistent practice.`;
  if (progressPercent >= 90)  return `Almost there. Stay consistent — your ${post} tag is within reach.`;
  if (progressPercent >= 75)  return `Getting close. A few more focused quizzes and your ${post} goal is yours.`;
  if (progressPercent >= 50)  return `Halfway there. Your consistent practice is building real ${post} preparation.`;
  if (progressPercent >= 25)  return `Building momentum. Keep practicing to get closer to your ${post} goal.`;
  if (progressPercent >= 10)  return `Good start. Keep practicing — every quiz moves you closer to your ${post} goal.`;
  return `Your journey has started. Practice daily and build momentum toward your ${post} goal.`;
}

export default function DreamPostCard({ coins }) {
  const { data: session } = useSession();
  const scope = getUserCacheScope(session);
  const [dreamPost, setDreamPost]                     = useState('');
  const [dreamPostUnlockedAt, setDreamPostUnlockedAt] = useState(null);
  const [isEditing, setIsEditing]                     = useState(false);
  const [selectedOption, setSelectedOption]           = useState('');
  const [customInput, setCustomInput]                 = useState('');
  const [isLoading, setIsLoading]                     = useState(true);
  const [isSaving, setIsSaving]                       = useState(false);
  const [error, setError]                             = useState('');
  const [fetchError, setFetchError]                   = useState(false);

  useEffect(() => {
    // Account-scoped, cache-aware read (fresh → 0 network; else 1 GET, deduped).
    getDreamPost({ scope })
      .then(res => {
        const data = res?.data || {};
        setDreamPost(data.dreamPost || '');
        setDreamPostUnlockedAt(data.dreamPostUnlockedAt || null);
        setIsLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function openEditForm() {
    setError('');
    if (dreamPost && DROPDOWN_OPTIONS.includes(dreamPost)) {
      setSelectedOption(dreamPost);
      setCustomInput('');
    } else if (dreamPost) {
      setSelectedOption('Other');
      setCustomInput(dreamPost);
    } else {
      setSelectedOption('');
      setCustomInput('');
    }
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setError('');
    setSelectedOption('');
    setCustomInput('');
  }

  async function handleSave() {
    const valueToSave = selectedOption === 'Other'
      ? customInput.trim()
      : selectedOption.trim();

    if (!valueToSave) {
      setError('Please enter your Dream Post');
      return;
    }
    if (valueToSave.length < 2 || valueToSave.length > 40) {
      setError('Please enter a valid Dream Post (2–40 characters)');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      // One mutation (in-flight deduped); patches the scoped Dream Post cache.
      // No follow-up GET.
      const data = await updateDreamPost({ scope, dreamPost: valueToSave });
      if (!data.ok) {
        setError(data.error || "Couldn't save your Dream Post. Please try again.");
        return;
      }
      setDreamPost(data.dreamPost);
      setDreamPostUnlockedAt(data.dreamPostUnlockedAt);
      setIsEditing(false);
      setSelectedOption('');
      setCustomInput('');
    } catch {
      setError("Couldn't save your Dream Post. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const isUnlocked      = !!dreamPostUnlockedAt;
  const displayCoins    = isUnlocked ? DREAM_POST_TARGET : coins;
  const progressPercent = Math.min(100, (displayCoins / DREAM_POST_TARGET) * 100);

  /* ── State 1: Loading ──────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="bg-[var(--ssc-surface)] border border-[var(--ssc-border-soft)] rounded-2xl p-4 mt-3 shadow-[var(--ssc-shadow-card)]">
        <div className="skeleton h-4 w-32 rounded-lg mb-3" />
        <div className="skeleton h-3 w-full rounded-lg mb-2" />
        <div className="skeleton h-2 w-full rounded-full" />
      </div>
    );
  }

  /* ── Fetch error ───────────────────────────────────────────────── */
  if (fetchError) {
    return (
      <div className="bg-[var(--ssc-surface)] border border-[var(--ssc-border-soft)] rounded-2xl p-4 mt-3 shadow-[var(--ssc-shadow-card)]">
        <p className="text-[var(--ssc-text-muted)] text-sm">
          Couldn't load your Dream Post. Refresh to try again.
        </p>
      </div>
    );
  }

  /* ── State 3: Edit / Set form ──────────────────────────────────── */
  if (isEditing) {
    return (
      <div className="bg-[var(--ssc-surface)] border border-[var(--ssc-border-soft)] rounded-2xl p-4 mt-3 shadow-[var(--ssc-shadow-card)]">
        <p className="text-[var(--ssc-text-primary)] text-base font-semibold mb-3">
          What is your Dream Post?
        </p>

        <select
          value={selectedOption}
          onChange={e => { setSelectedOption(e.target.value); setError(''); }}
          className="w-full bg-[var(--ssc-surface-soft)] border border-[var(--ssc-border-soft)] rounded-xl px-4 py-3 text-[var(--ssc-text-primary)] text-sm focus:border-[var(--ssc-teal)] focus:outline-none"
        >
          <option value="" disabled>Select a post</option>
          {DROPDOWN_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {selectedOption === 'Other' && (
          <input
            type="text"
            value={customInput}
            onChange={e => { setCustomInput(e.target.value); setError(''); }}
            placeholder="Enter your Dream Post"
            maxLength={40}
            className="w-full bg-[var(--ssc-surface-soft)] border border-[var(--ssc-border-soft)] rounded-xl px-4 py-3 text-[var(--ssc-text-primary)] text-sm focus:border-[var(--ssc-teal)] focus:outline-none mt-2 placeholder-[var(--ssc-text-muted)]"
          />
        )}

        {error && (
          <p className="text-[var(--ssc-danger)] text-xs mt-1.5">{error}</p>
        )}

        {dreamPost !== '' && (
          <p className="text-[var(--ssc-text-muted)] text-xs mt-2 leading-relaxed">
            Your progress will stay the same. Only your Dream Post will change.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[var(--ssc-orange)] hover:bg-[var(--ssc-orange-deep)] text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="bg-white border border-[var(--ssc-border-soft)] hover:bg-[var(--ssc-surface-soft)] text-[var(--ssc-text-secondary)] font-medium rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /* ── State 2: No dream post set ────────────────────────────────── */
  if (!dreamPost) {
    return (
      <div className="bg-[var(--ssc-surface)] border border-[var(--ssc-border-soft)] rounded-2xl p-4 mt-3 shadow-[var(--ssc-shadow-card)]">
        <p className="text-2xl mb-2">🎯</p>
        <p className="text-[var(--ssc-text-primary)] text-base font-semibold">Set Your Dream Post</p>
        <p className="text-[var(--ssc-text-muted)] text-sm mt-1 leading-relaxed">
          Choose your target SSC post and track your progress as you practice.
        </p>
        <button
          onClick={openEditForm}
          className="mt-4 bg-[var(--ssc-orange)] hover:bg-[var(--ssc-orange-deep)] text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors shadow-[var(--ssc-shadow-cta)]"
        >
          Set Dream Post
        </button>
      </div>
    );
  }

  /* ── State 5: Unlocked ─────────────────────────────────────────── */
  if (isUnlocked) {
    return (
      <div className="bg-[var(--ssc-surface)] border border-[rgba(246,179,49,0.32)] rounded-2xl p-4 mt-3 shadow-[var(--ssc-shadow-card)]">
        <p className="text-[var(--ssc-coin)] text-base font-semibold">🏅 Dream Post Unlocked</p>
        <p className="text-[var(--ssc-orange)] text-lg font-bold mt-1">{dreamPost}</p>

        <p className="text-[var(--ssc-text-secondary)] text-sm mt-3">
          <span className="text-[var(--ssc-text-primary)] font-semibold">8,000</span> / 8,000 coins
        </p>
        <div className="h-2 bg-[var(--ssc-disabled-bg)] rounded-full mt-2">
          <div className="h-2 bg-[var(--ssc-coin)] rounded-full" style={{ width: '100%' }} />
        </div>

        <p className="text-[var(--ssc-text-muted)] text-sm mt-3 leading-relaxed">
          You earned this tag through consistent practice.
        </p>

        <button
          onClick={openEditForm}
          className="mt-3 bg-white border border-[var(--ssc-border-soft)] hover:bg-[var(--ssc-surface-soft)] text-[var(--ssc-text-secondary)] font-medium rounded-xl px-4 py-2 text-sm transition-colors"
        >
          Edit Dream Post
        </button>
      </div>
    );
  }

  /* ── State 4: Post set, progress in flight ─────────────────────── */
  return (
    <div className="bg-[var(--ssc-surface)] border border-[var(--ssc-border-soft)] rounded-2xl p-4 mt-3 shadow-[var(--ssc-shadow-card)]">

      {/* 🎯 Dream Post ————————————————————————— Edit */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[var(--ssc-text-muted)] text-sm font-semibold">
          🎯 Dream Post
        </p>
        <button
          onClick={openEditForm}
          className="text-[var(--ssc-teal)] hover:text-[var(--ssc-orange)] text-xs font-medium transition-colors active:opacity-50 flex-shrink-0"
        >
          Edit
        </button>
      </div>

      {/* Post name — prominent */}
      <p className="text-[var(--ssc-text-primary)] text-base font-bold mb-3 truncate">
        {dreamPost}
      </p>

      {/* 18% completed */}
      <p className="text-[var(--ssc-text-muted)] text-xs mb-1.5">
        <span className="text-[var(--ssc-text-primary)] font-semibold">{Math.floor(progressPercent)}%</span>
        {' completed'}
      </p>

      {/* Progress bar */}
      <div className="relative rounded-full" style={{ height: 10, background: 'var(--ssc-disabled-bg)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, var(--ssc-teal), var(--ssc-success))',
            boxShadow: '0 0 10px rgba(14,165,164,0.22)',
          }}
        />
        {progressPercent > 3 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `calc(${progressPercent}% - 6px)`,
              width: 12, height: 12,
              background: '#fff',
              border: '2px solid var(--ssc-teal)',
              boxShadow: '0 0 7px rgba(20,184,166,0.85)',
            }}
          />
        )}
      </div>

      {/* Coins to unlock */}
      <p className="text-[var(--ssc-text-muted)] text-xs mt-3">
        {Math.max(0, DREAM_POST_TARGET - coins).toLocaleString()} coins to unlock your tag
      </p>

    </div>
  );
}
