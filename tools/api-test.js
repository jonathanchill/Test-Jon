/*
 * Unit tests for the Anthropic client and the offline scorer, with fetch stubbed.
 * No API key and no network needed.
 *
 *   node tools/api-test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const failures = [];
function check(label, condition, detail) {
  process.stdout.write(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}\n`);
  if (!condition) failures.push(label);
}

/** Load the lib scripts the way the service worker does, over a fake global. */
function loadLibs(fetchImpl) {
  const sandbox = { console, setTimeout, clearTimeout, fetch: fetchImpl };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ['util.js', 'heuristics.js', 'claude.js']) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const EMAILS = [
  {
    id: 'e0',
    level: 'preview',
    subject: 'Lunch tomorrow?',
    senderName: 'Sam',
    senderEmail: 'sam@example.com',
    snippet: 'still on for 1pm?',
  },
];

(async () => {
  /* ---------------------------------------------------- request shape */
  let captured = null;
  let libs = loadLibs(async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return response(200, {
      model: 'claude-opus-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 120, output_tokens: 40 },
      content: [{
        type: 'text',
        text: JSON.stringify({
          results: [{
            id: 'e0',
            spam: { verdict: 'not_spam', confidence: 92 },
            authorship: { verdict: 'human', confidence: 71 },
            reason: 'Lowercase, abrupt, asks a specific question.',
          }],
        }),
      }],
    });
  });

  const out = await libs.MailLensClaude.classify(EMAILS, {
    apiKey: 'sk-ant-test', model: 'claude-opus-5', effort: 'low',
  });

  check('posts to the Messages API', captured.url === 'https://api.anthropic.com/v1/messages');
  check('sends the API key header', captured.init.headers['x-api-key'] === 'sk-ant-test');
  check('pins the API version', captured.init.headers['anthropic-version'] === '2023-06-01');
  check('opts in to direct browser access',
    captured.init.headers['anthropic-dangerous-direct-browser-access'] === 'true');
  check('uses the configured model', captured.body.model === 'claude-opus-5', captured.body.model);
  check('does not send a thinking block', captured.body.thinking === undefined);
  check('does not send budget_tokens', !JSON.stringify(captured.body).includes('budget_tokens'));
  check('constrains the output to the verdict schema',
    captured.body.output_config.format.type === 'json_schema' &&
    captured.body.output_config.format.schema.required.includes('results'));
  check('passes the effort level', captured.body.output_config.effort === 'low');
  check('includes the email text in the prompt',
    captured.body.messages[0].content.includes('still on for 1pm?'));
  check('marks preview input as preview',
    captured.body.messages[0].content.includes('PREVIEW'));
  check('parses the verdict back out', out.results[0].authorship.verdict === 'human');
  check('reports token usage', out.usage.input_tokens === 120);

  /* ------------------------------------------------------ full message */
  await libs.MailLensClaude.classify(
    [{ ...EMAILS[0], level: 'full', body: 'the whole message body here' }],
    { apiKey: 'k', model: 'claude-opus-5', effort: 'medium' },
  );
  check('marks full input as the full message',
    captured.body.messages[0].content.includes('FULL MESSAGE') &&
    captured.body.messages[0].content.includes('the whole message body here'));

  /* ------------------------------------------------------------ errors */
  libs = loadLibs(async () => response(401, { error: { message: 'invalid x-api-key' } }));
  let error = null;
  try {
    await libs.MailLensClaude.classify(EMAILS, { apiKey: 'bad', model: 'claude-opus-5' });
  } catch (err) {
    error = err;
  }
  check('surfaces a bad key without retrying', error && /API key rejected/.test(error.message), error && error.message);

  let attempts = 0;
  libs = loadLibs(async () => {
    attempts += 1;
    if (attempts < 3) return response(429, { error: { message: 'slow down' } });
    return response(200, {
      model: 'claude-opus-5',
      content: [{ type: 'text', text: '{"results":[]}' }],
      usage: {},
    });
  });
  await libs.MailLensClaude.classify(EMAILS, { apiKey: 'k', model: 'claude-opus-5' });
  check('retries through rate limiting', attempts === 3, attempts + ' attempts');

  libs = loadLibs(async () => response(200, {
    model: 'claude-opus-5',
    stop_reason: 'refusal',
    content: [{ type: 'text', text: '' }],
  }));
  error = null;
  try {
    await libs.MailLensClaude.classify(EMAILS, { apiKey: 'k', model: 'claude-opus-5' });
  } catch (err) {
    error = err;
  }
  check('handles a refusal instead of reading empty content', error && /declined/.test(error.message));

  /* -------------------------------------------------------- heuristics */
  libs = loadLibs(async () => { throw new Error('should not be called'); });
  const h = libs.MailLensHeuristics;

  const phish = h.classify({
    subject: 'URGENT: verify your account',
    senderName: 'PayPal Security',
    senderEmail: 'billing@paypa1-secure.top',
    body: 'Dear Customer, we detected unusual activity. Verify your account within 24 hours. CLICK HERE NOW!!!! Confirm your account or it will be closed.',
  }, 'full');
  check('offline scorer catches obvious phishing', phish.spam.verdict === 'spam',
    phish.spam.confidence + '% sure');

  const note = h.classify({
    subject: 'lunch tomorrow?',
    senderName: 'Sam',
    senderEmail: 'sam@example.com',
    body: 'hey, still on for 1pm? i can move it if not, no worries either way. gonna be near yours anyway',
  }, 'full');
  check('offline scorer leaves a short personal note alone',
    note.spam.verdict === 'not_spam' && note.authorship.verdict === 'human',
    note.authorship.verdict);

  const slop = h.classify({
    subject: 'Unlocking the full potential of your workflow',
    senderName: 'Dana',
    senderEmail: 'dana@growthco.io',
    body: 'I hope this email finds you well. In today\'s fast-paced landscape, it is crucial to leverage robust, seamless solutions. Our platform empowers you to streamline your workflow and foster collaboration. Furthermore, our holistic approach underscores a pivotal commitment. Should you have any questions, please do not hesitate to reach out.',
  }, 'full');
  check('offline scorer flags model-sounding prose', slop.authorship.verdict === 'ai',
    slop.authorship.confidence + '% sure');

  const preview = h.classify({
    subject: 'Unlocking the full potential of your workflow',
    senderName: 'Dana',
    senderEmail: 'dana@growthco.io',
    snippet: 'I hope this email finds you well. In today\'s fast-paced landscape',
  }, 'preview');
  check('offline scorer stays humble on previews', preview.authorship.confidence <= 52,
    preview.authorship.confidence + '%');

  if (failures.length) {
    process.stdout.write(`\n${failures.length} check(s) failed\n`);
    process.exit(1);
  }
  process.stdout.write('\nAll checks passed\n');
})();
