const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  isMentorQuizLaunchableTask,
  resolveMentorQuizLaunchContext,
} = require('../lib/mentorQuizLaunchContext.cjs');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
let failed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('practice_task resolves exact subject/topic normal practice context', () => {
  const ctx = resolveMentorQuizLaunchContext({
    taskId: 'T1',
    planId: 'P1',
    taskType: 'practice_task',
    subjectName: 'Geography',
    topic: 'Rivers',
    questionCount: 25,
  });
  assert.equal(ctx.ok, true);
  assert.equal(ctx.taskId, 'T1');
  assert.equal(ctx.planId, 'P1');
  assert.equal(ctx.subject, 'Geography');
  assert.equal(ctx.topic, 'Rivers');
  assert.equal(ctx.mode, 'normal_practice');
  assert.equal(ctx.questionSource, 'questions');
  assert.equal(ctx.questionCount, 25);
  assert.equal(ctx.locked, true);
});

test('mistake_recovery_task resolves repeated mistake context', () => {
  const ctx = resolveMentorQuizLaunchContext({
    taskId: 'T2',
    planId: 'P2',
    taskType: 'mistake_recovery_task',
    subject: 'Geography',
    topicName: 'Rivers',
    questionCount: 10,
  });
  assert.equal(ctx.ok, true);
  assert.equal(ctx.mode, 'repeated_mistakes');
  assert.equal(ctx.questionSource, 'repeated_mistakes');
  assert.equal(ctx.subject, 'Geography');
  assert.equal(ctx.topic, 'Rivers');
});

test('recent_mistakes placeholder resolves to mixed repeated mistake context', () => {
  const ctx = resolveMentorQuizLaunchContext({
    taskId: 'T3',
    taskType: 'practice_task',
    reason: 'recent_mistakes',
    subjectName: 'Repeated Mistakes',
    displayName: 'Repeated Mistakes',
  }, { planId: 'P3' });
  assert.equal(ctx.ok, true);
  assert.equal(ctx.planId, 'P3');
  assert.equal(ctx.subject, 'Mixed GK');
  assert.equal(ctx.topic, 'Repeated Mistakes');
  assert.equal(ctx.mode, 'repeated_mistakes');
});

test('revision_task resolves revision mode over normal question source', () => {
  const ctx = resolveMentorQuizLaunchContext({
    taskId: 'T4',
    planId: 'P4',
    taskType: 'revision_task',
    subjectName: 'Modern History',
    topicName: 'Freedom Struggle',
  });
  assert.equal(ctx.ok, true);
  assert.equal(ctx.mode, 'revision');
  assert.equal(ctx.questionSource, 'questions');
  assert.equal(ctx.subject, 'Modern History');
  assert.equal(ctx.topic, 'Freedom Struggle');
});

test('non-quiz task types are not quiz launchable', () => {
  for (const taskType of ['coverage_check', 'confidence_check', 'feedback_task', 'pace_unlock_task']) {
    assert.equal(isMentorQuizLaunchableTask({ taskType }), false, `${taskType} should not launch quiz`);
    const ctx = resolveMentorQuizLaunchContext({ taskType });
    assert.equal(ctx.ok, false);
    assert.equal(ctx.reason, 'NON_QUIZ_TASK');
  }
});

test('missing subject blocks launch safely', () => {
  const ctx = resolveMentorQuizLaunchContext({
    taskId: 'T5',
    taskType: 'practice_task',
    topic: 'Rivers',
  });
  assert.equal(ctx.ok, false);
  assert.equal(ctx.reason, 'MISSING_SUBJECT');
});

test('missing topic uses subject-level All because questions API supports it', () => {
  const ctx = resolveMentorQuizLaunchContext({
    taskId: 'T6',
    taskType: 'practice_task',
    subject: 'Polity',
  });
  assert.equal(ctx.ok, true);
  assert.equal(ctx.topic, 'All');
});

test('Mentor launch preserves taskId/planId and does not complete on launch', () => {
  const mentor = read('pages/mentor.js');
  assert.ok(/resolveMentorQuizLaunchContext/.test(mentor), 'mentor page must use resolver');
  assert.ok(/sourceTaskId:\s*context\.taskId/.test(mentor), 'sourceTaskId must come from context');
  assert.ok(/planId:\s*context\.planId/.test(mentor), 'planId must come from context');
  assert.ok(/runTaskAction\(task,\s*'launch_practice'/.test(mentor), 'launch should only record launch_practice');
  const launchStart = mentor.indexOf('async function launchMentorQuizTask');
  const launchEnd = mentor.indexOf('async function launchPractice', launchStart);
  const launchBody = mentor.slice(launchStart, launchEnd);
  assert.ok(!/runTaskAction\(task,\s*'complete'/.test(launchBody), 'launch must not complete task');
});

test('quiz-return remains the completion path', () => {
  const result = read('pages/result.js');
  assert.ok(/\/api\/mentor\/quiz-return/.test(result), 'result page must call mentor quiz-return');
  assert.ok(/taskId:\s*mentorContext\.sourceTaskId/.test(result), 'quiz-return must use sourceTaskId');
});

test('zero-question states are explicit and do not start generic quiz', () => {
  const mentor = read('pages/mentor.js');
  assert.ok(/No questions found for this topic\./.test(mentor));
  assert.ok(/No mistake questions found for this topic\. Try normal practice instead\./.test(mentor));
  assert.ok(!/router\.push\('\/history\/mistakes'\)/.test(mentor), 'must not route generic history mistakes from Mentor task launch');
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
  console.log(`\n${passed}/${tests.length} Mentor quiz-launch tests passed.`);
  process.exit(failed ? 1 : 0);
})();
