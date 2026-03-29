pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";

// The Reveal circuit allows a user to prove they hold a winning position without revealing the nonce.
// Proves knowledge of (side, nonce, bettor_key) such that:
// 1. Poseidon(side, nonce, bettor_key) == commitment
// 2. side == winning_side
// Outputs a nullifier to prevent double-claiming: Poseidon(commitment, nonce)

template RevealBet() {
    // Private Inputs
    signal input side;       // 0 for Yes, 1 for No
    signal input nonce;      
    signal input bettor_key; 
    
    // Public Inputs (from the Smart Contract state)
    signal input commitment;
    signal input winning_side;

    // Public Output
    signal output nullifier;

    // 1. Verify Commitment Preimage
    component commit_hasher = Poseidon(3);
    commit_hasher.inputs[0] <== side;
    commit_hasher.inputs[1] <== nonce;
    commit_hasher.inputs[2] <== bettor_key;
    
    commit_hasher.out === commitment;

    // 2. Verify Side Matches Winning Outcome
    // The bettor is only allowed to generate a valid proof if they voted for the correct outcome.
    side === winning_side;

    // 3. Generate Nullifier
    // The nullifier depends on the commitment and the private nonce.
    // It uniquely identifies the claim attempt without revealing the preimage details 
    // to observers other than "this commitment was claimed".
    component nullifier_hasher = Poseidon(2);
    nullifier_hasher.inputs[0] <== commitment;
    nullifier_hasher.inputs[1] <== nonce;

    nullifier <== nullifier_hasher.out;
}

// commitment and winning_side are public inputs. The output nullifier is automatically public.
component main { public [commitment, winning_side] } = RevealBet();
