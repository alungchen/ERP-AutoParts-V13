$ErrorActionPreference = "Stop"
for ($i = 0; $i -le 18; $i++) {
    Write-Host "Importing batch_$i.sql..."
    wrangler d1 execute erp-db --local --file=./batch_$i.sql
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to import batch_$i.sql"
        exit 1
    }
}
Write-Host "All batches imported successfully!"
