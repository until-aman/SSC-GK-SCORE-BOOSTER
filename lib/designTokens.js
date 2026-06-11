export const typography = {
  appTitle: 'font-display text-[22px] leading-[1.15] font-black tracking-normal',
  pageTitle: 'font-display text-[20px] leading-[1.2] font-extrabold',
  sectionTitle: 'font-display text-[17px] leading-[1.25] font-extrabold',
  cardTitle: 'font-display text-[16px] leading-[1.25] font-bold',
  body: 'font-body text-[14px] leading-[1.55] font-medium',
  bodySmall: 'font-body text-[13px] leading-[1.45] font-medium',
  caption: 'font-body text-[12px] leading-[1.35] font-medium',
  button: 'font-body text-[15px] leading-[1.2] font-bold',
};

export const spacing = {
  pageX: 'px-4',
  sectionGap: 'mt-5',
  cardPadding: 'p-4',
  cardRadius: 'rounded-[22px]',
  cardGap: 'gap-3',
};

export const cardStyles = {
  base: 'rounded-[22px] border border-white/[0.08] bg-[#172D47] shadow-sm',
  interactive: 'active:scale-[0.98] transition-transform',
  premium: 'rounded-[24px] border border-white/[0.08] bg-[#1E3554]',
};

export const buttonStyles = {
  primary: 'rounded-2xl px-4 py-3 font-body text-[15px] font-bold active:scale-[0.98] transition-transform',
  secondary: 'rounded-2xl px-4 py-3 font-body text-[14px] font-bold border border-white/10 active:scale-[0.98] transition-transform',
};

export const sscQuestLight = {
  colors: {
    bg: '#F3FBFA',
    bgAlt: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FEFD',
    surfaceElevated: '#FFFFFF',
    borderSoft: '#DDE8F0',
  },
  text: {
    primary: '#102033',
    secondary: '#5B6B82',
    muted: '#8A98AA',
    inverse: '#FFFFFF',
  },
  brand: {
    orange: '#FF6A00',
    orangeDeep: '#F45100',
    teal: '#0EA5A4',
    tealSoft: '#E8F8F6',
  },
  gamification: {
    coinGold: '#F6B331',
    rankViolet: '#6D5DF6',
    streakAmber: '#F59E0B',
  },
  feedback: {
    success: '#12B886',
    successSoft: '#E7FAF3',
    warning: '#F59E0B',
    warningSoft: '#FFF7E6',
    danger: '#EF4444',
    dangerSoft: '#FEECEC',
    info: '#2563EB',
    infoSoft: '#EFF6FF',
  },
  state: {
    disabledBg: '#EEF3F7',
    disabledText: '#9AA8B8',
    focusRing: '#0EA5A4',
    overlay: 'rgba(16,32,51,0.45)',
  },
  radius: {
    card: '18px',
    hero: '22px',
    button: '16px',
    chip: '999px',
    modal: '24px',
  },
  shadows: {
    card: '0 8px 24px rgba(16, 32, 51, 0.08)',
    float: '0 16px 40px rgba(16, 32, 51, 0.12)',
    cta: '0 10px 22px rgba(255, 106, 0, 0.22)',
  },
  spacing: {
    pageX: 'px-4',
    sectionGap: 'mt-5',
    cardPadding: 'p-4',
    denseCardPadding: 'p-3',
  },
  classNames: {
    page: 'ssc-light-page',
    card: 'ssc-light-card',
    cardSoft: 'ssc-light-card-soft',
    buttonPrimary: 'ssc-light-button-primary',
    buttonSecondary: 'ssc-light-button-secondary',
    chip: 'ssc-light-chip',
    progressTrack: 'ssc-light-progress-track',
    progressFill: 'ssc-light-progress-fill',
    skeleton: 'ssc-light-skeleton',
    focusRing: 'ssc-focus-ring',
  },
};

export const sscLightTokens = sscQuestLight;
