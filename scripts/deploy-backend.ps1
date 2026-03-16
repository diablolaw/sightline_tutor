param(
  [string]$ProjectId,
  [string]$Region = "us-central1",
  [string]$ServiceName = "sightline-tutor-backend",
  [string]$GeminiApiKey = $env:GEMINI_API_KEY,
  [string]$GeminiModel = "gemini-2.5-flash-native-audio-preview-12-2025",
  [ValidateSet("AUDIO", "TEXT")]
  [string]$GeminiResponseModality = "AUDIO",
  [string]$AllowedOrigins = "",
  [int]$TimeoutSeconds = 3600
)

if (-not $ProjectId) {
  throw "ProjectId is required. Example: .\scripts\deploy-backend.ps1 -ProjectId your-project-id"
}

if (-not $GeminiApiKey) {
  throw "GeminiApiKey is required. Pass -GeminiApiKey or set GEMINI_API_KEY in your shell."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot "backend"

$envVars = @(
  "GEMINI_API_KEY=$GeminiApiKey"
  "GEMINI_MODEL=$GeminiModel"
  "GEMINI_RESPONSE_MODALITY=$GeminiResponseModality"
)

if ($AllowedOrigins) {
  $envVars += "ALLOWED_ORIGINS=$AllowedOrigins"
}

$setEnvVars = $envVars -join ","

Write-Host "Deploying backend service '$ServiceName' to project '$ProjectId' in region '$Region'..."

& gcloud run deploy $ServiceName `
  --project $ProjectId `
  --source $sourcePath `
  --region $Region `
  --allow-unauthenticated `
  --timeout $TimeoutSeconds `
  --set-env-vars $setEnvVars

