/*
 * Labelled sample emails for measuring the offline scorer.
 *
 * These are modelled on what a working business inbox actually contains -
 * LinkedIn notification traffic, calendar invitations, scheduled reports,
 * genuine threads with colleagues, cold outreach, AI-drafted pitches and
 * phishing - rather than on cases the scorer is known to get right.
 *
 * `level` says how much text is available: 'preview' is what a message-list row
 * exposes (subject + ~100 characters of snippet), 'full' is an opened message.
 * Expectations are deliberately lenient where the truth is genuinely uncertain:
 * `authorship: null` means any verdict is acceptable, and a list of verdicts
 * means any of them is.
 */
'use strict';

module.exports = [
  /* ---------------------------------------------- automated / notification */
  {
    name: 'LinkedIn message notification',
    level: 'preview',
    senderName: 'Matt Wolff via LinkedIn',
    senderEmail: 'messages-noreply@linkedin.com',
    subject: 'Matt just messaged you',
    snippet: '1 new message awaits your response',
    spam: 'not_spam',
    authorship: 'automated',
  },
  {
    name: 'LinkedIn digest of several messages',
    level: 'preview',
    senderName: 'LinkedIn Messaging',
    senderEmail: 'messaging-digest-noreply@linkedin.com',
    subject: 'Bent, Seb, and Philippe sent new messages',
    snippet: '3 new messages await your response',
    spam: 'not_spam',
    authorship: 'automated',
  },
  {
    name: 'Calendar invitation',
    level: 'preview',
    senderName: 'Jonny Marksman',
    senderEmail: 'jonny@marksman.example',
    subject: 'Invitation: Track Breakthrough 1:1 Session @ Mon 5 Oct 2026 16:00 - 16:30 (BST)',
    snippet: 'You have been invited to the following event.',
    spam: 'not_spam',
    authorship: 'automated',
  },
  {
    name: 'Mailing list moderation report',
    level: 'preview',
    senderName: 'noreply-spamdigest',
    senderEmail: 'noreply-spamdigest@googlegroups.com',
    subject: "Moderator's spam report for hq@example.com",
    snippet: 'This message is being sent to you because you are a moderator of the group.',
    spam: 'not_spam',
    authorship: 'automated',
  },
  {
    name: 'Scheduled SEO report to self',
    level: 'preview',
    senderName: 'me',
    senderEmail: 'reports@example.com',
    subject: 'Weekly SEO Scanner — example.com — 17/09/2026 to 23/09/2026 (+ full site audit)',
    snippet: 'Period: 17-23 Sep 2026 vs 10-16 Sep 2026 · Marketing channel summary',
    spam: 'not_spam',
    authorship: 'automated',
  },
  {
    name: 'Payment receipt',
    level: 'preview',
    senderName: 'Stripe',
    senderEmail: 'receipts@stripe.com',
    subject: 'Your receipt from Example Ltd',
    snippet: 'Receipt #2451-9921 · Amount paid GBP 240.00',
    spam: 'not_spam',
    authorship: 'automated',
  },
  {
    name: 'CI build failure',
    level: 'preview',
    senderName: 'GitHub Actions',
    senderEmail: 'notifications@github.com',
    subject: '[example/site] Build failed on main',
    snippet: 'The run failed. View it in your browser.',
    spam: 'not_spam',
    authorship: 'automated',
  },
  {
    name: 'Full automated newsletter with unsubscribe footer',
    level: 'full',
    senderName: 'Product Weekly',
    senderEmail: 'no-reply@productweekly.example',
    subject: 'Your weekly digest is ready',
    body: 'Here is what happened this week across your workspace.\n\n' +
      '12 new items were added. 4 were completed. 2 are overdue.\n\n' +
      'You are receiving this because you subscribed to Product Weekly. ' +
      'Manage your email preferences or unsubscribe. Do not reply to this email.',
    spam: 'not_spam',
    authorship: 'automated',
  },

  /* ------------------------------------------------------------------ spam */
  {
    name: 'Phishing, brand from free mailbox',
    level: 'preview',
    senderName: 'PayPal Security',
    senderEmail: 'billing@paypa1-secure.top',
    subject: 'URGENT: Your account has been suspended',
    snippet: 'Dear Customer, we detected unusual activity. Verify your account within 24 hours. CLICK HERE NOW!!!!',
    spam: 'spam',
    authorship: null,
  },
  {
    name: 'Advance fee fraud',
    level: 'full',
    senderName: 'Barrister A. Musa',
    senderEmail: 'barr.musa@legalfirm.tk',
    subject: 'URGENT AND CONFIDENTIAL',
    body: 'Dear Friend, I am contacting you regarding the estate of a deceased client who shares ' +
      'your surname. He left an inheritance of $12,500,000 USD with no next of kin. ' +
      'This is not a scam. I require your urgent reply to proceed with the wire transfer.',
    spam: 'spam',
    authorship: null,
  },
  {
    name: 'Credential harvesting',
    level: 'full',
    senderName: 'IT Helpdesk',
    senderEmail: 'helpdesk@micros0ft-verify.xyz',
    subject: 'Final notice: mailbox will be closed',
    body: 'Your mailbox storage is full and your account has been suspended. ' +
      'Click here to verify your account and update your payment details. ' +
      'Expires today. Send us your password to restore access immediately.',
    spam: 'spam',
    authorship: null,
  },

  /* ----------------------------------------------------------------- human */
  {
    name: 'Short informal note from a colleague',
    level: 'preview',
    senderName: 'Sam Okafor',
    senderEmail: 'sam@example.com',
    subject: 'lunch tomorrow?',
    snippet: 'hey, still on for 1pm? i can move it if not, no worries either way',
    spam: 'not_spam',
    authorship: 'human',
  },
  {
    name: 'Reply in an ongoing thread',
    level: 'full',
    senderName: 'Elliot Vance',
    senderEmail: 'elliot@example.com',
    subject: 're: Conversation post Gamescom',
    body: "Hi Jonathan,\n\nThanks so much for giving me your email - when works for you next week? " +
      "I'm around Tues and Weds, bit tight Thurs. Also I didn't get a chance to ask, did Mal end up " +
      "going to the panel thing? Sounded like it clashed.\n\nhello from a very rainy Cologne btw\n\nElliot",
    spam: 'not_spam',
    authorship: 'human',
  },
  {
    name: 'Blunt one-liner',
    level: 'full',
    senderName: 'Mal',
    senderEmail: 'mal@example.com',
    subject: 'deck',
    body: "cant open it, can you resend as pdf? thx",
    spam: 'not_spam',
    authorship: ['human', 'unclear'],
  },
  {
    name: 'Careful human business writing',
    level: 'full',
    senderName: 'Jack Prentice',
    senderEmail: 'jack@accountants.example',
    subject: 'Year end',
    body: "Dear Jon and Mal,\n\nAs we are now approaching your year end, is there anything you'd like " +
      "to discuss before we close the books? Last year we left the director's loan until quite late " +
      "and it made the January filing tighter than it needed to be.\n\n" +
      "I've got slots on the 14th and the 16th. Either works for me.\n\nBest wishes,\nJack",
    // Polished human prose is the classic false positive. Anything except a
    // confident "ai" is an acceptable answer here.
    spam: 'not_spam',
    authorship: ['human', 'unclear'],
  },

  /* -------------------------------------------------------------------- ai */
  {
    name: 'AI-written cold outreach',
    level: 'full',
    senderName: 'Dana at GrowthCo',
    senderEmail: 'dana@growthco.example',
    subject: 'Unlocking the full potential of your workflow',
    body: 'Hi there,\n\nI hope this email finds you well. In today\'s fast-paced business landscape, ' +
      'organisations are constantly seeking to leverage robust and seamless solutions that unlock ' +
      'the full potential of their teams.\n\nOur platform empowers you to streamline your workflow, ' +
      'foster collaboration, and elevate your operational efficiency. It is not just a tool, it is a ' +
      'comprehensive ecosystem designed to navigate the complexities of modern work.\n\n' +
      'Furthermore, our holistic approach underscores a commitment to measurable outcomes. Moreover, ' +
      'clients report a pivotal shift in productivity within the first quarter of adoption.\n\n' +
      'Should you have any questions, please do not hesitate to reach out.\n\nBest regards,\nDana',
    spam: 'not_spam',
    authorship: 'ai',
  },
  {
    name: 'AI-written, visible in the preview',
    level: 'preview',
    senderName: 'Priya Raman',
    senderEmail: 'priya@consulting.example',
    subject: 'Elevate your content strategy',
    snippet: "I hope this email finds you well. In today's fast-paced digital landscape, it is crucial to leverage",
    spam: 'not_spam',
    authorship: 'ai',
  },
  {
    name: 'AI-written internal update',
    level: 'full',
    senderName: 'Ops',
    senderEmail: 'ops@example.com',
    subject: 'Q3 process improvements',
    body: 'Team,\n\nAs we navigate the complexities of the current quarter, it is worth noting that our ' +
      'holistic approach to operations has yielded a myriad of improvements.\n\n' +
      '**Efficiency**: We have streamlined our intake process.\n' +
      '**Collaboration**: We have fostered stronger cross-functional alignment.\n' +
      '**Visibility**: We have elevated our reporting cadence.\n\n' +
      'Furthermore, these changes underscore a pivotal commitment to excellence. Moreover, they ' +
      'position us to unlock the full potential of the team in the quarters ahead.\n\n' +
      'Should you have any questions, please do not hesitate to reach out.',
    spam: 'not_spam',
    authorship: 'ai',
  },

  /* -------------------------------------------- thin previews: say unclear */
  {
    name: 'Bare subject, no snippet',
    level: 'preview',
    senderName: 'Zach Miller',
    senderEmail: 'zach@example.com',
    subject: 'New deck',
    snippet: '',
    spam: 'not_spam',
    authorship: 'unclear',
  },
  {
    name: 'Neutral business preview',
    level: 'preview',
    senderName: 'Stephane Roy',
    senderEmail: 'stephane@example.com',
    subject: 'Following up on our conversation',
    snippet: 'Hi Jonathan, thanks for the time on Tuesday. Attaching the numbers we discussed.',
    // Genuinely undecidable from one line - unclear or human both acceptable,
    // but a confident "ai" would be wrong.
    spam: 'not_spam',
    authorship: ['unclear', 'human'],
  },
];
