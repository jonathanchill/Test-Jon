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

  function aiScore(email, cues) {
    const body = email.body || email.snippet || '';
    const text = (email.subject || '') + '\n' + body;
    let score = 30 + count(text, AI_PHRASES, cues) - count(text, HUMAN_PHRASES, []);

    const words = body.split(/\s+/).filter(Boolean);
    const emDashes = (body.match(/[—–]/g) || []).length;
    if (words.length > 60 && emDashes >= 3) { score += 14; cues.push('em-dash habit'); }

    const contractions = (body.match(/\b\w+'(s|t|re|ve|ll|d|m)\b/gi) || []).length;
    if (words.length > 80 && contractions === 0) { score += 12; cues.push('no contractions'); }

    const sents = sentences(body);
    if (sents.length >= 5) {
      const lengths = sents.map((s) => s.split(/\s+/).length);
      const sd = stdev(lengths);
      if (sd < 3.5) { score += 16; cues.push('very even sentence lengths'); }
      else if (sd > 9) { score -= 10; }
    }
    if (/^\s*[-*•]\s+\*\*/m.test(body) || /^\s*\*\*[^*]{2,40}\*\*:/m.test(body)) {
      score += 12;
      cues.push('bolded bullet lead-ins');
    }
    if (/\b(i|im)\b/.test(body) && !/\bI\b/.test(body)) { score -= 14; cues.push('lowercase "i"'); }
    if (/\b(\w+)\s+\1\b/i.test(body)) { score -= 8; }
    if (words.length < 25) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * @param {{subject:string, senderName:string, senderEmail:string, snippet?:string, body?:string}} email
   * @param {'preview'|'full'} level
   */
  function classify(email, level) {
    const spamCues = [];
    const aiCues = [];
    const spam = spamScore(email, spamCues);
    const ai = aiScore(email, aiCues);

    // A preview is a subject line and ~100 characters of snippet. Never let it
    // sound sure of itself.
    const ceiling = level === 'full' ? 78 : 52;

    const spamVerdict = spam >= 55 ? 'spam' : 'not_spam';
    const spamConfidence = Math.min(ceiling, 45 + Math.abs(spam - 55));

    let authorship = 'unclear';
    if (ai >= 62) authorship = 'ai';
    else if (ai <= 38) authorship = 'human';
    const authorshipConfidence = authorship === 'unclear'
      ? Math.min(40, ceiling)
      : Math.min(ceiling, 40 + Math.abs(ai - 50));

    const cues = (spamVerdict === 'spam' ? spamCues : aiCues).slice(0, 3);
    const reason = cues.length
      ? 'Signals: ' + cues.join(', ') + '.'
      : 'No strong signals either way in the text available.';

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
