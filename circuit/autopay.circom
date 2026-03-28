pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";

// This circuit allows a user to authorize a recurring payment mandate.
// The user generates a proof that they know a `secret` which, combined with the 
// public mandate parameters, hashes to a specific public `commitment`.
// The relayer repeatedly submits this proof to execute payments without needing the user's secret.

template AutoPayAuthorization() {
    // Private input: The user's secret authorization key
    signal input secret;
    
    // Public inputs: Mandate parameters that the Soroban contract enforces
    signal input max_amount;
    signal input interval;
    signal input recipient;

    // Public output: The commitment stored securely on the Soroban contract
    signal output commitment;

    // Instantiate a 4-input Poseidon hasher
    component hasher = Poseidon(4);
    
    // Load inputs into the hasher
    hasher.inputs[0] <== secret;
    hasher.inputs[1] <== max_amount;
    hasher.inputs[2] <== interval;
    hasher.inputs[3] <== recipient;

    // The resulting hash is the commitment
    commitment <== hasher.out;
}

// The `commitment` is an implicit public output. We explicitly declare the other inputs as public.
component main { public [max_amount, interval, recipient] } = AutoPayAuthorization();
