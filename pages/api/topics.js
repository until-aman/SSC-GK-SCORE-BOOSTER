import { getMasterSubjects, getSheetsClient, getTopicsBySubject, VALID_SUBJECTS } from '@/lib/sheets';
import { getOrLoadServerCache } from '@/lib/server/serverCache';

const TOPICS_TTL_MS = 12 * 60 * 60 * 1000; // 12h — catalog metadata changes rarely

function deriveSubjectCounts(allTopics) {
  // allTopics is the full { subject: { topic: count } } map for the collection.
  const counts = {};
  for (const subj of VALID_SUBJECTS) {
    const topicMap = allTopics[subj] || {};
    counts[subj] = Object.values(topicMap).reduce((sum, n) => sum + n, 0);
  }
  return counts;
}

function normalizeMasterSubjects(rows = []) {
  return rows.reduce((acc, row) => {
    const subjectName = row.SubjectName || row.SubjectId;
    if (!subjectName) return acc;
    const meta = {
      subjectId: row.SubjectId || subjectName,
      subjectName,
      displayOrder: Number(row.DisplayOrder) || 99,
      icon: row.Icon || '',
      shortName: row.ShortName || subjectName,
    };
    [subjectName, row.SubjectId, row.ShortName].filter(Boolean).forEach(key => {
      acc[key] = meta;
    });
    return acc;
  }, {});
}

async function loadSubjectMeta() {
  return getOrLoadServerCache(
    'master-subjects:active',
    TOPICS_TTL_MS,
    async () => normalizeMasterSubjects(await getMasterSubjects(await getSheetsClient())),
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject, collection = 'general', includeCounts, includeSubjectMeta } = req.query;
    const wantCounts = includeCounts === 'true' || !subject;
    const subjectMeta = includeSubjectMeta === 'true' ? await loadSubjectMeta() : undefined;

    if (subject && !wantCounts) {
      // Single-subject request: one read, no counts loop. Server-cached per subject.
      const topics = await getOrLoadServerCache(
        `topics:${collection}:${subject}`,
        TOPICS_TTL_MS,
        () => getTopicsBySubject(subject, collection),
      );
      return res.status(200).json({ topics, subjectCounts: {}, ...(subjectMeta ? { subjectMeta } : {}) });
    }

    // Counts requested (or no subject filter). getTopicsBySubject(undefined)
    // ALREADY returns every subject's topics, so subjectCounts is derived from
    // that single read — no per-subject N+1 loop. Server-cached per collection.
    const allTopics = await getOrLoadServerCache(
      `topics:${collection}:__all__`,
      TOPICS_TTL_MS,
      () => getTopicsBySubject(undefined, collection),
    );
    const subjectCounts = deriveSubjectCounts(allTopics);
    // Preserve the existing response shape: `topics` is the requested-subject
    // slice when a subject was given, else the full map (unchanged behavior).
    const topics = subject ? { [subject]: allTopics[subject] || {} } : allTopics;

    if (process.env.NODE_ENV !== 'production') console.debug('[apidiag] {"kind":"public-cache","event":"topics-derived-single-read"}');
    return res.status(200).json({ topics, subjectCounts, ...(subjectMeta ? { subjectMeta } : {}) });
  } catch (err) {
    console.error('Topics API error:', err);
    return res.status(500).json({ error: 'Failed to read data' });
  }
}
