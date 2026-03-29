$env:NODE_OPTIONS="--max-old-space-size=4096"

# Phase 1: Powers of Tau (Using existing if available or recreating)
if (-not (Test-Path "pot12_final.ptau")) {
    npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v -e="randomness"
    npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
}

# Process Seal Bet
Write-Host "Compiling Seal Bet Circuit..."
circom seal_bet.circom --r1cs --wasm --sym

npx snarkjs groth16 setup seal_bet.r1cs pot12_final.ptau seal_0000.zkey
npx snarkjs zkey contribute seal_0000.zkey seal_0001.zkey --name="Second contribution" -v -e="more randomness"
npx snarkjs zkey export verificationkey seal_0001.zkey seal_vkey.json

# Process Reveal Bet
Write-Host "Compiling Reveal Bet Circuit..."
circom reveal_bet.circom --r1cs --wasm --sym

npx snarkjs groth16 setup reveal_bet.r1cs pot12_final.ptau reveal_0000.zkey
npx snarkjs zkey contribute reveal_0000.zkey reveal_0001.zkey --name="Second contribution" -v -e="more randomness"
npx snarkjs zkey export verificationkey reveal_0001.zkey reveal_vkey.json

Write-Host "Prediction Market Circuits compiled and setup completed."
