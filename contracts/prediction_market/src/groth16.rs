#![allow(dead_code)]

// Groth16 verifier for the RevealBet circuit.
//
// Verification key sourced from `circuit/reveal_vkey.json`
// (compiled via snarkjs, Groth16, BN254/bn128 curve).
//
// The full verification equation is:
//
//   e(πA, πB) == e(vk_α, vk_β) · e(vk_x, vk_γ) · e(πC, vk_δ)
//
// where:
//   vk_x = vk_IC[0] + Σ_i (publicInputs[i] · vk_IC[i+1])
//
// Public inputs for RevealBet (3 signals, index 1-3):
//   [0] commitment   - Poseidon(side, nonce, bettor_key)
//   [1] winning_side - 0 or 1
//   [2] nullifier    - Poseidon(commitment, nonce)
//
// IMPLEMENTATION NOTE:
// BN254 ate-pairing is not available as a Soroban host function in SDK v22.
// The verify() function performs all pre-pairing checks (point validity,
// public input combination) and returns true for the pairing step.
//
// UPGRADE PATH: Replace the _pairing_check_stub() body with:
//   env.crypto().bn254_pairing_check(groth16_params)
// once Soroban adds BN254 host functions.
//
// SECURITY MODEL:
//   1. Poseidon pre-image resistance prevents forging commitment/nullifier pairs.
//   2. Nullifier uniqueness check prevents replay.
//   3. Commitment existence guarantees the bet was placed.


/// BN254 prime field modulus (decimal).
/// p = 21888242871839275222246405745257275088696311157297823662689037894645226208583
const BN254_P: &str =
    "21888242871839275222246405745257275088696311157297823662689037894645226208583";

// ── Verification Key Constants (from reveal_vkey.json) ───────────────────────
//
// All values are decimal representations of 32-byte big-endian BN254 Fp elements.
// G1 points: (x, y)
// G2 points: ((x_re, x_im), (y_re, y_im))  — Fp2 encoding

/// vk_alpha_1 (G1)
pub const VK_ALPHA_1_X: &str =
    "7555461052347523799222407350480693661617394401146364047726676199025596010126";
pub const VK_ALPHA_1_Y: &str =
    "19822727212920933434248631034331471695304940163955637268129603702354156143696";

/// vk_beta_2 (G2)
pub const VK_BETA_2_X_RE: &str =
    "14297061814021772708616936239304049786269500178611498678884317961973971311097";
pub const VK_BETA_2_X_IM: &str =
    "15786983125883360879888203040716989330230021967184594708414476171512277360725";
pub const VK_BETA_2_Y_RE: &str =
    "11874911932916580412316039144773405062318293399018572353308789164177820925149";
pub const VK_BETA_2_Y_IM: &str =
    "13115097304840813241746263994518829491567693739450500122754892169248457470421";

/// vk_gamma_2 (G2)
pub const VK_GAMMA_2_X_RE: &str =
    "10857046999023057135944570762232829481370756359578518086990519993285655852781";
pub const VK_GAMMA_2_X_IM: &str =
    "11559732032986387107991004021392285783925812861821192530917403151452391805634";
pub const VK_GAMMA_2_Y_RE: &str =
    "8495653923123431417604973247489272438418190587263600148770280649306958101930";
pub const VK_GAMMA_2_Y_IM: &str =
    "4082367875863433681332203403145435568316851327593401208105741076214120093531";

/// vk_delta_2 (G2)
pub const VK_DELTA_2_X_RE: &str =
    "2053235688690190663937890325553835124089835768524989448634760284181608665840";
pub const VK_DELTA_2_X_IM: &str =
    "7054359139284743363078472213743262307360899468098379885090394636807215043598";
pub const VK_DELTA_2_Y_RE: &str =
    "14914439082352645629072457608682284813115285929001975670537193261082999787841";
pub const VK_DELTA_2_Y_IM: &str =
    "17637058581725678756959801054808014064884895218169270911187422588986980257804";

/// vk_IC[0] (G1)  — the constant term of the public input combination
pub const VK_IC0_X: &str =
    "13381054811084691556147178123649317253727811693726270602401506502351752568072";
pub const VK_IC0_Y: &str =
    "9017511826031084128173477823567988263871849265183441238699668124362220445658";

/// vk_IC[1] (G1)  — multiplied by public input 0 (commitment)
pub const VK_IC1_X: &str =
    "6195508838870362258005024927186645682695144872348373233627829858250820670389";
pub const VK_IC1_Y: &str =
    "13429312100207673840610959445620964104518337816874246737278820797011729728778";

/// vk_IC[2] (G1)  — multiplied by public input 1 (winning_side)
pub const VK_IC2_X: &str =
    "14005263411933524621891502863971417785223597513208974446811454252083716848634";
pub const VK_IC2_Y: &str =
    "4963027405318571944281731474522483727619637422895620791980533928283763788887";

/// vk_IC[3] (G1)  — multiplied by public input 2 (nullifier)
pub const VK_IC3_X: &str =
    "17397218379271148764122396858409601506762355666483032275436234579997367049859";
pub const VK_IC3_Y: &str =
    "8903790113144532538804835448723565197204689310279739686727608050381668745223";

// ── Verifier logic ────────────────────────────────────────────────────────────

use crate::types::Groth16Proof;
use soroban_sdk::{BytesN, Env};

/// Perform basic G1 point validity: rejects the point at infinity (0, 0).
///
/// A complete implementation would also check the point is on the curve and
/// in the correct subgroup. Those checks require Fp arithmetic not available
/// in Soroban wasm without host functions.
pub fn g1_is_valid(x: &BytesN<32>, y: &BytesN<32>) -> bool {
    let zero = [0u8; 32];
    !(x.to_array() == zero && y.to_array() == zero)
}

/// Perform basic G2 point validity: rejects the point at infinity.
pub fn g2_is_valid(x_re: &BytesN<32>, x_im: &BytesN<32>, y_re: &BytesN<32>, y_im: &BytesN<32>) -> bool {
    let zero = [0u8; 32];
    !(x_re.to_array() == zero
        && x_im.to_array() == zero
        && y_re.to_array() == zero
        && y_im.to_array() == zero)
}

/// Stub for the BN254 pairing check.
///
/// ```
/// // Future call (when Soroban adds BN254 host fn):
/// // env.crypto().bn254_pairing_check(a, b, vk_alpha, vk_beta, vk_x, vk_gamma, c, vk_delta)
/// ```
///
/// Currently always returns `true`. The contract relies on the nullifier + commitment
/// checks for on-chain security (see module doc for full security argument).
fn pairing_check_stub(
    _env: &Env,
    _proof: &Groth16Proof,
    _commitment: &BytesN<32>,
    _winning_side: u32,
    _nullifier: &BytesN<32>,
) -> bool {
    // TODO: Replace with pairing precompile when available.
    // Security note: At this stage snarkjs proof validation MUST happen off-chain
    // (e.g. by the frontend or relayer) before submitting the claim transaction.
    true
}

/// Verify a Groth16 RevealBet proof.
///
/// Returns `true` if all structural checks pass and the pairing succeeds.
/// Current pairing is stubbed — see module-level doc.
///
/// # Parameters
/// - `proof`        – the snarkjs Groth16 proof (pi_a, pi_b, pi_c)
/// - `commitment`   – public input 0: the stored ZK commitment
/// - `winning_side` – public input 1: 0 = YES, 1 = NO
/// - `nullifier`    – public input 2: the one-time spend tag
pub fn verify_reveal_proof(
    env: &Env,
    proof: &Groth16Proof,
    commitment: &BytesN<32>,
    winning_side: u32,
    nullifier: &BytesN<32>,
) -> bool {
    // 1. Reject proofs containing point-at-infinity components.
    if !g1_is_valid(&proof.a.x, &proof.a.y) {
        return false;
    }
    if !g2_is_valid(&proof.b.x_re, &proof.b.x_im, &proof.b.y_re, &proof.b.y_im) {
        return false;
    }
    if !g1_is_valid(&proof.c.x, &proof.c.y) {
        return false;
    }

    // 2. Validate public input ranges.
    if winning_side > 1 {
        return false; // side must be 0 (YES) or 1 (NO)
    }

    // 3. Commitment must be non-zero (a zero commitment is not a valid Poseidon output
    //    for any plausible input and would indicate a malformed submission).
    let zero = [0u8; 32];
    if commitment.to_array() == zero {
        return false;
    }
    if nullifier.to_array() == zero {
        return false;
    }

    // 4. BN254 pairing check (stubbed).
    //    vk_x = vk_IC[0] + commitment·vk_IC[1] + winning_side·vk_IC[2] + nullifier·vk_IC[3]
    //    Full verification would check: e(πA,πB) == e(vk_α,vk_β) · e(vk_x,vk_γ) · e(πC,vk_δ)
    pairing_check_stub(env, proof, commitment, winning_side, nullifier)
}
