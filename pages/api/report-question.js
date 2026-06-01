import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';

const VALID_ISSUE_TYPES = new Set([
  'wrong_answer',
  'unclear_question',
  'bad_explanation',
  'duplicate',
  'formatting_issue',
  'outdated',
  'other',
]);

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

async function getQuestionQualityHeaders(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'QuestionQualityLog!1:1',
  });
  const headers = (response.data.values || [[]])[0] || [];
  return { headers, headerIndex: buildHeaderIndex(headers) };
}

function buildReportRow(headers, headerIndex, valuesByHeader) {
  const row = new Array(headers.length).fill('');
  Object.entries(valuesByHeader).forEach(([headerName, value]) => {
    const position = headerIndex[headerName];
    if (typeof position === 'number') row[position] = value;
  });
  return row;
}

function generateQualityLogId() {
  return `QL_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { questionId, issueType, issueDescription = '' } = req.body || {};

  if (!questionId || typeof questionId !== 'string') {
    return res.status(400).json({ error: 'questionId is required' });
  }

  if (!VALID_ISSUE_TYPES.has(issueType)) {
    return res.status(400).json({ error: 'Invalid issueType' });
  }

  try {
    const sheets = await getSheetsClient();
    const { headers, headerIndex } = await getQuestionQualityHeaders(sheets);
    if (!headers.length) {
      return res.status(500).json({ error: 'QuestionQualityLog headers are missing' });
    }

    const reportedAt = new Date().toISOString();
    const row = buildReportRow(headers, headerIndex, {
      QualityLogId: generateQualityLogId(),
      QuestionId: questionId.trim(),
      ReportedByEmail: session.user.email,
      ReportedAt: reportedAt,
      IssueType: issueType,
      IssueDescription: String(issueDescription || '').trim(),
      Status: 'open',
      ReviewedBy: '',
      ResolvedAt: '',
      ResolutionNotes: '',
    });

    const endColumn = columnToLetter(headers.length);
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `QuestionQualityLog!A:${endColumn}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    return res.status(200).json({ success: true, message: 'Report submitted. Thank you.' });
  } catch (err) {
    console.error('[report-question] Error:', err.message);
    return res.status(500).json({ error: 'Failed to submit report' });
  }
}
