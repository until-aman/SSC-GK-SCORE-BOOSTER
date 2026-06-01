import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';
import { getAppConfig } from '@/lib/config/appConfig';

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

export default async function handler(req, res) {
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
    sourceScreen = '',
    deviceType = '',
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
    const duplicateCheckKey = clientSessionId || `${userEmail}_${subject}_${topic}_${startedAt}`;

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
      XP: '',
      CoinsEarned: '',
      CompletionStatus: 'completed',
      IsDailyChallenge: subject === 'Daily Challenge' || quizMode === 'dailychallenge' ? 'TRUE' : 'FALSE',
      SourceScreen: sourceScreen,
      DeviceType: deviceType,
      AppVersion: appVersion,
      ClientSessionId: clientSessionId,
      ServerSavedAt: serverSavedAt,
      DuplicateCheckKey: duplicateCheckKey,
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

    appendHeaderRows(sheets, 'AttemptAnswers', attemptRows).catch(err => {
      console.error('[quiz-session/complete] AttemptAnswers write failed:', err.message);
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionId,
        correct,
        incorrect,
        skipped,
        score,
        accuracy,
      },
    });
  } catch (err) {
    console.error('[quiz-session/complete] Error:', err.message);
    return res.status(500).json(validationError());
  }
}
