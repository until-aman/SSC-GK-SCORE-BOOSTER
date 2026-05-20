import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function explainWrongAnswer({ question, optionA, optionB, optionC, optionD, correctOption, userOption, explanation, subject, topic }) {
  if (!process.env.GEMINI_API_KEY) return 'AI Explanation requires a Gemini API key.';
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
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    return 'Could not generate explanation at this time.';
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
