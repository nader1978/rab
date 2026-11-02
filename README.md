# RAB Sales & Expenses System

HTML / SharePoint version of `Sales_Expenses_App.accdb`, laid out like NFPC SC Mngt Support System, with the RAB logo and its green · charcoal · gold colour theme (default; other themes in Settings → Personal Settings).
Every Access table is a SharePoint list; every Access form is a page.

## Files
| File | What it is |
|---|---|
| `index.html` | The page (login, side panel, top bar) |
| `css/app.css` | All styles — base + SC Mngt theme layer + RAB logo theme (green · charcoal · gold) |
| `js/00-config.js` | **Edit this** — Tenant ID, Client ID, Site URL, system name/logo for every user, logo file names |
| `js/01-core.js` | Helpers + the SharePoint list schema (tables & columns) |
| `js/02-data.js` | Microsoft sign-in, Microsoft Graph, SharePoint lists, demo data store, users & roles |
| `js/03-ui.js` | Form engine, grids, Excel import/export, charts |
| `js/04-logic.js` | Business rules (totals, numbering, payments, P&L posting) + demo data |
| `js/05-pages-transactions.js` | Dashboard, Invoices/Purchases/Payment page |
| `js/06-pages-lists.js` | Transactions list, Payment Window, P&L, overviews |
| `js/07-pages-inquiries.js` | Incoming inquiry, inquiry list, alarms |
| `js/08-reports.js` | Printable reports (invoice, voucher, SOA, aged, P&L, ledger) |
| `js/09-admin-boot.js` | Employees, users, company, banks, masters, settings, switchboard, start-up |
| `img/` | RAB logo: `rab-icon.png` (side panel / top bar), `rab-logo.png` (sign-in page, switchboard), `favicon.png` — replace the files to change the logo |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

Keep the folder structure as it is — `index.html` loads `css/` and `js/` by relative path, and the
scripts must load in the order listed in `index.html`.

## Publish on GitHub Pages
1. Create a repository in the **same GitHub account as SC Mngt** (e.g. `rab`), so both share the
   connection settings (`https://nader1978.github.io/...`).
2. Upload everything in this folder (including `.nojekyll`) to the root of the repository.
3. Repository → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
4. After ~1 minute the site is at `https://<account>.github.io/<repo>/`.
5. Azure → App registrations → your app → **Authentication** → **Single-page application** → add
   `https://<account>.github.io/<repo>/` **and** `https://<account>.github.io/<repo>/index.html`.
   (Not under *Web* — that gives error AADSTS9002326.)
6. Open the site → sign in → **Settings**. If SC Mngt is already configured on the same account,
   the IDs are filled in. Otherwise enter them (or put them in `js/00-config.js`).
7. First time only: **Settings → Create / repair all lists**, then import your Access tables.

## Run locally
Microsoft sign-in does not work from a double-clicked file. Run a small web server in this folder:
`python -m http.server 8080` → open `http://localhost:8080/` (add `http://localhost:8080/` as a
Single-page application redirect URI). Opened as a plain file, the page works with demo data only.

## Demo sign-in
Demo mode (no SharePoint): `admin` / `admin`, `mohammad` / `1234` (User), `sara` / `1234` (Accounts).
