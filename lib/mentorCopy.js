// lib/mentorCopy.js
// All Hinglish mentor messages and app constants for SSC Mentor layer.
// UI labels are in English. Only mentor guidance text is in Hinglish.

export const MENTOR_COPY = {
  // Setup screens
  SETUP_WELCOME: "Namaste! Pehle exam target select kar lijiye, phir plan usi hisaab se banega.",
  SETUP_DAYS_LEFT: "Exam mein kitna time bacha hai? Sahi timeline select kar lijiye, plan usi hisaab se adjust hoga.",
  SETUP_TIME_PACE: "Aap roz GK ko kitna time de sakte hain? Apna pace select kar lijiye.",
  SETUP_SUBJECT_STATUS: "Ab subject status select kar lijiye — kaun se subjects ready hain aur kaun se abhi baaki hain.",
  SETUP_PLAN_READY: "Aapka personalized plan ready hai. Pehle ek task complete kar lijiye, phir next step pe chalte hain.",

  // Days left closing lines
  DAYS_VERY_CLOSE: "Waqt kam hai. Har din ka plan carefully complete kar lijiye.",
  DAYS_CLOSE: "Ek mahine mein kaafi improvement ho sakti hai. Focused practice rakhiye.",
  DAYS_MODERATE: "Time achha hai. Consistent practice se strong base ban jayega.",
  DAYS_PLENTY: "Aapke paas time hai. Roz thoda consistent practice kar lijiye.",

  // Time of day greetings
  MORNING_GREETING: "Aaj ka plan ready hai. Pehle ek task complete kar lijiye, phir next step pe chalte hain.",
  AFTERNOON_GREETING: "Aaj ka plan abhi pending hai. Pehle priority task complete kar lijiye.",
  EVENING_GREETING: "Kuch tasks baaki hain. Aaj ek focused revision complete kar lijiye.",
  NIGHT_GREETING: "Late study kar rahe hain. Short revision kar lijiye aur plan ko manageable rakhiye.",

  // Task type messages
  THEORY_TASK: "Is topic ki theory abhi cover nahi hui hai. Pehle apne source se padh lijiye, phir Mark as Done karein.",
  PRACTICE_TASK: "Is topic ki theory complete ho chuki hai. Ab questions practice karne se aapka confidence strong hoga.",
  MISTAKE_REVISION: "Aapne yeh questions pehle galat kiye hain. Ek baar revise kar lijiye — score recover hoga.",
  QUICK_REVISION: "Is topic mein mistakes zyada aa rahi hain. Pehle quick revision kar lijiye, phir dobara attempt karein.",
  DAILY_CHALLENGE: "Aaj ka Daily Challenge attempt kar lijiye. Yeh routine practice ka important part hai.",
  SAVED_REVISION: "Aapne yeh questions save kiye hain. Aaj inhe revise kar lijiye.",

  // Result screen performance messages
  RESULT_EXCELLENT: "Bahut achha performance hai. Is topic ko spaced revision mein add kar rahe hain.",
  RESULT_GOOD: "Is topic mein aapka performance improve ho raha hai. Thodi aur practice se topic strong hoga.",
  RESULT_AVERAGE: "Improvement ki scope hai. Pehle mistakes review kar lijiye, phir short practice karein.",
  RESULT_WEAK: "Is topic mein mistakes zyada aa rahi hain. Pehle quick revision kar lijiye, phir wrong questions dobara attempt karein.",
  RESULT_LOW_CONFIDENCE: "Aapne kaafi questions skip kiye hain. Topic recall weak ho sakta hai, pehle short revision karna better rahega.",

  // Achievements
  ACHIEVEMENTS_LABEL: "Yeh aapki consistent practice ka result hai.",

  // Empty states
  NO_PLAN: "Aapka personalized GK plan abhi ready nahi hai. Setup complete kar lijiye, phir daily plan mil jayega.",
  NO_THEORY_DONE: "Abhi koi topic practice ke liye ready nahi hai. Pehle kuch topics ki theory complete mark kar lijiye.",
  NO_MISTAKES: "Abhi mistake history nahi bani hai. Pehle kuch quizzes attempt kar lijiye.",
  NO_TASKS_TODAY: "Aaj ke liye koi pending task nahi hai. Revision streak maintain rakhiye.",
  PLAN_FAILED: "Plan generate nahi ho paya. Please retry.",
  EDIT_PROFILE_SAVED: "Aapki preparation details update ho gayi hain. Plan naye timeline ke hisaab se adjust ho jayega.",
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

export function getISTDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getISTHour(date = new Date()) {
  const hourPart = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date).find(part => part.type === 'hour');
  const hour = Number(hourPart?.value || 0);
  return hour === 24 ? 0 : hour;
}

export function getMentorDayMessage(date = new Date()) {
  const hour = getISTHour(date);
  if (hour < 12) return MENTOR_COPY.MORNING_GREETING;
  if (hour < 17) return MENTOR_COPY.AFTERNOON_GREETING;
  if (hour < 21) return MENTOR_COPY.EVENING_GREETING;
  return MENTOR_COPY.NIGHT_GREETING;
}

export function formatPreparationStartedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
