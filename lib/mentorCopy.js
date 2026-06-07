// lib/mentorCopy.js
// All Hinglish mentor messages and app constants for SSC Mentor layer.
// UI labels are in English. Only mentor guidance text is in Hinglish.

export const MENTOR_COPY = {
  // Setup screens
  SETUP_WELCOME: "Namaste! Main aapka SSC Mentor hoon. Pehle mujhe batao — kaun sa exam de rahe ho?",
  SETUP_DAYS_LEFT: "Exam mein kitna time bacha hai? Sach batana — plan usi hisaab se banega.",
  SETUP_TIME_PACE: "Roz kitna time GK ko de sakte ho? Aur kaisi preparation chahiye?",
  SETUP_SUBJECT_STATUS: "Ab batao — kaun se subjects mein theory cover ho gayi hai aur kaun se abhi baaki hain?",
  SETUP_PLAN_READY: "Aapka personalized plan ready hai. Aaj se shuruat karte hain.",

  // Days left closing lines
  DAYS_VERY_CLOSE: "Waqt kam hai. Ek ek din matter karta hai.",
  DAYS_CLOSE: "Ek mahine mein bohot kuch ho sakta hai. Focused raho.",
  DAYS_MODERATE: "Achha time hai. Consistent raho aur strong base banao.",
  DAYS_PLENTY: "Aaram se chalo, lekin roz thoda zaroor karo.",

  // Time of day greetings
  MORNING_GREETING: "Subah ho gayi hai. Aaj ka plan ready hai — ek ek task clear karo.",
  AFTERNOON_GREETING: "Dopahar ho gayi hai. Aaj ka plan abhi bhi pending hai.",
  EVENING_GREETING: "Shaam ho gayi. Kuch task baaki hain — aaj complete karo.",
  NIGHT_GREETING: "Raat mein bhi padh rahe ho — yahi dedication result degi.",

  // Task type messages
  THEORY_TASK: "Is topic ki theory abhi tak cover nahi hui hai. Apne source se padho aur Mark as Done karo.",
  PRACTICE_TASK: "Is topic ki theory ho gayi hai. Ab practice karo — questions se confidence aata hai.",
  MISTAKE_REVISION: "Yeh questions tune pehle galat kiye the. Ek baar aur dekho — samajh ke karo.",
  QUICK_REVISION: "Is topic mein score weak tha. Ek quick revision karo aur phir attempt karo.",
  DAILY_CHALLENGE: "Aaj ka Daily Challenge attempt karo — yeh routine ka hissa hai.",
  SAVED_REVISION: "Tune yeh questions save kiye the. Aaj inhe revise karte hain.",

  // Result screen performance messages
  RESULT_EXCELLENT: "Zabardast! Is topic par pakad mazboot hai. Aage badho.",
  RESULT_GOOD: "Achha kiya. Thoda aur practice karo aur yeh topic strong ho jayega.",
  RESULT_AVERAGE: "Theek tha, lekin improvement ki jagah hai. Mistakes zaroor dekho.",
  RESULT_WEAK: "Score thoda kam raha. Ghabrao mat — mistakes dekho aur ek baar aur attempt karo.",
  RESULT_LOW_CONFIDENCE: "Bohot questions skip kiye. Confidence ke liye revision karo pehle.",

  // Achievements
  ACHIEVEMENTS_LABEL: "Yeh tumhari mehnat ka result hai.",

  // Empty states
  NO_PLAN: "Aapka personalized GK plan abhi ready nahi hai. Setup mein sirf 2 minute lagte hain.",
  NO_THEORY_DONE: "Abhi koi topic practice ke liye ready nahi hai. Pehle kuch topics ki theory complete mark karo.",
  NO_MISTAKES: "Abhi mistake history nahi bani hai. Pehle kuch quizzes attempt karo.",
  NO_TASKS_TODAY: "Aaj ke liye koi pending task nahi hai. Achha kaam kiya!",
  PLAN_FAILED: "Plan generate nahi ho paya. Please retry.",
  EDIT_PROFILE_SAVED: "Preparation details update ho gayi hain.",
};

export const TOPIC_STATUS = {
  NOT_STARTED: 'Not Started',
  WEAK: 'Weak',
  STRONG: 'Strong',
};

export const SUBJECT_STATUS = {
  NOT_STARTED: 'Not Started',
  THEORY_DONE: 'Theory Done',
  PRACTICE_STARTED: 'Practice Started',
};

export const TASK_TYPE = {
  THEORY_TASK: 'THEORY_TASK',
  PRACTICE_TASK: 'PRACTICE_TASK',
  MISTAKE_REVISION: 'MISTAKE_REVISION',
  QUICK_REVISION: 'QUICK_REVISION',
  DAILY_CHALLENGE: 'DAILY_CHALLENGE',
  SAVED_REVISION: 'SAVED_REVISION',
};

export const PERFORMANCE_CATEGORY = {
  EXCELLENT: 'EXCELLENT',         // correctRate >= 80
  GOOD: 'GOOD',                   // correctRate >= 65
  AVERAGE: 'AVERAGE',             // correctRate >= 45
  WEAK: 'WEAK',                   // correctRate < 45
  LOW_CONFIDENCE: 'LOW_CONFIDENCE', // skippedRate >= 30 (overrides others)
};

export const TASK_COUNT_BY_TIME = {
  '15-20 min': 2,
  '30 min': 3,
  '45 min': 4,
  '1 hour': 5,
  '1.5+ hours': 6,
};

export const DAYS_LEFT_DEFAULT = 45;

export const SUBJECT_DISPLAY_NAMES = {
  Polity: 'Indian Polity',
  Geography: 'Geography',
  Ancient_History: 'Ancient History',
  Medieval_History: 'Medieval History',
  Modern_History: 'Modern History',
  Economics: 'Economics',
  Physics: 'Physics',
  Chemistry: 'Chemistry',
  Biology: 'Biology',
  Current_Affairs: 'Current Affairs',
  Static_GK: 'Static GK',
};

export const SUBJECT_ICONS = {
  Polity: '🏛️',
  Geography: '🌍',
  Ancient_History: '🏺',
  Medieval_History: '⚔️',
  Modern_History: '📜',
  Economics: '📊',
  Physics: '⚡',
  Chemistry: '🧪',
  Biology: '🧬',
  Current_Affairs: '📰',
  Static_GK: '📚',
};

export const FEEDBACK_CHIPS = [
  'Good',
  'Need Revision',
  'Forgot Facts',
  'Concept Not Clear',
  'Too Difficult',
];
