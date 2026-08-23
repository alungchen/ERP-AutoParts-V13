---
name: erp-operations
description: Automates and manages ERP AutoParts V13 tasks such as database synchronization, background missing parts scraping, historical documents migration, daily XLS/XLSX report import, and photo migration to Cloudflare R2. Use this when performing administrative, scraping, or database tasks for the ERP AutoParts project.
---
# ERP AutoParts Operational Playbook

This skill outlines how to run scraping, database sync, report imports, and file migration tasks in the `ERP-AutoParts-V13` project. Use this whenever the user asks you to update data, sync databases, pull external parts details, or run standard operations scripts.

## Core Operations

### 1. Scrape Missing Parts Data (Background Crawler)
When documents are imported, parts may exist only by ID without brand, model, or description. Run the background scraper to search external sites and auto-populate details in D1.

- **Full scan (background execution)**:
  ```bash
  node scripts/scrape_all_missing_bg.cjs
  ```
- **Filter by specific date**:
  ```bash
  node scripts/scrape_all_missing_bg.cjs --date=2026-06-09
  ```
- **Filter by date range**:
  ```bash
  node scripts/scrape_all_missing_bg.cjs --start-date=2026-06-01 --end-date=2026-06-30
  ```
- **Filter by whole month**:
  ```bash
  node scripts/scrape_all_missing_bg.cjs --month=2026-06
  ```

#### Flow & Troubleshooting:
1. `prepare_missing_batch.cjs` queries D1 for parts present in documents but missing from product registry, batching 30 items into `keywords.txt`.
2. `run_all.cjs --headless` launches Puppeteer, logs into the external catalog, scrapes details, writes to D1, downloads photos, and uploads them to Cloudflare R2.
3. **Session Expiry (Exit Code 2)**: If login fails:
   - Run `node scripts/run_all.cjs` (without `--headless`) to open Chrome.
   - Manually solve challenges/login.
   - Close the browser and restart the background script.

---

### 2. Import Daily XLS/XLSX Reports
Import transaction sheets from branches into D1 database.

- **Upload to Cloud (Production)**:
  ```bash
  node scripts/import_daily_report_xls.cjs --branch=xizhi --remote
  ```
- **Import to Local Developer Environment**:
  ```bash
  node scripts/import_daily_report_xls.cjs --branch=xizhi
  ```
- **Branch Parameters**: `xizhi` (default), `songshan`, `linkou`.
- **Target File Input**:
  - **Single File**: Rename to `list_to_upload.xls` (or `.xlsx`) and place in root.
  - **Directory / Multiple Files**: Put multiple Excel files in root (e.g. `20251231.xls`, etc.). The script automatically parses all of them.
  - **Custom Paths**: Pass `--file="path1.xls,path2.xls"` or `--file="D:\Downloads"`.

---

### 3. Photo Scraper & Cloudflare R2 Migration
Scrape photos for new products and move them to Cloudflare R2.

- **Step 1: Scrape Photo URLs**:
  Reads keywords from `keywords.txt` (leave empty for full database scan) and finds product photo URLs.
  ```bash
  node scripts/scrape_legacy_photos.cjs
  ```
- **Step 2: Migrate Files to R2**:
  Downloads files locally to `output/legacy_photos_backup/` and uploads them to the R2 bucket, updating D1 with the new public URL.
  ```bash
  node scripts/migrate_photos_to_r2.cjs
  ```

---

### 4. Migrate Branch Historical Documents
Migrate historical invoices, quotes, and purchase orders from the legacy system.

- **Migrate to Cloud (Production)**:
  ```bash
  node scripts/migrate_branch_documents.cjs --branch=songshan --start=2026-01-01 --end=2026-06-08
  ```
- **Migrate to Local SQLite Database**:
  ```bash
  node scripts/migrate_branch_documents.cjs --branch=xizhi --start=2026-06-08 --end=2026-06-08 --local
  ```
- **Skip Crawling (Import CSV direct to SQL)**:
  If a previous run succeeded in downloading CSV but failed during SQL import:
  ```bash
  node scripts/migrate_branch_documents.cjs --branch=xizhi --skip-scrape
  ```

---

### 5. D1 Database Synchronization & Local Development
Useful commands for local environment testing and backups.

- **Export Remote database to SQL**:
  ```bash
  npm run db:export:remote
  ```
- **Export Local database to SQL**:
  ```bash
  npm run db:export:local
  ```
- **Restore Remote D1 backup to Local D1**:
  ```bash
  npm run db:import:local
  ```
- **Sync Remote database to Local**:
  ```bash
  npm run db:sync:local
  ```
- **Run migrations**:
  - Local: `npm run db:migrate:local`
  - Remote: `npm run db:migrate:remote`
