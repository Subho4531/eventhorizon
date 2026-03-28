circom autopay.circom --r1cs --wasm --sym
$env:NODE_OPTIONS="--max-old-space-size=4096"

# Phase 1: Powers of Tau
npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v -e="randomness"
npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Phase 2: Circuit Specific Setup
npx snarkjs groth16 setup autopay.r1cs pot12_final.ptau autopay_0000.zkey
npx snarkjs zkey contribute autopay_0000.zkey autopay_0001.zkey --name="Second contribution" -v -e="more randomness"

# Export Verification Key
npx snarkjs zkey export verificationkey autopay_0001.zkey verification_key.json

Write-Host "Circuit compiled and setup completed."
