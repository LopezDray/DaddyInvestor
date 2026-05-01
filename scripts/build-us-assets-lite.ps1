param(
  [int]$BulkParts = 100,
  [long]$MinMarketCap = 0,
  [string]$SourceDir = "",
  [switch]$Offline
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$OutFile = Join-Path $Root "assets/us-assets-lite.js"
$OverridesFile = Join-Path $Root "assets/asset-overrides.json"
$ReviewFile = Join-Path $Root "assets/asset-review-queue.json"
$CoverageFile = Join-Path $Root "assets/index-coverage-report.json"

if (-not $SourceDir) {
  $SourceDir = Join-Path $Root "source_data\asset_db"
}

if (-not $Offline -and -not $env:FMP_API_KEY) {
  throw "Set FMP_API_KEY in the current shell before running this script, or run with -Offline and local source files."
}

$Sectors = [ordered]@{
  TECH = "Information Technology"; COMM = "Communication Services"; DISC = "Consumer Discretionary"
  STAP = "Consumer Staples"; HEALTH = "Health Care"; FIN = "Financials"; IND = "Industrials"
  ENERGY = "Energy"; UTIL = "Utilities"; MAT = "Materials"; RE = "Real Estate"; ETF = "ETF"; CASH = "Cash Equivalent"; UNKNOWN = "Unknown Sector"
}

$Industries = [ordered]@{
  AI_SOFTWARE = "AI / Data Software"; SOFTWARE = "Software"; CLOUD = "Cloud / Enterprise Software"
  SEMIS = "Semiconductors"; MEMORY = "Memory Semiconductors"; FOUNDRY = "Semiconductor Foundry"
  HARDWARE = "Hardware / Devices"; INTERNET = "Internet Platforms"; AD_TECH = "Advertising Technology"
  ECOM = "E-Commerce"; MEDIA = "Streaming / Media"; TELECOM = "Telecommunication Services"
  EV = "Electric Vehicles"; APPAREL = "Apparel / Footwear"; AUTO = "Automobiles"
  HOME_IMPROVEMENT = "Home Improvement Retail"; RESTAURANTS = "Restaurants"; TRAVEL = "Travel / Booking Platforms"
  FINTECH = "Fintech / Crypto"; BANKS = "Banks"; ASSET_MGMT = "Asset Management"
  CAPITAL_MARKETS = "Capital Markets"; PAYMENTS = "Payments"; INSURANCE = "Insurance"
  EXCHANGE = "Exchange / Market Data"; PHARMA = "Pharmaceuticals"; BIOTECH = "Biotechnology"
  HEALTH_SERVICES = "Health Services"; MEDTECH = "Medical Technology"; HOSPITALS = "Hospitals"
  HOUSEHOLD = "Household & Personal Products"; BEVERAGES = "Beverages"; PACKAGED_FOOD = "Packaged Food"
  DEF_RETAIL = "Defensive Retail"; DISCOUNT_RETAIL = "Discount Retail"; AERO_DEF = "Aerospace & Defense"
  AERO = "Aerospace"; MACHINERY = "Machinery"; TRANSPORT = "Transportation / Logistics"
  RAILROAD = "Railroad"; BUSINESS_SERVICES = "Business Services"; PAYROLL = "Payroll / HCM Services"
  ELECTRICAL = "Electrical Equipment"; INDUSTRIAL_AUTO = "Industrial Automation"; POWER_GRID = "Power Grid / Electrification"
  GEOTHERMAL = "Geothermal / Renewable Power"; OIL_GAS = "Oil & Gas"; LNG = "Liquefied Natural Gas"
  OIL_SERVICE = "Oilfield Services"; FERTILIZER = "Fertilizer / Agricultural Inputs"; WASTE = "Waste Management / Environmental Services"
  CHEMICALS = "Specialty Chemicals"; METALS = "Metals & Mining"; GOLD_MINER = "Gold Mining"
  REG_UTILITY = "Regulated Utility"; CYBER = "Cybersecurity"; NETWORKING = "Networking Infrastructure"
  SEMI_EQUIP = "Semiconductor Equipment"; DATA_ANALYTICS = "Data Analytics"; REIT = "Real Estate / REIT"
  BROAD_ETF = "Broad Market ETF"; COUNTRY_ETF = "Country / Regional ETF"; SECTOR_ETF = "Sector ETF"
  SHORT_TREASURY = "Short-Term Treasury ETF"; BOND_ETF = "Bond ETF"; LONG_TREASURY = "Long Treasury ETF"
  GOLD_ETF = "Gold ETF"; SILVER_ETF = "Silver ETF"; COMMODITY_ETF = "Commodity ETF"; BTC_ETF = "Bitcoin ETF"
}

$SectorMap = @{
  "technology" = "TECH"; "information technology" = "TECH"; "communication services" = "COMM"
  "consumer discretionary" = "DISC"; "consumer cyclical" = "DISC"; "consumer staples" = "STAP"
  "consumer defensive" = "STAP"; "health care" = "HEALTH"; "healthcare" = "HEALTH"
  "financial services" = "FIN"; "financials" = "FIN"; "industrials" = "IND"; "energy" = "ENERGY"
  "utilities" = "UTIL"; "basic materials" = "MAT"; "materials" = "MAT"; "real estate" = "RE"
}

$Rules = @(
  @{ Industry = "SHORT_TREASURY"; Sleeve = "cash"; Keywords = @("t-bill", "treasury bill", "0-3 month", "short treasury", "money market") }
  @{ Industry = "GOLD_ETF"; Sleeve = "hedge"; Keywords = @("gold trust", "gold shares") }
  @{ Industry = "COMMODITY_ETF"; Sleeve = "hedge"; Keywords = @("commodity", "oil fund", "natural gas fund") }
  @{ Industry = "BROAD_ETF"; Sleeve = "diversified"; Keywords = @("s&p 500", "total market", "dow jones", "russell 2000", "broad market") }
  @{ Industry = "COUNTRY_ETF"; Sleeve = "diversified"; Keywords = @("msci", "emerging markets", "developed markets", "international") }
  @{ Industry = "SECTOR_ETF"; Sleeve = "diversified"; Keywords = @("sector spdr", "sector etf") }
  @{ Industry = "SEMIS"; Sleeve = "growth"; Keywords = @("semiconductor", "chip", "integrated circuit") }
  @{ Industry = "SEMI_EQUIP"; Sleeve = "growth"; Keywords = @("semiconductor equipment", "wafer", "lithography") }
  @{ Industry = "SOFTWARE"; Sleeve = "growth"; Keywords = @("software", "application", "saas") }
  @{ Industry = "CLOUD"; Sleeve = "growth"; Keywords = @("cloud", "database", "data platform") }
  @{ Industry = "AI_SOFTWARE"; Sleeve = "growth"; Keywords = @("artificial intelligence", "ai platform") }
  @{ Industry = "CYBER"; Sleeve = "hedge"; Keywords = @("cyber", "security software") }
  @{ Industry = "POWER_GRID"; Sleeve = "growth"; Keywords = @("electrification", "power grid", "electrical equipment", "energy equipment") }
  @{ Industry = "AERO_DEF"; Sleeve = "hedge"; Keywords = @("aerospace and defense", "defense") }
  @{ Industry = "OIL_GAS"; Sleeve = "hedge"; Keywords = @("oil", "gas", "petroleum", "exploration", "integrated oil") }
  @{ Industry = "FERTILIZER"; Sleeve = "hedge"; Keywords = @("fertilizer", "agricultural inputs") }
  @{ Industry = "HOUSEHOLD"; Sleeve = "hedge"; Keywords = @("household", "personal products") }
  @{ Industry = "BEVERAGES"; Sleeve = "hedge"; Keywords = @("beverage", "soft drink") }
  @{ Industry = "PACKAGED_FOOD"; Sleeve = "hedge"; Keywords = @("packaged food", "tobacco", "food products") }
  @{ Industry = "HEALTH_SERVICES"; Sleeve = "hedge"; Keywords = @("managed health", "health services", "health care providers") }
  @{ Industry = "PHARMA"; Sleeve = "hedge"; Keywords = @("pharmaceutical") }
  @{ Industry = "BIOTECH"; Sleeve = "growth"; Keywords = @("biotechnology") }
  @{ Industry = "MEDTECH"; Sleeve = "growth"; Keywords = @("medical devices", "life sciences tools") }
  @{ Industry = "REG_UTILITY"; Sleeve = "hedge"; Keywords = @("regulated electric", "electric utilities", "utilities") }
  @{ Industry = "WASTE"; Sleeve = "hedge"; Keywords = @("waste", "environmental services") }
  @{ Industry = "BANKS"; Sleeve = "diversified"; Keywords = @("bank", "banks") }
  @{ Industry = "INSURANCE"; Sleeve = "diversified"; Keywords = @("insurance") }
  @{ Industry = "ASSET_MGMT"; Sleeve = "diversified"; Keywords = @("asset management", "capital markets") }
  @{ Industry = "PAYMENTS"; Sleeve = "diversified"; Keywords = @("payment", "transaction processing") }
  @{ Industry = "REIT"; Sleeve = "diversified"; Keywords = @("reit", "real estate") }
)

$IndexEtfs = [ordered]@{ SP500 = "IVV"; RUSSELL2000 = "IWM" }
$IndexMembership = @{}
$CoveredIndexSymbols = @{}
$Review = New-Object System.Collections.Generic.List[object]
$Db = [ordered]@{ sectors = $Sectors; industries = $Industries; assets = [ordered]@{} }

function First-Value($Values) {
  foreach ($value in $Values) {
    if ($null -ne $value -and [string]$value -ne "") { return $value }
  }
  $null
}

function Invoke-Fmp($Path, $Params) {
  $query = ($Params.GetEnumerator() | ForEach-Object {
    "$([uri]::EscapeDataString($_.Key))=$([uri]::EscapeDataString([string]$_.Value))"
  }) -join "&"
  $uri = "https://financialmodelingprep.com/stable/$Path`?$query&apikey=$([uri]::EscapeDataString($env:FMP_API_KEY))"
  Invoke-RestMethod -Method Get -Uri $uri -Headers @{ "User-Agent" = "DaddyInvestor/1.0" }
}

function Invoke-FmpLegacy($Path, $Params) {
  $query = ($Params.GetEnumerator() | ForEach-Object {
    "$([uri]::EscapeDataString($_.Key))=$([uri]::EscapeDataString([string]$_.Value))"
  }) -join "&"
  if ($query) { $query = "$query&" }
  $uri = "https://financialmodelingprep.com/api/v4/$Path`?$query" + "apikey=$([uri]::EscapeDataString($env:FMP_API_KEY))"
  Invoke-WebRequest -Method Get -Uri $uri -Headers @{ "User-Agent" = "DaddyInvestor/1.0" } -UseBasicParsing
}

function Invoke-FmpV3($Path, $Params) {
  $query = ($Params.GetEnumerator() | ForEach-Object {
    "$([uri]::EscapeDataString($_.Key))=$([uri]::EscapeDataString([string]$_.Value))"
  }) -join "&"
  if ($query) { $query = "$query&" }
  $uri = "https://financialmodelingprep.com/api/v3/$Path`?$query" + "apikey=$([uri]::EscapeDataString($env:FMP_API_KEY))"
  Invoke-RestMethod -Method Get -Uri $uri -Headers @{ "User-Agent" = "DaddyInvestor/1.0" }
}

function Convert-FmpRows($Data) {
  if ($null -eq $Data) { return @() }
  if ($Data -is [array]) { return @($Data) }

  $props = @($Data.PSObject.Properties.Name)
  foreach ($errorProp in @("Error Message", "error", "message")) {
    if ($props -contains $errorProp -and -not ($props -contains "symbol")) {
      Write-Host "FMP returned message: $($Data.$errorProp)"
      return @()
    }
  }

  foreach ($prop in @("data", "results", "items", "profiles")) {
    if ($props -contains $prop) { return @($Data.$prop) }
  }

  @($Data)
}

function Get-ScreenerProfiles {
  $profiles = New-Object System.Collections.Generic.List[object]
  $seen = @{}

  foreach ($exchange in @("NASDAQ", "NYSE", "AMEX")) {
    $rows = @()
    try {
      $rows = Convert-FmpRows (Invoke-Fmp "company-screener" @{
        exchange = $exchange
        limit = 10000
      })
      Write-Host "company-screener $exchange returned $(@($rows).Count) rows."
    } catch {
      Write-Host "company-screener $exchange failed. Trying legacy stock-screener."
      try {
        $rows = Convert-FmpRows (Invoke-FmpV3 "stock-screener" @{
          exchange = $exchange
          limit = 10000
        })
        Write-Host "legacy stock-screener $exchange returned $(@($rows).Count) rows."
      } catch {
        Write-Host "legacy stock-screener $exchange failed: $($_.Exception.Message)"
        $rows = @()
      }
    }

    foreach ($row in @($rows)) {
      $symbol = Normalize-Symbol $row.symbol
      if (-not $symbol -or $seen.ContainsKey($symbol)) { continue }
      $seen[$symbol] = $true
      $profiles.Add($row)
    }
  }

  Write-Host "Screener source returned $($profiles.Count) unique profiles."
  @($profiles)
}

function Get-LegacyAllProfiles {
  Write-Host "profile-bulk part endpoint unavailable. Falling back to api/v4/profile/all."
  $response = Invoke-FmpLegacy "profile/all" @{}
  $content = ([string]$response.Content).Trim()
  if (-not $content) { return @() }
  if ($content.StartsWith("[")) { return @($content | ConvertFrom-Json) }
  if ($content.StartsWith("{")) {
    $parsed = $content | ConvertFrom-Json
    if ($parsed.PSObject.Properties.Name -contains "Error Message") { throw $parsed."Error Message" }
    if ($parsed.PSObject.Properties.Name -contains "message") { throw $parsed.message }
    return @($parsed)
  }
  @([regex]::Split($content, "\r?\n") | ConvertFrom-Csv)
}

function Resolve-LocalSourceFile($Names) {
  foreach ($name in $Names) {
    foreach ($ext in @(".json", ".csv")) {
      $path = Join-Path $SourceDir "$name$ext"
      if (Test-Path -LiteralPath $path) { return $path }
    }
  }
  $null
}

function Read-LocalSourceRows($Path) {
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($ext -eq ".csv") {
    return @(Import-Csv -LiteralPath $Path)
  }
  if ($ext -ne ".json") {
    throw "Unsupported source file type: $Path"
  }

  $raw = Get-Content -LiteralPath $Path -Raw -Encoding utf8
  if (-not $raw.Trim()) { return @() }
  $parsed = $raw | ConvertFrom-Json
  if ($parsed -is [array]) { return @($parsed) }

  foreach ($prop in @("data", "holdings", "results", "profiles", "items")) {
    if ($parsed.PSObject.Properties.Name -contains $prop) {
      return @($parsed.$prop)
    }
  }

  @($parsed)
}

function Get-LocalHoldings($EtfSymbol, $IndexName) {
  $names = if ($IndexName -eq "SP500") {
    @("ivv-holdings", "sp500-holdings", "sp500", "s-and-p-500")
  } else {
    @("iwm-holdings", "russell2000-holdings", "russell-2000", "iwm")
  }
  $path = Resolve-LocalSourceFile $names
  if (-not $path) {
    throw "Offline mode needs $EtfSymbol holdings in $SourceDir. Use one of these file names: $($names -join ', ') with .json or .csv."
  }
  Read-LocalSourceRows $path
}

function Get-LocalProfiles {
  $files = New-Object System.Collections.Generic.List[string]
  foreach ($name in @("profiles", "profile-bulk", "us-profiles", "fmp-profile-bulk")) {
    $path = Resolve-LocalSourceFile @($name)
    if ($path -and -not $files.Contains($path)) { $files.Add($path) }
  }

  if (Test-Path -LiteralPath $SourceDir) {
    Get-ChildItem -LiteralPath $SourceDir -File |
      Where-Object { $_.Name -match "^profile-bulk-.+\.(json|csv)$" } |
      Sort-Object Name |
      ForEach-Object {
        if (-not $files.Contains($_.FullName)) { $files.Add($_.FullName) }
      }
  }

  if ($files.Count -eq 0) {
    throw "Offline mode needs profile data in $SourceDir. Add profiles.json/csv, profile-bulk.json/csv, or profile-bulk-*.json/csv."
  }

  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($file in $files) {
    foreach ($row in @(Read-LocalSourceRows $file)) { $rows.Add($row) }
  }
  @($rows)
}

function Get-Holdings($EtfSymbol, $IndexName) {
  if ($Offline) { return Get-LocalHoldings $EtfSymbol $IndexName }
  Invoke-Fmp "etf/holdings" @{ symbol = $EtfSymbol }
}

function Get-ProfileBatch($Part) {
  if ($Offline) {
    if ($Part -gt 0) { return @() }
    if ($null -eq $script:OfflineProfiles) {
      $script:OfflineProfiles = @(Get-LocalProfiles)
    }
    return @($script:OfflineProfiles)
  }

  if ($Part -eq 0 -and $null -eq $script:ScreenerProfiles) {
    $script:ScreenerProfiles = @(Get-ScreenerProfiles)
    if ($script:ScreenerProfiles.Count -ge 1000) {
      return @($script:ScreenerProfiles)
    }
    Write-Host "Screener source had only $($script:ScreenerProfiles.Count) profiles. Trying profile-bulk fallback."
  } elseif ($null -ne $script:ScreenerProfiles -and $script:ScreenerProfiles.Count -ge 1000) {
    return @()
  }

  try {
    Invoke-Fmp "profile-bulk" @{ part = $Part }
  } catch {
    Write-Host "profile-bulk part $Part failed. Using fallback source."
    if ($Part -eq 0) { return @(Get-LegacyAllProfiles) }
    return @()
  }
}

function Normalize-Symbol($Symbol) {
  ([string]$Symbol).Trim().ToUpperInvariant().Replace("-", ".") -replace "[^A-Z0-9.]", ""
}

function Test-IsUsExchange($Exchange) {
  $text = ([string]$Exchange).Trim().ToUpperInvariant()
  if (-not $text) { return $false }
  foreach ($marker in @(
    "NASDAQ",
    "NYSE",
    "NEW YORK STOCK EXCHANGE",
    "AMEX",
    "AMERICAN STOCK EXCHANGE",
    "NYSE AMERICAN",
    "NYSE ARCA",
    "BATS",
    "CBOE",
    "IEX"
  )) {
    if ($text.Contains($marker)) { return $true }
  }
  $false
}

function Test-IsUsListedProfile($Profile, $IsIndexMember) {
  if ($IsIndexMember) { return $true }
  $country = ([string](First-Value @($Profile.country, $Profile.countryName))).Trim().ToUpperInvariant()
  if ($country -and @("US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA") -notcontains $country) {
    return $false
  }
  $exchange = First-Value @($Profile.exchangeShortName, $Profile.exchange, $Profile.exchangeName)
  if (Test-IsUsExchange $exchange) { return $true }
  $country -in @("US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA")
}

function Test-Truthy($Value) {
  if ($null -eq $Value) { return $false }
  if ($Value -is [bool]) { return $Value }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  @("true", "1", "yes", "y", "etf") -contains $text
}

function Test-IsEtf($Profile) {
  $value = First-Value @($Profile.isEtf, $Profile.isETF, $Profile.etf, $Profile.assetType, $Profile.type)
  if ($null -eq $value) { return $false }
  $text = ([string]$value).Trim().ToUpperInvariant()
  if ($text -eq "ETF" -or $text -eq "FUND") { return $true }
  Test-Truthy $value
}

function Get-Number($Values, $Default = 0) {
  $raw = First-Value $Values
  $number = 0.0
  if ($null -ne $raw -and [double]::TryParse([string]$raw, [ref]$number)) { return $number }
  $Default
}

function Add-IndexMembership($Symbol, $IndexName) {
  if (-not $IndexMembership.ContainsKey($Symbol)) { $IndexMembership[$Symbol] = New-Object System.Collections.Generic.List[string] }
  if (-not $IndexMembership[$Symbol].Contains($IndexName)) { $IndexMembership[$Symbol].Add($IndexName) }
}

foreach ($indexName in $IndexEtfs.Keys) {
  $holdings = Get-Holdings $IndexEtfs[$indexName] $indexName
  foreach ($holding in @($holdings)) {
    $symbol = Normalize-Symbol (First-Value @($holding.symbol, $holding.asset, $holding.holdingSymbol, $holding.ticker))
    if ($symbol -and $symbol -ne "N/A" -and $symbol -ne "CASH") { Add-IndexMembership $symbol $indexName }
  }
}

function Get-SectorCode($Sector, $IsEtf) {
  if ($IsEtf) { return "ETF" }
  $key = ([string]$Sector).ToLowerInvariant()
  if ($SectorMap.ContainsKey($key)) { return $SectorMap[$key] }
  "UNKNOWN"
}

function Get-SleeveForSector($SectorCode, $IsEtf) {
  if ($IsEtf) { return "diversified" }
  if ($SectorCode -eq "UNKNOWN") { return "unknown" }
  if (@("STAP", "UTIL", "ENERGY") -contains $SectorCode) { return "hedge" }
  if (@("TECH", "COMM") -contains $SectorCode) { return "growth" }
  "diversified"
}

function Get-Risk($Sleeve, $Beta) {
  $base = @{ cash = 10; hedge = 44; diversified = 54; growth = 72; unknown = 60 }[$Sleeve]
  if (-not $base) { $base = 60 }
  $betaValue = 0
  if (-not [double]::TryParse([string]$Beta, [ref]$betaValue) -or $betaValue -le 0) { return $base }
  [math]::Max(10, [math]::Min(94, [math]::Round($base + (($betaValue - 1) * 12))))
}

function Map-Profile($Profile) {
  $name = if ($Profile.companyName) { $Profile.companyName } elseif ($Profile.name) { $Profile.name } else { $Profile.symbol }
  $isEtf = Test-IsEtf $Profile
  $sectorCode = Get-SectorCode $Profile.sector $isEtf
  $text = "$($Profile.companyName) $($Profile.name) $($Profile.sector) $($Profile.industry)".ToLowerInvariant()
  $rule = $Rules | Where-Object {
    $keywords = $_.Keywords
    $keywords | Where-Object { $text.Contains($_) } | Select-Object -First 1
  } | Select-Object -First 1
  $industry = if ($rule) { $rule.Industry } elseif ($Profile.industry) { ([string]$Profile.industry) -replace "[^A-Za-z0-9 /&.-]", "" } else { "Business Services" }
  $sleeve = if ($rule) { $rule.Sleeve } else { Get-SleeveForSector $sectorCode $isEtf }
  [pscustomobject]@{
    name = $name
    sectorCode = $sectorCode
    industryCode = $industry
    sleeve = $sleeve
    risk = Get-Risk $sleeve $Profile.beta
    assetType = if ($isEtf) { "ETF" } else { $null }
    confidence = if ($rule) { 82 } elseif ($sectorCode -eq "UNKNOWN") { 35 } elseif ($sectorCode -in @("TECH", "DISC")) { 68 } else { 58 }
  }
}

function Compact-AssetRow($Mapped, $Indexes) {
  $indexList = @($Indexes | ForEach-Object { [string]$_ })
  $row = @(
    [string]$Mapped.name
    [string]$Mapped.sectorCode
    [string]$Mapped.industryCode
    [string]$Mapped.sleeve
    [int]$Mapped.risk
  )
  if ($Mapped.assetType -or $indexList.Count) {
    $row += $(if ($Mapped.assetType) { [string]$Mapped.assetType } else { "Stock" })
  }
  if ($indexList.Count) {
    $row += ,$indexList
  }
  return ,$row
}

for ($part = 0; $part -lt $BulkParts; $part++) {
  $profiles = Get-ProfileBatch $part
  if (-not $profiles -or @($profiles).Count -eq 0) { break }
  foreach ($profile in @($profiles)) {
    $symbol = Normalize-Symbol $profile.symbol
    if (-not $symbol) { continue }
    $indexes = if ($IndexMembership.ContainsKey($symbol)) { $IndexMembership[$symbol] } else { @() }
    $isIndexMember = @($indexes).Count -gt 0
    if (-not (Test-IsUsListedProfile $profile $isIndexMember)) { continue }
    $marketCap = Get-Number @($profile.mktCap, $profile.marketCap, 0) 0
    if (-not $isIndexMember -and -not (Test-IsEtf $profile) -and $marketCap -lt $MinMarketCap) { continue }
    $mapped = Map-Profile $profile
    if ($isIndexMember) { $CoveredIndexSymbols[$symbol] = $true }
    if ($mapped.confidence -lt 65) {
      $Review.Add([ordered]@{ symbol = $symbol; name = $mapped.name; sector = $profile.sector; industry = $profile.industry; suggestedSleeve = $mapped.sleeve; confidence = $mapped.confidence })
    }
    $Db.assets[$symbol] = Compact-AssetRow $mapped @($indexes)
  }
}

if (Test-Path $OverridesFile) {
  $overrides = Get-Content -LiteralPath $OverridesFile -Raw -Encoding utf8 | ConvertFrom-Json
  foreach ($item in $overrides.PSObject.Properties) {
    $symbol = Normalize-Symbol $item.Name
    $value = $item.Value
    $indexes = if ($value.indexes) { @($value.indexes) } elseif ($IndexMembership.ContainsKey($symbol)) { @($IndexMembership[$symbol]) } else { @() }
    $mapped = [pscustomobject]@{
      name = if ($value.name) { $value.name } else { $symbol }
      sectorCode = if ($value.sectorCode) { $value.sectorCode } else { "TECH" }
      industryCode = if ($value.industryCode) { $value.industryCode } else { "SOFTWARE" }
      sleeve = if ($value.sleeve) { $value.sleeve } else { "growth" }
      risk = if ($value.risk) { [int]$value.risk } else { 60 }
      assetType = $value.assetType
    }
    if ($indexes.Count) { $CoveredIndexSymbols[$symbol] = $true }
    $Db.assets[$symbol] = Compact-AssetRow $mapped $indexes
  }
}

$sortedAssets = [ordered]@{}
$Db.assets.Keys | Sort-Object | ForEach-Object { $sortedAssets[$_] = $Db.assets[$_] }
$Db.assets = $sortedAssets

$coverage = [ordered]@{}
foreach ($indexName in $IndexEtfs.Keys) {
  $members = @($IndexMembership.Keys | Where-Object { $IndexMembership[$_].Contains($indexName) })
  $covered = @($members | Where-Object { $CoveredIndexSymbols.ContainsKey($_) })
  $missing = @($members | Where-Object { -not $CoveredIndexSymbols.ContainsKey($_) })
  $coverage[$indexName] = [ordered]@{ proxy = $IndexEtfs[$indexName]; total = $members.Count; covered = $covered.Count; missing = $missing }
}

"window.DADDY_ASSET_DB = $($Db | ConvertTo-Json -Depth 10);`n" | Set-Content -LiteralPath $OutFile -Encoding utf8
$Review | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReviewFile -Encoding utf8
$coverage | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $CoverageFile -Encoding utf8

Write-Host "Wrote $($Db.assets.Count) assets to $OutFile"
Write-Host "Wrote $($Review.Count) review candidates to $ReviewFile"
Write-Host "Wrote index coverage report to $CoverageFile"
