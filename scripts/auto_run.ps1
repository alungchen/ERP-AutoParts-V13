Write-Host "=========================================="
Write-Host "🤖 AI 自動化任務已啟動！"
Write-Host "=========================================="
Write-Host "⏳ 正在監控並等待您目前的 scrape_parts.cjs 執行完畢..."

while ($true) {
    # 檢查是否有包含 scrape_parts.cjs 的 node 行程在執行
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match "scrape_parts.cjs" }
    
    if (-not $processes) {
        break
    }
    Start-Sleep -Seconds 30
}

Write-Host "`n✅ 偵測到 scrape_parts.cjs 執行結束！"
Write-Host "🚀 正在自動接手：執行第一步 (抓取舊照片網址)..."
Write-Host "------------------------------------------"
node scripts/scrape_legacy_photos.cjs

Write-Host "`n✅ 第一步完成！"
Write-Host "🚀 正在自動接手：執行第二步 (將照片搬家到 R2)..."
Write-Host "------------------------------------------"
node scripts/migrate_photos_to_r2.cjs

Write-Host "`n🎉 所有任務已由 AI 代為執行完成！您可以安心檢查結果。"
