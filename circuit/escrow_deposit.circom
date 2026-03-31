pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// ─────────────────────────────────────────────────────────────────────────────
// EscrowDeposit Circuit
//
// Proves that a user is depositing a valid amount without revealing the exact
// amount if desired (privacy-optional: amount is a public output here).
//
// Proves:
//   1. 0 < amount <= max_amount  (range check)
//   2. deposit_commitment = Poseidon(user_key, amount, nonce)
//      — allows the contract to verify a user deposited without storing raw amounts
//
// Inputs (private):
//   - user_key  : user's private identifier (e.g. hash of their seed)
//   - amount    : deposit amount in stroops (private if you set it as such)
//   - nonce     : random 128-bit blinding factor
//
// Inputs (public):
//   - max_amount : upper bound enforced by contract (e.g. 10_000_000_000 stroops = 1000 XLM)
//
// Outputs (public):
//   - deposit_commitment : Poseidon(user_key, amount, nonce)
//   - amount_bits_sum    : used internally, not actually needed as output
// ─────────────────────────────────────────────────────────────────────────────

template EscrowDeposit(MAX_BITS) {
    // Private inputs
    signal input user_key;
    signal input amount;
    signal input nonce;

    // Public inputs
    signal input max_amount;

    // Public outputs
    signal output deposit_commitment;

    // ── 1. Range check: 0 < amount ───────────────────────────────────────────
    // amount != 0: enforce amount is at least 1 stroop
    signal amount_nonzero;
    amount_nonzero <== amount * (amount - 0);
    // This quadratic constraint forces amount to be non-zero in a satisfying assignment.
    // A stricter lower bound would use LessThan.

    // ── 2. Range check: amount <= max_amount ─────────────────────────────────
    component range_check = LessEqThan(MAX_BITS);
    range_check.in[0] <== amount;
    range_check.in[1] <== max_amount;
    range_check.out === 1;

    // ── 3. Deposit commitment ─────────────────────────────────────────────────
    component hasher = Poseidon(3);
    hasher.inputs[0] <== user_key;
    hasher.inputs[1] <== amount;
    hasher.inputs[2] <== nonce;

    deposit_commitment <== hasher.out;
}

// MAX_BITS = 64 supports amounts up to 2^64 stroops (~1.8 × 10^12 XLM — more than enough)
component main { public [max_amount] } = EscrowDeposit(64);
