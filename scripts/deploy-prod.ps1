<#
.SYNOPSIS
  Production deploy from this PC, without GitHub. Source of truth: Azure Repos
  (remote `azure`, https://dev.azure.com/iakodigital/cdc-platform/_git/cdc-platform).

  Mirrors .github/workflows/main_cdc-api-prod.yml (manual, main-only, SHA-pinned,
  fail-closed), minus the Nightly QA gate, which lived on GitHub Actions.

.DESCRIPTION
  Guards (all BEFORE any Azure change):
    1. working tree has no tracked changes;
    2. HEAD equals the current tip of azure/main (fetched now);
    3. -Sha equals that commit (typed by a human: the "I mean this exact commit" check);
    4. Backend/docker-entrypoint.sh has LF line endings (CRLF -> exit 127, API down);
    5. cdc-api-prod is in `sitecontainers` mode;
    6. -AcknowledgeStartupMigrations is passed: the new container runs
       `prisma migrate deploy` against the PRODUCTION database when it starts.

  Then: az acr build (skipped if the SHA tag exists) -> sitecontainers update ->
  restart -> poll https://<api>/api/products until 200 -> optional Vercel prod deploy.
  No automatic rollback: the previous image is printed so you can switch back.

.EXAMPLE
  git fetch azure; git switch --detach azure/main
  .\scripts\deploy-prod.ps1 -Sha (git rev-parse HEAD) -AcknowledgeStartupMigrations
  .\scripts\deploy-prod.ps1 -Sha <sha> -AcknowledgeStartupMigrations -Frontend
  .\scripts\deploy-prod.ps1 -Sha <sha> -FrontendOnly
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [ValidatePattern('^[0-9a-f]{40}$')] [string] $Sha,
  [switch] $AcknowledgeStartupMigrations,
  [switch] $Frontend,
  [switch] $FrontendOnly
)

$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'   # az log streaming crashes on cp1252 consoles

$AcrName       = 'cdcplatformacr'
$AcrServer     = 'cdcplatformacr.azurecr.io'
$ImageName     = 'cdc-platform-backend'
$WebApp        = 'cdc-api-prod'
$ResourceGroup = 'CDC-Prod-RG'
$TargetPort    = '5000'
$VercelOrgId     = 'team_fP05bFuhtFJzd0IjVWLvFAmE'
$VercelProjectId = 'prj_nLtJUVmvrlOAKcNlrUu7t1gLSC3L'   # cdc-public-site

function Fail([string] $msg) { Write-Host "REFUSED: $msg" -ForegroundColor Red; Write-Host 'Nothing was built, updated or restarted.'; exit 1 }
function Step([string] $msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
# PowerShell names are case-insensitive: a bare `az` inside function `Az`
# calls the function itself (call depth overflow). Resolve the real CLI once.
$AzCli = (Get-Command az -CommandType Application | Select-Object -First 1).Source
function Az { $out = & $AzCli @args; if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed ($LASTEXITCODE)" }; $out }

$repoRoot = (git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

# ---- Guards --------------------------------------------------------------
Step 'Guard: clean working tree'
if (git status --porcelain --untracked-files=no) { Fail 'tracked files have uncommitted changes.' }

Step 'Guard: HEAD == azure/main == -Sha'
git fetch azure main --quiet; if ($LASTEXITCODE -ne 0) { Fail 'git fetch azure main failed (sign in again: git -c credential.msauthFlow=devicecode ls-remote azure).' }
$tip  = (git rev-parse azure/main).Trim()
$head = (git rev-parse HEAD).Trim()
if ($head -ne $tip) { Fail "HEAD $head is not the tip of azure/main ($tip). Run: git switch --detach azure/main" }
if ($Sha -ne $tip)  { Fail "-Sha $Sha is not the tip of azure/main ($tip)." }

if (-not $FrontendOnly) {
  if (-not $AcknowledgeStartupMigrations) { Fail 'pass -AcknowledgeStartupMigrations: the container runs prisma migrate deploy against PRODUCTION on start.' }

  Step 'Guard: docker-entrypoint.sh has LF line endings'
  $bytes = [IO.File]::ReadAllBytes((Join-Path $repoRoot 'Backend/docker-entrypoint.sh'))
  if ([Array]::IndexOf($bytes, [byte]13) -ge 0) { Fail 'Backend/docker-entrypoint.sh contains CRLF (container would exit 127). Check .gitattributes and re-checkout.' }

  Step 'Guard: cdc-api-prod is in sitecontainers mode'
  $mode = (Az webapp config show -n $WebApp -g $ResourceGroup --query linuxFxVersion -o tsv).Trim()
  if ($mode.ToLower() -ne 'sitecontainers') { Fail "linuxFxVersion is '$mode', not 'sitecontainers'." }

  $previous = (Az webapp sitecontainers list -n $WebApp -g $ResourceGroup --query "[?name=='main'].image | [0]" -o tsv).Trim()
  $image    = "${AcrServer}/${ImageName}:${Sha}"
  Write-Host "Current image : $previous"
  Write-Host "Target image  : $image"

  # ---- Build ---------------------------------------------------------------
  $exists = & $AzCli acr repository show -n $AcrName --image "${ImageName}:${Sha}" --query digest -o tsv 2>$null
  if ($LASTEXITCODE -eq 0 -and $exists) {
    Step "Image already in ACR ($exists), skipping build"
  } else {
    Step 'az acr build (Backend/)'
    Push-Location (Join-Path $repoRoot 'Backend')
    try { Az acr build --registry $AcrName --image "${ImageName}:${Sha}" --no-logs . | Out-Null } finally { Pop-Location }
    Az acr repository show -n $AcrName --image "${ImageName}:${Sha}" --query digest -o tsv | Out-Null
  }

  # ---- Switch + restart ----------------------------------------------------
  Step 'Point Site Container "main" at the new image'
  Az webapp sitecontainers update -n $WebApp -g $ResourceGroup --container-name main --image $image --target-port $TargetPort | Out-Null
  Step 'Restart'
  Az webapp restart -n $WebApp -g $ResourceGroup | Out-Null

  # ---- Verify --------------------------------------------------------------
  $apiHost = (Az webapp show -n $WebApp -g $ResourceGroup --query defaultHostName -o tsv).Trim()
  $ok = $false
  for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 15
    try { $code = (Invoke-WebRequest "https://$apiHost/api/products" -UseBasicParsing -TimeoutSec 20).StatusCode } catch { $code = $_.Exception.Response.StatusCode.value__ }
    Write-Host "  attempt $i/20: /api/products -> $code"
    if ($code -eq 200) { $ok = $true; break }
  }
  $configured = (Az webapp sitecontainers list -n $WebApp -g $ResourceGroup --query "[?name=='main'].image | [0]" -o tsv).Trim()
  if (-not $ok -or $configured -ne $image) {
    Write-Host "Backend NOT verified (health=$ok, configured=$configured)." -ForegroundColor Red
    Write-Host "Rollback: az webapp sitecontainers update -n $WebApp -g $ResourceGroup --container-name main --image $previous --target-port $TargetPort; az webapp restart -n $WebApp -g $ResourceGroup"
    exit 1
  }
  Write-Host "Backend verified: $image is configured and /api/products returns 200." -ForegroundColor Green
  Write-Host "Rollback target: $previous"
}

# ---- Frontend (Vercel) -----------------------------------------------------
if ($Frontend -or $FrontendOnly) {
  Step 'Vercel production deploy (cdc-public-site)'
  if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) { Fail 'vercel CLI not found (npm i -g vercel, then vercel login).' }
  $env:VERCEL_ORG_ID = $VercelOrgId
  $env:VERCEL_PROJECT_ID = $VercelProjectId
  vercel deploy --prod --yes
  if ($LASTEXITCODE -ne 0) { Write-Host 'Vercel deploy failed.' -ForegroundColor Red; exit 1 }
}

Write-Host 'Done.' -ForegroundColor Green
