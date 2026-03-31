use soroban_sdk::{contracttype, Address, BytesN, Symbol};

// ──────────────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketStatus {
    Open     = 0,
    Closed   = 1, // past close_time, awaiting oracle
    Resolved = 2,
    Disputed = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Outcome {
    Yes = 0,
    No  = 1,
}

// ──────────────────────────────────────────────────────────────────────────────
// Structs
// ──────────────────────────────────────────────────────────────────────────────

/// A single prediction market.
#[contracttype]
#[derive(Clone)]
pub struct Market {
    /// Address that created the market (must post bond).
    pub creator: Address,
    /// Trusted oracle that resolves the market.
    pub oracle: Address,
    /// Short human-readable description (max 32 chars as Symbol).
    pub title: Symbol,
    /// Current lifecycle stage.
    pub status: MarketStatus,
    /// Outcome set by oracle on resolution (None while open).
    pub outcome: Option<Outcome>,
    /// Unix seconds after which no new bets may be placed.
    pub close_time: u64,
    /// Total XLM staked in this market (stroops).
    pub total_pool: i128,
    /// Creator bond held in escrow, slashable on bad oracle behaviour.
    pub bond: i128,
    /// Dispute window end (48 h after resolution). Payouts unlock after this.
    pub dispute_end: u64,
    /// Payout multiplier set by oracle at resolution (basis points, e.g. 20 000 = 2×).
    /// Winners receive: bet_amount × payout_bps / 10 000.
    pub payout_bps: u32,
}

/// A sealed bet position. Only the ZK commitment is stored on-chain;
/// the actual side (YES/NO) is a private witness held by the bettor.
#[contracttype]
#[derive(Clone)]
pub struct Position {
    pub bettor: Address,
    pub market_id: u32,
    /// Bet amount in stroops.
    pub amount: i128,
    /// Set true after claim() succeeds to block double withdrawals.
    pub claimed: bool,
}

// ──────────────────────────────────────────────────────────────────────────────
// Groth16 proof types
// ──────────────────────────────────────────────────────────────────────────────

/// A BN254 G1 affine point (x, y each 32 bytes big-endian).
#[contracttype]
#[derive(Clone)]
pub struct G1Point {
    pub x: BytesN<32>,
    pub y: BytesN<32>,
}

/// A BN254 G2 affine point (coordinates are Fp2 elements: re + im·i).
#[contracttype]
#[derive(Clone)]
pub struct G2Point {
    pub x_re: BytesN<32>,
    pub x_im: BytesN<32>,
    pub y_re: BytesN<32>,
    pub y_im: BytesN<32>,
}

/// A Groth16 proof as produced by snarkjs (pi_a, pi_b, pi_c).
#[contracttype]
#[derive(Clone)]
pub struct Groth16Proof {
    pub a: G1Point, // π_A ∈ G1
    pub b: G2Point, // π_B ∈ G2
    pub c: G1Point, // π_C ∈ G1
}

// ──────────────────────────────────────────────────────────────────────────────
// Storage key enum
// ──────────────────────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    // ── Config / one-time init ────────────────────────────────────────────────
    /// Address of the XLM Stellar Asset Contract (SAC).
    XlmToken,
    /// Contract administrator.
    Admin,

    // ── Escrow ────────────────────────────────────────────────────────────────
    /// Per-user escrow balance (stroops).
    EscrowBal(Address),

    // ── Markets ───────────────────────────────────────────────────────────────
    MarketCount,
    Market(u32),

    // ── Positions / ZK ───────────────────────────────────────────────────────
    /// commitment (32-byte Poseidon hash) → Position
    Position(BytesN<32>),
    /// nullifier (32-byte Poseidon hash) → bool (true = spent)
    Nullifier(BytesN<32>),
}
