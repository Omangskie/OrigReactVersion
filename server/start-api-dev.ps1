# start-api-dev.ps1
# Development helper: loads server/serviceAccount.json into FIREBASE_SERVICE_ACCOUNT_JSON
# and starts the API server. Place your Firebase service account JSON at server/serviceAccount.json.

$svc = Join-Path $PSScriptRoot 'serviceAccount.json'
if (-Not (Test-Path $svc)) {
    Write-Error "serviceAccount.json not found at $svc. Place your Firebase service account JSON there."
    exit 1
}

$json = Get-Content -Raw $svc
$env:FIREBASE_SERVICE_ACCOUNT_JSON = $json
Write-Host "Loaded serviceAccount.json into FIREBASE_SERVICE_ACCOUNT_JSON. Starting API server..."
node (Join-Path $PSScriptRoot 'paymongo-api.js')
