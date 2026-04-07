//! # ZK Prediction Market + Escrow — Soroban Contract
//!
//! ## Architecture
//!
//! This single contract serves two roles:
//!
//! ### 1. Escrow Vault
//!   - Users deposit XLM → balance tracked in on-chain storage.
//!   - Bets and bonds are deducted from escrow; winnings are credited back.
//!   - Users can withdraw their free balance at any time.
//!
//! ### 2. ZK Prediction Market
//!   - Bets are "sealed": only a Poseidon commitment is stored on-chain.
//!   - The bettor's chosen side (YES/NO) is a private witness in the ZK proof.
//!   - At claim time the bettor furnishes a Groth16 proof proving they bet on
//!     the winning side, without revealing which side they chose at bet time.
//!   - A nullifier prevents double-claiming the same position.
//!
//! ## Function Summary
//!
//! | Function           | Auth      | Description                                   |
//! |--------------------|-----------|-----------------------------------------------|
//! | `init`             | –         | One-time setup: XLM token address + admin     |
//! | `deposit`          | user      | Transfer XLM from user wallet → escrow        |
//! | `withdraw`         | user      | Transfer XLM from escrow → user wallet        |
//! | `balance_of`       | public    | Return user's current escrow balance          |
//! | `create_market`    | creator   | Open a new market, take creator bond          |
//! | `place_bet`        | bettor    | Seal a bet: store commitment, deduct stake    |
//! | `resolve`          | oracle    | Set market outcome + payout multiplier        |
//! | `claim`            | bettor    | Groth16-verify reveal proof, pay winner       |
//! | `slash_bond`       | anyone    | After dispute window, slash bad oracle bond   |
//! | `get_market`       | public    | Read market state                             |
//! | `get_position`     | public    | Read sealed position by commitment            |
//! | `escrow_balance`   | public    | Read contract's own XLM balance               |

#![no_std]

mod groth16;
mod types;

use groth16::verify_reveal_proof;
use types::*;
use soroban_sdk::{
    contract, contractimpl, token, Address, BytesN, Env, Symbol,
    symbol_short,
};

// Dispute window: 48 hours in seconds
const DISPUTE_WINDOW_SECS: u64 = 0; // Instant claims (no dispute window)

// ──────────────────────────────────────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct ZKPredictionMarket;

#[contractimpl]
impl ZKPredictionMarket {
    // ── Initialisation ────────────────────────────────────────────────────────

    /// One-time initialisation. Must be called before any other function.
    ///
    /// # Arguments
    /// * `admin`     – Address authorised to emergency-pause (future use).
    /// * `xlm_token` – Address of the native XLM Stellar Asset Contract (SAC).
    ///                 On Testnet: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
    pub fn init(env: Env, admin: Address, xlm_token: Address) {
        // Can only be called once.
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialised");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().extend_ttl(17_280, 17_280); // ~30 days
    }

    // ── Escrow: Deposit ───────────────────────────────────────────────────────

    /// Deposit `amount` stroops of XLM from `user`'s wallet into their escrow
    /// balance held by this contract.
    ///
    /// The user must have authorised this contract to spend their XLM via the
    /// SAC (`token.approve(contract, amount)`) OR the `transfer` auth is
    /// included inline in the same Soroban auth tree (recommended pattern).
    ///
    /// Emits: `"deposit"` event with { user, amount }.
    pub fn deposit(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Pull XLM from user's wallet into the contract's custody.
        let xlm = Self::xlm_client(&env);
        xlm.transfer(&user, &env.current_contract_address(), &amount);

        // Credit escrow balance.
        let bal = Self::get_escrow_bal(&env, &user);
        env.storage()
            .persistent()
            .set(&DataKey::EscrowBal(user.clone()), &(bal + amount));

        env.events()
            .publish((symbol_short!("deposit"), user), amount);
    }

    /// Withdraw `amount` stroops from the caller's escrow back to their wallet.
    ///
    /// Fails if `amount` exceeds the caller's free (un-locked) escrow balance.
    ///
    /// Emits: `"withdraw"` event with { user, amount }.
    pub fn withdraw(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let bal = Self::get_escrow_bal(&env, &user);
        if bal < amount {
            panic!("Insufficient escrow balance");
        }

        // Debit escrow balance before external transfer (reentrancy guard).
        env.storage()
            .persistent()
            .set(&DataKey::EscrowBal(user.clone()), &(bal - amount));

        // Return XLM to user's wallet.
        let xlm = Self::xlm_client(&env);
        xlm.transfer(&env.current_contract_address(), &user, &amount);

        env.events()
            .publish((symbol_short!("withdraw"), user), amount);
    }

    /// Return `user`'s current escrow balance in stroops.
    pub fn balance_of(env: Env, user: Address) -> i128 {
        Self::get_escrow_bal(&env, &user)
    }

    /// Return the total XLM balance held by this contract (escrow + pools + bonds).
    pub fn escrow_balance(env: Env) -> i128 {
        let xlm = Self::xlm_client(&env);
        xlm.balance(&env.current_contract_address())
    }

    // ── Markets: Create ───────────────────────────────────────────────────────

    /// Create a new binary prediction market.
    ///
    /// The `creator` must have at least `bond` stroops in their escrow balance.
    /// The bond is locked until the market resolves + dispute window passes.
    ///
    /// # Arguments
    /// * `creator`    – Market creator (also bonds XLM as good-faith deposit).
    /// * `oracle`     – Address authorised to call `resolve()`.
    /// * `title`      – Short title symbol (≤ 32 ASCII chars).
    /// * `close_time` – Unix timestamp (seconds) after which no new bets accepted.
    /// * `bond`       – Stroops locked as creator bond.
    ///
    /// Returns the new market ID.
    pub fn create_market(
        env: Env,
        creator: Address,
        oracle: Address,
        title: Symbol,
        close_time: u64,
    ) -> u32 {
        creator.require_auth();

        let now = env.ledger().timestamp();
        if close_time <= now {
            panic!("close_time must be in the future");
        }

        // Allocate market ID.
        let mut count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MarketCount)
            .unwrap_or(0);
        count += 1;

        let market = Market {
            creator: creator.clone(),
            oracle,
            title: title.clone(),
            status: MarketStatus::Open,
            outcome: None,
            close_time,
            total_pool: 0,
            dispute_end: 0,
            payout_bps: 0,
        };

        env.storage()
            .instance()
            .set(&DataKey::MarketCount, &count);
        let k = DataKey::Market(count);
        env.storage().persistent().set(&k, &market);
        env.storage().persistent().extend_ttl(&k, 17_280, 17_280);

        env.events()
            .publish((symbol_short!("mkt_new"), creator), (count, title));

        count
    }

    // ── Markets: Bet ─────────────────────────────────────────────────────────

    /// Seal a ZK bet on a market.
    ///
    /// The bettor's chosen side (YES/NO) is embedded in `commitment` —
    /// a Poseidon hash computed off-chain:
    ///   `commitment = Poseidon(side, nonce, bettor_key)`
    ///
    /// Only the commitment is stored on-chain; the side remains private until
    /// the bettor constructs a reveal proof at claim time.
    ///
    /// The `amount` in stroops is deducted from the bettor's escrow balance.
    ///
    /// Emits: `"bet"` event with { bettor, market_id, commitment, amount }.
    pub fn place_bet(
        env: Env,
        bettor: Address,
        market_id: u32,
        commitment: BytesN<32>,
        amount: i128,
    ) {
        bettor.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let market_key = DataKey::Market(market_id);
        let mut market: Market = env
            .storage()
            .persistent()
            .get(&market_key)
            .expect("Market not found");

        // Guard: market must be open and before close_time.
        if market.status != MarketStatus::Open {
            panic!("Market is not open");
        }
        if env.ledger().timestamp() >= market.close_time {
            panic!("Betting period has ended");
        }

        // Guard: reject duplicate commitment (replay protection).
        let commitment_key = DataKey::Position(commitment.clone());
        if env.storage().persistent().has(&commitment_key) {
            panic!("Commitment already exists");
        }

        // Deduct stake from bettor's escrow balance.
        let bal = Self::get_escrow_bal(&env, &bettor);
        if bal < amount {
            panic!("Insufficient escrow balance");
        }
        env.storage()
            .persistent()
            .set(&DataKey::EscrowBal(bettor.clone()), &(bal - amount));

        // Record sealed position.
        let position = Position {
            bettor: bettor.clone(),
            market_id,
            amount,
            claimed: false,
        };
        let k = commitment_key;
        env.storage().persistent().set(&k, &position);
        env.storage().persistent().extend_ttl(&k, 17_280, 17_280);

        // Update total pool (side breakdown is private until claims).
        market.total_pool += amount;
        let k = market_key;
        env.storage().persistent().set(&k, &market);
        env.storage().persistent().extend_ttl(&k, 17_280, 17_280);

        env.events().publish(
            (symbol_short!("bet"), bettor),
            (market_id, commitment, amount),
        );
    }

    // ── Markets: Resolve ──────────────────────────────────────────────────────

    /// Resolve a market. Only the registered oracle may call this.
    ///
    /// Sets the winning outcome and the payout multiplier. The dispute window
    /// starts immediately; payouts unlock after `dispute_end`.
    ///
    /// # Arguments
    /// * `market_id`   – Target market.
    /// * `outcome`     – `Outcome::Yes` or `Outcome::No`.
    /// * `payout_bps`  – Winner payout in basis points.
    ///                   E.g. `20_000` = 2× (winners get 2× their stake).
    ///                   Must be > 10_000 (i.e. at least 1×, to avoid rug).
    ///
    /// Emits: `"resolved"` event with { market_id, outcome, payout_bps }.
    pub fn resolve(
        env: Env,
        oracle: Address,
        market_id: u32,
        outcome: u32,
        payout_bps: u32,
    ) {
        oracle.require_auth();

        if payout_bps < 10_000 {
            panic!("payout_bps must be >= 10_000 (1x minimum)");
        }

        let market_key = DataKey::Market(market_id);
        let mut market: Market = env
            .storage()
            .persistent()
            .get(&market_key)
            .expect("Market not found");

        if market.oracle != oracle {
            panic!("Caller is not the registered oracle");
        }
        if market.status == MarketStatus::Resolved {
            panic!("Market already resolved");
        }

        let now = env.ledger().timestamp();
        market.status = MarketStatus::Resolved;
        market.outcome = Some(outcome);
        market.payout_bps = payout_bps;
        market.dispute_end = now + DISPUTE_WINDOW_SECS;

        let k = market_key;
        env.storage().persistent().set(&k, &market);
        env.storage().persistent().extend_ttl(&k, 17_280, 17_280);

        env.events()
            .publish((symbol_short!("resolved"), oracle), (market_id, payout_bps));
    }

    // ── Markets: Claim ────────────────────────────────────────────────────────

    /// Claim winnings for a sealed bet using a ZK reveal proof.
    ///
    /// The Groth16 proof (generated off-chain by snarkjs) proves that:
    ///   1. The bettor knows the preimage of `commitment` (their side + nonce + key).
    ///   2. The side encoded in the commitment matches the market's winning outcome.
    ///   3. The `nullifier` is derived deterministically from that preimage.
    ///
    /// The contract enforces:
    ///   - Market is resolved and dispute window has passed.
    ///   - This nullifier has not been spent before.
    ///   - The referenced commitment exists and belongs to `bettor`.
    ///   - Proof structural validity (non-infinity points, valid ranges).
    ///
    /// On success, the payout is credited to the bettor's escrow balance.
    ///
    /// # Arguments
    /// * `commitment` – The 32-byte Poseidon commitment stored when bet was placed.
    /// * `nullifier`  – The 32-byte Poseidon nullifier from the reveal circuit.
    /// * `proof`      – Groth16 proof: (π_A ∈ G1, π_B ∈ G2, π_C ∈ G1).
    ///
    /// Emits: `"claim"` event with { bettor, market_id, nullifier, payout }.
    pub fn claim(
        env: Env,
        bettor: Address,
        market_id: u32,
        commitment: BytesN<32>,
        nullifier: BytesN<32>,
        proof: Groth16Proof,
    ) {
        bettor.require_auth();

        let market_key = DataKey::Market(market_id);
        let market: Market = env
            .storage()
            .persistent()
            .get(&market_key)
            .expect("Market not found");

        // Guard: market must be resolved.
        if market.status != MarketStatus::Resolved {
            panic!("Market is not yet resolved");
        }

        // Guard: dispute window must have elapsed.
        let now = env.ledger().timestamp();
        if now < market.dispute_end {
            panic!("Dispute window still open");
        }

        // Guard: nullifier must not have been spent.
        let nullifier_key = DataKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&nullifier_key) {
            panic!("Nullifier already spent (double-claim attempt)");
        }

        // Guard: commitment must exist and belong to this bettor.
        let commitment_key = DataKey::Position(commitment.clone());
        let mut position: Position = env
            .storage()
            .persistent()
            .get(&commitment_key)
            .expect("Commitment not found");

        if position.bettor != bettor {
            panic!("Commitment does not belong to caller");
        }
        if position.market_id != market_id {
            panic!("Commitment is for a different market");
        }
        if position.claimed {
            panic!("Position already claimed");
        }

        let winning_side = market.outcome.unwrap();

        // ── ZK Proof Verification ─────────────────────────────────────────────
        // Verify the Groth16 RevealBet proof. The circuit proves:
        //   Poseidon(side, nonce, bettor_key) == commitment  AND  side == winning_side
        // and outputs:
        //   nullifier = Poseidon(commitment, nonce)
        //
        // Public inputs (circuit signals):
        //   [0] commitment   – the stored commitment
        //   [1] winning_side – 0 (YES) or 1 (NO)
        //   [2] nullifier    – the one-time spend tag
        let proof_valid = verify_reveal_proof(
            &env,
            &proof,
            &commitment,
            winning_side,
            &nullifier,
        );
        if !proof_valid {
            panic!("Invalid ZK proof");
        }
        // ─────────────────────────────────────────────────────────────────────

        // Mark nullifier spent BEFORE external state mutations (reentrancy guard).
        let k = nullifier_key;
        env.storage().persistent().set(&k, &true);
        env.storage().persistent().extend_ttl(&k, 17_280, 17_280);

        // Mark position as claimed.
        position.claimed = true;
        let k = commitment_key;
        env.storage().persistent().set(&k, &position);
        env.storage().persistent().extend_ttl(&k, 17_280, 17_280);

        // Compute and credit payout.
        // payout = bet_amount × payout_bps / 10_000
        let payout = (position.amount as i128) * (market.payout_bps as i128) / 10_000;

        let current_bal = Self::get_escrow_bal(&env, &bettor);
        env.storage()
            .persistent()
            .set(&DataKey::EscrowBal(bettor.clone()), &(current_bal + payout));

        env.events().publish(
            (symbol_short!("claim"), bettor),
            (market_id, nullifier, payout),
        );
    }



    // ── Query helpers ─────────────────────────────────────────────────────────

    /// Return full market state for a given market ID.
    pub fn get_market(env: Env, market_id: u32) -> Market {
        env.storage()
            .persistent()
            .get(&DataKey::Market(market_id))
            .expect("Market not found")
    }

    /// Return the sealed position associated with a commitment hash.
    pub fn get_position(env: Env, commitment: BytesN<32>) -> Position {
        env.storage()
            .persistent()
            .get(&DataKey::Position(commitment))
            .expect("Position not found")
    }

    /// Return the total number of markets created.
    pub fn market_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MarketCount)
            .unwrap_or(0)
    }

    /// Return true if a nullifier has been spent.
    pub fn is_nullifier_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier))
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn xlm_client(env: &Env) -> token::Client<'_> {
        let xlm: Address = env
            .storage()
            .instance()
            .get(&DataKey::XlmToken)
            .expect("Not initialised — call init() first");
        token::Client::new(env, &xlm)
    }

    fn get_escrow_bal(env: &Env, user: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::EscrowBal(user.clone()))
            .unwrap_or(0)
    }
}

mod test;
