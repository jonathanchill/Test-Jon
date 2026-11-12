/**
 * Single source of truth for brand and contact details.
 * Everything here is a PLACEHOLDER until the new business has a name,
 * domain, address and legal entity. Swap once and the whole site updates.
 */
export const site = {
  name: 'OppositeNumber',
  legalName: 'OppositeNumber Ltd',
  tagline: 'AI that ships. Products that last.',
  shortName: 'OppNo',
  description:
    'OppositeNumber is an AI and digital product studio. We help ambitious UK businesses put AI to work in their operations and products, then design, build and run the software behind it.',
  email: 'hello@example.com',
  phone: '+44 (0)20 0000 0000',
  phoneHref: 'tel:+442000000000',
  addresses: [
    { label: 'Studio', lines: ['Address line 1', 'Town', 'Postcode'], mapsUrl: '#' },
  ],
  social: {
    linkedin: 'https://www.linkedin.com/',
    youtube: 'https://www.youtube.com/',
    instagram: 'https://www.instagram.com/',
    x: 'https://x.com/',
  },
  founded: 2026,
  // Shown in the footer and used in schema.org data. Remove any you do not hold.
  certifications: ['Cyber Essentials Plus'],
  bookingUrl: '/contact',
  /** Home page showreel. Leave all empty for the placeholder. Set src (self-hosted MP4) or youtubeId / vimeoId. */
  showreel: { src: '', poster: '', youtubeId: '', vimeoId: '' } as { src?: string; poster?: string; youtubeId?: string; vimeoId?: string },
};

export const nav = [
  { label: 'AI Services', href: '/ai-services' },
  { label: 'Digital Services', href: '/digital-services' },
  { label: 'Approach & Pricing', href: '/approach' },
  { label: 'Work', href: '/work' },
  { label: 'Sectors', href: '/sectors' },
  { label: 'Team', href: '/team' },
  { label: 'Insights', href: '/insights' },
];

export const footerNav = [
  { label: 'AI Readiness Scorecard', href: '/ai-readiness' },
  { label: 'Careers', href: '/careers' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];
