export type Service = {
  slug: string;
  group: 'ai' | 'digital';
  pillar: string;
  title: string;
  summary: string;
  outcomes: string[];
  deliverables: string[];
  timeline: string;
  from?: string;
};

/** Service catalogue. Each entry becomes /services/[slug]. */
export const services: Service[] = [
  // ---------------- AI ----------------
  {
    slug: 'ai-opportunity-audit',
    group: 'ai',
    pillar: 'AI Strategy',
    title: 'AI Opportunity Audit',
    summary:
      'A two-week, fixed-price review of where AI will save money or make money in your business, ranked by value and effort.',
    outcomes: [
      'A ranked backlog of AI opportunities with estimated ROI',
      'Data and systems readiness score for each one',
      'A 90-day plan your board can approve',
    ],
    deliverables: ['Stakeholder interviews', 'Process and data mapping', 'Opportunity scorecard', 'Board-ready roadmap'],
    timeline: '2 weeks',
    from: 'Fixed price',
  },
  {
    slug: 'ten-day-ai-sprint',
    group: 'ai',
    pillar: 'AI Strategy',
    title: '10-Day AI Sprint',
    summary:
      'From idea to a working, tested AI prototype in ten working days. Real data, real users, real decision at the end.',
    outcomes: ['A working prototype on your data', 'Evaluation results against a success metric you set', 'A go / no-go recommendation with costs'],
    deliverables: ['Day 1 framing workshop', 'Prototype built and tested on your data', 'Security and data review', 'Demo and go / no-go decision'],
    timeline: '10 working days',
    from: '£8,995 fixed',
  },
  {
    slug: 'fractional-ai-lead',
    group: 'ai',
    pillar: 'AI Strategy',
    title: 'Fractional AI Lead',
    summary: 'Senior AI leadership at your table one or two days a week. Strategy, governance and delivery owned by someone accountable.',
    outcomes: ['An AI strategy that matches your operating model', 'Governance and policy in place', 'Vendors and pilots held to measurable outcomes'],
    deliverables: ['Weekly leadership time', 'AI policy and governance pack', 'Vendor and build reviews', 'Quarterly board reporting'],
    timeline: 'Rolling monthly',
  },
  {
    slug: 'ai-product-development',
    group: 'ai',
    pillar: 'AI Development',
    title: 'AI Product Development',
    summary:
      'Custom AI features and products: assistants, search, classification, generation and agentic workflows, built with evals and guardrails from day one.',
    outcomes: ['Production AI features with measured accuracy', 'Cost and latency budgets met', 'Observability so you can trust what ships'],
    deliverables: ['Architecture and model selection', 'Eval suite and red-teaming', 'Integration with your stack', 'Monitoring and runbooks'],
    timeline: '6 to 16 weeks',
  },
  {
    slug: 'process-automation',
    group: 'ai',
    pillar: 'AI Development',
    title: 'Business Process Automation',
    summary: 'Replace manual, document-heavy and email-driven processes with AI workflows that connect the systems you already own.',
    outcomes: ['Hours back for your team every week', 'Fewer errors and faster turnaround', 'Audit trail on every automated decision'],
    deliverables: ['Process discovery', 'Workflow design and build', 'Human-in-the-loop controls', 'Adoption support'],
    timeline: '4 to 10 weeks',
  },
  {
    slug: 'data-readiness',
    group: 'ai',
    pillar: 'AI Development',
    title: 'Data & AI Readiness',
    summary: 'Get your data clean, connected and governed so AI gives you answers you can rely on.',
    outcomes: ['A single trusted source for the data AI needs', 'Pipelines and access controls in place', 'Clear ownership of data quality'],
    deliverables: ['Data audit', 'Pipeline and warehouse work', 'Access and retention policy', 'Quality dashboards'],
    timeline: '4 to 12 weeks',
  },
  {
    slug: 'ai-adoption-programme',
    group: 'ai',
    pillar: 'AI Adoption',
    title: 'AI Adoption Programme',
    summary: 'Hands-on training and change support so AI tools get used, not just licensed.',
    outcomes: ['Measured uplift in tool usage and output', 'Champions in every team', 'Guardrails your people understand'],
    deliverables: ['Role-based workshops', 'Playbooks and prompt libraries', 'Champion network', 'Usage measurement'],
    timeline: '6 to 12 weeks',
  },
  {
    slug: 'ai-governance-security',
    group: 'ai',
    pillar: 'AI Adoption',
    title: 'AI Governance & Security',
    summary: 'Policies, controls and security testing that keep your AI usage safe, compliant and defensible.',
    outcomes: ['AI acceptable-use and data policies', 'Risk register and controls you can show an auditor', 'Security review of AI-exposed surfaces'],
    deliverables: ['Policy pack', 'Risk assessment', 'Prompt-injection and data-leak testing', 'Board briefing'],
    timeline: '3 to 6 weeks',
  },
  {
    slug: 'ai-search-visibility',
    group: 'ai',
    pillar: 'AI Adoption',
    title: 'AI Search Visibility (GEO)',
    summary: 'Make sure ChatGPT, Claude, Gemini and Perplexity understand, trust and cite your brand when buyers ask.',
    outcomes: ['Baseline of how you show up in AI answers', 'Structured data, llms.txt and content fixes shipped', 'Monthly benchmark against competitors'],
    deliverables: ['AI visibility audit', 'Technical fixes', 'Content plan', 'Benchmark reporting'],
    timeline: '4 weeks, then monthly',
  },

  // ---------------- Digital ----------------
  {
    slug: 'product-strategy',
    group: 'digital',
    pillar: 'Strategy',
    title: 'Product Strategy & Roadmaps',
    summary: 'Work out what to build, for whom and why it will win before you spend on engineering.',
    outcomes: ['A validated product vision', 'A roadmap tied to business outcomes', 'Clear success metrics'],
    deliverables: ['Discovery workshops', 'Customer research', 'Opportunity mapping', 'Roadmap and business case'],
    timeline: '3 to 6 weeks',
  },
  {
    slug: 'proof-of-concept',
    group: 'digital',
    pillar: 'Strategy',
    title: 'Proof of Concept',
    summary: 'A low-risk, time-boxed build to prove the hard part works before committing to the whole product.',
    outcomes: ['Technical risk retired early', 'Something real to show investors or the board', 'Accurate estimates for the full build'],
    deliverables: ['Scope and success criteria', 'Working PoC', 'Technical findings', 'Full-build estimate'],
    timeline: '2 to 4 weeks',
  },
  {
    slug: 'mobile-apps',
    group: 'digital',
    pillar: 'Build',
    title: 'Mobile App Development',
    summary: 'iOS and Android apps that your customers keep on their home screen, built natively or cross-platform depending on what the product needs.',
    outcomes: ['Store-ready apps with analytics baked in', 'A back end that scales with downloads', 'A release pipeline your team can run'],
    deliverables: ['UX and UI design', 'App and API build', 'QA and device testing', 'Store submission and launch'],
    timeline: '12 to 20 weeks',
  },
  {
    slug: 'web-platforms',
    group: 'digital',
    pillar: 'Build',
    title: 'Web Platforms & SaaS',
    summary: 'Customer portals, SaaS products and internal tools, engineered for performance, security and change.',
    outcomes: ['A platform that handles growth without rewrites', 'Secure by design, with audit trails', 'Fast pages that convert'],
    deliverables: ['Architecture', 'Front and back-end build', 'Integrations', 'Hosting, monitoring and support'],
    timeline: '10 to 24 weeks',
  },
  {
    slug: 'marketing-websites',
    group: 'digital',
    pillar: 'Build',
    title: 'Marketing Websites & Headless CMS',
    summary: 'Fast, accessible, findable websites on a headless CMS your marketing team will actually enjoy using.',
    outcomes: ['Core Web Vitals in the green', 'Editors publish without developers', 'Built for search engines and AI engines alike'],
    deliverables: ['Content modelling', 'Design system', 'Astro or Nuxt front end', 'CMS, hosting and training'],
    timeline: '8 to 14 weeks',
  },
  {
    slug: 'design-systems',
    group: 'digital',
    pillar: 'Design',
    title: 'Design Systems',
    summary: 'Tokens, components and documentation that keep every product on-brand and make teams faster.',
    outcomes: ['Consistent UI across every property', 'Less duplicated front-end work', 'Accessibility handled once, centrally'],
    deliverables: ['Audit and foundations', 'Figma library', 'Coded component library', 'Governance and docs'],
    timeline: '6 to 12 weeks',
  },
  {
    slug: 'digital-branding',
    group: 'digital',
    pillar: 'Design',
    title: 'Digital Branding',
    summary: 'Identity, motion and tone of voice designed for screens first, so the product and the brand feel like one thing.',
    outcomes: ['A distinctive identity that works at 16px and 16ft', 'Brand guidelines your team can apply', 'Launch assets ready to go'],
    deliverables: ['Brand strategy', 'Identity and motion', 'Guidelines', 'Launch toolkit'],
    timeline: '6 to 10 weeks',
  },
];

export const pillars = {
  ai: [
    { name: 'AI Strategy', blurb: 'Find where AI pays back, prove it fast, and own the plan at leadership level.' },
    { name: 'AI Development', blurb: 'Build AI into your products and processes with evals, guardrails and observability.' },
    { name: 'AI Adoption', blurb: 'Make it stick with training, governance, security and visibility in AI search.' },
  ],
  digital: [
    { name: 'Strategy', blurb: 'Decide what to build and de-risk it before the big spend.' },
    { name: 'Build', blurb: 'Apps, platforms and websites engineered to last.' },
    { name: 'Design', blurb: 'Design systems and digital brands that scale with you.' },
  ],
};

export const byGroup = (group: Service['group']) => services.filter((s) => s.group === group);
export const bySlug = (slug: string) => services.find((s) => s.slug === slug);
