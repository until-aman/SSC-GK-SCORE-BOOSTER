# Step 02 Theme Tokens Reference

Theme: SSC Quest Light  
Scope: reference for future screen-by-screen migration. These tokens are available but not applied to pages yet.

## Tailwind Tokens Added

Use these as Tailwind classes in later phases, for example `bg-ssc-bg`, `text-ssc-text-primary`, `border-ssc-border`, and `bg-ssc-orange`.

| Token | Value | Intended Usage |
|---|---:|---|
| `ssc.bg` | `#F3FBFA` | app background |
| `ssc.bgAlt` | `#F8FAFC` | alternate page background |
| `ssc.surface` | `#FFFFFF` | card and panel surface |
| `ssc.surfaceSoft` | `#F8FEFD` | nested/soft card surface |
| `ssc.surfaceElevated` | `#FFFFFF` | modal, top bar, bottom nav surface |
| `ssc.border` | `#DDE8F0` | card/input border |
| `ssc.text.primary` | `#102033` | headings and primary body text |
| `ssc.text.secondary` | `#5B6B82` | secondary copy and metadata |
| `ssc.text.muted` | `#8A98AA` | captions and low-emphasis text |
| `ssc.text.inverse` | `#FFFFFF` | text on orange/dark controls |
| `ssc.orange.DEFAULT` | `#FF6A00` | primary CTA, active nav, selected chips |
| `ssc.orange.deep` | `#F45100` | CTA gradient/pressed state |
| `ssc.teal.DEFAULT` | `#0EA5A4` | learning/progress accent |
| `ssc.teal.soft` | `#E8F8F6` | soft progress/chip background |
| `ssc.coin` | `#F6B331` | coins and reward highlights |
| `ssc.rank` | `#6D5DF6` | rank and achievement accent |
| `ssc.streak` | `#F59E0B` | streak accent |
| `ssc.success.DEFAULT` | `#12B886` | success/correct states |
| `ssc.success.soft` | `#E7FAF3` | success background |
| `ssc.warning.DEFAULT` | `#F59E0B` | warning/low-time states |
| `ssc.warning.soft` | `#FFF7E6` | warning background |
| `ssc.danger.DEFAULT` | `#EF4444` | wrong/error states |
| `ssc.danger.soft` | `#FEECEC` | wrong/error background |
| `ssc.info.DEFAULT` | `#2563EB` | neutral info accent |
| `ssc.info.soft` | `#EFF6FF` | info background |
| `ssc.disabled.bg` | `#EEF3F7` | disabled controls |
| `ssc.disabled.text` | `#9AA8B8` | disabled text |
| `ssc.focus` | `#0EA5A4` | focus ring |

## CSS Variables Added

Base:

- `--ssc-bg: #F3FBFA`
- `--ssc-bg-alt: #F8FAFC`
- `--ssc-surface: #FFFFFF`
- `--ssc-surface-soft: #F8FEFD`
- `--ssc-surface-elevated: #FFFFFF`
- `--ssc-border-soft: #DDE8F0`

Text:

- `--ssc-text-primary: #102033`
- `--ssc-text-secondary: #5B6B82`
- `--ssc-text-muted: #8A98AA`
- `--ssc-text-inverse: #FFFFFF`

Brand/action:

- `--ssc-orange: #FF6A00`
- `--ssc-orange-deep: #F45100`
- `--ssc-teal: #0EA5A4`
- `--ssc-teal-soft: #E8F8F6`

Gamification:

- `--ssc-coin: #F6B331`
- `--ssc-rank: #6D5DF6`
- `--ssc-streak: #F59E0B`

Feedback:

- `--ssc-success: #12B886`
- `--ssc-success-soft: #E7FAF3`
- `--ssc-warning: #F59E0B`
- `--ssc-warning-soft: #FFF7E6`
- `--ssc-danger: #EF4444`
- `--ssc-danger-soft: #FEECEC`
- `--ssc-info: #2563EB`
- `--ssc-info-soft: #EFF6FF`

State:

- `--ssc-disabled-bg: #EEF3F7`
- `--ssc-disabled-text: #9AA8B8`
- `--ssc-focus-ring: #0EA5A4`
- `--ssc-overlay: rgba(16,32,51,0.45)`

Shape/elevation:

- `--ssc-radius-card: 18px`
- `--ssc-radius-hero: 22px`
- `--ssc-radius-button: 16px`
- `--ssc-radius-chip: 999px`
- `--ssc-radius-modal: 24px`
- `--ssc-shadow-card: 0 8px 24px rgba(16, 32, 51, 0.08)`
- `--ssc-shadow-float: 0 16px 40px rgba(16, 32, 51, 0.12)`
- `--ssc-shadow-cta: 0 10px 22px rgba(255, 106, 0, 0.22)`

## CSS Utility Classes Added

- `.ssc-light-page`
- `.ssc-light-card`
- `.ssc-light-card-soft`
- `.ssc-light-button-primary`
- `.ssc-light-button-secondary`
- `.ssc-light-chip`
- `.ssc-light-progress-track`
- `.ssc-light-progress-fill`
- `.ssc-light-skeleton`
- `.ssc-focus-ring`

These classes are additive and unused in Step 2.

## JavaScript Exports Added

`lib/designTokens.js` now exports:

- `sscQuestLight`
- `sscLightTokens`

The new object includes:

- `colors`
- `text`
- `brand`
- `gamification`
- `feedback`
- `state`
- `radius`
- `shadows`
- `spacing`
- `classNames`

Existing exports remain:

- `typography`
- `spacing`
- `cardStyles`
- `buttonStyles`

## Future Usage Examples

Future light card:

```jsx
<div className="ssc-light-card p-4">
  <h2 className="text-ssc-text-primary">Today's Mixed GK Challenge</h2>
  <p className="text-ssc-text-secondary">25 questions · +50 coins</p>
</div>
```

Future CTA:

```jsx
<button className="ssc-light-button-primary w-full px-4 py-3">
  Start Quiz Now
</button>
```

Future chip:

```jsx
<span className="ssc-light-chip px-3 py-1 text-xs">
  Most Attempted
</span>
```

Future semantic state:

```jsx
<div className="rounded-2xl border border-ssc-danger/20 bg-ssc-danger-soft text-ssc-text-primary">
  Review this wrong answer.
</div>
```

Future skeleton:

```jsx
<div className="ssc-light-skeleton h-16 rounded-2xl" />
```

## Accessibility Notes

- Use `#102033` for primary text on white surfaces.
- Use muted text sparingly under 12px.
- Do not rely only on red/green for quiz answer states; keep icons or labels.
- Use orange mainly for primary actions and selected states.
- Use teal for progress, learning, focus, and calm success indicators.
- Keep `text-inverse` on orange CTAs for reliable contrast.

