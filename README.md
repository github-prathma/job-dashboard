# Job Search Command Center

**Live demo:** https://github-prathma.github.io/job-dashboard/ (sign-in only works for accounts added as test users; click **Preview with sample data** after signing in to see the layout).

A personal dashboard for your job search. It shows the jobs your agents found, a tailored resume for each one, people to contact for a referral, and charts of how your search is going. It also helps you write LinkedIn messages.

**Your data stays in your own Google Drive.** The website holds no data. When you sign in with Google, your browser reads your tracker sheet directly from Drive. The dashboard can only *read*; it can't change or delete anything.

**Nothing is sent for you.** The dashboard and the agents prepare everything; you apply and send messages yourself.

---

## How it works

```
 Claude agents (run twice a day)          Your Google Drive                     This dashboard
 ─────────────────────────────            ─────────────────                     ──────────────
 1. Find new job postings        ──►   Job Application Tracker (sheet)   ──►   Jobs, charts, "Next up"
 2. Tailor your resume per job   ──►   Tailored Resumes/<Company>/        ──►   Resume buttons
 3. Find people + draft messages ──►   Outreach tab + draft docs          ──►   Agent drafts page
 4. Write a run log              ──►   Run Logs/                          ──►   Files page
```

You can use the dashboard without the agents too: type jobs into the sheet yourself and the dashboard still works.

---

## Setup (about 30 minutes, once)

### Step 1. Copy this repo
Click **Fork** at the top of this page on GitHub. You now have your own copy, e.g. `github.com/<you>/job-dashboard`.

### Step 2. Set up your Google Drive
Create one folder in Google Drive (for example "Job Agent") with these items inside:

| Name | Type | What it's for |
|---|---|---|
| Job Application Tracker | Google Sheet | One row per job. **The dashboard reads this.** |
| Run Logs | Folder | One Google Doc per agent run. **The dashboard lists these.** |
| SEARCH CONFIG (edit me) | Google Doc | Your rules for the agents. Start from [`agent/search-config-template.md`](agent/search-config-template.md). |
| BASE RESUME | Google Doc | Your resume. Update it any time; the agents always read the latest version. |
| Tailored Resumes | Folder | The agents save one resume per job here, in a folder per company. |
| Referral Outreach Drafts | Folder | The agents save outreach drafts here. |

**The tracker sheet.** In the first tab, type these 16 headers into row 1, columns A to P, exactly as written:

```
Date Found | Company | Job Title | Location | Job Link | Source | Posted At | Match Score | Sponsorship Signal | H-1B History | Tailored Resume Link | Company Folder | Outreach Drafts Link | Status | Date Applied | Missing Keywords / Notes
```

Tips:
- **Dates** look like `2026-10-20`. Type a `'` first (`'2026-10-20`) so Sheets doesn't change the format.
- **Match Score** is a number from 0 to 100.
- **Links** must start with `https://`.
- **Status** is one of: `Ready to apply`, `Applied`, `Referral requested`, `Interviewing`, `Offer`, `Rejected`, `Skipped`. Add a dropdown with these values (select column N → Data → Data validation). An empty status counts as Ready to apply.

**The Outreach tab (optional).** Add a second tab named exactly `Outreach` with these 13 headers in row 1:

```
Date Drafted | Company | Job Title | Job Link | Person | Person Title | Relationship | Found Via | Profile URL | Message Type | Subject | Message | Draft ID
```

- Relationship is one of `Your connection`, `Recruiter`, `Hiring manager`, `Engineer`.
- Message Type is one of `InMail`, `Connection note`, `Message`.

Without this tab, the Agent drafts page is simply empty.

### Step 3. Create a Google sign-in key (OAuth client ID)
This lets the dashboard ask Google for permission to read your sheet. It's free.

1. Go to https://console.cloud.google.com and create a project (any name, e.g. "Job Dashboard").
2. **APIs & Services → Library**: turn on **Google Sheets API** and **Google Drive API**.
3. **Google Auth Platform / OAuth consent screen**:
   - Choose **External**. App name: "Job Dashboard". Use your email for the contact fields.
   - Under **Audience → Test users**, add the Google account that owns your Drive folder.
   - Leave the app in **Testing**. You'll see an "unverified app" warning when signing in. That's normal for a personal app; click **Continue**.
4. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: `https://<your-github-username>.github.io` (no path, no slash at the end).
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).

The client ID is not a password. Google only accepts it from the website address you entered above.

### Step 4. Fill in `config.js`
Open `config.js` in your fork (click the file, then the pencil icon) and change:

| Setting | What to put |
|---|---|
| `GOOGLE_CLIENT_ID` | The Client ID from step 3 |
| `YOUR_NAME` | Your first name, for the greeting |
| `RUN_TIMES` | When your agents run (only shown as text) |
| `GOOGLE_ACCOUNT_HINT` | The Google email that owns your Drive folder |
| `TRACKER_SHEET_ID` | The long ID in the sheet's address: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` |
| `RUN_LOGS_FOLDER_ID` | The ID in the Run Logs folder's address: `drive.google.com/drive/folders/`**`THIS_PART`** |
| `LINKS` | Full web addresses of your config doc, resume, the two output folders and the main folder |
| `DAILY_LIMIT`, `INMAIL_DAILY_LIMIT` | Jobs per day and LinkedIn InMails per day (used for progress bars) |

Click **Commit changes** to save.

### Step 5. Make the LinkedIn messages sound like you (`outreach.js`)
The message writer only uses facts you put in this file, so it never makes things up. Edit:
- `ME`: your name, a one-line pitch, and (optional) a work-authorization line that's only used for recruiters. If you don't need one, set `sponsorship` and `shortSponsorship` to `''`.
- `HIGHLIGHTS`: 4–8 true achievements from your resume, each with keywords. The writer picks the ones that best match the job.
- `SCHOOLS`, `PAST_EMPLOYERS` and their labels: used by the "Alumni" and "Ex-colleagues" search buttons.

### Step 6. Publish it with GitHub Pages
In your fork: **Settings → Pages**. Under **Build and deployment** choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**. After a minute your dashboard is at:

`https://<your-github-username>.github.io/job-dashboard/`

Open it and click **Sign in with Google**. Before you have any data, click **Preview with sample data** to see how it looks.

### Step 7 (optional). Set up the agents
The agents run in [Claude](https://claude.ai) as a **scheduled task** and need the Google Drive, Google Docs and Google Sheets connectors turned on.

1. Open [`agent/agent-prompt.md`](agent/agent-prompt.md) and replace every `<...>` placeholder with your name and your Drive IDs (same IDs as step 4, plus your config doc, resume and folders).
2. In Claude, ask it to create a scheduled task that runs twice a day with that prompt, or paste the prompt into a new scheduled task yourself.
3. After the first run, refresh the dashboard: new jobs, resumes and drafts appear.

---

## Using the dashboard every day

| Page | What you do there |
|---|---|
| **Overview** | See today's numbers and **Next up**: the best jobs to apply to now, with buttons for Apply, Resume, Outreach and Connections. |
| **Analytics** | Charts: your funnel (prepared → applied → interviewing → offer), jobs per day, match scores, top companies, sources. |
| **All jobs** | Search and filter every job. Each row has Apply, Resume, Folder and People buttons. |
| **LinkedIn outreach** | Write a message: enter the person, company and job, pick **InMail**, **Connection note** (300 characters max) or **Message**, then click **Draft messages**. Paste the job link (Greenhouse, Lever or Ashby) and the drafts mention skills from that job that are also in your resume. |
| **Agent drafts** | Messages the agents prepared, grouped by job. Copy, open the person's profile, send it on LinkedIn, then click **Mark as sent**. |
| **Files and runs** | Recent run logs and links to your Drive files. |

**Light or dark?** Use the sun / screen / moon switch at the bottom of the sidebar (or top-right of the sign-in page). The screen icon follows your device setting.

**To update a job's status,** change the Status column in the sheet. The dashboard refreshes every 5 minutes, when you come back to the tab, or when you click **Refresh**.

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

**"Could not load data" after signing in.**
You signed in with an account that can't open the tracker, or the IDs in `config.js` are wrong. Use the account that owns the Drive folder and check that it's a Test user (step 3).

**"Access blocked" or "redirect/origin mismatch" from Google.**
The JavaScript origin in step 3 must be exactly `https://<your-github-username>.github.io`, with no path and no slash at the end.

**My changes don't show up.**
GitHub Pages takes about a minute after a commit. Then hard-refresh (Cmd+Shift+R or Ctrl+Shift+R).

**What's saved in my browser?**
Only small conveniences: your light/dark choice, which drafts you marked sent, your sent-message log, and the job you picked last. Clearing site data resets them. Your sign-in lasts about an hour.

**Is my data public?**
No. The website code is public, but it holds no data. Only someone who signs in with an account that can open your sheet sees anything.

---

## Files in this repo
| File | What it is |
|---|---|
| `index.html` | The page layout and styles |
| `app.js` | Sign-in, loading data, charts, and the pages |
| `config.js` | **Your settings**: client ID, sheet and folder IDs, links, limits |
| `outreach.js` | **Your message facts**: pitch, highlights, schools, past employers |
| `agent/agent-prompt.md` | Prompt for the scheduled Claude agents (fill in the placeholders) |
| `agent/search-config-template.md` | Starting point for your SEARCH CONFIG doc |
