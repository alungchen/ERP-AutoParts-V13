Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class SleepPreventer {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(int esFlags);
}
"@

$ES_CONTINUOUS = -2147483648
$ES_DISPLAY_REQUIRED = 2
$ES_SYSTEM_REQUIRED = 1

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " ANTI-SLEEP MODE ACTIVATED! (Windows API)" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Status: Your screen will stay ON and system will NOT sleep." -ForegroundColor Yellow
Write-Host "Please DO NOT close this window until your scraper finishes."
Write-Host ""
Write-Host "To restore normal sleep settings, press [Enter] here..." -ForegroundColor White

$flags = $ES_CONTINUOUS -bor $ES_DISPLAY_REQUIRED -bor $ES_SYSTEM_REQUIRED
[SleepPreventer]::SetThreadExecutionState($flags) | Out-Null

Read-Host

Write-Host "Restoring default sleep settings..." -ForegroundColor Yellow
[SleepPreventer]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
Write-Host "Restored! You can safely close this window now." -ForegroundColor Green
Start-Sleep -Seconds 2
