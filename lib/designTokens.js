export const typography = {
  appTitle: 'font-display text-[22px] leading-[1.15] font-black tracking-normal text-text-primary',
  pageTitle: 'font-display text-[24px] leading-[1.18] font-extrabold text-text-primary',
  sectionTitle: 'font-display text-[18px] leading-[1.25] font-extrabold text-text-primary',
  cardTitle: 'font-display text-[17px] leading-[1.25] font-bold text-text-primary',
  body: 'font-body text-[14px] leading-[1.55] font-medium text-text-secondary',
  bodySmall: 'font-body text-[13px] leading-[1.45] font-medium text-text-muted',
  caption: 'font-body text-[12px] leading-[1.35] font-medium',
  button: 'font-body text-[15px] leading-[1.2] font-bold',
};

export const spacing = {
  pageX: 'px-4',
  sectionGap: 'mt-5',
  cardPadding: 'p-4',
  cardRadius: 'rounded-[20px]',
  cardGap: 'gap-3',
};

export const cardStyles = {
  base: 'rounded-[20px] border border-border-subtle bg-bg-card shadow-[0_8px_24px_rgba(15,23,42,0.06)]',
  interactive: 'active:scale-[0.98] transition-transform',
  soft: 'rounded-[20px] border border-border-subtle bg-bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
  premium: 'rounded-[24px] border border-border-subtle bg-gradient-to-b from-white to-bg-surface shadow-[0_10px_28px_rgba(15,23,42,0.07)]',
  teal: 'rounded-[20px] border border-brand-teal-border bg-brand-teal-glow',
  orange: 'rounded-[20px] border border-brand-orange-border bg-brand-orange-glow',
  danger: 'rounded-[20px] border border-red-200 bg-red-50',
};

export const buttonStyles = {
  primary: 'rounded-2xl bg-brand-orange px-4 py-3 font-body text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(255,106,20,0.22)] active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-transform',
  secondary: 'rounded-2xl border border-border-medium bg-white px-4 py-3 font-body text-[14px] font-bold text-text-primary active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400 transition-transform',
  teal: 'rounded-2xl border border-brand-teal-border bg-brand-teal px-4 py-3 font-body text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(20,184,166,0.18)] active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-transform',
  danger: 'rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-body text-[14px] font-bold text-red-600 active:scale-[0.98] transition-transform',
};

export const chipStyles = {
  base: 'rounded-full border border-border-medium bg-white px-3 py-1.5 text-[12px] font-bold text-text-secondary',
  active: 'rounded-full border border-brand-orange bg-brand-orange-glow px-3 py-1.5 text-[12px] font-bold text-orange-700',
  success: 'rounded-full border border-brand-teal-border bg-brand-teal-glow px-3 py-1.5 text-[12px] font-bold text-brand-teal-dim',
  danger: 'rounded-full border border-red-300 bg-red-100 px-3 py-1.5 text-[12px] font-bold text-red-700',
  reward: 'rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 text-[12px] font-bold text-amber-700',
};

export const inputStyles = {
  base: 'w-full rounded-[14px] border border-border-subtle bg-white px-3 py-3 text-[14px] font-medium text-text-primary placeholder:text-text-disabled outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10',
};

export const modalStyles = {
  backdrop: 'fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm',
  card: 'rounded-[24px] border border-border-subtle bg-white shadow-[0_24px_60px_rgba(15,23,42,0.20)]',
};
