@echo off
chcp 65001 >nul
set "SCRIPT_PATH=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$code = [System.IO.File]::ReadAllText($env:SCRIPT_PATH, [System.Text.Encoding]::UTF8); $marker = '#' + '__PS_START__'; $idx = $code.IndexOf($marker); if ($idx -lt 0) { Write-Error 'Installer payload missing.'; exit 1 }; & ([scriptblock]::Create($code.Substring($idx)))"
exit /b %ERRORLEVEL%
#__PS_START__
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/7madh1/ArabicDiscord.git"
$VencordRepoUrl = "https://github.com/Vendicated/Vencord.git"
$BdPluginUrl = "https://raw.githubusercontent.com/7madh1/ArabicDiscord/main/betterdiscord/ArabicDiscord.plugin.js"
$BdInstallerUrl = "https://github.com/BetterDiscord/Installer/releases/latest/download/BetterDiscord-Windows.exe"

function Write-Header {
    Clear-Host
    Write-Host @'
  _____                      _ _     
 |___  |_ __ ___   __ _   __| | |__  
    / /| '_ ` _ \ / _` | / _` | '_ \ 
   / / | | | | | | (_| || (_| | | | |
  /_/  |_| |_| |_|\__,_| \__,_|_| |_|
'@ -ForegroundColor Cyan
    Write-Host "  ======================================================" -ForegroundColor DarkCyan
    Write-Host "    ArabicDiscord v0.1.0  |  Vencord & BetterDiscord    " -ForegroundColor White
    Write-Host "                Crafted by 7madh                        " -ForegroundColor Magenta
    Write-Host "  ======================================================" -ForegroundColor DarkCyan
    Write-Host ""
}

function Get-DiscordAppDirs {
    $base = Join-Path $env:LOCALAPPDATA "Discord"
    if (-not (Test-Path $base)) { return @() }
    return Get-ChildItem -Path $base -Directory -Filter "app-*" | Sort-Object Name -Descending
}

function Test-BetterDiscordInjected {
    foreach ($dir in Get-DiscordAppDirs) {
        if (Test-Path (Join-Path $dir.FullName "resources\betterdiscord.app.asar")) {
            return $true
        }
    }
    return $false
}

function Test-VencordInjected {
    foreach ($dir in Get-DiscordAppDirs) {
        if ((Test-Path (Join-Path $dir.FullName "resources\_app.asar")) -or (Test-Path (Join-Path $dir.FullName "resources\app\package.json"))) {
            return $true
        }
    }
    return $false
}

function Stop-DiscordProcesses {
    $procs = Get-Process -Name "*Discord*" -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "[*] Closing Discord..." -ForegroundColor Yellow
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

function Start-DiscordClient {
    $updater = Join-Path $env:LOCALAPPDATA "Discord\Update.exe"
    if (Test-Path $updater) {
        Write-Host "[*] Launching Discord..." -ForegroundColor Green
        Start-Process -FilePath $updater -ArgumentList "--processStart", "Discord.exe"
    }
}

function Enable-BetterDiscordPlugin {
    param([string]$BdRoot)
    $pluginsJsonPath = Join-Path $BdRoot "data\stable\plugins.json"
    $parent = Split-Path -Parent $pluginsJsonPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $map = @{}
    if (Test-Path $pluginsJsonPath) {
        try {
            $parsed = Get-Content -Raw -Encoding UTF8 $pluginsJsonPath | ConvertFrom-Json
            if ($parsed) {
                foreach ($prop in $parsed.PSObject.Properties) {
                    $map[$prop.Name] = $prop.Value
                }
            }
        } catch {
            $map = @{}
        }
    }
    $map["ArabicDiscord"] = $true
    $json = $map | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($pluginsJsonPath, "$json`n", (New-Object System.Text.UTF8Encoding($false)))
}

function Install-ForBetterDiscord {
    Write-Header
    Write-Host "[*] Target: BetterDiscord" -ForegroundColor Green
    Write-Host ""

    if (Test-VencordInjected) {
        Write-Host "[!] Vencord appears to be injected into Discord right now." -ForegroundColor Yellow
        Write-Host "    Vencord and BetterDiscord cannot run on the same Discord installation." -ForegroundColor Yellow
        Write-Host "    Please uninject Vencord first (pnpm.cmd uninject) if you want BetterDiscord." -ForegroundColor Yellow
        $cont = Read-Host "Continue anyway? (y/N)"
        if ($cont -notmatch "^[yY]") { return }
    }

    $bdRoot = Join-Path $env:APPDATA "BetterDiscord"
    $bdPlugins = Join-Path $bdRoot "plugins"

    if (-not (Test-BetterDiscordInjected) -or -not (Test-Path $bdPlugins)) {
        Write-Host "[!] BetterDiscord does not look fully installed yet." -ForegroundColor Yellow
        $dl = Read-Host "Download and launch official BetterDiscord Installer now? (Y/n)"
        if ($dl -notmatch "^[nN]") {
            $installerExe = Join-Path $env:TEMP "BetterDiscord-Windows.exe"
            Write-Host "[*] Downloading BetterDiscord Installer..." -ForegroundColor Cyan
            Invoke-WebRequest -Uri $BdInstallerUrl -OutFile $installerExe -UseBasicParsing
            Write-Host "[*] Complete the BetterDiscord Installer window (Install -> Discord), then return here." -ForegroundColor Cyan
            Start-Process -FilePath $installerExe -Wait
        }
    }

    if (-not (Test-Path $bdPlugins)) {
        New-Item -ItemType Directory -Force -Path $bdPlugins | Out-Null
    }

    $destPlugin = Join-Path $bdPlugins "ArabicDiscord.plugin.js"
    Write-Host "[*] Downloading latest ArabicDiscord.plugin.js..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $BdPluginUrl -OutFile $destPlugin -UseBasicParsing
    Enable-BetterDiscordPlugin -BdRoot $bdRoot

    Write-Host ""
    Write-Host "[OK] Installed ArabicDiscord.plugin.js to:" -ForegroundColor Green
    Write-Host "     $destPlugin" -ForegroundColor Gray
    Write-Host "     Plugin enabled automatically in BetterDiscord settings." -ForegroundColor Green
    Write-Host ""

    $restart = Read-Host "Restart Discord now? (Y/n)"
    if ($restart -notmatch "^[nN]") {
        Stop-DiscordProcesses
        Start-DiscordClient
    }
}

function Ensure-Command {
    param(
        [string]$Cmd,
        [string]$Label,
        [string]$WingetId,
        [string]$HelpUrl
    )
    if (Get-Command $Cmd -ErrorAction SilentlyContinue) { return $true }
    Write-Host "[!] $Label ($Cmd) is not installed." -ForegroundColor Yellow
    if ($WingetId -and (Get-Command "winget" -ErrorAction SilentlyContinue)) {
        $ans = Read-Host "Install $Label automatically using winget? (Y/n)"
        if ($ans -notmatch "^[nN]") {
            winget install --id $WingetId --accept-source-agreements --accept-package-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            if (Get-Command $Cmd -ErrorAction SilentlyContinue) { return $true }
        }
    }
    Write-Host "    Please install $Label from: $HelpUrl" -ForegroundColor Red
    Write-Host "    Then re-run this installer." -ForegroundColor Red
    return $false
}

function Ensure-Pnpm {
    if (Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue) { return $true }
    if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) {
        Write-Host "[*] Installing pnpm globally via npm..." -ForegroundColor Cyan
        & npm.cmd install -g pnpm
        $npmBin = Join-Path $env:APPDATA "npm"
        if ($env:Path -notlike "*$npmBin*") { $env:Path = "$env:Path;$npmBin" }
        if (Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue) { return $true }
    }
    Write-Host "[!] pnpm was not found. Run: npm install -g pnpm" -ForegroundColor Red
    return $false
}

function Install-ForVencord {
    Write-Header
    Write-Host "[*] Target: Vencord (From Source)" -ForegroundColor Green
    Write-Host ""

    if (Test-BetterDiscordInjected) {
        Write-Host "[!] BetterDiscord is currently injected into Discord." -ForegroundColor Yellow
        Write-Host "    Uninstall BetterDiscord first via BetterDiscord Installer before injecting Vencord." -ForegroundColor Yellow
        $cont = Read-Host "Continue anyway? (y/N)"
        if ($cont -notmatch "^[yY]") { return }
    }

    if (-not (Ensure-Command -Cmd "git" -Label "Git" -WingetId "Git.Git" -HelpUrl "https://git-scm.com/downloads")) { return }
    if (-not (Ensure-Command -Cmd "node" -Label "Node.js LTS" -WingetId "OpenJS.NodeJS.LTS" -HelpUrl "https://nodejs.org")) { return }
    if (-not (Ensure-Pnpm)) { return }

    $defaultDir = Join-Path $env:USERPROFILE "Vencord"
    $inputDir = Read-Host "Vencord folder path [Press Enter for $defaultDir]"
    $vencordDir = if ([string]::IsNullOrWhiteSpace($inputDir)) { $defaultDir } else { $inputDir.Trim().Trim('"') }

    $ErrorActionPreference = "Continue"
    if (-not (Test-Path (Join-Path $vencordDir ".git"))) {
        Write-Host "[*] Cloning Vencord into $vencordDir..." -ForegroundColor Cyan
        & git clone $VencordRepoUrl $vencordDir
        if ($LASTEXITCODE -ne 0) { throw "Failed to clone Vencord." }
    } else {
        Write-Host "[*] Updating existing Vencord repository..." -ForegroundColor Cyan
        & git -C $vencordDir pull --ff-only
    }

    $userPluginsDir = Join-Path $vencordDir "src\userplugins"
    if (-not (Test-Path $userPluginsDir)) {
        New-Item -ItemType Directory -Force -Path $userPluginsDir | Out-Null
    }

    $pluginDir = Join-Path $userPluginsDir "arabicDiscord"
    if (-not (Test-Path (Join-Path $pluginDir ".git"))) {
        if (Test-Path $pluginDir) {
            Remove-Item -Recurse -Force $pluginDir
        }
        Write-Host "[*] Cloning ArabicDiscord plugin..." -ForegroundColor Cyan
        & git clone $RepoUrl $pluginDir
        if ($LASTEXITCODE -ne 0) { throw "Failed to clone ArabicDiscord." }
    } else {
        Write-Host "[*] Updating ArabicDiscord plugin..." -ForegroundColor Cyan
        & git -C $pluginDir pull --ff-only
    }
    $ErrorActionPreference = "Stop"

    if (-not (Test-Path (Join-Path $pluginDir "index.tsx"))) {
        throw "Invalid plugin layout: index.tsx missing in $pluginDir"
    }

    Push-Location $vencordDir
    try {
        Write-Host "[*] Installing Vencord dependencies (pnpm.cmd install)..." -ForegroundColor Cyan
        & pnpm.cmd install
        if ($LASTEXITCODE -ne 0) { throw "pnpm install failed." }

        Write-Host "[*] Building Vencord + ArabicDiscord (pnpm.cmd build)..." -ForegroundColor Cyan
        & pnpm.cmd build
        if ($LASTEXITCODE -ne 0) { throw "pnpm build failed." }

        Stop-DiscordProcesses
        Write-Host "[*] Launching Vencord injector (choose Install -> Discord)..." -ForegroundColor Cyan
        & pnpm.cmd inject
        if ($LASTEXITCODE -ne 0) { throw "pnpm inject failed." }
    } finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "[OK] Vencord + ArabicDiscord built and injected!" -ForegroundColor Green
    Write-Host "     Open Discord -> Settings -> Vencord -> Plugins -> Enable ArabicDiscord." -ForegroundColor Gray
    Write-Host ""

    $launch = Read-Host "Launch Discord now? (Y/n)"
    if ($launch -notmatch "^[nN]") {
        Start-DiscordClient
    }
}

function Update-ArabicDiscord {
    Write-Header
    Write-Host "[*] Checking existing installations..." -ForegroundColor Cyan
    $updatedAny = $false

    $bdPlugin = Join-Path $env:APPDATA "BetterDiscord\plugins\ArabicDiscord.plugin.js"
    if (Test-Path $bdPlugin) {
        Write-Host "[*] Updating BetterDiscord plugin..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $BdPluginUrl -OutFile $bdPlugin -UseBasicParsing
        Write-Host "[OK] Updated $bdPlugin" -ForegroundColor Green
        $updatedAny = $true
    }

    $candidates = @(
        (Join-Path $env:USERPROFILE "Vencord"),
        "C:\Dev\arabic-discord"
    )
    $custom = Read-Host "Vencord folder to update [Enter to auto-check or skip]"
    if (-not [string]::IsNullOrWhiteSpace($custom)) {
        $candidates = @($custom.Trim().Trim('"')) + $candidates
    }

    foreach ($dir in ($candidates | Select-Object -Unique)) {
        $pDir = Join-Path $dir "src\userplugins\arabicDiscord"
        if (Test-Path (Join-Path $pDir ".git")) {
            Write-Host "[*] Updating Vencord plugin in $dir..." -ForegroundColor Cyan
            & git -C $pDir pull --ff-only
            Push-Location $dir
            try {
                & pnpm.cmd build
            } finally {
                Pop-Location
            }
            Write-Host "[OK] Rebuilt Vencord + ArabicDiscord in $dir" -ForegroundColor Green
            $updatedAny = $true
            break
        }
    }

    if (-not $updatedAny) {
        Write-Host "[!] No existing BetterDiscord or Vencord ArabicDiscord installation found." -ForegroundColor Yellow
    }
}

while ($true) {
    Write-Header
    Write-Host "Choose your Discord client mod:" -ForegroundColor White
    Write-Host ""
    Write-Host "  [1] BetterDiscord  (One-click plugin install + auto updates)" -ForegroundColor Green
    Write-Host "  [2] Vencord        (Automatic source clone, build & inject)" -ForegroundColor Cyan
    Write-Host "  [3] Update         (Update existing ArabicDiscord installation)" -ForegroundColor Yellow
    Write-Host "  [4] Exit" -ForegroundColor Gray
    Write-Host ""
    $choice = Read-Host "Enter choice (1-4)"

    try {
        switch ($choice) {
            "1" { Install-ForBetterDiscord; Read-Host "Press Enter to return to menu" }
            "2" { Install-ForVencord; Read-Host "Press Enter to return to menu" }
            "3" { Update-ArabicDiscord; Read-Host "Press Enter to return to menu" }
            "4" { break }
            default { Write-Host "Invalid choice." -ForegroundColor Red; Start-Sleep -Seconds 1 }
        }
        if ($choice -eq "4") { break }
    } catch {
        Write-Host ""
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
        Read-Host "Press Enter to continue"
    }
}
