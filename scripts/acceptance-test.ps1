#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Acceptance test script for Cortex CLI - simulates common user workflows.

.DESCRIPTION
    This script creates a temporary store and exercises the main CLI commands
    to verify the system works as expected. It emulates what a user would do
    when manually testing the CLI.

.PARAMETER Verbose
    Show detailed output for each step.

.PARAMETER KeepStore
    Don't clean up the temporary store after tests (useful for debugging).

.EXAMPLE
    ./scripts/acceptance-test.ps1
    
.EXAMPLE
    ./scripts/acceptance-test.ps1 -Verbose -KeepStore
#>

[CmdletBinding()]
param(
    [switch]$KeepStore
)

$ErrorActionPreference = "Stop"
$script:TestsPassed = 0
$script:TestsFailed = 0
$script:TestsSkipped = 0

# Colors for output
function Write-TestHeader($message) {
    Write-Host ""
    Write-Host "=== $message ===" -ForegroundColor Cyan
}

function Write-TestStep($message) {
    Write-Host "  -> $message" -ForegroundColor Gray
}

function Write-TestPass($message) {
    Write-Host "  [PASS] $message" -ForegroundColor Green
    $script:TestsPassed++
}

function Write-TestFail($message, $details = $null) {
    Write-Host "  [FAIL] $message" -ForegroundColor Red
    if ($details) {
        Write-Host "         $details" -ForegroundColor DarkRed
    }
    $script:TestsFailed++
}

function Write-TestSkip($message) {
    Write-Host "  [SKIP] $message" -ForegroundColor Yellow
    $script:TestsSkipped++
}

function Write-TestInfo($message) {
    Write-Host "  [INFO] $message" -ForegroundColor DarkGray
}

# Run cortex command and return result
function Invoke-Cortex {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,
        [string]$StoreRoot,
        [switch]$AllowFailure,
        [string]$StdinContent,
        [string]$WorkDir
    )
    
    $cortexArgs = @()
    if ($StoreRoot) {
        $cortexArgs += "--global-store"
        $cortexArgs += $StoreRoot
    }
    $cortexArgs += $Arguments
    
    # Build the full command - we need to run from a directory without .cortex
    $cliPath = (Resolve-Path "src/cli/run.ts").Path -replace '\\', '/'
    
    Write-Verbose "Running: bun run $cliPath $($cortexArgs -join ' ')"
    
    $result = @{
        ExitCode = 0
        Output = ""
        Error = ""
    }
    
    try {
        # Save current location and change to work directory
        $originalLocation = Get-Location
        if ($WorkDir) {
            Set-Location $WorkDir
        }
        
        try {
            if ($StdinContent) {
                $result.Output = $StdinContent | bun run $cliPath @cortexArgs 2>&1
            } else {
                $result.Output = bun run $cliPath @cortexArgs 2>&1
            }
            $result.ExitCode = $LASTEXITCODE
        }
        finally {
            # Restore original location
            Set-Location $originalLocation
        }
        
        # Convert output array to string if needed
        if ($result.Output -is [array]) {
            $result.Output = $result.Output -join "`n"
        }
    }
    catch {
        $result.Error = $_.Exception.Message
        $result.ExitCode = 1
    }
    
    if (-not $AllowFailure -and $result.ExitCode -ne 0) {
        Write-TestInfo "Command output: $($result.Output)"
        throw "Cortex command failed with exit code $($result.ExitCode)"
    }
    
    return $result
}

# Assert that a condition is true
function Assert-True {
    param(
        [Parameter(Mandatory)]
        [bool]$Condition,
        [Parameter(Mandatory)]
        [string]$Message,
        [string]$Details = $null
    )
    
    if ($Condition) {
        Write-TestPass $Message
    } else {
        Write-TestFail $Message $Details
        throw "Assertion failed: $Message"
    }
}

# Assert that output contains a string
function Assert-Contains {
    param(
        [Parameter(Mandatory)]
        [string]$Haystack,
        [Parameter(Mandatory)]
        [string]$Needle,
        [Parameter(Mandatory)]
        [string]$Message
    )
    
    if ($Haystack -match [regex]::Escape($Needle)) {
        Write-TestPass $Message
    } else {
        Write-TestFail $Message "Expected to find '$Needle' in output"
        Write-TestInfo "Actual output: $Haystack"
        throw "Assertion failed: $Message"
    }
}

# Assert that output matches a regex pattern
function Assert-Matches {
    param(
        [Parameter(Mandatory)]
        [string]$Haystack,
        [Parameter(Mandatory)]
        [string]$Pattern,
        [Parameter(Mandatory)]
        [string]$Message
    )
    
    if ($Haystack -match $Pattern) {
        Write-TestPass $Message
    } else {
        Write-TestFail $Message "Expected to match pattern '$Pattern'"
        Write-TestInfo "Actual output: $Haystack"
        throw "Assertion failed: $Message"
    }
}

# Assert that a file exists
function Assert-FileExists {
    param(
        [Parameter(Mandatory)]
        [string]$Path,
        [Parameter(Mandatory)]
        [string]$Message
    )
    
    if (Test-Path $Path) {
        Write-TestPass $Message
    } else {
        Write-TestFail $Message "File not found: $Path"
        throw "Assertion failed: $Message"
    }
}

# Main test execution
function Main {
    Write-Host ""
    Write-Host "Cortex CLI Acceptance Tests" -ForegroundColor Magenta
    Write-Host "============================" -ForegroundColor Magenta
    Write-Host ""
    
    # Setup: Create temporary directory
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "cortex-acceptance-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $storeRoot = Join-Path $tempRoot "memory"
    
    # Convert to forward slashes for cross-platform compatibility with bun/node
    $storeRoot = $storeRoot -replace '\\', '/'
    $tempRoot = $tempRoot -replace '\\', '/'
    
    Write-TestInfo "Test store location: $storeRoot"
    
    try {
        # ============================================================
        # TEST GROUP: Store Initialization
        # ============================================================
        Write-TestHeader "Store Initialization"
        
        Write-TestStep "Creating temporary directory structure"
        New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
        
        Write-TestStep "Initializing a new store with 'store init'"
        $result = Invoke-Cortex -Arguments @("store", "init", $storeRoot) -WorkDir $tempRoot
        Assert-Contains $result.Output "path:" "Store init returns path in output"
        Assert-FileExists (Join-Path $storeRoot "index.yaml") "Root index.yaml was created"
        
        # ============================================================
        # TEST GROUP: Adding Memories
        # ============================================================
        Write-TestHeader "Adding Memories"
        
        Write-TestStep "Adding a memory with inline content"
        $result = Invoke-Cortex -Arguments @(
            "add", "project/tech-stack",
            "--content", "Using TypeScript with Bun runtime. Database: SQLite."
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Added memory" "Add command reports success"
        Assert-FileExists (Join-Path $storeRoot "project" "tech-stack.md") "Memory file was created"
        
        Write-TestStep "Adding a memory with tags"
        $result = Invoke-Cortex -Arguments @(
            "add", "project/architecture",
            "--content", "Event-driven microservices with message queues.",
            "--tags", "architecture,microservices,events"
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Added memory" "Add with tags reports success"
        
        Write-TestStep "Adding a memory with expiration"
        $expiryDate = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
        $result = Invoke-Cortex -Arguments @(
            "add", "project/sprint-goal",
            "--content", "Complete the authentication module by end of sprint.",
            "--expires-at", $expiryDate
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Added memory" "Add with expiration reports success"
        
        Write-TestStep "Adding a memory in a nested category"
        $result = Invoke-Cortex -Arguments @(
            "add", "domain/payments/stripe-integration",
            "--content", "Stripe API keys stored in env. Webhook endpoint at /api/webhooks/stripe."
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Added memory" "Add in nested category reports success"
        Assert-FileExists (Join-Path $storeRoot "domain" "payments" "stripe-integration.md") "Nested memory file was created"
        
        Write-TestStep "Adding a memory using stdin pipe"
        $result = Invoke-Cortex -Arguments @(
            "add", "human/coding-preferences"
        ) -StoreRoot $storeRoot -WorkDir $tempRoot -StdinContent "Prefers Result<T,E> pattern over exceptions. Uses functional programming style."
        Assert-Contains $result.Output "Added memory" "Add via stdin reports success"
        
        # NOTE: Currently the add command does not update indexes (allowIndexUpdate: false).
        # We need to run reindex to build the category indexes for list to work.
        Write-TestStep "Running reindex to build category indexes"
        $result = Invoke-Cortex -Arguments @("reindex") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Reindexed" "Reindex builds indexes after add"
        
        # ============================================================
        # TEST GROUP: Viewing Memories
        # ============================================================
        Write-TestHeader "Viewing Memories"
        
        Write-TestStep "Showing a memory with 'show' command"
        $result = Invoke-Cortex -Arguments @("show", "project/tech-stack") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "TypeScript" "Show displays memory content"
        Assert-Contains $result.Output "# project/tech-stack" "Show includes path as header"
        
        Write-TestStep "Showing memory metadata"
        $result = Invoke-Cortex -Arguments @("show", "project/architecture") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Matches $result.Output "tags:" "Show displays tags"
        Assert-Contains $result.Output "architecture" "Tags include expected value"
        
        # ============================================================
        # TEST GROUP: Listing Memories
        # ============================================================
        Write-TestHeader "Listing Memories"
        
        Write-TestStep "Listing all memories"
        $result = Invoke-Cortex -Arguments @("list") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "memories:" "List returns memories array"
        Assert-Contains $result.Output "project/tech-stack" "List includes added memory"
        Assert-Contains $result.Output "project/architecture" "List includes multiple memories"
        
        Write-TestStep "Listing memories in a specific category"
        $result = Invoke-Cortex -Arguments @("list", "project") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "project/tech-stack" "Category list includes project memories"
        # Should NOT include domain memories
        if ($result.Output -match "domain/payments") {
            Write-TestFail "Category list should not include memories from other categories"
        } else {
            Write-TestPass "Category list excludes other categories"
        }
        
        Write-TestStep "Listing with JSON format"
        $result = Invoke-Cortex -Arguments @("list", "--format", "json") -StoreRoot $storeRoot -WorkDir $tempRoot
        $json = $result.Output | ConvertFrom-Json -ErrorAction SilentlyContinue
        Assert-True ($null -ne $json) "JSON output is valid JSON" "Output: $($result.Output)"
        Assert-True ($json.memories.Count -gt 0) "JSON contains memories array"
        
        Write-TestStep "Listing with TOON format"
        $result = Invoke-Cortex -Arguments @("list", "--format", "toon") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "memories" "TOON output contains memories"
        
        # ============================================================
        # TEST GROUP: Updating Memories
        # ============================================================
        Write-TestHeader "Updating Memories"
        
        Write-TestStep "Updating memory content"
        $result = Invoke-Cortex -Arguments @(
            "update", "project/tech-stack",
            "--content", "Using TypeScript with Bun runtime. Database: PostgreSQL (migrated from SQLite)."
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Updated memory" "Update command reports success"
        
        Write-TestStep "Verifying update was applied"
        $result = Invoke-Cortex -Arguments @("show", "project/tech-stack") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "PostgreSQL" "Updated content is visible"
        
        Write-TestStep "Updating memory tags"
        $result = Invoke-Cortex -Arguments @(
            "update", "project/tech-stack",
            "--tags", "typescript,bun,postgresql,backend"
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Updated memory" "Tag update reports success"
        
        Write-TestStep "Verifying tag update"
        $result = Invoke-Cortex -Arguments @("show", "project/tech-stack") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "postgresql" "Updated tags are visible"
        
        Write-TestStep "Setting expiration on existing memory"
        $newExpiry = (Get-Date).AddDays(30).ToString("yyyy-MM-ddTHH:mm:ssZ")
        $result = Invoke-Cortex -Arguments @(
            "update", "project/architecture",
            "--expires-at", $newExpiry
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Updated memory" "Expiry update reports success"
        
        Write-TestStep "Clearing expiration"
        $result = Invoke-Cortex -Arguments @(
            "update", "project/sprint-goal",
            "--clear-expiry"
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Updated memory" "Clear expiry reports success"
        
        # ============================================================
        # TEST GROUP: Moving Memories
        # ============================================================
        Write-TestHeader "Moving Memories"
        
        Write-TestStep "Adding a memory to move"
        $result = Invoke-Cortex -Arguments @(
            "add", "project/temp-notes",
            "--content", "These are temporary notes to be reorganized."
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        
        # Reindex to ensure indexes exist
        Invoke-Cortex -Arguments @("reindex") -StoreRoot $storeRoot -WorkDir $tempRoot | Out-Null
        
        Write-TestStep "Moving memory to new location (within same category)"
        $result = Invoke-Cortex -Arguments @(
            "move", "project/temp-notes", "project/archived-notes"
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Moved memory" "Move command reports success"
        
        Write-TestStep "Verifying memory exists at new location"
        $result = Invoke-Cortex -Arguments @("show", "project/archived-notes") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "temporary notes" "Memory content at new location"
        
        Write-TestStep "Verifying memory removed from old location"
        $result = Invoke-Cortex -Arguments @("show", "project/temp-notes") -StoreRoot $storeRoot -WorkDir $tempRoot -AllowFailure
        Assert-True ($result.ExitCode -ne 0) "Memory not found at old location (expected failure)"
        
        # ============================================================
        # TEST GROUP: Removing Memories
        # ============================================================
        Write-TestHeader "Removing Memories"
        
        Write-TestStep "Adding a memory to remove"
        $result = Invoke-Cortex -Arguments @(
            "add", "project/to-delete",
            "--content", "This memory will be deleted."
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        
        Write-TestStep "Removing the memory"
        $result = Invoke-Cortex -Arguments @("remove", "project/to-delete") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Removed memory" "Remove command reports success"
        
        Write-TestStep "Verifying memory was removed"
        $result = Invoke-Cortex -Arguments @("show", "project/to-delete") -StoreRoot $storeRoot -WorkDir $tempRoot -AllowFailure
        Assert-True ($result.ExitCode -ne 0) "Memory not found after removal (expected failure)"
        
        # ============================================================
        # TEST GROUP: Expiration and Pruning
        # ============================================================
        Write-TestHeader "Expiration and Pruning"
        
        Write-TestStep "Adding an expired memory"
        $pastExpiry = (Get-Date).AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ssZ")
        $result = Invoke-Cortex -Arguments @(
            "add", "project/expired-task",
            "--content", "This task has already expired.",
            "--expires-at", $pastExpiry
        ) -StoreRoot $storeRoot -WorkDir $tempRoot
        
        Write-TestStep "Listing without expired memories (default)"
        $result = Invoke-Cortex -Arguments @("list", "project") -StoreRoot $storeRoot -WorkDir $tempRoot
        if ($result.Output -match "project/expired-task") {
            Write-TestFail "Default list should exclude expired memories"
        } else {
            Write-TestPass "Default list excludes expired memories"
        }
        
        Write-TestStep "Listing with expired memories"
        $result = Invoke-Cortex -Arguments @("list", "project", "--include-expired") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "project/expired-task" "Include-expired shows expired memories"
        
        Write-TestStep "Running prune to remove expired memories"
        $result = Invoke-Cortex -Arguments @("prune") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Matches $result.Output "(Pruned|No expired)" "Prune command completes"
        
        Write-TestStep "Verifying expired memory was pruned"
        $result = Invoke-Cortex -Arguments @("list", "project", "--include-expired") -StoreRoot $storeRoot -WorkDir $tempRoot
        if ($result.Output -match "project/expired-task") {
            Write-TestFail "Expired memory should have been pruned"
        } else {
            Write-TestPass "Expired memory was pruned successfully"
        }
        
        # ============================================================
        # TEST GROUP: Reindexing
        # ============================================================
        Write-TestHeader "Reindexing"
        
        Write-TestStep "Running reindex command"
        $result = Invoke-Cortex -Arguments @("reindex") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "Reindexed" "Reindex command reports success"
        
        Write-TestStep "Verifying index integrity after reindex"
        $result = Invoke-Cortex -Arguments @("list") -StoreRoot $storeRoot -WorkDir $tempRoot
        Assert-Contains $result.Output "memories:" "List works after reindex"
        
        # ============================================================
        # TEST GROUP: Error Handling
        # ============================================================
        Write-TestHeader "Error Handling"
        
        Write-TestStep "Attempting to show non-existent memory"
        $result = Invoke-Cortex -Arguments @("show", "nonexistent/memory") -StoreRoot $storeRoot -WorkDir $tempRoot -AllowFailure
        Assert-True ($result.ExitCode -ne 0) "Show non-existent memory fails gracefully"
        
        Write-TestStep "Attempting to add with invalid path"
        $result = Invoke-Cortex -Arguments @(
            "add", "invalid path with spaces",
            "--content", "test"
        ) -StoreRoot $storeRoot -WorkDir $tempRoot -AllowFailure
        Assert-True ($result.ExitCode -ne 0) "Add with invalid path fails gracefully"
        
        Write-TestStep "Attempting to update non-existent memory"
        $result = Invoke-Cortex -Arguments @(
            "update", "nonexistent/memory",
            "--content", "test"
        ) -StoreRoot $storeRoot -WorkDir $tempRoot -AllowFailure
        Assert-True ($result.ExitCode -ne 0) "Update non-existent memory fails gracefully"
        
        # ============================================================
        # TEST GROUP: Help System
        # ============================================================
        Write-TestHeader "Help System"
        
        Write-TestStep "Getting main help"
        $result = Invoke-Cortex -Arguments @("--help") -WorkDir $tempRoot
        Assert-Contains $result.Output "COMMANDS" "Main help shows commands"
        Assert-Contains $result.Output "add" "Main help lists add command"
        
        Write-TestStep "Getting command-specific help"
        $result = Invoke-Cortex -Arguments @("add", "--help") -WorkDir $tempRoot
        Assert-Contains $result.Output "cortex add" "Command help shows usage"
        Assert-Contains $result.Output "--content" "Command help shows options"
        
        # ============================================================
        # Summary
        # ============================================================
        Write-Host ""
        Write-Host "============================" -ForegroundColor Magenta
        Write-Host "Test Summary" -ForegroundColor Magenta
        Write-Host "============================" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "  Passed:  $script:TestsPassed" -ForegroundColor Green
        Write-Host "  Failed:  $script:TestsFailed" -ForegroundColor $(if ($script:TestsFailed -gt 0) { "Red" } else { "Gray" })
        Write-Host "  Skipped: $script:TestsSkipped" -ForegroundColor $(if ($script:TestsSkipped -gt 0) { "Yellow" } else { "Gray" })
        Write-Host ""
        
        if ($script:TestsFailed -gt 0) {
            Write-Host "SOME TESTS FAILED" -ForegroundColor Red
            exit 1
        } else {
            Write-Host "ALL TESTS PASSED" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        Write-Host ""
        Write-Host "TEST EXECUTION FAILED" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host ""
        Write-Host "Stack trace:" -ForegroundColor DarkRed
        Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
        exit 1
    }
    finally {
        if (-not $KeepStore -and (Test-Path $tempRoot)) {
            Write-Host ""
            Write-TestInfo "Cleaning up temporary store at $tempRoot"
            Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
        } elseif ($KeepStore) {
            Write-Host ""
            Write-TestInfo "Store preserved at: $storeRoot"
        }
    }
}

# Run main
Main
