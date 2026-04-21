#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, BytesN, Env, Symbol,
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/// Deploy a mock XLM SAC and return (token_admin, xlm_client).
fn create_xlm_token(env: &Env) -> (Address, token::StellarAssetClient<'_>) {
    let admin = Address::generate(env);
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    let client = token::StellarAssetClient::new(env, &contract_id.address());
    (admin, client)
}

/// Mint `amount` stroops of XLM to `recipient`.
fn mint(sac: &token::StellarAssetClient, admin: &Address, recipient: &Address, amount: i128) {
    sac.mint(recipient, &amount);
    let _ = admin;
}

/// Build a dummy (but non-zero) 32-byte value from a seed byte.
fn bytes32(env: &Env, seed: u8) -> BytesN<32> {
    let mut arr = [0u8; 32];
    arr[0] = seed;
    arr[31] = seed.wrapping_add(1);
    BytesN::from_array(env, &arr)
}

/// Build a trivially-valid dummy Groth16Proof (non-infinite points).
fn dummy_proof(env: &Env) -> Groth16Proof {
    let g1 = |s: u8| G1Point { x: bytes32(env, s), y: bytes32(env, s + 1) };
    let g2 = |s: u8| G2Point {
        x_re: bytes32(env, s),
        x_im: bytes32(env, s + 1),
        y_re: bytes32(env, s + 2),
        y_im: bytes32(env, s + 3),
    };
    Groth16Proof { a: g1(10), b: g2(20), c: g1(30) }
}

/// Advance ledger timestamp by `secs` seconds.
fn advance_time(env: &Env, secs: u64) {
    let ts = env.ledger().timestamp() + secs;
    env.ledger().set(LedgerInfo {
        timestamp: ts,
        ..env.ledger().get()
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Setup fixture
// ──────────────────────────────────────────────────────────────────────────────

struct Fixture {
    env: Env,
    contract: ZKPredictionMarketClient<'static>,
    contract_id: Address,
    _xlm_sac: token::StellarAssetClient<'static>,
    xlm_client: token::Client<'static>,
    admin: Address,
    alice: Address,
    bob: Address,
    oracle: Address,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let (token_admin, xlm_sac) = create_xlm_token(&env);
        let xlm_client = token::Client::new(&env, &xlm_sac.address);

        let contract_id = env.register(ZKPredictionMarket, ());
        // SAFETY: extending lifetime for test convenience.
        let contract = ZKPredictionMarketClient::new(
            unsafe { &*(&env as *const Env) },
            &contract_id,
        );
        let xlm_sac = unsafe {
            core::mem::transmute::<
                token::StellarAssetClient<'_>,
                token::StellarAssetClient<'static>,
            >(xlm_sac)
        };
        let xlm_client = unsafe {
            core::mem::transmute::<token::Client<'_>, token::Client<'static>>(xlm_client)
        };

        let admin  = Address::generate(&env);
        let alice  = Address::generate(&env);
        let bob    = Address::generate(&env);
        let oracle = Address::generate(&env);

        contract.init(&admin, &xlm_sac.address);

        // Fund Alice and Bob with 1000 XLM (in stroops: 1 XLM = 10_000_000 stroops).
        let xlm_amount = 1_000 * 10_000_000_i128;
        mint(&xlm_sac, &token_admin, &alice,  xlm_amount);
        mint(&xlm_sac, &token_admin, &bob,    xlm_amount);
        mint(&xlm_sac, &token_admin, &admin,  xlm_amount);

        Fixture {
            env,
            contract,
            contract_id,
            _xlm_sac: xlm_sac,
            xlm_client,
            admin,
            alice,
            bob,
            oracle,
        }
    }

    fn one_xlm() -> i128 { 10_000_000 }
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests — Escrow
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn test_deposit_and_balance() {
    let f = Fixture::new();
    let amount = Fixture::one_xlm() * 100; // 100 XLM

    f.contract.deposit(&f.alice, &amount);

    assert_eq!(f.contract.balance_of(&f.alice), amount);
    // Contract should hold the XLM.
    assert_eq!(f.xlm_client.balance(&f.contract_id), amount);
}

#[test]
fn test_withdraw_full() {
    let f = Fixture::new();
    let amount = Fixture::one_xlm() * 50;

    f.contract.deposit(&f.alice, &amount);
    f.contract.withdraw(&f.alice, &amount);

    assert_eq!(f.contract.balance_of(&f.alice), 0);
    assert_eq!(f.xlm_client.balance(&f.contract_id), 0);
}

#[test]
fn test_withdraw_partial() {
    let f = Fixture::new();
    let deposit = Fixture::one_xlm() * 100;
    let withdraw = Fixture::one_xlm() * 30;

    f.contract.deposit(&f.alice, &deposit);
    f.contract.withdraw(&f.alice, &withdraw);

    assert_eq!(f.contract.balance_of(&f.alice), deposit - withdraw);
}

#[test]
#[should_panic(expected = "Insufficient escrow balance")]
fn test_over_withdraw_fails() {
    let f = Fixture::new();
    f.contract.deposit(&f.alice, &Fixture::one_xlm());
    f.contract.withdraw(&f.alice, &(Fixture::one_xlm() * 2)); // too much
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests — Market Lifecycle
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn test_create_market() {
    let f = Fixture::new();
    let close = f.env.ledger().timestamp() + 3_600;

    let id = f.contract.create_market(
        &f.admin,
        &f.oracle,
        &Symbol::new(&f.env, "BTC_OVER_100K"),
        &close,
    );

    assert_eq!(id, 1u32);
    assert_eq!(f.contract.market_count(), 1u32);

    let market = f.contract.get_market(&id);
    assert_eq!(market.status, MarketStatus::Open);
}

#[test]
fn test_place_bet() {
    let f = Fixture::new();
    let stake = Fixture::one_xlm() * 20;
    let close = f.env.ledger().timestamp() + 3_600;

    f.contract.deposit(&f.alice, &stake);

    let id = f.contract.create_market(
        &f.admin,
        &f.oracle,
        &Symbol::new(&f.env, "ETH_FLIP"),
        &close,
    );

    let commitment = bytes32(&f.env, 42);
    f.contract.place_bet(&f.alice, &id, &commitment, &stake);

    let market = f.contract.get_market(&id);
    assert_eq!(market.total_pool, stake);
    assert_eq!(f.contract.balance_of(&f.alice), 0); // stake locked

    let pos = f.contract.get_position(&commitment);
    assert_eq!(pos.amount, stake);
    assert!(!pos.claimed);
}

#[test]
#[should_panic(expected = "Commitment already exists")]
fn test_duplicate_commitment_fails() {
    let f = Fixture::new();
    let stake = Fixture::one_xlm() * 10;
    let close = f.env.ledger().timestamp() + 3_600;

    f.contract.deposit(&f.alice, &(stake * 2));
    let id = f.contract.create_market(
        &f.admin,
        &f.oracle,
        &Symbol::new(&f.env, "DUP_TEST"),
        &close,
    );

    let commitment = bytes32(&f.env, 7);
    f.contract.place_bet(&f.alice, &id, &commitment, &stake);
    f.contract.place_bet(&f.alice, &id, &commitment, &stake); // duplicate → panic
}

#[test]
fn test_resolve_market() {
    let f = Fixture::new();
    let close = f.env.ledger().timestamp() + 3_600;

    let id = f.contract.create_market(
        &f.admin,
        &f.oracle,
        &Symbol::new(&f.env, "RESOLVE_TEST"),
        &close,
    );

    f.contract.resolve(&f.oracle, &id, &OUTCOME_YES, &20_000u32);

    let market = f.contract.get_market(&id);
    assert_eq!(market.status, MarketStatus::Resolved);
    assert_eq!(market.outcome, Some(OUTCOME_YES));
    assert_eq!(market.payout_bps, 20_000);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests — Full ZK Claim Lifecycle
// ──────────────────────────────────────────────────────────────────────────────

#[test]
fn test_full_claim_lifecycle() {
    let f = Fixture::new();
    let stake     = Fixture::one_xlm() * 50;
    let payout_bps: u32 = 20_000; // 2× payout
    let close     = f.env.ledger().timestamp() + 3_600;

    // 1. Deposits.
    f.contract.deposit(&f.alice, &stake);
    f.contract.deposit(&f.bob, &stake);

    // 2. Create market.
    let id = f.contract.create_market(
        &f.admin,
        &f.oracle,
        &Symbol::new(&f.env, "ZK_LIFECYCLE"),
        &close,
    );

    // 3. Alice places ZK bet (commitment = Poseidon(YES, nonce, alice_key) — mocked here).
    let commitment = bytes32(&f.env, 55);
    let nullifier  = bytes32(&f.env, 99);
    f.contract.place_bet(&f.alice, &id, &commitment, &stake);
    
    // Bob places a bet too, so the contract has sufficient balance to pay Alice's 2x payout
    f.contract.place_bet(&f.bob, &id, &bytes32(&f.env, 88), &stake);

    // 4. Oracle resolves YES, 2× payout.
    f.contract.resolve(&f.oracle, &id, &OUTCOME_YES, &payout_bps);

    // 5. Advance past dispute window (48 h + 1 s).
    advance_time(&f.env, DISPUTE_WINDOW_SECS + 1);

    // 6. Alice claims with ZK proof (dummy proof accepted because pairing is stubbed).
    let proof = dummy_proof(&f.env);
    f.contract.claim(&f.alice, &id, &commitment, &nullifier, &proof);

    // Expected payout: 50 XLM × 2.0 = 100 XLM.
    let expected_payout = stake * payout_bps as i128 / 10_000;
    assert_eq!(f.contract.balance_of(&f.alice), expected_payout);

    // Nullifier must now be spent.
    assert!(f.contract.is_nullifier_spent(&nullifier));

    // 7. Alice withdraws winnings.
    f.contract.withdraw(&f.alice, &expected_payout);
    assert_eq!(f.contract.balance_of(&f.alice), 0);
}

#[test]
#[should_panic(expected = "Nullifier already spent")]
fn test_double_claim_fails() {
    let f = Fixture::new();
    let stake  = Fixture::one_xlm() * 10;
    let close  = f.env.ledger().timestamp() + 3_600;

    f.contract.deposit(&f.alice, &stake);
    let id = f.contract.create_market(
        &f.admin,
        &f.oracle,
        &Symbol::new(&f.env, "DOUBLE_CLAIM"),
        &close,
    );
    let commitment = bytes32(&f.env, 1);
    let nullifier  = bytes32(&f.env, 2);
    f.contract.place_bet(&f.alice, &id, &commitment, &stake);
    f.contract.resolve(&f.oracle, &id, &OUTCOME_YES, &20_000u32);
    advance_time(&f.env, DISPUTE_WINDOW_SECS + 1);

    let proof = dummy_proof(&f.env);
    f.contract.claim(&f.alice, &id, &commitment, &nullifier, &proof); // first — ok
    f.contract.claim(&f.alice, &id, &commitment, &nullifier, &proof); // second → panic
}

#[test]
#[should_panic(expected = "Dispute window still open")]
fn test_claim_during_dispute_fails() {
    let f = Fixture::new();
    let stake = Fixture::one_xlm() * 10;
    let close = f.env.ledger().timestamp() + 3_600;

    f.contract.deposit(&f.alice, &stake);
    let id = f.contract.create_market(
        &f.admin,
        &f.oracle,
        &Symbol::new(&f.env, "DISPUTE_TEST"),
        &close,
    );
    let commitment = bytes32(&f.env, 3);
    let nullifier  = bytes32(&f.env, 4);
    f.contract.place_bet(&f.alice, &id, &commitment, &stake);
    f.contract.resolve(&f.oracle, &id, &OUTCOME_YES, &20_000u32);

    // Do NOT advance time — dispute window still open.
    let proof = dummy_proof(&f.env);
    f.contract.claim(&f.alice, &id, &commitment, &nullifier, &proof); // → panic
}


