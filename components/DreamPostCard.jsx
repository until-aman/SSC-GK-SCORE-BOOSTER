import { useState, useEffect } from 'react';

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

function getMotivationalMessage(progressPercent) {
  if (progressPercent >= 100) return 'You earned this tag through consistent practice.';
  if (progressPercent >= 90)  return 'Almost there. Stay consistent — your Dream Post Tag is within reach.';
  if (progressPercent >= 75)  return 'You are getting close. A few more focused quizzes can push you nearer to your goal.';
  if (progressPercent >= 50)  return 'Halfway strong. Your regular practice is turning into real preparation.';
  if (progressPercent >= 25)  return 'You are building consistency. Keep practicing to move closer to your Dream Post.';
  if (progressPercent >= 10)  return 'Good start. Every quiz is adding strength to your GK preparation.';
  return 'Your journey has started. Practice a few questions daily and build momentum.';
}

export default function DreamPostCard({ coinsEarned }) {
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
    fetch('/api/dream-post')
      .then(r => r.json())
      .then(data => {
        setDreamPost(data.dreamPost || '');
        setDreamPostUnlockedAt(data.dreamPostUnlockedAt || null);
        setIsLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setIsLoading(false);
      });
  }, []);

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
      const res = await fetch('/api/dream-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dreamPost: valueToSave }),
      });
      const data = await res.json();
      if (!res.ok) {
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
  const displayCoins    = isUnlocked ? DREAM_POST_TARGET : coinsEarned;
  const progressPercent = Math.min(100, (displayCoins / DREAM_POST_TARGET) * 100);

  /* ── State 1: Loading ──────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="bg-[#172D47] border border-white/10 rounded-2xl p-4 mt-3">
        <div className="skeleton h-4 w-32 rounded-lg mb-3" />
        <div className="skeleton h-3 w-full rounded-lg mb-2" />
        <div className="skeleton h-2 w-full rounded-full" />
      </div>
    );
  }

  /* ── Fetch error ───────────────────────────────────────────────── */
  if (fetchError) {
    return (
      <div className="bg-[#172D47] border border-white/10 rounded-2xl p-4 mt-3">
        <p className="text-[#7A8FA6] text-sm">
          Couldn't load your Dream Post. Refresh to try again.
        </p>
      </div>
    );
  }

  /* ── State 3: Edit / Set form ──────────────────────────────────── */
  if (isEditing) {
    return (
      <div className="bg-[#172D47] border border-white/10 rounded-2xl p-4 mt-3">
        <p className="text-[#F0F4F8] text-base font-semibold mb-3">
          What is your Dream Post?
        </p>

        <select
          value={selectedOption}
          onChange={e => { setSelectedOption(e.target.value); setError(''); }}
          className="w-full bg-[#112236] border border-white/10 rounded-xl px-4 py-3 text-[#F0F4F8] text-sm focus:border-[#FF6B16]/50 focus:outline-none"
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
            className="w-full bg-[#112236] border border-white/10 rounded-xl px-4 py-3 text-[#F0F4F8] text-sm focus:border-[#FF6B16]/50 focus:outline-none mt-2 placeholder-[#4A5A6B]"
          />
        )}

        {error && (
          <p className="text-[#EF4444] text-xs mt-1.5">{error}</p>
        )}

        {dreamPost !== '' && (
          <p className="text-[#7A8FA6] text-xs mt-2 leading-relaxed">
            Your progress will stay the same. Only your Dream Post will change.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#FF6B16] hover:bg-[#E55E0E] text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="bg-transparent border border-white/15 hover:bg-white/5 text-[#B8C4D4] font-medium rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50"
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
      <div className="bg-[#172D47] border border-white/10 rounded-2xl p-4 mt-3">
        <p className="text-2xl mb-2">🎯</p>
        <p className="text-[#F0F4F8] text-base font-semibold">Set Your Dream Post</p>
        <p className="text-[#7A8FA6] text-sm mt-1 leading-relaxed">
          Choose your target SSC post and track your progress as you practice.
        </p>
        <button
          onClick={openEditForm}
          className="mt-4 bg-[#FF6B16] hover:bg-[#E55E0E] text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
        >
          Set Dream Post
        </button>
      </div>
    );
  }

  /* ── State 5: Unlocked ─────────────────────────────────────────── */
  if (isUnlocked) {
    return (
      <div className="bg-[#172D47] border border-[#F59E0B]/30 rounded-2xl p-4 mt-3">
        <p className="text-[#F59E0B] text-base font-semibold">🏅 Dream Post Unlocked</p>
        <p className="text-[#FF6B16] text-lg font-bold mt-1">{dreamPost}</p>

        <p className="text-[#B8C4D4] text-sm mt-3">
          <span className="text-[#F0F4F8] font-semibold">8,000</span> / 8,000 coins
        </p>
        <div className="h-2 bg-[#112236] rounded-full mt-2">
          <div className="h-2 bg-[#F59E0B] rounded-full" style={{ width: '100%' }} />
        </div>

        <p className="text-[#7A8FA6] text-sm mt-3 leading-relaxed">
          You earned this tag through consistent practice.
        </p>

        <button
          onClick={openEditForm}
          className="mt-3 bg-transparent border border-white/15 hover:bg-white/5 text-[#B8C4D4] font-medium rounded-xl px-4 py-2 text-sm transition-colors"
        >
          Edit Dream Post
        </button>
      </div>
    );
  }

  /* ── State 4: Post set, progress in flight ─────────────────────── */
  return (
    <div className="bg-[#172D47] border border-white/10 rounded-2xl p-4 mt-3">
      <p className="text-[#F0F4F8] text-base font-semibold">🎯 Dream Post</p>
      <p className="text-[#FF6B16] text-lg font-bold mt-1">{dreamPost}</p>

      <p className="text-[#B8C4D4] text-sm mt-3">
        <span className="text-[#F0F4F8] font-semibold">
          {coinsEarned.toLocaleString()}
        </span>{' '}/ 8,000 coins
      </p>
      <div className="h-2 bg-[#112236] rounded-full mt-2">
        <div
          className="h-2 bg-[#14B8A6] rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="text-[#7A8FA6] text-sm mt-3 leading-relaxed">
        {getMotivationalMessage(progressPercent)}
      </p>

      <button
        onClick={openEditForm}
        className="mt-3 bg-transparent border border-white/15 hover:bg-white/5 text-[#B8C4D4] font-medium rounded-xl px-4 py-2 text-sm transition-colors"
      >
        Edit
      </button>
    </div>
  );
}
