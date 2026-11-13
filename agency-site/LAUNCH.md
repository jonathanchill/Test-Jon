# Launch checklist for oppositenumber.ai

Everything the site needs is in this repo. The steps below are the ones only an account owner can do.
Work top to bottom; each block is independent unless it says otherwise.

## 1. Point oppositenumber.ai at Netlify

1. In Netlify open the project, then **Domain management**, then **Add a domain**. Enter `oppositenumber.ai` and confirm you own it. Add `www.oppositenumber.ai` as an alias when prompted.
2. Choose how to connect DNS. Either option works:
   - **Netlify DNS (simplest).** Netlify shows four nameservers. At your .ai registrar, replace the existing nameservers with those four. Netlify then manages all records, including the ones Google Workspace will need later.
   - **Keep your registrar's DNS.** Add two records there: an `A` record for the apex `@` pointing to `75.2.60.5`, and a `CNAME` for `www` pointing to `apex-loadbalancer.netlify.com`. Netlify shows the exact values on the domain page; use those if they differ.
3. Wait for DNS to propagate, usually under an hour for .ai. Netlify then issues a free HTTPS certificate automatically under **Domain management**, then **HTTPS**. Click **Verify DNS configuration** if it has not started.
4. Set `oppositenumber.ai` as the **primary domain**. The repo already redirects `www` and the old `superlative-alfajores` address to it.
5. **Project configuration**, then **Access & security**, then **Visitor access**: turn protection off so the public can see the site.
6. **Build & deploy**, then **Branches and deploy contexts**: make `claude/keen-planck-kc7jie` the production branch, or merge it to `main` and make `main` production. Either is fine; pick one and keep it.
7. **Forms**: add an email notification for the `contact` form pointing at the inbox you want enquiries in.

## 2. Email on the domain (needed before Google Business Profile and Ads)

1. Sign up for Google Workspace Business Starter at workspace.google.com using `oppositenumber.ai`. Create `hello@oppositenumber.ai` and a personal mailbox for yourself.
2. Google gives you a verification TXT record and five MX records. Add them wherever DNS lives (Netlify DNS or the registrar).
3. Add the SPF, DKIM and DMARC records Google shows under **Apps**, then **Gmail**, then **Authenticate email**. Without these, enquiries you send will land in spam.
4. Use the new Google account for everything below so ownership stays with the business, not a personal Gmail.

## 3. Google Business Profile (do once the studio address is confirmed)

1. Go to business.google.com signed in as the Workspace account and create a profile for **OppositeNumber**.
2. Category: primary **Internet marketing service** or **Software company**; add **Website designer** and **Business management consultant** as secondary.
3. Address: 2 Guildford Park Road, Guildford GU2 7ND. Tick that you serve customers at their location and add service areas: Guildford, Farnham, Godalming, Woking, Haslemere, Cranleigh, Dorking, Camberley, Farnborough, Fleet, Aldershot, Weybridge, Leatherhead.
4. Google will verify by postcard to the address, or sometimes by video call. Nothing is public until verified.
5. After verification: add the logo (`public/brand/mark.svg` exported as PNG), the hero photo, opening hours, phone, and a description. Link to `https://oppositenumber.ai`.
6. Add the four case studies as **Updates** and ask Thunderbolt, Homeconcepts, 1minus1 and WBK for reviews. Five early reviews move the needle more than anything else.

## 4. Social channels local businesses actually check

Set these up with the Workspace email, same name and logo on each. Priority order:

1. **LinkedIn company page** (essential for B2B in Surrey). Add all staff as employees, post each case study, follow local chambers.
2. **Google Business Profile** posts (above). Counts as social for local search.
3. **Instagram** for the work gallery and studio life. Reserve the handle even if posting is light.
4. **Facebook page**. Low effort, but many Surrey business groups and local directories require one.
5. **YouTube** channel for the showreel and talking heads. Also feeds Google results.
6. **X** only to hold the name.

Suggested handle: `oppositenumberai` everywhere, falling back to `oppositenumber_ai`. Once created, put the URLs in `src/data/site.ts` under `social` and they appear in the footer and the structured data.

Local directories worth ten minutes each: Surrey Chambers of Commerce, Guildford Business Forum, Yell, Bing Places (imports from Google Business Profile), Clutch and DesignRush for agency searches.

## 5. Google Ads

Do not start Ads until sections 1 to 3 are done and the contact form notification is confirmed working.

1. Create the Ads account at ads.google.com with the Workspace login. Link it to Google Business Profile and to Google Analytics (add the GA4 measurement ID through Google Tag Manager, then set `PUBLIC_GTM_ID` in Netlify environment variables).
2. Install conversion tracking on the `/thanks` page, which is where the contact form lands.
3. Start with one **Search** campaign, exact and phrase match only, geo-targeted to a 25-mile radius of Guildford:
   - Ad group **AI consultancy**: "ai consultancy surrey", "ai consultant guildford", "ai agency surrey", "ai automation for small business".
   - Ad group **AI search visibility**: "ai search optimisation", "generative engine optimisation agency", "get found on chatgpt".
   - Ad group **Websites**: "web design agency guildford", "web development surrey".
   - Send AI terms to `/ai-services`, web terms to `/digital-services`, and town terms to the matching `/locations/` page.
4. Budget: £20 to £30 a day for the first month, then cut keywords with no enquiries and double down on the rest.
5. Add negative keywords from day one: jobs, course, free, salary, tutorial, degree.

## 6. Before you tell anyone

- Replace the placeholder prices on `/approach` or hide them.
- Swap the placeholder testimonials and team entries in `src/data/testimonials.ts` and `src/pages/team.astro`.
- Add company number, registered office and ICO number to `/privacy` and `/terms`.
- Submit the sitemap at `https://oppositenumber.ai/sitemap-index.xml` in Google Search Console and Bing Webmaster Tools.
