import { withApiTrace } from '@/lib/apiDiagnostics';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';
import { getAppConfig } from '@/lib/config/appConfig';
import { persistScore } from '@/lib/server/scorePersistence';

function buildHeaderIndex(headers) {
  return (headers || []).reduce((index, header, position) => {
    const key = String(header || '').trim();
    if (key) index[key] = position;
    return index;
  }, {});
}

function columnToLetter(columnNumber) {
  let letter = '';
  let n = columnNumber;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter || 'A';
}

function setRowValue(row, headerIndex, headerName, value) {
  const position = headerIndex[headerName];
  if (typeof position === 'number') row[position] = value;
}

async function getSheetHeaders(sheets, tabName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tabName}!1:1`,
  });
  const headers = (response.data.values || [[]])[0] || [];
  return { headers, headerIndex: buildHeaderIndex(headers) };
}

function buildRow(headers, headerIndex, valuesByHeader) {
  const row = new Array(headers.length).fill('');
  Object.entries(valuesByHeader).forEach(([headerName, value]) => {
    setRowValue(row, headerIndex, headerName, value);
  });
  return row;
}

async function appendHeaderRow(sheets, tabName, valuesByHeader) {
  const { headers, headerIndex } = await getSheetHeaders(sheets, tabName);
  if (!headers.length) throw new Error(`${tabName} header row is missing`);

  const row = buildRow(headers, headerIndex, valuesByHeader);
  const endColumn = columnToLetter(headers.length);
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tabName}!A:${endColumn}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

async function appendHeaderRows(sheets, tabName, rowsByHeader) {
  if (!rowsByHeader.length) return;

  const { headers, headerIndex } = await getSheetHeaders(sheets, tabName);
  if (!headers.length) throw new Error(`${tabName} header row is missing`);

  const rows = rowsByHeader.map(valuesByHeader => buildRow(headers, headerIndex, valuesByHeader));
  const endColumn = columnToLetter(headers.length);
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tabName}!A:${endColumn}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
}

async function quizSessionExists(sheets, clientSessionId) {
  if (!clientSessionId) return false;

  const { headerIndex } = await getSheetHeaders(sheets, 'QuizSessions');
  const columnIndex = headerIndex.ClientSessionId;
  if (typeof columnIndex !== 'number') return false;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'QuizSessions!A:ZZ',
  });
  const rows = (response.data.values || []).slice(1);
  return rows.some(row => String(row[columnIndex] || '') === clientSessionId);
}

function generateSessionId() {
  return `SESSION_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function validationError(message = 'Quiz data could not be saved. Please try again.') {
  return {
    success: false,
    error: {
      code: 'VALIDATION_FAILED',
      message,
    },
  };
}

function validateAnswer(answer) {
  if (!answer || typeof answer !== 'object') return false;
  if (!answer.questionId) return false;
  if (typeof answer.isCorrect !== 'boolean') return false;
  if (typeof answer.isSkipped !== 'boolean') return false;

  const timeTaken = Number(answer.timeTakenSeconds || 0);
  return Number.isFinite(timeTaken) && timeTaken >= 0 && timeTaken <= 35;
}

function buildQuestionIdsList(answers) {
  return answers.map(answer => String(answer.questionId || '').trim()).join(',');
}

function buildAnswersSummaryJSON(answers) {
  return JSON.stringify(answers.map(answer => {
    const isSkipped = Boolean(answer.isSkipped);
    const item = {
      q: answer.questionId,
      a: isSkipped ? null : (answer.userAnswer || null),
      ok: !isSkipped && Boolean(answer.isCorrect),
      s: Number(answer.timeTakenSeconds) || 0,
    };
    if (isSkipped) item.skip = true;
    return item;
  }));
}

function getDeviceType(req) {
  const userAgent = req.headers['user-agent'] || '';
  return /mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop';
}

function calculateSessionCoins({ correct, accuracy, completionStatus }) {
  const baseCoins = correct * 2;
  const accuracyBonus = accuracy >= 80 ? 10 : accuracy >= 60 ? 5 : 0;
  const completionBonus = completionStatus === 'completed' ? 5 : 0;
  return baseCoins + accuracyBonus + completionBonus;
}

export default withApiTrace('/api/quiz-session/complete', handler);
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  }

  const {
    clientSessionId = '',
    startedAt = '',
    subject = '',
    topic = '',
    sourceCollection = '',
    quizMode = 'normal',
    timeSpentSeconds = 0,
    answers = [],
    sourceScreen = 'unknown',
  } = req.body || {};

  if (!Array.isArray(answers) || answers.length === 0 || !answers.every(validateAnswer)) {
    return res.status(400).json(validationError());
  }

  try {
    const sheets = await getSheetsClient();
    if (await quizSessionExists(sheets, clientSessionId)) {
      return res.status(200).json({ success: true, alreadySaved: true });
    }

    const config = await getAppConfig();
    const appVersion = config.APP_VERSION || '1.0.0';
    const sessionId = generateSessionId();
    const completedAt = new Date().toISOString();
    const serverSavedAt = completedAt;
    const userEmail = session.user.email;
    const userName = session.user.name || '';

    const correct = answers.filter(answer => !answer.isSkipped && answer.isCorrect).length;
    const skipped = answers.filter(answer => answer.isSkipped).length;
    const incorrect = answers.length - correct - skipped;
    const score = correct * 2 - incorrect * 0.5;
    const accuracy = answers.length ? (correct / answers.length) * 100 : 0;
    const completionStatus = 'completed';
    const coins = calculateSessionCoins({ correct, accuracy, completionStatus });
    const deviceType = getDeviceType(req);
    const duplicateCheckKey = clientSessionId || `${userEmail}_${subject}_${topic}_${startedAt}`;
    const questionIdsList = buildQuestionIdsList(answers);
    const answersSummaryJSON = buildAnswersSummaryJSON(answers);

    // ── Score / coins / Users persistence (canonical completion) ─────────
    // Ordered before the QuizSessions write so that if a later write fails, a
    // retry re-runs cleanly: persistScore has its own independent Scores dedup
    // (hasDuplicateScore) so coins are never awarded twice. Prefer explicit
    // score fields from the body (identical to what /api/score received), with
    // a fallback to the values derived from `answers`.
    const scoreInput = {
      correctAnswers:   typeof req.body.correctAnswers   === 'number' ? req.body.correctAnswers   : correct,
      incorrectAnswers: typeof req.body.incorrectAnswers === 'number' ? req.body.incorrectAnswers : incorrect,
      skipped:          typeof req.body.skipped          === 'number' ? req.body.skipped          : skipped,
      totalQuestions:   typeof req.body.totalQuestions   === 'number' ? req.body.totalQuestions   : answers.length,
      rawScore:         typeof req.body.rawScore         === 'number' ? req.body.rawScore         : score,
      subject,
      topic,
      sessionId:        req.body.sessionId || clientSessionId || sessionId,
      clientSessionId,
      quizMode,
      sourceCollection,
      startedAt,
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
    };

    let scoreData = null;
    try {
      const scoreResult = await persistScore({ email: userEmail, name: userName, input: scoreInput });
      if (scoreResult.kind === 'success') {
        scoreData = scoreResult.data;
      } else if (scoreResult.kind === 'validation') {
        // Invalid score fields — do not fail the completion; session still saves.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[quiz-session/complete] score validation skipped:', scoreResult.error);
        }
      }
      // kind === 'duplicate' → Scores already saved earlier; no fresh coin data.
    } catch (scoreErr) {
      // Real persistence failure BEFORE the QuizSessions write — return a
      // controlled error so the client retry re-runs and converges (Scores dedup
      // prevents double coins). Do not hide the failure.
      console.error('[quiz-session/complete] score persistence failed:', scoreErr.message);
      return res.status(500).json({ success: false, error: { code: 'SCORE_PERSIST_FAILED', message: 'Could not save score. Please retry.' } });
    }

    await appendHeaderRow(sheets, 'QuizSessions', {
      SessionId: sessionId,
      UserId: userEmail,
      UserEmail: userEmail,
      UserName: userName,
      StartedAt: startedAt,
      CompletedAt: completedAt,
      Subject: subject,
      Topic: topic,
      SourceCollection: sourceCollection,
      QuizMode: quizMode || 'normal',
      QuestionCount: answers.length,
      Correct: correct,
      Incorrect: incorrect,
      Skipped: skipped,
      Score: score,
      Accuracy: accuracy,
      TimeSpentSeconds: Number(timeSpentSeconds) || 0,
      ['X' + 'P']: coins,
      ['Coins' + 'Earned']: coins,
      CompletionStatus: completionStatus,
      IsDailyChallenge: subject === 'Daily Challenge' || quizMode === 'dailychallenge' ? 'TRUE' : 'FALSE',
      SourceScreen: sourceScreen || 'unknown',
      DeviceType: deviceType,
      AppVersion: appVersion,
      ClientSessionId: clientSessionId,
      ServerSavedAt: serverSavedAt,
      DuplicateCheckKey: duplicateCheckKey,
      QuestionIdsList: questionIdsList,
      AnswersSummaryJSON: answersSummaryJSON,
    });

    const attemptedAt = completedAt;
    const attemptRows = answers.map(answer => {
      const isSkipped = Boolean(answer.isSkipped);
      const isCorrect = Boolean(answer.isCorrect);
      return {
        AttemptAnswerId: `${sessionId}_${answer.questionId}`,
        SessionId: sessionId,
        UserId: userEmail,
        UserEmail: userEmail,
        AttemptedAt: attemptedAt,
        Subject: subject,
        Topic: topic,
        QuestionId: answer.questionId,
        SourceCollection: sourceCollection,
        UserAnswer: answer.userAnswer || '',
        CorrectAnswer: answer.correctAnswer || '',
        IsCorrect: isCorrect ? 'TRUE' : 'FALSE',
        IsSkipped: isSkipped ? 'TRUE' : 'FALSE',
        TimeTakenSeconds: Number(answer.timeTakenSeconds) || 0,
        ScoreDelta: isSkipped ? 0 : isCorrect ? 2 : -0.5,
        AttemptNumberForQuestion: 1,
        QuizMode: quizMode || 'normal',
        AppVersion: appVersion,
      };
    });

    try {
      await appendHeaderRows(sheets, 'AttemptAnswers', attemptRows);
    } catch (err) {
      console.error('[quiz-session/complete] AttemptAnswers write failed:', err.message);
    }

    return res.status(200).json({
      success: true,
      ok: true,
      sessionId,
      clientSessionId,
      // Score / coin fields (top-level) — consumed by pages/result.js coinsResult.
      ...(scoreData ? {
        coins:            scoreData.coins,
        totalCoins:       scoreData.totalCoins,
        level:            scoreData.level,
        streakCount:      scoreData.streakCount,
        lastAttemptDate:  scoreData.lastAttemptDate,
        isFirstQuizOfDay: scoreData.isFirstQuizOfDay,
        streakMilestone:  scoreData.streakMilestone,
        profileSnapshot:  scoreData.profileSnapshot,
      } : {}),
      // Existing completion payload (kept for backward compatibility).
      data: {
        sessionId,
        correct,
        incorrect,
        skipped,
        score,
        accuracy,
        coins,
      },
    });
  } catch (err) {
    console.error('[quiz-session/complete] Error:', err.message);
    return res.status(500).json(validationError());
  }
}
