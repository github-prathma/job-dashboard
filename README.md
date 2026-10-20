# Job Search Command Center

A private dashboard for the job search agents. The page itself is public on GitHub Pages, but it holds no data: you sign in with Google and it reads the tracker sheet and run logs straight from your Drive into your browser. Nothing is stored on GitHub.

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
- To change a status, edit the tracker sheet (the Status column has a dropdown). The dashboard is read-only.
- Sign-in lasts about an hour per tab; after that Google asks again silently or with one click.

## Files
- `index.html` – layout and styles
- `app.js` – Google sign-in, data loading and charts
- `config.js` – client ID, file IDs, links and limits (edit this to change settings)
