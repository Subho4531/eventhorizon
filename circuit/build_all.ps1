#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Compile, setup, and build all ZK circuits for GravityFlow (Groth16, BN254).

.DESCRIPTION
  This script compiles the three Circom circuits:
    1. seal_bet        – Commit to a bet position (already compiled, re-runs if needed)
    2. reveal_bet      – ZK reveal for winning claim (already compiled)
    3. escrow_deposit  – Range-check a deposit amount (NEW)

  Then runs Powers of Tau setup, Phase 2 specialised setup, and exports
  the verification keys needed by the Soroban contract and the frontend.

.USAGE
  cd circuit/
  ./build_all.ps1

.REQUIREMENTS
  - Node.js 18+
  - npx snarkjs
  - circom (on PATH, or install via: npm install -g circom)
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$circuitDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $circuitDir

function Compile-Circuit {
    param([string]$name)
    Write-Host "`n==> Compiling $name.circom …" -ForegroundColor Cyan
    if (!(Test-Path "$name.circom")) {
        Write-Warning "$name.circom not found — skipping."
        return
    }
    circom "$name.circom" --r1cs --wasm --sym -o .
    Write-Host "    ✓ $name compiled" -ForegroundColor Green
}

function Setup-Phase2 {
    param([string]$name, [string]$ptau)
    Write-Host "`n==> Phase 2 setup for $name …" -ForegroundColor Cyan

    # Groth16 setup
    npx snarkjs groth16 setup "$name.r1cs" $ptau "${name}_0000.zkey"

    # Contribute randomness (non-interactive with random entropy — acceptable for testnet)
    $entropy = [System.Guid]::NewGuid().ToString()
    echo $entropy | npx snarkjs zkey contribute "${name}_0000.zkey" "${name}_0001.zkey" --name="GravityFlow" -v

    # Export verification key
    npx snarkjs zkey export verificationkey "${name}_0001.zkey" "${name}_vkey.json"

    Write-Host "    ✓ $name setup complete  →  ${name}_vkey.json" -ForegroundColor Green
}

# ── 1. Powers of Tau (if not yet done) ───────────────────────────────────────
if (!(Test-Path "pot12_final.ptau")) {
    Write-Host "`n==> Running Powers of Tau (this takes ~1 min) …" -ForegroundColor Yellow
    npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    echo "GravityFlow entropy round 1" | npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="GravityFlow" -v
    npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
    Write-Host "    ✓ pot12_final.ptau ready" -ForegroundColor Green
} else {
    Write-Host "    ✓ pot12_final.ptau already exists — skipping" -ForegroundColor DarkGray
}

$ptau = "pot12_final.ptau"

# ── 2. Compile circuits ───────────────────────────────────────────────────────
Compile-Circuit "seal_bet"
Compile-Circuit "reveal_bet"
Compile-Circuit "escrow_deposit"

# ── 3. Phase 2 setup per circuit ─────────────────────────────────────────────
# seal_bet
if (!(Test-Path "seal_0001.zkey")) {
    Setup-Phase2 "seal_bet" $ptau
} else {
    Write-Host "    ✓ seal_bet already set up — skipping" -ForegroundColor DarkGray
}

# reveal_bet
if (!(Test-Path "reveal_0001.zkey")) {
    Setup-Phase2 "reveal_bet" $ptau
} else {
    Write-Host "    ✓ reveal_bet already set up — skipping" -ForegroundColor DarkGray
}

# escrow_deposit (new)
if (!(Test-Path "escrow_deposit_0001.zkey")) {
    Setup-Phase2 "escrow_deposit" $ptau
} else {
    Write-Host "    ✓ escrow_deposit already set up — skipping" -ForegroundColor DarkGray
}

# ── 4. Export Solidity/Wasm verifiers (optional, for off-chain verification) ──
Write-Host "`n==> Exporting verification artifacts …" -ForegroundColor Cyan

foreach ($name in @("seal_bet", "reveal_bet", "escrow_deposit")) {
    $vkey = "${name}_vkey.json"
    if (Test-Path "${name}_0001.zkey") {
        # Generate witness calculator JS (already in ${name}_js/)
        Write-Host "    ✓ $vkey ready"
    }
}

# ── 5. Summary ────────────────────────────────────────────────────────────────
Write-Host @"

╔═══════════════════════════════════════════════════════╗
║           GravityFlow ZK Circuit Build Done           ║
╠═══════════════════════════════════════════════════════╣
║  seal_bet           → seal_vkey.json                  ║
║  reveal_bet         → reveal_vkey.json                ║
║  escrow_deposit     → escrow_deposit_vkey.json        ║
╠═══════════════════════════════════════════════════════╣
║  Next steps:                                          ║
║  1. Deploy the Soroban contract (see deploy.ps1)      ║
║  2. Update .env:                                      ║
║     NEXT_PUBLIC_ESCROW_CONTRACT_ID=<deployed-id>      ║
║  3. The contract uses reveal_vkey.json constants      ║
║     already hardcoded in src/groth16.rs               ║
╚═══════════════════════════════════════════════════════╝

"@ -ForegroundColor Green
