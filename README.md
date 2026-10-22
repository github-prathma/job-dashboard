# Job Search Command Center

**Try it:** https://github-prathma.github.io/job-dashboard/ (sign in with any Google account, or click **Or look around with sample data first**).

![Demo: sign in, overview, analytics, jobs, LinkedIn outreach, agent drafts and the dark theme](docs/demo.gif)

*A one-minute tour using sample data. [Watch the full-quality video (MP4)](docs/demo.mp4).*

A personal dashboard for your job search. It shows the jobs your agents found, a tailored resume for each one, people to contact for a referral, and charts of how your search is going. It also helps you write LinkedIn messages.

**Your data stays in your own Google Drive.** The website holds no data. The first time you sign in, it creates a **Job Agent** folder in your Drive with everything it needs. Google only lets the app open the files it created there; it can't see anything else in your Drive.

**Nothing is sent for you.** The dashboard and the agents prepare everything; you apply and send messages yourself.

---

## How it works

```
 Claude agents (run twice a day)          Your Google Drive                     This dashboard
 ─────────────────────────────            ─────────────────                     ──────────────
 1. Find new job postings        ──►   Job Application Tracker (sheet)   ──►   Jobs, charts, "Next up"
 2. Tailor your resume per job   ──►   Tailored Resumes/<Company>/        ──►   Resume buttons
 3. Find people + draft messages ──►   Outreach tab + draft docs          ──►   Agent drafts page
 4. Log the run                  ──►   Runs tab + Run Logs/               ──►   Files and runs page
```



---

## Getting started (about 5 minutes)

No coding, no Google Cloud, no API keys.

1. **Open the site** and click **Sign in with Google**. Use any Google account; Google asks you to let the app "see, edit, create and delete only the specific Google Drive files you use with this app". That's the narrowest Drive permission Google offers.
2. **Answer the setup questions** (name, the roles you want, your resume, a few highlights). The wizard then creates this in your Drive:

   | In your **Job Agent** folder | What it's for |
   |---|---|
   | Job Application Tracker (Google Sheet) | Tabs: **Jobs** (one row per job), **Outreach** (drafted messages), **Runs** (one row per agent run), **Profile** (your details for messages) |
   | SEARCH CONFIG (edit me) | Your rules for the agents: roles, locations, companies, templates |
   | BASE RESUME | Your resume. Edit it any time; the agents always read the latest version |
   | Tailored Resumes, Referral Outreach Drafts, Run Logs | Folders the agents fill |

3. **Turn on the agents** (optional, but this is what finds jobs for you). They run in [Claude](https://claude.ai) as a scheduled task:
   - In Claude, turn on the **Google Drive**, **Google Docs** and **Google Sheets** connectors.
   - On the last setup screen (or later on **Files and runs**), click **Copy agent instructions**. They already contain your file IDs.
   - In a new Claude chat, type *"Create a scheduled task that runs every day at 7:45 AM and 5:45 PM with these instructions:"* and paste.

   Without the agents, the dashboard still works: type jobs into the **Jobs** tab yourself.

**To change your details later,** edit the **Profile** tab of your tracker (Files and runs → **Edit my profile**). Search rules live in the SEARCH CONFIG doc.

---

## Using the dashboard every day

| Page | What you do there |
|---|---|
| **Overview** | See today's numbers and **Next up**: the best jobs to apply to now, with buttons for Apply, Resume, Outreach and Connections. |
| **Analytics** | Charts: your funnel (prepared → applied → interviewing → offer), jobs per day, match scores, top companies, sources. |
| **All jobs** | Search and filter every job. Each row has Apply, Resume, Folder and People buttons. |
| **LinkedIn outreach** | Write a message: enter the person, company and job, pick **InMail**, **Connection note** (300 characters max) or **Message**, then click **Draft messages**. Paste the job link (Greenhouse, Lever or Ashby) and the drafts mention skills from that job that are also in your resume. |
| **Agent drafts** | Messages the agents prepared, grouped by job. Copy, open the person's profile, send it on LinkedIn, then click **Mark as sent**. |
| **Files and runs** | Recent runs, links to your Drive files, and **Copy agent instructions**. |

**Light or dark?** Use the sun / screen / moon switch at the bottom of the sidebar (or top-right of the sign-in page). The screen icon follows your device setting.

**To update a job's status,** change the Status column in the **Jobs** tab of your tracker. The dashboard refreshes every 5 minutes, when you come back to the tab, or when you click **Refresh**.

### Finding people to ask for referrals
Every job has **Find people** buttons that open LinkedIn's own search in your browser, filtered to people **currently at that company** and **in the US**:
- **Your connections** (1st-degree): ask for a referral directly.
- **2nd-degree**: ask a mutual connection to introduce you.
- **Alumni**: people from your schools.
- **Ex-colleagues**: people who worked where you did.

If someone from a similarly named company shows up, click **Current company** on LinkedIn and pick the exact company page.

### One-click drafting from a LinkedIn profile (bookmarklet)
1. On the **LinkedIn outreach** page, drag the **Draft with Job Agent** button to your browser's bookmarks bar (in Chrome, show the bar with Cmd+Shift+B or Ctrl+Shift+B).
2. On the dashboard, click any **Find people** button for a job. The dashboard remembers that job.
3. Open someone's LinkedIn profile and click the bookmark. The message page opens with their name, profile link, the job, their role and the right message type already filled in.

It only reads the profile you're looking at, and only when you click it. It works in desktop browsers, not on phones. Keep the dashboard tab open so you stay signed in.

---

## Common questions

**Google says "This app isn't verified" or "Access blocked".**
The person who hosts the site hasn't finished the one-time Google Cloud setup below (the app must be **In production** and ask only for the `drive.file` permission).

**I signed in and see the setup questions again.**
You're signed in with a different Google account than the one you set up with, or the tracker was deleted. Each Google account gets its own workspace.

**My changes don't show up.**
The dashboard refreshes every 5 minutes, when you come back to the tab, or when you click **Refresh**. After a code change, GitHub Pages takes about a minute; then hard-refresh (Cmd+Shift+R or Ctrl+Shift+R).

**What's saved in my browser?**
Only small conveniences: your light/dark choice, which drafts you marked sent, your sent-message log, and the job you picked last. Clearing site data resets them. Your sign-in lasts about an hour.

**Is my data public?**
No. The website code is public, but it holds no data. Your files are private in your own Drive.

---

## Hosting your own copy (only for the person who runs the site)

Everyone else can skip this. You do it once, and then anyone can sign in.

1. **Fork** this repo, then **Settings → Pages**: Deploy from a branch, **main**, **/ (root)**. Your site is `https://<your-github-username>.github.io/job-dashboard/`.
2. In https://console.cloud.google.com create a project, then **APIs & Services → Library**: enable **Google Drive API** and **Google Sheets API**.
3. **Google Auth Platform**:
   - **Branding**: app name (e.g. "Job Agent"), support email, and your site address as the home page.
   - **Audience**: user type **External**, then click **Publish app** so the status is **In production**. No test users needed.
   - **Data access**: add only `https://www.googleapis.com/auth/drive.file`. Google treats it as non-sensitive, so the app doesn't need Google's review.
   - **Clients → Create client**: type **Web application**, Authorized JavaScript origins `https://<your-github-username>.github.io` (no path, no trailing slash).
4. Put the client ID in `config.js` → `GOOGLE_CLIENT_ID` and commit.

The client ID isn't a secret: Google only accepts it from the site address you listed.

---

## Files in this repo
| File | What it is |
|---|---|
| `index.html` | The page layout and styles |
| `app.js` | Sign-in, loading data, charts, and the pages |
| `setup.js` | The first-time setup wizard that creates your Drive workspace |
| `config.js` | Site-wide settings: Google client ID and default limits |
| `outreach.js` | How LinkedIn messages are written (your facts come from the Profile tab) |
| `agent/agent-prompt.md` | Template for the agent instructions (the wizard fills it in for you) |
| `agent/search-config-template.md` | What the SEARCH CONFIG doc covers |
| `docs/demo.gif`, `docs/demo.mp4` | The demo shown at the top of this page |
