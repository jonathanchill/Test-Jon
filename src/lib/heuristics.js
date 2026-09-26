/*
 * Offline classifier. Runs when there is no API key configured, when the API
 * call fails, and as the instant first answer while a Claude call is in flight.
 *
 * It is a scorer, not an oracle: it reports its own confidence and the UI shows
 * which engine produced a verdict. Statistical AI-detection is unreliable on
 * short text in particular, which is why previews are capped hard below.
 */
(function (root) {
  'use strict';

  const SPAM_PHRASES = [
    ['verify your account', 22], ['confirm your account', 20], ['account has been suspended', 26],
    ['unusual activity', 16], ['click here to', 12], ['act now', 14], ['limited time offer', 14],
    ['risk[- ]free', 12], ['100% free', 16], ['no credit card', 10], ['you have won', 26],
    ['congratulations you', 22], ['claim your (prize|reward|refund)', 26], ['lottery', 20],
    ['inheritance', 22], ['next of kin', 26], ['wire transfer', 16], ['western union', 20],
    ['bitcoin|crypto wallet|usdt', 14], ['investment opportunity', 16], ['work from home', 12],
    ['make \\$?\\d+ per (day|week)', 22], ['viagra|cialis|pharmacy', 26], ['weight loss', 14],
    ['dear (friend|customer|user|beneficiary|sir/madam)', 18], ['this is not a scam', 30],
    ['urgent(ly)? (reply|response|attention)', 18], ['final notice', 16], ['expires? (today|in 24)', 16],
    ['update your (payment|billing)', 20], ['gift card', 14], ['you are a (winner|selected)', 22],
    ['send (me )?your (password|pin|otp|code)', 30], ['tax refund', 16], ['unclaimed funds', 24],
  ];

  const AI_PHRASES = [
    ['i hope this (e?mail|message|note) finds you well', 26],
    ['i trust this (e?mail|message) finds you', 24],
    ['in today\'?s (fast[- ]paced|digital|ever[- ]evolving)', 20],
    ['it\'?s worth noting', 12], ['it is important to note', 12],
    ['navigat(e|ing) the (complexities|landscape)', 18],
    ['delve into', 18], ['a testament to', 16], ['rich tapestry', 22],
    ['unlock the (full )?potential', 18], ['take (it|things|your \\w+) to the next level', 12],
    ['at the end of the day', 8], ['moreover', 10], ['furthermore', 10], ['additionally,', 8],
    ['in conclusion', 12], ['that being said', 8], ['rest assured', 10],
    ['feel free to (reach out|let me know)', 8], ['should you have any (questions|concerns)', 12],
    ['do not hesitate to', 12], ['i wanted to reach out', 10], ['i am reaching out', 10],
    ['seamless(ly)?', 10], ['holistic', 12], ['robust', 8], ['leverage', 10], ['synerg', 12],
    ['streamlin', 8], ['foster', 8], ['underscore', 12], ['pivotal', 10], ['myriad', 12],
    ['plethora', 12], ['comprehensive', 6], ['cutting[- ]edge', 10], ['game[- ]changer', 10],
    ['elevate your', 14], ['empower', 8], ['crucial', 6], ['realm of', 10], ['landscape of', 10],
    ['not only .{0,60} but also', 14], ['it\'?s not just .{0,40}, it\'?s', 20],
    ['whether you\'?re .{0,40} or', 12], ['from .{0,30} to .{0,30}, ', 8],
  ];

  const HUMAN_PHRASES = [
    ['\\blol\\b|\\bhaha\\b|\\bthx\\b|\\btbh\\b|\\bfyi\\b|\\bimo\\b|\\bbtw\\b', 14],
    ['\\bgonna\\b|\\bwanna\\b|\\bkinda\\b|\\bdunno\\b|\\byeah\\b|\\bnope\\b', 14],
    ['sorry for the (delay|late)', 8], ['sent from my (iphone|ipad|android|mobile)', 22],
    ['\\bcheers\\b|\\bta\\b(?![a-z])', 8], ['^\\s*(hey|hiya|yo)\\b', 10],
  ];

  const SUSPECT_TLD = /\.(top|xyz|click|loan|work|zip|mov|gq|cf|tk|ml|buzz|rest|monster|cam)$/i;

  /* Machine-sent mail: notifications, digests, receipts, calendar traffic. It is
     neither "AI-written" nor meaningfully "human", and it is a large slice of a
     real inbox, so it gets its own verdict rather than being forced into one. */
  const AUTO_MAILBOX = /(^|[.\-_+])(no-?reply|do-?not-?reply|notifications?|notify|mailer|mailer-daemon|bounces?|postmaster|automated|autoreply|alerts?|digests?|reminders?|updates?|reports?|scanner|system|robot|bot|cron|jenkins|builds?)([.\-_+@]|$)/i;

  const AUTO_DOMAIN = /(^|\.)(linkedin\.com|facebookmail\.com|mail\.instagram\.com|twitter\.com|x\.com|github\.com|gitlab\.com|atlassian\.net|slack\.com|asana\.com|trello\.com|notion\.so|calendly\.com|eventbrite\.com|stripe\.com|xero\.com|intuit\.com|quickbooks\.com|dropbox\.com|zoom\.us|docusign\.net|mailchimp\.com|substack\.com)$/i;

  const AUTO_PHRASES = [
    ['just messaged you', 30], ['sent you a message', 24], ['sent new messages', 30],
    ['\\d+ new messages? await', 34], ['awaits your response', 26],
    ['viewed your profile', 28], ['wants to connect', 24], ['invitation to connect', 24],
    ['^invitation:', 32], ['^(accepted|declined|updated|cancelled) invitation:', 34],
    ['^(re: )?invitation: .* @ ', 30],
    ['this (e?mail|message) (is|was) (being )?sent (to you )?(because|automatically)', 32],
    ['do not reply to this (e?mail|message)', 32], ['this is an automated', 34],
    ['unsubscribe', 14], ['manage your (email )?(preferences|notifications)', 24],
    ['you are receiving this', 26], ['view (it |this )?in (your )?browser', 20],
    ['your (weekly|daily|monthly) (report|digest|summary|update)', 26],
    ['\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\s*(to|through|[-–—])\\s*\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}', 30],
    ['\\d{4}-\\d{2}-\\d{2}\\s*(to|through|[-–—])\\s*\\d{4}-\\d{2}-\\d{2}', 30],
    ['^period:', 28],
    ['(weekly|daily|monthly|quarterly)\\b.{0,40}\\b(scan|scanner|report|digest|summary|audit|roundup|snapshot)', 26],
    ['(weekly|daily|monthly) (report|digest|summary) (for|—|-)', 22],
    ['your (receipt|invoice|statement|order)', 24], ['payment (received|failed|due)', 22],
    ['password reset', 20], ['verification code', 22], ['confirm your (e?mail|subscription)', 18],
    ['moderator\'?s? (spam )?report', 30], ['build (passed|failed)', 26],
    ['new sign-?in', 22], ['security alert', 20],
  ];

  /** Scores `text` against a weighted pattern list, collecting what actually matched. */
  function count(text, patterns, out) {
    let score = 0;
    for (const [pattern, weight] of patterns) {
      const match = text.match(new RegExp(pattern, 'im'));
      if (match) {
        score += weight;
        if (out && out.length < 4) {
          const phrase = match[0].replace(/\s+/g, ' ').trim().toLowerCase();
          out.push('"' + (phrase.length > 44 ? phrase.slice(0, 42) + '…' : phrase) + '"');
        }
      }
    }
    return score;
  }

  function sentences(text) {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.split(/\s+/).length > 2);
  }

  function stdev(nums) {
    if (nums.length < 2) return 0;
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
    return Math.sqrt(variance);
  }

  function spamScore(email, cues) {
    const text = (email.subject || '') + '\n' + (email.body || email.snippet || '');
    let score = count(text, SPAM_PHRASES, cues);

    const words = text.split(/\s+/).filter(Boolean);
    const shouty = words.filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
    if (words.length > 8 && shouty.length / words.length > 0.18) {
      score += 18;
      cues.push('lots of SHOUTING');
    }
    const bangs = (text.match(/!/g) || []).length;
    if (bangs >= 4) { score += 12; cues.push(bangs + ' exclamation marks'); }
    if (/\$\s?\d[\d,]{3,}|\d[\d,]{5,}\s?(usd|eur|gbp)/i.test(text)) {
      score += 12;
      cues.push('large sum of money');
    }
    if (/(https?:\/\/)?(bit\.ly|tinyurl|t\.co|goo\.gl|is\.gd|cutt\.ly)/i.test(text)) {
      score += 14;
      cues.push('link shortener');
    }
    const domain = (email.senderEmail || '').split('@')[1] || '';
    if (domain && SUSPECT_TLD.test(domain)) { score += 16; cues.push('sender TLD .' + domain.split('.').pop()); }
    if (/(paypal|apple|amazon|netflix|microsoft|hmrc|irs|dhl|fedex)/i.test(email.senderName || '') &&
        /(gmail|outlook|hotmail|yahoo|proton)\./i.test(domain)) {
      score += 30;
      cues.push('brand name from a free mailbox');
    }
    if (/[Ѐ-ӿͰ-Ͽ]/.test((email.subject || '')) && /[a-z]/i.test(email.subject || '')) {
      score += 14;
      cues.push('mixed-alphabet subject');
    }
    return Math.min(100, score);
  }

  function automatedScore(email, cues) {
    const text = (email.subject || '') + '\n' + (email.body || email.snippet || '');
    let score = count(text, AUTO_PHRASES, cues);

    const address = (email.senderEmail || '').toLowerCase();
    const mailbox = address.split('@')[0] || '';
    const domain = address.split('@')[1] || '';
    if (mailbox && AUTO_MAILBOX.test(mailbox)) { score += 40; cues.push('sent from "' + mailbox + '"'); }
    if (domain && AUTO_DOMAIN.test(domain)) { score += 26; cues.push('notification domain ' + domain); }
    // "Matt Wolff via LinkedIn", "Jira (via Atlassian)" - a relayed sender.
    if (/\bvia\b/i.test(email.senderName || '')) { score += 24; cues.push('relayed sender'); }

    return Math.min(100, score);
  }

  /**
   * Returns a 0-100 lean towards machine authorship plus how much evidence it
   * rests on. The evidence counts matter as much as the score: with nothing to
   * go on this must say so rather than fall back on a default verdict.
   */
  function aiScore(email, cues) {
    const body = email.body || email.snippet || '';
    const text = (email.subject || '') + '\n' + body;
    const humanCues = [];
    const aiPhraseScore = count(text, AI_PHRASES, cues);
    const humanPhraseScore = count(text, HUMAN_PHRASES, humanCues);

    let score = 50 + aiPhraseScore - humanPhraseScore;
    let aiHits = cues.length;
    let humanHits = humanCues.length;

    const words = body.split(/\s+/).filter(Boolean);
    const emDashes = (body.match(/[—–]/g) || []).length;
    if (words.length > 60 && emDashes >= 3) { score += 14; aiHits += 1; cues.push('em-dash habit'); }

    const contractions = (body.match(/\b\w+'(s|t|re|ve|ll|d|m)\b/gi) || []).length;
    if (words.length > 80 && contractions === 0) { score += 12; aiHits += 1; cues.push('no contractions'); }
    else if (words.length > 40 && contractions >= 3) { score -= 10; humanHits += 1; humanCues.push('writes in contractions'); }

    const sents = sentences(body);
    if (sents.length >= 5) {
      const lengths = sents.map((s) => s.split(/\s+/).length);
      const sd = stdev(lengths);
      if (sd < 3.5) { score += 16; aiHits += 1; cues.push('very even sentence lengths'); }
      else if (sd > 9) { score -= 12; humanHits += 1; humanCues.push('uneven, bursty sentences'); }
    }
    if (/^\s*[-*•]\s+\*\*/m.test(body) || /^\s*\*\*[^*]{2,40}\*\*:/m.test(body)) {
      score += 12;
      aiHits += 1;
      cues.push('bolded bullet lead-ins');
    }
    if (/\b(i|im)\b/.test(body) && !/\bI\b/.test(body)) {
      score -= 16; humanHits += 1; humanCues.push('lowercase "i"');
    }
    if (/\b[a-z]{2,}\d+[a-z]{1,}\b|\b(teh|recieve|seperate|definately|alot|thier|occured|untill)\b/i.test(body)) {
      score -= 12; humanHits += 1; humanCues.push('typos');
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      aiHits,
      humanHits,
      humanCues,
      words: words.length,
    };
  }

  /**
   * @param {{subject:string, senderName:string, senderEmail:string, snippet?:string, body?:string}} email
   * @param {'preview'|'full'} level
   */
  function classify(email, level) {
    const spamCues = [];
    const aiCues = [];
    const autoCues = [];
    const spam = spamScore(email, spamCues);
    const auto = automatedScore(email, autoCues);
    const ai = aiScore(email, aiCues);

    // A preview is a subject line and ~100 characters of snippet. Never let it
    // sound sure of itself.
    const ceiling = level === 'full' ? 78 : 55;

    const spamVerdict = spam >= 55 ? 'spam' : 'not_spam';
    // Confidence tracks how far the evidence sits from the decision line, so a
    // borderline mail reads as borderline instead of as a flat constant.
    const spamConfidence = spamVerdict === 'spam'
      ? Math.min(ceiling, 55 + (spam - 55) * 0.6)
      : Math.min(ceiling, 40 + (55 - spam) * 0.5);

    let authorship = 'unclear';
    let authorshipConfidence = Math.min(35, ceiling);
    let cues = [];

    if (auto >= 34) {
      authorship = 'automated';
      authorshipConfidence = Math.min(ceiling, 50 + (auto - 34) * 0.5);
      cues = autoCues;
    } else if (ai.score >= 66 && ai.aiHits >= 2) {
      authorship = 'ai';
      authorshipConfidence = Math.min(ceiling, 45 + (ai.score - 66) * 0.8);
      cues = aiCues;
    } else if (ai.score <= 40 && ai.humanHits >= 1) {
      authorship = 'human';
      authorshipConfidence = Math.min(ceiling, 45 + (40 - ai.score) * 0.6);
      cues = ai.humanCues;
    }
    // Everything else stays "unclear". Without positive evidence this scorer
    // must not assert a verdict - silence on thin text is the correct answer,
    // and the badge says so rather than defaulting to "human".

    const shown = (spamVerdict === 'spam' ? spamCues : cues).slice(0, 3);
    const reason = shown.length
      ? 'Signals: ' + shown.join(', ') + '.'
      : level === 'full'
        ? 'Nothing in the text points either way.'
        : 'Only a subject line and a preview to go on.';

    return {
      spam: { verdict: spamVerdict, confidence: Math.round(spamConfidence) },
      authorship: { verdict: authorship, confidence: Math.round(authorshipConfidence) },
      reason,
      engine: 'heuristics',
      level,
    };
  }

  root.MailLensHeuristics = { classify };
})(typeof self !== 'undefined' ? self : globalThis);
