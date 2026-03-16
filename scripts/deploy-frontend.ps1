param(
  [string]$ProjectId,
  [string]$BackendUrl,
  [string]$Region = "us-central1",
  [string]$ServiceName = "sightline-tutor"
)

if (-not $ProjectId) {
  throw "ProjectId is required. Example: .\scripts\deploy-frontend.ps1 -ProjectId your-project-id -BackendUrl https://your-backend.run.app/"
}

if (-not $BackendUrl) {
  throw "BackendUrl is required. Example: -BackendUrl https://your-backend.run.app/"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot "frontend"

$normalizedBackendUrl = $BackendUrl.TrimEnd("/")
if ($normalizedBackendUrl -like "https://*") {
  $websocketUrl = "wss://" + $normalizedBackendUrl.Substring(8) + "/ws/live"
} elseif ($normalizedBackendUrl -like "http://*") {
  $websocketUrl = "ws://" + $normalizedBackendUrl.Substring(7) + "/ws/live"
} else {
  throw "BackendUrl must start with http:// or https://"
}

Write-Host "Using websocket URL: $websocketUrl"
Write-Host "Deploying frontend service '$ServiceName' to project '$ProjectId' in region '$Region'..."

$env:NEXT_PUBLIC_WS_URL = $websocketUrl

try {
  & gcloud run deploy $ServiceName `
    --project $ProjectId `
    --source $sourcePath `
    --region $Region `
    --allow-unauthenticated
}
finally {
  Remove-Item Env:NEXT_PUBLIC_WS_URL -ErrorAction SilentlyContinue
}

