const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const quiz = fs.readFileSync(path.join(root, 'pages/quiz.js'), 'utf8');

let passed = 0;
let failed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('quiz page detects browser reload with Performance Navigation API', () => {
  assert.ok(/function wasPageReload\(\)/.test(quiz), 'wasPageReload helper must exist');
  assert.ok(/getEntriesByType\?\.\('navigation'\)/.test(quiz), 'must use performance navigation entries');
  assert.ok(/navigation\?\.type === 'reload'/.test(quiz), 'must detect reload navigation type');
});

test('refreshed active sessions use Leave Quiz recovery prompt', () => {
  assert.ok(/const shouldUseLeavePrompt = wasPageReload\(\) \|\| isHistoryQuizSession\(session\);/.test(quiz));
  assert.ok(/setRecoveryPrompt\(\{ type: shouldUseLeavePrompt \? 'reload_exit' : 'resume', session \}\)/.test(quiz));
});

test('Leave Quiz recovery prompt reuses stored-session continue and end handlers', () => {
  const recoveryBlockStart = quiz.indexOf('if (recoveryPrompt)');
  const leaveBranchStart = quiz.indexOf('if (isLeaveExitPrompt)', recoveryBlockStart);
  const leaveBranchEnd = quiz.indexOf('if (loading) return', leaveBranchStart);
  const leaveBranch = quiz.slice(leaveBranchStart, leaveBranchEnd > -1 ? leaveBranchEnd : leaveBranchStart + 6000);
  assert.ok(/Leave quiz\?/.test(leaveBranch), 'recovery leave prompt must use Leave quiz title');
  assert.ok(/onClick=\{handleResumeStoredQuiz\}/.test(leaveBranch), 'Continue must restore stored quiz');
  assert.ok(/onClick=\{handleDiscardStoredAttempt\}/.test(leaveBranch), 'End must use stored attempt result logic');
});

test('Leave Quiz modal displays attempted count even at zero', () => {
  const leaveBranchStart = quiz.indexOf('if (isLeaveExitPrompt)');
  const leaveBranch = quiz.slice(leaveBranchStart, leaveBranchStart + 5000);
  assert.ok(/\{sessionAttemptedCount\} \/ \{sessionQuestionCount\} attempted/.test(leaveBranch));
  assert.ok(!/\{sessionAttemptedCount > 0 && \(/.test(leaveBranch), 'refresh leave prompt must not hide 0 attempted');
});

test('back-button Leave Quiz modal also displays attempted count without zero guard', () => {
  const exitStart = quiz.indexOf('{showExitModal &&');
  const exitBlock = quiz.slice(exitStart, exitStart + 5000);
  assert.ok(/\{attemptedCount\} \/ \{questions\.length\} attempted/.test(exitBlock));
  assert.ok(!/\{attemptedCount > 0 && \(/.test(exitBlock), 'back leave prompt must not hide 0 attempted');
});

(async () => {
  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      console.log(`ok  ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${t.name}\n     ${err.message}`);
    }
  }
  console.log(`\n${passed}/${tests.length} quiz refresh Leave Quiz modal tests passed.`);
  process.exit(failed ? 1 : 0);
})();
