import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

function ruleBasedWrongAnswerTip({ correctOption, userOption, explanation, subject, topic }) {
  // Use the official explanation if it's substantial and not a known error string
  const knownErrors = ['could not', 'unavailable', 'error', 'failed', 'try again'];
  const expClean = (explanation || '').trim();
  const expIsUsable = expClean.length > 25 && !knownErrors.some(e => expClean.toLowerCase().includes(e));
  if (expIsUsable) {
    return `You picked ${userOption || 'the wrong option'} — the correct answer is ${correctOption}. ${expClean}`;
  }

  // Subject-specific tips
  const subj = (subject || topic || '').toLowerCase();
  if (subj.includes('polity') || subj.includes('constitution') || subj.includes('parliament')) {
    return `Constitutional articles and amendments are high-frequency in SSC. Note the exact article number for this topic and revise once more before your next attempt.`;
  }
  if (subj.includes('history') || subj.includes('ancient') || subj.includes('medieval') || subj.includes('modern')) {
    return `History questions often turn on exact dates, rulers, or events. Build a short timeline for this period — visual anchoring helps recall under exam pressure.`;
  }
  if (subj.includes('geography') || subj.includes('river') || subj.includes('mountain') || subj.includes('state')) {
    return `Geography facts like capitals, rivers, and boundaries repeat in SSC. Trace this answer on a map once — spatial memory is far stronger than plain text revision.`;
  }
  if (subj.includes('science') || subj.includes('physics') || subj.includes('chemistry') || subj.includes('biology')) {
    return `Science concepts require precise recall. Write the key fact from this question on a sticky note and review it tomorrow — spaced repetition beats a single long session.`;
  }
  if (subj.includes('econom') || subj.includes('budget') || subj.includes('gdp') || subj.includes('finance')) {
    return `Economic terms and government schemes are easy to confuse. Note the full name, year, and purpose of this one — SSC frequently tests exact details.`;
  }
  if (subj.includes('current') || subj.includes('affairs') || subj.includes('award') || subj.includes('summit')) {
    return `Current affairs answers change yearly — make sure your source is up to date. Bookmark this topic for a quick re-read before your exam.`;
  }

  // Generic fallback
  return `You chose ${userOption || 'an incorrect option'} — the correct answer is ${correctOption}. SSC often revisits similar questions with slight variations, so reviewing this topic now will pay off.`;
}

export async function explainWrongAnswer({ question, optionA, optionB, optionC, optionD, correctOption, userOption, explanation, subject, topic }) {
  if (!process.env.GEMINI_API_KEY) return ruleBasedWrongAnswerTip({ correctOption, userOption, explanation, subject, topic });
  try {
    const prompt = `You are a sharp, supportive SSC GK mentor. An aspirant got this question wrong.

Subject: ${subject} | Topic: ${topic}
Question: ${question}
A: ${optionA} | B: ${optionB} | C: ${optionC} | D: ${optionD}
Correct Answer: Option ${correctOption}
Aspirant chose: Option ${userOption}
Official explanation: ${explanation}

In 2-3 sentences:
1. Tell them exactly WHY they likely made the mistake (e.g. a common confusion, similar-sounding facts, tricky wording).
2. Give a sharp memory trick or key fact to remember the correct answer.
Be direct, specific, and mentor-like — not robotic. Reference SSC exam patterns if relevant.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) return ruleBasedWrongAnswerTip({ correctOption, userOption, explanation, subject, topic });
    return text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return ruleBasedWrongAnswerTip({ correctOption, userOption, explanation, subject, topic });
  }
}

export async function getPerformanceSummary({ subject, topic, totalQuestions, correctAnswers, incorrectAnswers, skipped, rawScore, accuracy }) {
  if (!process.env.GEMINI_API_KEY) return 'Great effort! Keep practicing to improve your score.';
  try {
    const prompt = `You are a motivating SSC GK mentor reviewing an aspirant's performance.

Subject: ${subject} | Topic: ${topic}
Score: ${rawScore}/${totalQuestions} | Accuracy: ${accuracy}% | Correct: ${correctAnswers} | Wrong: ${incorrectAnswers} | Skipped: ${skipped}

Write 2 punchy sentences:
1. A sharp, honest assessment of their performance (mention the score/accuracy).
2. One specific, actionable advice for what to focus on next.
Sound like a mentor who genuinely wants them to crack SSC — not a chatbot.`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    return 'Great effort! Keep practicing to improve your score.';
  }
}

export async function getSkippedTip({ question, correctOption, correctOptionText, explanation, subject, topic }) {
  if (!process.env.GEMINI_API_KEY) return 'Review this topic to build your confidence.';
  try {
    const prompt = `You are an SSC GK mentor. An aspirant skipped this question in their quiz.

Subject: ${subject} | Topic: ${topic}
Question: ${question}
Correct Answer: ${correctOptionText}
Explanation: ${explanation}

Give ONE sharp sentence: a memory trick, mnemonic, or key insight that makes this fact unforgettable for SSC prep.`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    return 'Review this topic to build your confidence.';
  }
}
