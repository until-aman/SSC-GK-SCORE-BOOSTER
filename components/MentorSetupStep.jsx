export default function MentorSetupStep({
  currentStep,
  totalSteps = 5,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  submitting = false,
  showBack = true,
  title = 'Set up Mentor',
  children,
}) {
  return (
    <div className="min-h-screen bg-[var(--ssc-bg)] text-ssc-text-primary">
      <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-4">
        <header className="sticky top-0 z-30 -mx-4 mb-4 bg-[rgba(243,251,250,0.92)] px-4 pb-3 pt-1 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ssc-text-primary active:scale-95"
              >
                Back
              </button>
            ) : (
              <span className="h-9 w-9" />
            )}

            <div className="min-w-0 text-center">
              <h1 className="font-display text-base font-black leading-tight text-ssc-text-primary">{title}</h1>
              <p className="mt-0.5 text-xs font-bold text-ssc-text-secondary">Step {currentStep} of {totalSteps}</p>
            </div>

            <span className="h-9 w-9" />
          </div>

          <div className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
            {Array.from({ length: totalSteps }).map((_, index) => {
              const active = index < currentStep;
              return (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${active ? 'bg-ssc-teal' : 'bg-[#DDE8F0]'}`}
                />
              );
            })}
          </div>
        </header>

        <div className="flex-1 space-y-4">{children}</div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-[#DDE8F0] bg-[rgba(255,255,255,0.96)] px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(16,32,51,0.08)] backdrop-blur">
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled || submitting}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black transition-all ${
            continueDisabled || submitting
              ? 'cursor-not-allowed bg-ssc-disabled-bg text-ssc-disabled-text'
              : 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[var(--ssc-shadow-cta)] active:scale-[0.98]'
          }`}
        >
          {submitting ? 'Saving...' : continueLabel}
          {!submitting && !(continueDisabled || submitting) ? <span aria-hidden="true">-&gt;</span> : null}
        </button>
      </div>
    </div>
  );
}
