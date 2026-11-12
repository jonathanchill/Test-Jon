# Agency site (working name: OppositeNumber)

An Astro website for a new AI and digital product agency positioned against [Kyan](https://kyan.com). It is a separate business from 1minus1, so nothing here reuses 1minus1 branding, copy or infrastructure.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Astro 7, static output | Zero JS by default, fastest possible pages. Kyan ships a full Next.js bundle. |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`, tokens in `src/styles/global.css` | Matches the Tailwind habit on 1minus1.com. One `@theme` block holds the brand. |
| Content | Astro content collections (Markdown) in `src/content/` | Case studies and insights live in git today. Swap the loader for Strapi or Craft later without touching pages. |
| SEO / GEO | `@astrojs/sitemap`, canonical and OG tags, JSON-LD (Organization, Service, Article, FAQPage), `public/llms.txt`, `robots.txt` | Kyan sells "AI search visibility". This site practises it out of the box. |
| Forms | Netlify Forms by default, or `PUBLIC_FORM_ENDPOINT` for any other handler | Honeypot included. No reCAPTCHA dependency. |
| Analytics | Google Tag Manager, enabled only when `PUBLIC_GTM_ID` is set | Same as 1minus1.com. |
| CI | `.github/workflows/agency-site.yml` runs `astro check` and `astro build` | |

## Run it

```bash
cd agency-site
npm install
cp .env.example .env
npm run dev
```

`npm run build` writes a static site to `dist/`. Deploy anywhere static (Netlify, Cloudflare Pages, Vercel, GitHub Pages).

## Where things live

- `src/data/site.ts` — brand name, contact details, socials, nav. **Change this first.**
- `src/data/services.ts` — the 16 services. Each becomes `/services/[slug]`.
- `src/data/sectors.ts`, `testimonials.ts`, `faqs.ts` — small content lists.
- `src/content/work/*.md` — case studies (all marked `placeholder: true` for now).
- `src/content/insights/*.md` — articles.
- `src/styles/global.css` — colour, type and spacing tokens.
- `src/pages/` — one file per route, plus dynamic routes for services, work and insights.

## Pages

Home, AI Services, Digital Services, 16 service detail pages, Approach & Pricing, AI Readiness Scorecard (interactive), Sectors, Work (filterable) and 6 case studies, Insights and 3 articles, Team, Careers, Contact, Thanks, Privacy, Terms, 404.

## How it is positioned against Kyan

What Kyan does (from their live site, November 2026): "AI Consultancy & Implementation Agency", London and Guildford, founded 2002, B Corp, ISO 9001/27001/42001. Three AI pillars (Consultancy, Development, Adoption) and five digital pillars (Apps, Strategy, Websites, Branding, Design Systems). Flagship offer is a 20-Day AI Sprint. Clients include ITV, Premier League, Haleon, PureGym, Costa, Sage. Next.js on Netlify, PP Mori typeface, bright multi-colour palette.

Where this site attacks:

1. **Speed.** A 10-Day AI Sprint and a 2-week Opportunity Audit, both fixed price, versus their 20-day sprint.
2. **Transparency.** An Approach & Pricing page with engagement models and rate bands. Kyan publishes no prices.
3. **Proof culture.** "Evals before features", a success metric before every build, results on every case study.
4. **Lead magnet.** An on-site AI Readiness Scorecard with no email gate. Kyan links out to an external assessment.
5. **Technical credibility.** A faster, lighter site that already does structured data and `llms.txt` properly.

Where Kyan is strong and this site cannot yet compete: 20 years of case studies, B Corp, three ISO certifications, 22 named staff. Those gaps are listed below.

## What is still placeholder

- Business name, legal entity, domain, email, phone, address.
- Logo, typeface licence, final palette.
- Team names, roles and photos.
- All six case studies and all three testimonials.
- Prices on the Approach page.
- Privacy and Terms text.
- Certifications in the footer.
- Client logo marquee on the home page.
