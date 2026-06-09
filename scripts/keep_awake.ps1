Write-Host "防休眠/防登出腳本已啟動！ (按 Ctrl+C 結束)" -ForegroundColor Green
$wshell = New-Object -ComObject wscript.shell
$count = 0

while($true) {
    Start-Sleep -Seconds 59
    $wshell.SendKeys('{F15}')
    $count++
    Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] 模擬按鍵避免休眠 (已執行 $count 分鐘)" -ForegroundColor DarkGray
}
