import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getSheetsClient,
  getMentorProfile,
  getMasterTopics,
  // These two functions must be added to lib/sheets.js if they don't exist,
  // OR use the data reading logic inline below.
} from '@/lib/sheets';
import { generateTodaysPlan } from '@/lib/mentorPlanEngine';

function normalizeSubjectId(subjectId) {
  return String(subjectId || '').replace(/^Q_PYQ_/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const email = session.user.email;
  const sheets = await getSheetsClient();

  // 1. Get mentor profile
  const profile = await getMentorProfile(sheets, email);
  if (!profile) return res.status(200).json({ exists: false });

  // 2. Get master topics
  const topicRows = await getMasterTopics(sheets);
  const subjects = {};
  for (const row of topicRows) {
    const subjectId = normalizeSubjectId(row.SubjectId);
    if (!subjects[subjectId]) {
      subjects[subjectId] = { subjectName: row.SubjectName, topics: [] };
    }
    subjects[subjectId].topics.push({
      topicName: row.TopicName,
      displayName: row.DisplayName || row.TopicName,
      sscWeightage: row.SSCWeightage || 'Medium',
    });
  }
  const masterTopics = { subjects };

  // 3. Get subject history
  // Read AttemptAnswers and aggregate by subject+topic directly
  // Using the same Sheets read pattern as /api/history/subjects
  let subjectHistory = [];
  try {
    const attemptsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'AttemptAnswers!A2:R',
    });
    const rows = attemptsRes.data.values || [];
    // AttemptAnswers columns: AttemptAnswerId, SessionId, UserId, UserEmail,
    // AttemptedAt, Subject, Topic, QuestionId, SourceCollection, UserAnswer,
    // CorrectAnswer, IsCorrect, IsSkipped, TimeTakenSeconds, ScoreDelta,
    // AttemptNumberForQuestion, QuizMode, AppVersion
    // Column indices (0-based): UserEmail=3, Subject=5, Topic=6, IsCorrect=11, IsSkipped=12
    const userRows = rows.filter(r => r[3] === email);
    const subjectTopicMap = {};
    for (const row of userRows) {
      const subject = row[5] || '';
      const topic = row[6] || '';
      const isCorrect = row[11] === 'TRUE' || row[11] === true;
      if (!subject || !topic) continue;
      const key = `${subject}|||${topic}`;
      if (!subjectTopicMap[key]) {
        subjectTopicMap[key] = { subject, topic, totalAttempts: 0, correct: 0 };
      }
      subjectTopicMap[key].totalAttempts++;
      if (isCorrect) subjectTopicMap[key].correct++;
    }
    // Group into subjectHistory array
    const subjectMap = {};
    for (const item of Object.values(subjectTopicMap)) {
      if (!subjectMap[item.subject]) subjectMap[item.subject] = { subject: item.subject, topics: [] };
      subjectMap[item.subject].topics.push({
        topic: item.topic,
        totalAttempts: item.totalAttempts,
        accuracy: item.totalAttempts > 0 ? (item.correct / item.totalAttempts) * 100 : 0,
      });
    }
    subjectHistory = Object.values(subjectMap);
  } catch (e) {
    subjectHistory = []; // safe fallback
  }

  // 4. Get repeated mistakes preview
  let mistakesPreview = { repeatedMistakesPreview: [] };
  try {
    // Count questions where user answered wrong >= 2 times
    const attemptsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'AttemptAnswers!A2:R',
    });
    const rows = attemptsRes.data.values || [];
    const userRows = rows.filter(r => r[3] === email);
    const questionWrongCount = {};
    for (const row of userRows) {
      const questionId = row[7] || '';
      const isCorrect = row[11] === 'TRUE' || row[11] === true;
      const isSkipped = row[12] === 'TRUE' || row[12] === true;
      if (!questionId || isSkipped) continue;
      if (!isCorrect) {
        questionWrongCount[questionId] = (questionWrongCount[questionId] || 0) + 1;
      }
    }
    const repeatedMistakes = Object.entries(questionWrongCount)
      .filter(([, count]) => count >= 2)
      .map(([id]) => ({ questionId: id }));
    mistakesPreview = { repeatedMistakesPreview: repeatedMistakes };
  } catch (e) {
    mistakesPreview = { repeatedMistakesPreview: [] }; // safe fallback
  }

  // 5. Generate plan
  const plan = generateTodaysPlan(profile, subjectHistory, mistakesPreview, masterTopics);

  return res.status(200).json({ exists: true, plan });
}
