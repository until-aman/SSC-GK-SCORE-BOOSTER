// lib/mentor/repository/sheetsSource.js — READ-ONLY Google Sheets data source (Phase 2). CommonJS.
//
// Supplies raw {headers, rows} tab data to the pure orchestrator. Performs ONLY
// spreadsheets.values.get (read). NEVER appends/updates/clears. Used only when a
// repository feature flag is enabled; otherwise never invoked.
'use strict';

const MENTOR_TABS = {
  profile: 'MentorProfile',
  plans: 'MentorPlans',
  tasks: 'MentorTasks',
  topicState: 'StudentTopicState',
};

/** Read one tab as { headers, rows } using a read-only values.get. */
async function readTab(sheets, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tabName}!A:ZZ`,
  });
  const values = (res.data && res.data.values) || [];
  return { headers: values[0] || [], rows: values.slice(1) };
}

/**
 * Fetch all Mentor tabs read-only.
 * @returns {Promise<{profile,plans,tasks,topicState}>} raw tab data
 */
async function fetchRawMentorData() {
  // Lazy require to avoid loading the Sheets client unless this source is used.
  const { getSheetsClient } = require('../../sheets');
  const sheets = await getSheetsClient();
  const [profile, plans, tasks, topicState] = await Promise.all([
    readTab(sheets, MENTOR_TABS.profile),
    readTab(sheets, MENTOR_TABS.plans),
    readTab(sheets, MENTOR_TABS.tasks),
    readTab(sheets, MENTOR_TABS.topicState),
  ]);
  return { profile, plans, tasks, topicState };
}

module.exports = { fetchRawMentorData, readTab, MENTOR_TABS };
