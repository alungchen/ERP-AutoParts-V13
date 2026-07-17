# ERP 系統自動爬蟲與照片搬家指南

這是一份給使用者的簡易操作手冊，教您如何使用我們設計好的**全自動整合爬蟲系統**，只需輸入一行指令，系統就會幫您從外部網站抓取零件規格、自動匹配對應的照片，最後將照片永久備份至 R2 雲端並寫入您的 ERP 資料庫。

## ⚙️ 第一步：設定要搜尋的「關鍵字」

在專案的根目錄下，有一個名為 `keywords.txt` 的文字檔。
請用編輯器打開它，把你想要搜尋的關鍵字寫在裡面，**一行只能寫一個關鍵字**。

**範例：**
```text
ZVB-
com-b
VW-001
```

> **提示**：系統會按照您填寫的順序，自動一個接一個幫您搜尋並抓取資料。建議一次不要填寫太多（例如控制在 5~10 個以內），以免對方的伺服器承受不住而當機。

## 🔐 登入 uParts / 刷新 Cookie

爬蟲需要 uParts 登入狀態。若 Session 過期或被導向 SERVICE_CENTER，請先執行登入腳本。

### 汐止店（car00401 / b9）— 建議用法

**cck2** 的裝置授權與 **cck** 不互通；若在 cck2 看到「這個裝置尚未授權!!!」，請改走 **cck + 直連**（與單據爬蟲相同路徑）：

```bash
# 1. 複製範例並填入憑證
copy scripts\.uparts-login.example scripts\.uparts-login.local

# 2. 汐止店直連登入（注入 MachineId，略過 SERVICE_CENTER）
npm run login:uparts -- --host=cck.uparts.info --from=xizhi --direct
```

### 松山店

```bash
npm run login:uparts -- --from=songshan --direct
```

### 仍要使用 cck2 SERVICE_CENTER

```bash
npm run login:uparts -- --host=cck2.uparts.info --from=songshan
```

需在 uParts 後台為 **cck2** 另行核准裝置 MachineId，無法沿用 cck 的授權。

**常用參數：**

| 參數 | 說明 |
|------|------|
| `--direct` | 直連 `car2009/Default/`（建議，避開 SERVICE_CENTER 裝置檢查） |
| `--host=` | `cck.uparts.info`（預設）或 `cck2.uparts.info` |
| `--from=xizhi` | 從 `cookies_xizhi.json` 注入 Cookie |
| `--from=songshan` | 從 `cookies_songshan.json` 注入 MachineId |
| `--service=` / `--user=` / `--password=` | 覆寫 `.uparts-login.local` |

成功後產生 `scripts/cookies_cck.json` 或 `cookies_cck2.json`（已 gitignore）。

**疑難排解：**

| 訊息 | 處理方式 |
|------|----------|
| 這個裝置尚未授權!!! | 改 `--host=cck.uparts.info --direct`，或請管理員在 cck2 核准 MachineId |
| 等待審核… | uParts 後台核准裝置，或確認 `--from=songshan` 的 MachineId |

## 🚀 第二步：啟動終極全自動爬蟲

設定好關鍵字後，打開終端機 (Terminal)，確認您在專案的資料夾內，然後輸入以下這唯一的指令並按下 Enter：

```bash
node scripts/run_all.cjs
```

按下之後，您就可以去喝杯咖啡了！它會自動依序執行以下三個階段：

1. **[階段 1] 抓文字 (`scrape_parts.cjs`)**：
   - 自動打開瀏覽器並登入對方網站。
   - 逐一搜尋 `keywords.txt` 內的關鍵字。
   - 抓取零件規格與「適用車種」關聯清單。
   - 自動產生 SQL 語法，匯入到雲端 D1 資料庫（若遇到已存在的資料庫紀錄，會自動保護不覆蓋，寫入重複待審核清單）。
2. **[階段 2] 找照片 (`scrape_legacy_photos.cjs`)**：
   - 針對剛剛新抓到的料號，自動去舊系統尋找這些料號對應的舊版照片網址。
3. **[階段 3] 搬雲端 (`migrate_photos_to_r2.cjs`)**：
   - 將這些外部照片檔案一一實體下載下來。
   - 安全備份並上傳到您的專屬 Cloudflare R2 雲端儲存空間。
   - 將新的永久雲端網址更新回您的資料庫中。

當終端機顯示執行完畢時，就代表從文字到照片 100% 全部上線了！您可以直接打開 ERP 網頁查看結果。

## ⚠️ 第三步：查看「重複待審核清單」(如果有)

如果爬蟲在執行過程中，發現有部分的「零件號碼」在您的 ERP 系統裡面**已經存在**了，為了保護您的舊資料，系統不會自動覆蓋文字紀錄。

相對的，它會把這些衝突的資料寫入到以下檔案中：
👉 `output/duplicates_review.csv`

**當您看到終端機提示「發現 N 筆重複零件」時：**
您可以打開這個 `.csv` 檔案查看是哪些料號發生衝突。如果您決定要用新資料更新，可以直接登入 ERP 系統，在「產品資料庫」頁面搜尋該料號，手動更新即可。

---

## 🔄 舊系統 → 新系統 單據增量同步（常駐）

從 2026/07/05 起，舊系統新增的單據可透過常駐程式每 5 分鐘自動同步到新系統 D1：

```powershell
npm run sync:docs                # 常駐，每 5 分鐘一輪（松山 + 汐止、六種單別）
npm run sync:docs:once           # 只跑一輪就結束（測試用）
npm run sync:docs:once -- --dry-run   # 只抓不寫入，SQL 存 output/doc_sync_batch.sql
```

**運作原理（單號增量）**：舊系統單號如 `2S2607040006` = `2`(汐止) + `S`(銷貨單) + `260704`(日期) + `0006`(流水號)。程式記住每個「分店+單別+日期」前綴的最後流水號（存在 `output/doc_sync_state.json`），每輪只用「上一筆」往回翻到上次同步過的單就停，因此對舊系統負載極低。首次執行會自動從 D1 現有單號建立狀態。

**單別對照**：`S`=銷貨、`Q`=報價、`T`=銷退、`R`=進退、`B`=進貨、`I`=詢價。

**常用參數**：

| 參數 | 預設 | 說明 |
|------|------|------|
| `--branch=` | `both` | `songshan` / `xizhi` / `both` |
| `--types=` | `S,Q,T,R,B,I` | 要監控的單別（逗號分隔） |
| `--interval=` | `300` | 每輪間隔秒數（最低 60） |
| `--target=` | `remote` | 匯入 `remote` / `local` / `both` D1 |
| `--start=` | `2026-07-05` | 此日期前的單一律不碰 |
| `--once` | — | 只跑一輪 |
| `--dry-run` | — | 只抓取、產 SQL，不寫入 |
| `--rescan-every=` | `12` | 每 N 輪做一次「完整複查」（0=停用） |
| `--rescan-days=` | `3` | 複查時往回重抓幾天 |
| `--rescan` | — | 強制本次就做完整複查（常配 `--once`） |

**改單／刪單處理**：平常的增量輪只抓「新單號」，不會發現舊系統的改單或刪單。因此每 12 輪（約 1 小時）會自動做一次「完整複查」：把近 3 天的單整天重抓一遍（`INSERT OR REPLACE` 覆蓋改單內容），並比對單號清單——新系統有、舊系統已不存在的單會標記 `status='cancelled'` 並在備註加「⚠️ 舊系統已刪除此單」（不硬刪，保留紀錄可查）。若懷疑有單被改/刪想立即處理，可手動跑：`npm run sync:docs:once -- --rescan`。

**缺料號警示**：匯入時會檢查料號是否存在於新系統 `products` 表；缺料號的單據會在「備註」加上「⚠️ 缺料號待補正: …」、明細備註標記「⚠️ 新系統無此料號」，並記錄到 `output/doc_sync_missing.csv`，之後人工在新系統補建料號即可。

**登入**：汐止會自動填入認證；松山第一次需在跳出的 Chrome 視窗人工登入一次，之後 Cookie 會自動保存重複使用（`scripts/cookies_songshan.json`）。若 ERP 自動登出，下一輪會自動重新登入或再次提示人工登入。

---

### 💡 進階技巧：只跑特定腳本

雖然 `run_all.cjs` 最方便，但如果您因為某些原因只想要獨立跑某個階段，也可以分開輸入指令：
- **只抓文字**：`node scripts/scrape_parts.cjs`（若只要臨時抓特定一個料號，可以在後面加上關鍵字，例如 `node scripts/scrape_parts.cjs "ZVB-123"`）
- **只找照片網址**：`node scripts/scrape_legacy_photos.cjs`
- **只下載並上傳到 R2 雲端**：`node scripts/migrate_photos_to_r2.cjs`
