param(
  [int]$MinCoveragePct = 95
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DbFile = Join-Path $Root "assets/us-assets-lite.js"
$CoverageFile = Join-Path $Root "assets/index-coverage-report.json"

if (-not (Test-Path -LiteralPath $DbFile)) {
  throw "Missing local DB file: $DbFile"
}

if (-not (Test-Path -LiteralPath $CoverageFile)) {
  throw "Missing coverage report: $CoverageFile"
}

$dbText = Get-Content -LiteralPath $DbFile -Raw -Encoding utf8
if ($dbText -notmatch "window\.DADDY_ASSET_DB\s*=\s*(?<json>\{[\s\S]*\});?\s*$") {
  throw "Could not parse window.DADDY_ASSET_DB from $DbFile"
}

$db = $Matches.json | ConvertFrom-Json
$assetCount = @($db.assets.PSObject.Properties | Where-Object { $_.MemberType -eq "NoteProperty" }).Count
if ($assetCount -lt 1000) {
  throw "Local DB has only $assetCount assets. Expected a broad S&P 500 + Russell 2000 build."
}

$coverage = Get-Content -LiteralPath $CoverageFile -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($indexName in @("SP500", "RUSSELL2000")) {
  if (-not ($coverage.PSObject.Properties.Name -contains $indexName)) {
    throw "Coverage report is missing $indexName"
  }

  $total = [double]$coverage.$indexName.total
  $covered = [double]$coverage.$indexName.covered
  if ($total -le 0) {
    throw "$indexName has no holdings in coverage report"
  }

  $pct = [math]::Round(($covered / $total) * 100, 2)
  Write-Host "$indexName coverage: $covered / $total ($pct%)"
  if ($pct -lt $MinCoveragePct) {
    throw "$indexName coverage $pct% is below required $MinCoveragePct%"
  }
}

Write-Host "Asset DB validation passed with $assetCount assets."
