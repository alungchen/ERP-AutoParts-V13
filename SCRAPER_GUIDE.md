# 超簡版操作手冊

這份是最短、最實用的版本。若你已經把料號寫進 `keywords.txt`，直接照下面做就行。

## 1) 先填料號

開啟專案根目錄下的 `keywords.txt`。
每一行填一個料號，例如：

```text
MAN052
R1-005
ABC-123
```

> 一行一個，不要寫成一整串。

## 2) 直接執行自動抓取

在 Terminal 內輸入：

```bash
node scripts/run_all.cjs
```

這個指令會自動幫你做三件事：

1. 抓零件文字資料
2. 找對應照片網址
3. 下載照片並上傳到 Cloudflare R2

它會依序跑完，不用你手動一段一段執行。

## 3) 如果跳出瀏覽器登入

若程式要求你登入舊系統，直接登入即可。
登入成功後再回到 Terminal 繼續。

## 4) 完成後怎麼確認

執行結束後，回 ERP 頁面重新整理即可。
如果產品資料已經出現：
- 品名
- 車型
- 品牌
- 照片

就表示成功。

## 5) 只想抓單一料號 / 少量料號

若不想用 `keywords.txt`，也可以直接執行：

```bash
node scripts/scrape_parts.cjs "MAN052"
```

或：

```bash
node scripts/scrape_parts.cjs "MAN052" "R1-005"
```

## 6) 不要亂用的進階功能

以下這些不是你現在最簡單的路徑：

- `node scripts/scrape_all_missing_bg.cjs --month=2026-06`
- `npm run sync:docs`
- `npm run sync:docs:once`

這些是批次補齊或單據同步流程，和你現在「手動填 `keywords.txt` 後跑一次抓取」不是同一套。

## 7) 最短版結論

你現在真正應該做的是：

```bash
# 1. 先編輯 keywords.txt
# 2. 然後執行
node scripts/run_all.cjs
```

這是最簡單、最正確的做法。

如果你要，我下一步可以直接幫你把 `keywords.txt` 內容整理成「最少風險的格式」，不用再看這份長文件。
