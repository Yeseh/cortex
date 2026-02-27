#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Temp-isolated acceptance test for the current Cortex CLI.

.DESCRIPTION
    Runs a focused end-to-end smoke flow against the current CLI interface,
    using a temporary config root and temporary HOME so real user config is
    never touched.

.PARAMETER KeepStore
    Keep temporary files for debugging.

.EXAMPLE
    ./scripts/acceptance-test.ps1

.EXAMPLE
    ./scripts/acceptance-test.ps1 -KeepStore
#>

[CmdletBinding()]
param(
    [switch]$KeepStore
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor DarkGray
}

function Write-Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Assert-Contains {
    param(
        [Parameter(Mandatory)][string]$Haystack,
        [Parameter(Mandatory)][string]$Needle,
        [Parameter(Mandatory)][string]$Message
    )

    if ($Haystack -like "*${Needle}*") {
        Write-Pass $Message
    }
    else {
        Write-Fail "$Message (missing '$Needle')"
        throw "Assertion failed"
    }
}

function Invoke-Cortex {
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        [string]$StdinContent,
        [switch]$AllowFailure,
        [Parameter(Mandatory)][string]$CliPath,
        [Parameter(Mandatory)][string]$WorkDir
    )

    $result = @{
        ExitCode = 0
        Output = ""
    }

    $old = Get-Location
    try {
        Set-Location $WorkDir
        if ($PSBoundParameters.ContainsKey('StdinContent')) {
            $result.Output = $StdinContent | bun run $CliPath @Arguments 2>&1
        }
        else {
            $result.Output = bun run $CliPath @Arguments 2>&1
        }
        $result.ExitCode = $LASTEXITCODE
    }
    finally {
        Set-Location $old
    }

    if ($result.Output -is [array]) {
        $result.Output = $result.Output -join "`n"
    }

    if (-not $AllowFailure -and $result.ExitCode -ne 0) {
        Write-Host $result.Output
        throw "Command failed: bun run $CliPath $($Arguments -join ' ')"
    }

    return $result
}

function Main {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $cliPath = (Join-Path $repoRoot "packages/cli/src/run.ts") -replace '\\', '/'

    if (-not (Test-Path $cliPath)) {
        throw "CLI entrypoint not found at $cliPath"
    }

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "cortex-acceptance-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $workDir = Join-Path $tempRoot "workdir"
    $homeDir = Join-Path $tempRoot "home"
    $configDir = Join-Path $homeDir ".config/cortex"

    $tempRoot = $tempRoot -replace '\\', '/'
    $workDir = $workDir -replace '\\', '/'
    $homeDir = $homeDir -replace '\\', '/'
    $configDir = $configDir -replace '\\', '/'

    New-Item -ItemType Directory -Path $workDir -Force | Out-Null
    New-Item -ItemType Directory -Path $homeDir -Force | Out-Null

    $oldHome = $env:HOME
    $oldConfigDir = $env:CORTEX_CONFIG_DIR
    $oldConfigCwd = $env:CORTEX_CONFIG_CWD

    $env:HOME = $homeDir
    $env:CORTEX_CONFIG_DIR = $configDir
    $env:CORTEX_CONFIG_CWD = $workDir

    Write-Info "Temp root: $tempRoot"
    Write-Info "Config dir: $configDir"
    Write-Info "Work dir: $workDir"

    try {
        $init = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("init", "--format", "json")
        Assert-Contains -Haystack $init.Output -Needle '"kind": "init"' -Message "init returns structured output"

        $configPath = Join-Path $configDir "config.yaml"
        if (Test-Path $configPath) {
            Write-Pass "config.yaml created in isolated config root"
        }
        else {
            throw "Expected config file at $configPath"
        }

        $add = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("memory", "--store", "global", "add", "standards/cli-smoke", "-c", "temp test memory", "--format", "json")
        Assert-Contains -Haystack $add.Output -Needle "standards/cli-smoke" -Message "memory add succeeds"

        $show = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("memory", "--store", "global", "show", "standards/cli-smoke", "--format", "json")
        Assert-Contains -Haystack $show.Output -Needle "temp test memory" -Message "memory show returns created content"

        $update = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("memory", "--store", "global", "update", "standards/cli-smoke", "-c", "updated content", "--format", "json")
        Assert-Contains -Haystack $update.Output -Needle "standards/cli-smoke" -Message "memory update succeeds"

        $list = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("memory", "--store", "global", "list", "standards", "--format", "json")
        Assert-Contains -Haystack $list.Output -Needle "cli-smoke" -Message "memory list shows created memory"

        $move = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("memory", "--store", "global", "move", "standards/cli-smoke", "standards/cli-smoke-moved", "--format", "json")
        Assert-Contains -Haystack $move.Output -Needle "cli-smoke-moved" -Message "memory move succeeds"

        $showMoved = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("memory", "--store", "global", "show", "standards/cli-smoke-moved", "--format", "json")
        Assert-Contains -Haystack $showMoved.Output -Needle "updated content" -Message "moved memory retains updated content"

        $remove = Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("memory", "--store", "global", "remove", "standards/cli-smoke-moved", "--format", "json")
        Assert-Contains -Haystack $remove.Output -Needle "standards/cli-smoke-moved" -Message "memory remove succeeds"

        [void](Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("store", "list", "--format", "json"))
        Write-Pass "store list succeeds"

        [void](Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("store", "--store", "global", "reindex"))
        Write-Pass "store reindex succeeds"

        [void](Invoke-Cortex -CliPath $cliPath -WorkDir $workDir -Arguments @("store", "--store", "global", "prune"))
        Write-Pass "store prune succeeds"

        Write-Host ""
        Write-Host "ALL ACCEPTANCE CHECKS PASSED" -ForegroundColor Green
    }
    catch {
        Write-Host ""
        Write-Host "ACCEPTANCE CHECK FAILED" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
    finally {
        $env:HOME = $oldHome
        $env:CORTEX_CONFIG_DIR = $oldConfigDir
        $env:CORTEX_CONFIG_CWD = $oldConfigCwd

        if (-not $KeepStore -and (Test-Path $tempRoot)) {
            Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
            Write-Info "Cleaned temp root: $tempRoot"
        }
        elseif ($KeepStore) {
            Write-Info "Kept temp root for inspection: $tempRoot"
        }
    }
}

Main
