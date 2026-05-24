import { readQuestionsForTab, SUBJECT_TO_SUFFIX, COLLECTION_PREFIX } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const allTabs = [];

  Object.values(COLLECTION_PREFIX).forEach(prefix => {
    Object.values(SUBJECT_TO_SUFFIX).forEach(suffix => {
      allTabs.push(prefix + suffix);
    });
  });

  Promise.allSettled(
    allTabs.map(tab => readQuestionsForTab(tab).catch(() => null))
  );

  return res.status(200).json({ status: 'warming', tabs: allTabs.length });
}
