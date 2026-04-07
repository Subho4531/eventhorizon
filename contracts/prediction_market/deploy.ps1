#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Build and deploy the ZK Prediction Market Soroban contract to Stellar Testnet.

.DESCRIPTION
  1. Builds the Wasm contract (optimised release build).
  2. Generates a deployer keypair (or uses existing DEPLOYER_SECRET from env).
  3. Funds the deployer via Friendbot (testnet only).
  4. Uploads and deploys the contract via stellar CLI.
  5. Calls init() to configure the XLM token address + admin.
  6. Prints the deployed CONTRACT_ID to set in .env.

.USAGE
  cd contracts/prediction_market/
  ./deploy.ps1

.REQUIREMENTS
  - Rust + cargo
  - stellar CLI:  cargo install --locked stellar-cli --features opt
  - soroban target: rustup target add wasm32-unknown-unknown
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# $PSScriptRoot is always the absolute directory containing this script.
# This works correctly regardless of where the script is called from.
$contractDir = $PSScriptRoot
Set-Location $contractDir

$NETWORK = "testnet"
$RPC     = "https://soroban-testnet.stellar.org"
$NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"

# Native XLM SAC on Testnet
$XLM_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# ── 1. Build ─────────────────────────────────────────────────────────────────
Write-Host "`n==> Building contract (Soroban-compatible wasm) ..." -ForegroundColor Cyan
# Use 'stellar contract build' - sets the correct Rust flags for Soroban:
# -C target-feature=+reference-types,+bulk-memory,+mutable-globals etc.
# Raw 'cargo build --target wasm32-unknown-unknown' does NOT set these and
# will produce an invalid wasm that fails simulation with InvalidAction.
stellar contract build 2>&1 | ForEach-Object { Write-Host "    $_" }

# 'stellar contract build' targets wasm32v1-none (not wasm32-unknown-unknown)
$wasmPath = Join-Path $contractDir "target\wasm32v1-none\release\prediction_market.wasm"
if (!(Test-Path $wasmPath)) {
    # Fallback: also check wasm32-unknown-unknown in case of older stellar CLI
    $wasmPath = Join-Path $contractDir "target\wasm32-unknown-unknown\release\prediction_market.wasm"
    if (!(Test-Path $wasmPath)) {
        throw "Build failed - wasm not found. Run 'stellar contract build' manually to debug."
    }
}
Write-Host "    OK Wasm: $wasmPath" -ForegroundColor Green


# ── 2. Optimise with wasm-opt (if available) ─────────────────────────────────
if (Get-Command wasm-opt -ErrorAction SilentlyContinue) {
    Write-Host "`n==> Optimising with wasm-opt …" -ForegroundColor Cyan
    $optPath = "prediction_market_opt.wasm"
    wasm-opt -Oz --enable-bulk-memory $wasmPath -o $optPath
    $wasmPath = $optPath
    Write-Host "    ✓ Optimised: $optPath" -ForegroundColor Green
}

# ── 3. Deployer identity ──────────────────────────────────────────────────────
Write-Host "`n==> Setting up deployer identity ..." -ForegroundColor Cyan

if (!(Get-Command stellar -ErrorAction SilentlyContinue)) {
    throw "stellar CLI not found. Install with: cargo install --locked stellar-cli --features opt"
}

$identityName = "gravityflow-deployer"

# Convert output to string to safely use -match (handles null/array output)
$existingKeys = (stellar keys ls 2>&1) -join "`n"
if ($existingKeys -notmatch $identityName) {
    Write-Host "    Generating new keypair for '$identityName' ..."
    # Note: --no-fund was removed in stellar CLI v25+; generate never auto-funds
    stellar keys generate $identityName
}

# Capture address as a plain string (avoid calling .Trim() on an ErrorRecord)
$addrOutput = stellar keys address $identityName 2>&1
$deployerPublicKey = ($addrOutput | Where-Object { $_ -is [string] } | Select-Object -Last 1)
if ([string]::IsNullOrWhiteSpace($deployerPublicKey) -or $deployerPublicKey -notmatch "^G[A-Z0-9]{55}$") {
    throw "Failed to get deployer public key. stellar output: $addrOutput"
}
$deployerPublicKey = $deployerPublicKey.Trim()
Write-Host "    Deployer: $deployerPublicKey" -ForegroundColor Green

# ── 4. Fund via Friendbot (testnet only) ─────────────────────────────────────
Write-Host "`n==> Funding via Friendbot …" -ForegroundColor Cyan
try {
    $null = Invoke-RestMethod `
        -Uri "https://friendbot.stellar.org/?addr=$deployerPublicKey" `
        -Method GET
    Write-Host "    ✓ Funded" -ForegroundColor Green
} catch {
    Write-Warning "Friendbot funding may have failed (account may already exist)"
}

# ── 5. Deploy contract ─────────────────────────────────────────────────────────────────
Write-Host "`n==> Deploying contract to $NETWORK …" -ForegroundColor Cyan

$deployOutput = stellar contract deploy `
    --wasm $wasmPath `
    --source-account $identityName `
    --network $NETWORK 2>&1

# Filter to the last line that looks like a contract ID (starts with C, 56 chars)
$contractId = ($deployOutput | Where-Object { $_ -is [string] -and $_ -match "^C[A-Z0-9]{55}$" } | Select-Object -Last 1)

if ([string]::IsNullOrWhiteSpace($contractId)) {
    # If no contract ID found, display the full output to help debug
    Write-Host "Deploy output:" -ForegroundColor Red
    $deployOutput | ForEach-Object { Write-Host "  $_" }
    throw "Deploy failed - no contract ID found in output"
}
$contractId = $contractId.Trim()
Write-Host "    Contract deployed: $contractId" -ForegroundColor Green

# ── 6. Initialise contract ────────────────────────────────────────────────────
Write-Host "`n==> Calling init() …" -ForegroundColor Cyan
stellar contract invoke `
    --id $contractId `
    --source-account $identityName `
    --network $NETWORK `
    -- init `
    --admin $deployerPublicKey `
    --xlm_token $XLM_TOKEN

Write-Host "    ✓ Contract initialised" -ForegroundColor Green

# ── 7. Output ─────────────────────────────────────────────────────────────────
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║              GravityFlow Contract Deployed!                  ║
╠══════════════════════════════════════════════════════════════╣
║  Network:     Stellar Testnet                                ║
║  Contract ID: $contractId ║
║  Admin:       $deployerPublicKey ║
╠══════════════════════════════════════════════════════════════╣
║  Add to .env:                                                ║
║  NEXT_PUBLIC_ESCROW_CONTRACT_ID=$contractId ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

# ── 8. Verify deployment ──────────────────────────────────────────────────────
Write-Host "==> Verifying market_count() …" -ForegroundColor Cyan
stellar contract invoke `
    --id $contractId `
    --network $NETWORK `
    -- market_count

Write-Host "`n==> Done. Update .env and restart the dev server.`n" -ForegroundColor White
