# Launch guide for oppositenumber.ai

Click-by-click. Do the parts in order: A, then B, then C to E. Each part says what you need before you start and how you know it worked.

---

## Part A. Make the site live at oppositenumber.ai

**You need:** your Netlify login, and the login for wherever you bought oppositenumber.ai (the registrar).

### A1. Make the branch the production branch

1. Go to https://app.netlify.com and open the project (currently named `superlative-alfajores-c5cf7c`).
2. Left menu: **Project configuration**.
3. Left sub-menu: **Build & deploy**, then **Continuous deployment**.
4. Find the card **Branches and deploy contexts**. Click **Configure**.
5. **Production branch**: type `claude/keen-planck-kc7jie`. Click **Save**.
6. Left menu: **Deploys**. Click **Trigger deploy**, then **Deploy project**. Wait for the green **Published**.

### A2. Rename the project (optional but tidy)

1. **Project configuration**, then **General**, then **Project details**.
2. Click **Change project name**. Enter `oppositenumber`. Save. The temporary address becomes `oppositenumber.netlify.app`.

### A3. Add the custom domain

1. Left menu: **Domain management**.
2. Click **Add a domain**.
3. Type `oppositenumber.ai`. Click **Verify**.
4. Netlify says the domain is already registered and asks if you own it. Click **Yes, add domain**.
5. Netlify adds `oppositenumber.ai` and `www.oppositenumber.ai` to the list. Both show **Awaiting external DNS**. That is expected.

### A4. Connect DNS. Pick ONE of the two options.

**Option 1, recommended: let Netlify run DNS.**

1. On the **Domain management** page, next to `oppositenumber.ai`, click **Options**, then **Set up Netlify DNS**.
2. Click **Verify**, then **Add domain**, then **Continue** through the records screen (nothing to add yet), then **Continue**.
3. Netlify shows four nameservers that look like `dns1.p0X.nsone.net`, `dns2...`, `dns3...`, `dns4...`. Keep this tab open.
4. Log in to your registrar. Find the domain, then **Nameservers** or **DNS settings**. Choose **Custom nameservers**.
5. Delete the existing nameservers and paste the four from Netlify, one per line. Save.
6. Back in Netlify click **Done**.

**Option 2: keep DNS at the registrar.**

1. At the registrar open **DNS records** (sometimes **Advanced DNS** or **Zone editor**) for oppositenumber.ai.
2. Delete any existing `A` record for `@` and any `CNAME` for `www`.
3. Add: Type `A`, Host `@`, Value `75.2.60.5`, TTL default.
4. Add: Type `CNAME`, Host `www`, Value `apex-loadbalancer.netlify.com`, TTL default.
5. Save.

### A5. Wait, then switch on HTTPS

1. Wait 15 to 60 minutes. Check progress at https://dnschecker.org by entering `oppositenumber.ai`. When most locations show Netlify's address, continue.
2. Netlify, **Domain management**. The warning next to the domain should have gone. If not, click **Options**, then **Verify DNS configuration**.
3. Scroll to **HTTPS**. Click **Verify DNS configuration**, then **Provision certificate**. It usually completes in a minute. You want to see **Your site has HTTPS enabled**.
4. Next to `oppositenumber.ai` click **Options**, then **Set as primary domain**. Confirm.

### A6. Open the site to the public

1. **Project configuration**, then **Access & security**, then **Visitor access**.
2. Under **Site protection** click **Disable protection** (or set it to **Public**). Confirm.
3. Open https://oppositenumber.ai in a private browser window. You should see the site without a login prompt. Try https://www.oppositenumber.ai too; it should redirect to the non-www address.

### A7. Make sure enquiries reach you

1. Left menu: **Forms**. Confirm a form named `contact` is listed. If not, go to **Deploys**, **Trigger deploy**, **Deploy project**, then check again.
2. **Project configuration**, then **Notifications**, then **Emails and webhooks**. Click **Add notification**, then **Email notification**.
3. **Event to listen for**: New form submission. **Form**: contact. **Email to notify**: your address for now; change it to hello@oppositenumber.ai after Part B. Save.
4. Submit the form on the live site once. Check the email arrives. Also check **Forms**, then **contact** in Netlify to see the submission.

**Done when:** https://oppositenumber.ai loads with a padlock, www redirects, and a test enquiry arrives by email.

---

## Part B. Email and Google accounts on the domain

Do this before Business Profile and Ads so everything is owned by the business, not a personal Gmail.

### B1. Google Workspace

1. Go to https://workspace.google.com, click **Get started** (or **Start free trial**).
2. Business name: `OppositeNumber`. Number of employees: pick the band. Region: United Kingdom.
3. Your name and current email for contact.
4. When asked **Does your business have a domain?** choose **Yes, I have one I can use** and enter `oppositenumber.ai`.
5. Create the first user: `hello@oppositenumber.ai` with a strong password. This becomes the admin account. Add yourself as a second user later under **Directory**, then **Users**, then **Add new user**.
6. Choose the **Business Starter** plan.

### B2. Verify the domain and switch on Gmail

1. In the Workspace setup wizard click **Verify domain**. Google shows a TXT record starting `google-site-verification=`. Copy it.
2. Add it where DNS lives:
   - **If you chose Netlify DNS:** Netlify, **Domain management**, click `oppositenumber.ai` under **Netlify DNS**, then **Add new record**. Type `TXT`, Name `@`, Value the string from Google. Save.
   - **If DNS is at the registrar:** add the same TXT record in its DNS editor.
3. Back in Google click **Verify**. It can take a few minutes.
4. The wizard then shows **Activate Gmail** with five MX records. Add each one the same way:
   - MX, Name `@`, Priority `1`, Value `aspmx.l.google.com`
   - MX, `@`, `5`, `alt1.aspmx.l.google.com`
   - MX, `@`, `5`, `alt2.aspmx.l.google.com`
   - MX, `@`, `10`, `alt3.aspmx.l.google.com`
   - MX, `@`, `10`, `alt4.aspmx.l.google.com`
   (Some Workspace accounts show a single `smtp.google.com` record instead. Use whatever Google shows you.)
5. Click **Activate Gmail**. Send a test email to hello@oppositenumber.ai from another account and confirm it arrives.

### B3. Stop your email landing in spam (SPF, DKIM, DMARC)

1. Add a TXT record: Name `@`, Value `v=spf1 include:_spf.google.com ~all`.
2. Google Admin console (https://admin.google.com), **Apps**, **Google Workspace**, **Gmail**, **Authenticate email**. Click **Generate new record**, keep the defaults, click **Generate**. Copy the host name (`google._domainkey`) and the long value. Add it as a TXT record with that name and value. Back in Admin click **Start authentication**.
3. Add a TXT record: Name `_dmarc`, Value `v=DMARC1; p=none; rua=mailto:hello@oppositenumber.ai`.
4. Test at https://www.mail-tester.com by sending an email from hello@oppositenumber.ai to the address it gives you. Aim for 9/10 or better.

### B4. Analytics and Tag Manager (needed for Ads later)

1. Signed in as hello@oppositenumber.ai, go to https://tagmanager.google.com, **Create account**. Account name `OppositeNumber`, country UK, container name `oppositenumber.ai`, platform **Web**. Create. Copy the container ID, which looks like `GTM-XXXXXXX`.
2. Go to https://analytics.google.com, **Start measuring**. Account `OppositeNumber`, property `oppositenumber.ai`, time zone UK, currency GBP. Create a **Web** data stream for `https://oppositenumber.ai`. Copy the Measurement ID, which looks like `G-XXXXXXXXXX`.
3. In Tag Manager: **Tags**, **New**, choose **Google Tag**, paste the `G-` ID, trigger **All Pages**. Save, then **Submit**, then **Publish**.
4. In Netlify: **Project configuration**, **Environment variables**, **Add a variable**. Key `PUBLIC_GTM_ID`, value your `GTM-` ID. Save. Then **Deploys**, **Trigger deploy**, **Deploy project**.
5. Check: open the live site, then in Analytics go to **Reports**, **Realtime**. You should see yourself.

**Done when:** mail to and from hello@oppositenumber.ai works, mail-tester scores well, and Realtime shows a visit.

---

## Part C. Google Business Profile

**You need:** the studio address confirmed, a phone number that will be answered, and the hello@ login. Google will post a verification card to the address, so someone must be able to receive post there.

1. Signed in as hello@oppositenumber.ai, go to https://business.google.com, click **Manage now**.
2. **Business name:** `OppositeNumber`. Click **Continue**.
3. **Business type:** tick **Service business** and **Office** (customers can visit). Continue.
4. **Business category:** type and pick **Internet marketing service**. Continue. You will add more later.
5. **Add a location:** Yes. Enter `2 Guildford Park Road`, `Guildford`, `GU2 7ND`, United Kingdom. Continue. Drag the pin onto the building if asked.
6. **Service areas:** add Guildford, Farnham, Godalming, Woking, Haslemere, Cranleigh, Dorking, Camberley, Farnborough, Fleet, Aldershot, Weybridge, Leatherhead. Continue.
7. **Contact details:** phone number, website `https://oppositenumber.ai`. Continue.
8. **Verification:** choose **Postcard** (or video if offered and you prefer). The card arrives in 5 to 14 days with a five-digit code. When it comes, sign in, click **Enter code**.
9. While you wait, fill in the profile. From the dashboard:
   - **Edit profile**, **About**, **Description**: paste the first paragraph from the site's home page, then one line saying based in Guildford, working across Surrey and Hampshire.
   - **Edit profile**, **Categories**: add secondary categories **Software company**, **Website designer**, **Business management consultant**.
   - **Edit profile**, **Hours**: set your opening hours.
   - **Add photo**: logo (export `public/brand/mark.svg` to a 720 x 720 PNG), cover photo (the Thunderbolt-style team photo once you have your own), and three or four studio shots.
   - **Services**: add AI Opportunity Audit, 10-Day AI Sprint, Business Process Automation, AI Search Visibility, Website Development. Paste the one-line summaries from the site.
10. After verification: **Add update** once a week for the first month. Each case study is one update. Then **Ask for reviews** gives you a link; send it to Thunderbolt, Homeconcepts, 1minus1 and WBK.
11. Go to https://www.bingplaces.com, sign in with the Microsoft account of your choice, choose **Import from Google Business Profile**. Five minutes, and Bing is done.

**Done when:** searching `OppositeNumber Guildford` on Google shows the profile panel on the right with address, hours and website.

---

## Part D. Social channels

Use hello@oppositenumber.ai for every sign-up. Use the same name, logo and short description everywhere. Suggested handle `oppositenumberai`; if taken, `oppositenumber_ai`.

Profile text to paste: `AI & digital product studio in Guildford. We find where AI pays back, prove it in a fixed-price sprint, then build and run it. Working across Surrey and Hampshire.`

### D1. LinkedIn company page (highest priority)

1. Log in to your personal LinkedIn. Top right **For Business**, then **Create a Company Page**, then **Company**.
2. Name `OppositeNumber`, public URL `linkedin.com/company/oppositenumberai`, website `https://oppositenumber.ai`, industry **IT Services and IT Consulting**, size, type **Privately held**.
3. Tagline: `AI that ships. Products that last.` Upload the logo. Tick the verification box, click **Create page**.
4. **Edit page**: add the About text, location (the Guildford address), specialities (AI consultancy, AI automation, AI search visibility, web development, design systems).
5. Invite connections to follow. Post each case study with its photo over the first fortnight. Ask every team member to add OppositeNumber as their current employer.

### D2. Instagram

1. In the Instagram app, **Sign up** with hello@oppositenumber.ai. Username `oppositenumberai`.
2. **Edit profile**, **Switch to professional account**, choose **Business**, category **Marketing Agency**. Add the website link and the Guildford address.
3. Post the four case study photos as the first grid, then studio and team shots.

### D3. Facebook page

1. Log in to Facebook, **Pages**, **Create new page**. Name `OppositeNumber`, category **Marketing Agency** and **Software Company**. Add the bio text, website, address, phone, hours.
2. Link Instagram: **Settings**, **Linked accounts**, **Instagram**, connect. Posts can then go to both.

### D4. YouTube

1. Signed in as hello@oppositenumber.ai, go to https://www.youtube.com, click your avatar, **Create a channel**. Name `OppositeNumber`, handle `@oppositenumberai`.
2. Upload the showreel when it exists. Copy its video ID into `src/data/site.ts` under `showreel.youtubeId` and the home page plays it.

### D5. X

1. Sign up at https://x.com with hello@oppositenumber.ai, handle `oppositenumberai`. Add logo, bio, link. This is to hold the name; posting is optional.

### D6. Put the links on the website

Send me the final URLs, or edit `src/data/site.ts` under `social` yourself. They appear in the footer and in the structured data Google uses to connect the profiles.

### D7. Local directories (ten minutes each, do once)

Surrey Chambers of Commerce, Guildford Business Forum, Yell.com, Clutch.co, DesignRush. Same name, address, phone and website on each. Consistency matters more than volume.

---

## Part E. Google Ads

Only start after Parts A to C are complete and you have received at least one real test enquiry by email.

### E1. Account

1. Signed in as hello@oppositenumber.ai, go to https://ads.google.com, click **Start now**.
2. When it tries to build a campaign immediately, look for the small link **Switch to Expert Mode** (sometimes **Are you a professional marketer?**). Click it. Then **Create an account without a campaign**. Confirm UK, GMT, GBP. **Submit**.
3. **Tools** (spanner icon), **Data manager** or **Linked accounts**: link **Google Analytics** and **Google Business Profile**.
4. **Billing**: add a card. Set payment to **Automatic payments**.

### E2. Conversion tracking

1. **Goals**, **Conversions**, **New conversion action**, **Website**. Enter `oppositenumber.ai`, scan.
2. Choose **Add a conversion action manually**. Category **Submit lead form**, name `Contact form`, value **Don't use a value**, count **One**.
3. On the next screen choose **Use Google Tag Manager**. Copy the Conversion ID and Conversion Label.
4. In Tag Manager: **Tags**, **New**, type **Google Ads Conversion Tracking**, paste ID and label. Trigger: **New**, **Page View**, **Some page views**, condition **Page Path equals /thanks**. Save, **Submit**, **Publish**.
5. Test: submit the live contact form, wait a few hours, check **Goals**, **Conversions** shows status **Recording conversions**.

### E3. First campaign

1. **Campaigns**, **New campaign**, objective **Leads**, type **Search**. Untick **Search Partners** and **Display Network** when offered.
2. Campaign name `Search – Surrey AI`. **Locations**: **Enter another location**, type `Guildford`, click **Nearby**, choose **Radius**, set 25 miles. Target **Presence** (people in or regularly in the area), not **Interest**. Language English.
3. **Bidding**: Maximise clicks with a max CPC cap of £4 for the first fortnight, then switch to Maximise conversions once you have 15 or more conversions.
4. **Budget**: £25 a day.
5. Ad groups and keywords. Use phrase match (in quotes) and exact match (in square brackets). Point each group at the page shown.
   - **AI consultancy** → https://oppositenumber.ai/ai-services : `"ai consultancy surrey"`, `[ai consultant guildford]`, `"ai agency surrey"`, `"ai automation for small business"`, `"ai consultancy near me"`.
   - **AI search visibility** → https://oppositenumber.ai/services/ai-search-visibility : `"ai search optimisation"`, `"generative engine optimisation"`, `"get found on chatgpt"`, `"geo agency"`.
   - **Web design** → https://oppositenumber.ai/digital-services : `"web design agency guildford"`, `"web development surrey"`, `[website design guildford]`.
   - **Farnham** → https://oppositenumber.ai/locations/farnham : `"ai consultant farnham"`, `"web design farnham"`. Repeat the pattern for Woking and Godalming if budget allows.
6. **Negative keywords** at campaign level: `jobs`, `job`, `career`, `salary`, `course`, `courses`, `training`, `free`, `tutorial`, `degree`, `university`, `definition`, `what is`.
7. Ads: one Responsive Search Ad per group. Headlines to use and mix: `AI Consultancy in Guildford`, `Fixed-Price 10-Day AI Sprint`, `Working AI in 10 Days`, `Serving Surrey & Hampshire`, `No Hype, Measured Results`, `Book a 30-Minute Call`. Descriptions: `We find where AI pays back, prove it in a fixed-price sprint, then build and run it. Based in Guildford.` and `Senior team, published prices, your code and data stay yours. Talk to us about AI and digital.`
8. **Assets**: add sitelinks to Approach & Pricing, Work, AI Readiness Scorecard and Contact. Add a call asset with your phone number. Add the location asset by linking Business Profile.
9. Publish. Check daily for the first week under **Insights and reports**, **Search terms**. Add anything irrelevant as a negative keyword.
10. After 30 days: pause keywords with 50 or more clicks and no conversions. Raise budget on groups that converted.

---

## Part F. Final checks before telling customers

- `/approach`: replace the placeholder prices or ask me to hide them.
- `/team` and testimonials: replace placeholders.
- `/privacy` and `/terms`: add company number, registered office, ICO registration number.
- Google Search Console: https://search.google.com/search-console, add property `oppositenumber.ai` (Domain type), verify with the TXT record it gives you, then **Sitemaps**, submit `sitemap-index.xml`.
- Bing Webmaster Tools: https://www.bing.com/webmasters, **Import from Google Search Console**.
