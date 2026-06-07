export default function MentorSetupStep({
  currentStep,
  totalSteps = 5,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  submitting = false,
  showBack = true,
  children,
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-5">
        <div className="mb-5 flex items-center justify-between">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
            >
              Back
            </button>
          ) : (
            <span className="h-8 w-16" />
          )}

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, index) => {
              const active = index < currentStep;
              return (
                <span
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    active ? 'w-6 bg-teal-400' : 'w-2 bg-slate-700'
                  }`}
                />
              );
            })}
          </div>

          <span className="w-16 text-right text-xs text-slate-500">
            {currentStep}/{totalSteps}
          </span>
        </div>

        <div className="flex-1 space-y-5">{children}</div>

        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled || submitting}
          className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all ${
            continueDisabled || submitting
              ? 'cursor-not-allowed bg-slate-800 text-slate-500'
              : 'bg-teal-600 text-white shadow-lg shadow-teal-950/40 hover:bg-teal-500'
          }`}
        >
          {submitting ? 'Saving...' : continueLabel}
        </button>
      </main>
    </div>
  );
}
