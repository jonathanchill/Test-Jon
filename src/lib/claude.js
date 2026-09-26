/*
 * Anthropic Messages API client for the service worker.
 *
 * Raw fetch rather than the official SDK on purpose: this extension ships as an
 * unpacked folder with no build step, and the SDK would need a bundler. Every
 * request is made from the extension service worker, never from the Gmail page,
 * so the API key never touches a page context.
 */
(function (root) {
  'use strict';

  const API_URL = 'https://api.anthropic.com/v1/messages';
  const ANTHROPIC_VERSION = '2023-06-01';

  const VERDICT_SCHEMA = {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The id of the email being judged.' },
            // NB: numeric constraints (minimum/maximum/multipleOf) and string
            // length constraints are rejected by structured outputs. State the
            // range in the description instead - `description` is supported.
            spam: {
              type: 'object',
              properties: {
                verdict: { type: 'string', enum: ['spam', 'not_spam'] },
                confidence: { type: 'integer', description: 'How sure you are of this verdict, 0-100.' },
              },
              required: ['verdict', 'confidence'],
              additionalProperties: false,
            },
            authorship: {
              type: 'object',
              properties: {
                verdict: { type: 'string', enum: ['ai', 'human', 'mixed', 'automated', 'unclear'] },
                confidence: { type: 'integer', description: 'How sure you are of this verdict, 0-100.' },
              },
              required: ['verdict', 'confidence'],
              additionalProperties: false,
            },
            reason: {
              type: 'string',
              description: 'One short sentence, at most 160 characters, naming the concrete signal that decided it.',
            },
          },
          required: ['id', 'spam', 'authorship', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  };

  const SYSTEM_PROMPT = [
    'You triage a person\'s email. For every message you are given, judge two independent questions.',
    '',
    'SPAM: is this unsolicited bulk mail, phishing, a scam, or fraud?',
    '- spam: phishing and credential harvesting, advance-fee and lottery fraud, malware lures,',
    '  impersonation of a brand or colleague, unsolicited cold bulk pitches, adult/pharma junk.',
    '- not_spam: newsletters and marketing the recipient plausibly signed up for, transactional and',
    '  account mail from a service they use, notifications, and all ordinary correspondence. Being',
    '  promotional or unwanted is not the same as being spam.',
    '',
    'AUTHORSHIP: who or what produced this message?',
    '- automated: machine-sent mail, whoever wrote the template. Notification and digest mail',
    '  ("Matt just messaged you", "3 new messages await your response"), calendar invitations and',
    '  responses, receipts, invoices, statements, password resets, verification codes, security',
    '  alerts, CI and system notifications, scheduled reports, mailing-list and moderation traffic.',
    '  Tells: a no-reply or notifications mailbox, a "via <service>" sender, an unsubscribe or',
    '  "you are receiving this because" footer, a subject that is a template with a name slotted in.',
    '  This is a large slice of a real inbox - use it, do not force such mail into human or ai.',
    '- ai: a person (or their tool) had a language model write the prose. Signals include a formulaic',
    '  opener, evenly-sized sentences with little burstiness, rule-of-three lists, "not only X but',
    '  also Y" and "it\'s not just X, it\'s Y" framings, hedged corporate abstraction with no concrete',
    '  detail, bolded bullet lead-ins, and vocabulary such as delve, leverage, seamless, holistic,',
    '  tapestry, underscore, navigate the complexities.',
    '- human: a person wrote it themselves. Idiosyncratic rhythm, typos, fragments, contractions,',
    '  in-jokes, specific shared context, abrupt endings.',
    '- mixed: human-drafted then clearly model-polished, or a human note wrapped around generated text.',
    '- unclear: too little prose to tell, or genuinely ambiguous. Prefer this over guessing.',
    '',
    'CALIBRATION. Confidence is 0-100 and must reflect real uncertainty.',
    '- Detecting AI writing is unreliable. Fluent, well-organised writing by a competent human is the',
    '  most common false positive; never treat polish alone as proof.',
    '- When the input is marked PREVIEW you only have a subject line and a truncated snippet: cap every',
    '  confidence at 60 and use "unclear" freely. A preview is usually enough to spot automated mail',
    '  and spam, and rarely enough to judge human vs ai - say unclear when that is the truth.',
    '- Vary your confidence with the evidence. A run of identical scores means you are not judging.',
    '- Answer for every id you are given, once each, using the exact id string.',
  ].join('\n');

  function renderEmail(email) {
    const lines = [
      '<email id="' + email.id + '">',
      'source: ' + (email.level === 'full' ? 'FULL MESSAGE' : 'PREVIEW (subject + snippet only)'),
      'from: ' + (email.senderName || '(unknown)') + ' <' + (email.senderEmail || 'unknown') + '>',
      'subject: ' + (email.subject || '(no subject)'),
    ];
    const body = email.level === 'full' ? email.body : email.snippet;
    lines.push('body:', (body || '(empty)').trim(), '</email>');
    return lines.join('\n');
  }

  function extractJson(message) {
    const block = (message.content || []).find((b) => b.type === 'text');
    if (!block) throw new Error('Model returned no text content.');
    try {
      return JSON.parse(block.text);
    } catch (err) {
      const match = block.text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Could not parse the model response as JSON.');
    }
  }

  class ApiError extends Error {
    constructor(message, status, retryable) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.retryable = retryable;
    }
  }

  async function post(body, apiKey, signal) {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // Required for requests that originate from a browser context.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const err = await res.json();
        detail = (err && err.error && err.error.message) || '';
      } catch (_) {
        detail = await res.text().catch(() => '');
      }
      const retryable = res.status === 429 || res.status >= 500;
      const label = res.status === 401 ? 'API key rejected'
        : res.status === 429 ? 'Rate limited'
        : 'Anthropic API error ' + res.status;
      throw new ApiError(label + (detail ? ': ' + detail : ''), res.status, retryable);
    }
    return res.json();
  }

  /**
   * Classify a batch of emails.
   * @param {Array<object>} emails each needs id, subject, senderName, senderEmail, level and snippet|body
   * @param {{apiKey:string, model:string, effort:string}} config
   * @returns {Promise<{results:Array<object>, usage:object, model:string}>}
   */
  async function classify(emails, config) {
    if (!emails.length) return { results: [], usage: null, model: config.model };

    const body = {
      model: config.model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: config.effort || 'low',
        format: { type: 'json_schema', schema: VERDICT_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: 'Classify these ' + emails.length + ' email(s).\n\n' +
            emails.map(renderEmail).join('\n\n'),
        },
      ],
    };

    let attempt = 0;
    for (;;) {
      try {
        const message = await post(body, config.apiKey);
        if (message.stop_reason === 'refusal') {
          throw new ApiError('The model declined to classify this batch.', 200, false);
        }
        const parsed = extractJson(message);
        return {
          results: Array.isArray(parsed.results) ? parsed.results : [],
          usage: message.usage || null,
          model: message.model || config.model,
        };
      } catch (err) {
        attempt += 1;
        if (attempt > 3 || !(err instanceof ApiError) || !err.retryable) throw err;
        await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
      }
    }
  }

  root.MailLensClaude = { classify, ApiError };
})(typeof self !== 'undefined' ? self : globalThis);
