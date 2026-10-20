# Job Search Command Center

A private dashboard for the job search agents. The page itself is public on GitHub Pages, but it holds no data: you sign in with Google and it reads the tracker sheet and run logs straight from your Drive into your browser. Nothing is stored on GitHub.

## What you need in Google Drive

The dashboard reads two things live (a tracker sheet and a run-logs folder) and links to five more. All of them live in one Drive folder owned by the Google account you sign in with.

### Folder layout

```
Job Agent/                              (any name; linked as "Job Agent folder")
├── Job Application Tracker             Google Sheet   — READ by the dashboard
├── Run Logs/                           Folder         — READ by the dashboard
│   ├── Run 2026-10-20 07:43 PT         Google Docs written by the agents
│   └── ...
├── SEARCH CONFIG (edit me)             Google Doc     — linked only
├── BASE RESUME - <your name>           Google Doc     — linked only
├── Tailored Resumes/                   Folder         — linked only (one subfolder per company)
└── Referral Outreach Drafts/           Folder         — linked only
```

"Linked only" items just need to exist so the buttons open them; the dashboard never reads their contents.

### 1. Tracker sheet (required)

A Google Sheet whose **first tab** has this header row in **row 1, columns A to P, in this exact order and spelling**:

| Col | Header | What goes in it |
|---|---|---|
| A | Date Found | `YYYY-MM-DD` (Pacific date). Store as text (type it with a leading `'`) so Sheets doesn't reformat it. Drives "Prepared today" and the per-day chart. |
| B | Company | Company name. Drives "Top companies". |
| C | Job Title | Role name; becomes the link to the posting. |
| D | Location | Free text. |
| E | Job Link | Full `https://` URL to the posting. Used by **Apply**. |
| F | Source | Where it was found (Greenhouse, Ashby, LinkedIn…). |
| G | Posted At | `YYYY-MM-DD HH:mm`, as text. |
| H | Match Score | Plain number 0–100. Colored green at 85+, blue at 75+. |
| I | Sponsorship Signal | e.g. `Not stated`, `Sponsors`. |
| J | H-1B History | e.g. `Strong`, `Some`, `None found`. |
| K | Tailored Resume Link | `https://` link to the tailored resume. Used by **Resume**. |
| L | Company Folder | `https://` link to the company's resume folder. Used by **Folder**. |
| M | Outreach Drafts Link | `https://` link to the outreach doc. Used by **Outreach**. |
| N | Status | One of: `Ready to apply`, `Applied`, `Referral requested`, `Interviewing`, `Offer`, `Rejected`, `Skipped`. Blank counts as Ready to apply. A dropdown with these values is recommended (Data → Data validation). |
| O | Date Applied | `YYYY-MM-DD` (yours to fill in). |
| P | Missing Keywords / Notes | Free text. |

How the statuses roll up in the pipeline: **Applied** counts Applied, Referral requested, Interviewing, Offer and Rejected; **Interviewing** counts Interviewing and Offer; **Skipped** is left out of Prepared. Up to 999 job rows are read (range `A1:P1000`, set in `config.js`).

Links that are empty or don't start with `https://` show as greyed-out buttons.

### 2. Run Logs folder (required)

A Drive folder holding one **Google Doc** per agent run, titled starting with **`Run `** (capital R, then a space), e.g. `Run 2026-10-20 07:43 PT`. The dashboard lists the 8 newest by creation time. Other files in the folder (such as the agents' `seen-jobs` list) are ignored. An empty folder is fine; the card says no runs yet.

### 3. IDs and links in `config.js`

Copy each ID from the item's address bar:

| Setting | Comes from | Example URL → ID |
|---|---|---|
| `TRACKER_SHEET_ID` | the tracker sheet | `docs.google.com/spreadsheets/d/`**`1PUw…nhGM`**`/edit` |
| `RUN_LOGS_FOLDER_ID` | the Run Logs folder | `drive.google.com/drive/folders/`**`1n6L…v0s`** |
| `LINKS.*` | full URLs of the config doc, base resume, the two output folders, and the main folder | paste the whole URL |
| `GOOGLE_ACCOUNT_HINT` | the email that owns (or can view) the files | `prathma0909@gmail.com` |

### 4. Access

- Sign in with a Google account that **owns or can view** the tracker and the Run Logs folder. Any other account loads nothing and shows a "could not load data" message.
- That account must be listed as a **Test user** on the OAuth consent screen (step 2 below) while the app is in Testing.
- The dashboard asks only for read-only access: `spreadsheets.readonly` (to read the tracker) and `drive.metadata.readonly` (to list run-log titles and links, not their contents). It cannot edit or delete anything.
- Nothing in Drive needs to be shared publicly or "published to the web".

## One-time setup

### 1. Turn on GitHub Pages
Repo **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, Branch **main**, folder **/ (root)**. Your site will be at https://github-prathma.github.io/job-dashboard/.

### 2. Create a Google OAuth client ID (about 10 minutes)
Sign in to https://console.cloud.google.com with any Google account (it does not have to be the one that owns the files).

1. Create a project, for example "Job Dashboard".
2. **APIs & Services → Library**: enable **Google Sheets API** and **Google Drive API**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type **External**, app name "Job Dashboard", your email as support and developer contact.
   - Data access / scopes: add `.../auth/spreadsheets.readonly` and `.../auth/drive.metadata.readonly`.
   - Audience → **Test users**: add `prathma0909@gmail.com` (the account that owns the tracker).
   - Leave the app in **Testing**. You will see an "unverified app" notice when signing in; that is expected for a personal app.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - Authorized JavaScript origins: `https://github-prathma.github.io` (no path, no trailing slash).
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) into `config.js` → `GOOGLE_CLIENT_ID`.

The client ID is not a secret: Google only honors it from the origins you listed.

## Using it
- Open the site and click **Sign in with Google**, choosing `prathma0909@gmail.com`.
- Data loads live from the tracker. It refreshes every 5 minutes while the tab is open, when you come back to the tab, and when you click **Refresh data**.
- Before the first agent run, use **Preview with sample data** (in the Next up card) to see the layout with made-up jobs. A banner marks sample mode; **Show my data** switches back.
- **LinkedIn outreach** page: enter a person, company and job title, choose InMail or Connection note, and get two drafts to edit and copy. Paste the job link (Greenhouse, Lever or Ashby) or the job description and the drafts name skills from the posting that are also on your resume. Connection notes are kept within LinkedIn's 300-character limit, and a counter tracks your 5 InMails a day. The **Message** button on any row in All jobs opens this page prefilled. The sent log lives in your browser only.
- **Agent drafts** page: every person the agents found for each job, grouped by job, with a badge for 1st-degree connection, recruiter or hiring manager. Copy the message, open their profile, and mark it sent (InMails count toward the daily 5). Filter to **Your connections** for referral asks. Drafts come from the tracker's **Outreach** tab, which the agents fill after each run; sent marks are kept in this browser.
- To change a status, edit the tracker sheet (the Status column has a dropdown). The dashboard is read-only.
- Sign-in lasts about an hour per tab; after that Google asks again silently or with one click.

## Files
- `index.html` – layout and styles
- `app.js` – Google sign-in, data loading and charts
- `config.js` – client ID, file IDs, links and limits (edit this to change settings)
- `outreach.js` – LinkedIn message wording and the resume facts it draws from (edit to change tone or add highlights)
