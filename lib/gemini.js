const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Call Gemini 1.5 Flash with a system prompt and user prompt.
 * Returns the generated text, or null on failure.
 */
async function callGemini(systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('CRITICAL: GEMINI_API_KEY is missing from environment variables.');
    return null;
  }

  try {
    console.log(`[AI] Calling Gemini API for: "${userPrompt.substring(0, 50)}..."`);
    
    const combinedPrompt = `${systemPrompt}\n\n[TASK START]\n${userPrompt}`;
    
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: combinedPrompt }] }
        ],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.4,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[AI] Gemini API Error (${response.status}):`, JSON.stringify(data));
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('[AI] Gemini returned empty response.');
      return null;
    }

    console.log(`[AI] Gemini Success: "${text.substring(0, 30)}..."`);
    return text.trim();
  } catch (err) {
    console.error('[AI] Fetch Exception:', err);
    return null;
  }
}

/**
 * Explain why the user's answer was wrong.
 */
async function explainWrongAnswer({ question, optionA, optionB, optionC, optionD, correctOption, userOption, explanation, subject, topic }) {
  const options = { A: optionA, B: optionB, C: optionC, D: optionD };
  const correctOptionText = options[correctOption] || '';
  const userOptionText = options[userOption] || '';

  const systemPrompt = `You are a concise SSC exam mentor. A student answered an MCQ incorrectly.

STRICT RULES — follow these exactly:
- Do NOT generate new questions or new answer options.
- Do NOT change which option is correct. The CorrectOption field is always right.
- Keep your response under 60 words.
- Write in simple English for an SSC CGL/CHSL aspirant in India.
- Structure: 1 sentence why their choice is wrong, 1-2 sentences why the correct answer is right.
- Plain paragraph only. No bullet points. No markdown.`;

  const userPrompt = `Question: ${question}
Options: A) ${optionA}  B) ${optionB}  C) ${optionC}  D) ${optionD}
Correct answer: Option ${correctOption} — ${correctOptionText}
Student chose: Option ${userOption} — ${userOptionText}
Base explanation from question sheet: ${explanation || 'None provided'}

Explain why the student's answer was wrong and why the correct answer is right.`;

  return callGemini(systemPrompt, userPrompt);
}

/**
 * Give a memory tip for a skipped question.
 */
async function getSkippedTip({ question, correctOption, correctOptionText, explanation, subject, topic }) {
  const systemPrompt = `You are a concise SSC exam mentor. A student skipped an MCQ during a timed quiz.

STRICT RULES:
- Do NOT generate new questions or answer options.
- Do NOT change which option is correct.
- Keep your response under 50 words.
- Give a 1-2 sentence memory tip or mnemonic to help the student remember this specific fact.
- Do not repeat the question. Just give the memory tip.
- Simple English, friendly tone, exam-focused.
- Plain paragraph. No bullet points. No markdown.`;

  const userPrompt = `The correct answer is: ${correctOption}) ${correctOptionText}
Subject: ${subject}, Topic: ${topic}
Base explanation: ${explanation || 'None provided'}

Give a short memory tip to help remember this for the SSC exam.`;

  return callGemini(systemPrompt, userPrompt);
}

/**
 * Generate a performance summary after a quiz.
 */
async function getPerformanceSummary({ subject, topic, totalQuestions, correctAnswers, incorrectAnswers, skipped, rawScore, accuracy }) {
  const systemPrompt = `You are a motivating SSC exam mentor giving feedback after a practice quiz.

STRICT RULES:
- Do NOT generate new questions or answer options.
- Do NOT suggest or modify the student's score or marks.
- Keep your response under 70 words.
- Be encouraging but honest. If performance is poor, be constructive — not discouraging.
- End with exactly one specific, actionable study tip related to the subject and topic.
- Plain paragraph only. No bullet points. No markdown. No emojis.`;

  const userPrompt = `Subject: ${subject}, Topic: ${topic}
Total Questions: ${totalQuestions}
Correct: ${correctAnswers}, Wrong: ${incorrectAnswers}, Skipped: ${skipped}
Score: ${rawScore} marks
Accuracy: ${accuracy}%

Give a short, motivating performance summary and one specific study tip for this topic.`;

  return callGemini(systemPrompt, userPrompt);
}

module.exports = {
  explainWrongAnswer,
  getSkippedTip,
  getPerformanceSummary,
};
