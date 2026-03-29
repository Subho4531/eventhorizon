pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";

// The Seal circuit generates a commitment to a bet position without revealing it.
// Runs purely client-side in the browser.

template SealBet() {
    // Private Inputs
    signal input side;       // 0 for Yes, 1 for No
    signal input nonce;      // Random 256-bit number to prevent brute-forcing
    signal input bettor_key; // The bettor's public/private identifier for this bet

    // Public Output
    signal output commitment;

    // We use Poseidon hashing for SNARK-friendliness
    component hasher = Poseidon(3);
    
    hasher.inputs[0] <== side;
    hasher.inputs[1] <== nonce;
    hasher.inputs[2] <== bettor_key;

    commitment <== hasher.out;
    
    // Optional: Range check to ensure 'side' is exactly 0 or 1
    side * (1 - side) === 0;
}

// Side, nonce, and bettor_key are all private inputs, only the commitment is public.
component main = SealBet();
