/**
 * Local landing pages. The studio is in Guildford; these describe the towns we travel to and work with.
 * Each entry needs its own intro so the pages are genuinely different, not templated.
 */
export type Location = {
  slug: string; name: string; county: string; minutes: number; miles: number;
  intro: string; economy: string; sectors: string[]; clients?: string[]; faq: { q: string; a: string }[];
};

export const locations: Location[] = [
  {
    slug: 'farnham', name: 'Farnham', county: 'Surrey', minutes: 25, miles: 11,
    intro: 'Farnham has a dense cluster of agencies, creative studios and professional firms for a town its size, plus a university campus that keeps the talent pool young. We already work with businesses in the town and are on the A31 from our Guildford studio in under half an hour.',
    economy: 'Creative and marketing agencies, professional services, independent retail and hospitality around Castle Street and the Lion & Lamb Yard, and a growing base of founders working from the Farnham Maltings and nearby co-working spaces.',
    sectors: ['Agencies & studios', 'Professional services', 'Independent retail', 'Education'],
    clients: ['Thunderbolt', '1minus1'],
    faq: [
      { q: 'Do you come to Farnham for meetings?', a: 'Yes. Kick-off workshops and monthly reviews are usually in person, and Farnham is a 25-minute drive from our Guildford studio.' },
      { q: 'Have you worked with Farnham businesses before?', a: 'Yes, including two agencies based in the town. You can read both case studies on this page.' },
    ],
  },
  {
    slug: 'godalming', name: 'Godalming', county: 'Surrey', minutes: 15, miles: 5,
    intro: 'Godalming is our nearest neighbour, ten minutes down the A3100, and home to an unusual number of specialist businesses: engineering consultancies, financial advisers, independent schools and a thriving high street. Many of the founders we meet there have outgrown spreadsheets and email but are wary of expensive enterprise software.',
    economy: 'Specialist consultancies and engineering firms, financial and legal practices, independent schools, and a strong independent retail and food scene along the High Street and Church Street.',
    sectors: ['Professional services', 'Engineering & consultancy', 'Education', 'Independent retail'],
    faq: [
      { q: 'Is Godalming too small for an AI project to pay back?', a: 'No. The best returns we see are in ten-to-fifty-person firms where one automated workflow frees a senior person. Our Opportunity Audit is sized for exactly that.' },
      { q: 'Can we visit your studio?', a: 'Please do. We are at 2 Guildford Park Road, a short hop from Godalming by car or train.' },
    ],
  },
  {
    slug: 'woking', name: 'Woking', county: 'Surrey', minutes: 20, miles: 7,
    intro: 'Woking is the commercial heavyweight of west Surrey, with corporate headquarters around Victoria Way, a deep bench of technology and engineering companies, and fast trains to London that make it a base for hybrid teams. The scale of business here means AI projects tend to be about operations at volume: finance, customer service, compliance.',
    economy: 'Corporate head offices, technology and engineering firms, logistics and facilities companies, and a large professional services sector supporting them.',
    sectors: ['Technology & engineering', 'Financial services', 'Professional services', 'Logistics'],
    faq: [
      { q: 'Do you work with larger organisations in Woking?', a: 'Yes. For enterprise teams we usually start with a 10-Day Sprint inside one department, prove the number, then scale with governance in place.' },
      { q: 'How quickly can you be on site in Woking?', a: 'Twenty minutes by car, twelve by train from Guildford. Same-day is normal.' },
    ],
  },
  {
    slug: 'haslemere', name: 'Haslemere', county: 'Surrey', minutes: 30, miles: 13,
    intro: 'Haslemere sits where Surrey, Sussex and Hampshire meet, and its businesses tend to be owner-led, long-established and well connected: estate agents, architects, wealth managers, independent retailers and a remarkable number of consultants working from home. They want practical help from people who turn up, which suits how we work.',
    economy: 'Property and architecture practices, wealth and financial advice, health and wellbeing businesses, and consultants and remote professionals.',
    sectors: ['Property & architecture', 'Financial services', 'Health & wellbeing', 'Consultancy'],
    faq: [
      { q: 'We are a small team. Where would AI help first?', a: 'Usually enquiries, quoting and document handling. Our two-week Opportunity Audit will tell you precisely, with numbers.' },
      { q: 'Do you cover the Sussex and Hampshire side of Haslemere too?', a: 'Yes. Midhurst, Liphook and Petersfield are all within our normal travel area.' },
    ],
  },
  {
    slug: 'cranleigh', name: 'Cranleigh', county: 'Surrey', minutes: 20, miles: 9,
    intro: 'Cranleigh calls itself the largest village in England, and it behaves like a small town with a big catchment: construction and trades firms, agricultural and equestrian businesses, care providers and a busy high street. Businesses here run lean, which makes automation unusually valuable.',
    economy: 'Construction and trades, land and equestrian businesses, care and healthcare providers, independent retail and leisure.',
    sectors: ['Construction & trades', 'Care & healthcare', 'Rural & equestrian', 'Independent retail'],
    faq: [
      { q: 'Can AI help a trades or construction business?', a: 'Yes. Read our Homeconcepts case study: quoting from survey notes, client updates and invoice matching, all automated with a human approving each step.' },
      { q: 'Do you charge for travel to Cranleigh?', a: 'No. Anywhere within about 45 minutes of Guildford is included.' },
    ],
  },
  {
    slug: 'dorking', name: 'Dorking', county: 'Surrey', minutes: 30, miles: 13,
    intro: 'Dorking combines a historic market town with a serious business base along the A24 and around Denbies: food and drink producers, hospitality, professional firms and the headquarters of several national organisations. Tourism in the Surrey Hills adds a seasonal rhythm that good forecasting and automation handle well.',
    economy: 'Food, drink and hospitality, professional and financial services, national charity and membership head offices, and tourism around the Surrey Hills.',
    sectors: ['Hospitality & food', 'Charities & membership', 'Professional services', 'Tourism'],
    faq: [
      { q: 'We are a charity head office. Is AI appropriate for us?', a: 'Often more so than for commercial firms, because admin eats a bigger share of budget. We have specific experience with knowledge bases and case handling for not-for-profits.' },
      { q: 'How far is Dorking from your studio?', a: 'About half an hour along the A25 or A246.' },
    ],
  },
  {
    slug: 'camberley', name: 'Camberley', county: 'Surrey', minutes: 25, miles: 12,
    intro: 'Camberley and the Blackwater Valley form one of the South East’s busiest technology and defence corridors, with the M3 on the doorstep and large employers in Frimley and Bagshot. The businesses we meet here have data, lots of it, and want to use it without a two-year enterprise programme.',
    economy: 'Technology, defence and engineering, healthcare around Frimley Park, logistics and distribution, and business services along the M3.',
    sectors: ['Technology & defence', 'Healthcare', 'Logistics', 'Business services'],
    faq: [
      { q: 'We handle sensitive data. How do you approach security?', a: 'Least-privilege access, encryption in transit and at rest, no client data used for model training, and testing for prompt injection and data leakage before every launch. It is written into every statement of work.' },
      { q: 'Do you serve Frimley, Bagshot and Lightwater too?', a: 'Yes, the whole Blackwater Valley is within easy reach.' },
    ],
  },
  {
    slug: 'farnborough', name: 'Farnborough', county: 'Hampshire', minutes: 30, miles: 14,
    intro: 'Farnborough is aerospace, engineering and the businesses that serve them, plus a fast-growing town centre and the airport. Firms here are technically literate and sceptical of hype, which is exactly the audience for evaluation-led AI work with a number attached.',
    economy: 'Aerospace and advanced engineering, business aviation, technology services, and a large base of suppliers and consultancies.',
    sectors: ['Aerospace & engineering', 'Technology services', 'Supply chain', 'Professional services'],
    faq: [
      { q: 'Can you integrate with engineering and ERP systems?', a: 'Yes. We build a governed AI layer that connects to what you already run, so you can change models or vendors without rebuilding.' },
      { q: 'Do you work across the Hampshire border?', a: 'Yes. Farnborough, Fleet and Aldershot are all regular destinations from Guildford.' },
    ],
  },
  {
    slug: 'fleet', name: 'Fleet', county: 'Hampshire', minutes: 35, miles: 17,
    intro: 'Fleet has one of the highest concentrations of professional and technology workers in the country, many of them running their own consultancies and small firms from the town. Its businesses are polished and ambitious, and the question we hear most is how to deliver more without hiring.',
    economy: 'Consultancies and professional services, technology and software businesses, financial advice, and independent retail and leisure around Fleet Road.',
    sectors: ['Consultancy', 'Technology & software', 'Financial services', 'Independent retail'],
    faq: [
      { q: 'We are a consultancy. What does AI change for us?', a: 'Proposal drafting, research, reporting and knowledge management. Our 1minus1 and Thunderbolt case studies show the pattern for professional firms.' },
      { q: 'How often would we see you?', a: 'Weekly demos during a build, in person or on a call, and monthly reviews afterwards.' },
    ],
  },
  {
    slug: 'aldershot', name: 'Aldershot', county: 'Hampshire', minutes: 25, miles: 12,
    intro: 'Aldershot is changing fast, with major regeneration in the town centre and at Wellesley, a strong manufacturing and logistics base and the long-standing military presence. The businesses here are practical and cost-conscious, and respond to clear returns rather than technology for its own sake.',
    economy: 'Manufacturing and logistics, construction and regeneration, defence suppliers, retail and services for a growing residential population.',
    sectors: ['Manufacturing & logistics', 'Construction', 'Defence suppliers', 'Retail & services'],
    faq: [
      { q: 'What is the smallest sensible first project?', a: 'A two-week Opportunity Audit or a 10-Day Sprint, both fixed price. Either ends with a decision and a number, not a slide deck.' },
      { q: 'Are you close enough for regular visits?', a: 'Yes. Aldershot is 25 minutes from the studio via the A31 and A331.' },
    ],
  },
  {
    slug: 'weybridge', name: 'Weybridge', county: 'Surrey', minutes: 30, miles: 14,
    intro: 'Weybridge and the Elmbridge towns around it hold corporate head offices on the Brooklands estate, high-value property and wealth businesses, and a large population of senior professionals who run companies from home. Projects here tend to be about customer experience and premium service at scale.',
    economy: 'Corporate head offices at Brooklands, automotive and technology, property and wealth management, and premium retail and hospitality.',
    sectors: ['Corporate head offices', 'Property & wealth', 'Automotive & technology', 'Premium retail'],
    clients: ['Homeconcepts'],
    faq: [
      { q: 'Have you worked in Elmbridge before?', a: 'Yes. One of our construction clients has an office at Virginia Water and works across Weybridge, Esher and Cobham.' },
      { q: 'Do you cover Esher, Cobham and Walton too?', a: 'Yes. The whole of Elmbridge is within half an hour of Guildford.' },
    ],
  },
  {
    slug: 'leatherhead', name: 'Leatherhead', county: 'Surrey', minutes: 25, miles: 12,
    intro: 'Leatherhead punches well above its weight commercially, with research and technology campuses, pharmaceutical and professional services firms, and the M25 junction that makes it a natural regional base. The companies here are used to working with specialists and expect rigour.',
    economy: 'Research and technology campuses, pharmaceutical and healthcare companies, professional and financial services, and business parks along the M25.',
    sectors: ['Research & technology', 'Pharmaceutical & healthcare', 'Professional services', 'Business parks'],
    faq: [
      { q: 'Do you have experience in regulated industries?', a: 'Yes. Every engagement includes a data and security review, and we are used to working inside clients\' existing compliance and audit requirements.' },
      { q: 'How far is Leatherhead from Guildford?', a: 'About 25 minutes along the A246 through the Surrey Hills.' },
    ],
  },
];

export const bySlug = (slug: string) => locations.find((l) => l.slug === slug);
