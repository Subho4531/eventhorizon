#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol,
};
use soroban_sdk::token;

// --- Data Types ---

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Mandate {
    pub recipient: Address,
    pub commitment_hash: BytesN<32>,
    pub max_amount: i128,
    pub interval_ledgers: u32,
    pub last_executed: u32,
    pub token: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    MandateConfig,     // Stores the initialized mandate config
    VerificationKey,   // Stores the Groth16 VK
}

// --- Errors ---

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ProofInvalid = 3,
    AmountExceedsCeiling = 4,
    IntervalNotReached = 5,
}

// --- Verifier Placeholder ---
// In a production scenario, you would import a `arkworks` or similar BN254 Groth16 verifier
// customized for `no_std` / Soroban WASM. We abstract it behind a simple interface here.
pub fn verify_groth16_proof(_env: &Env, _vk: &soroban_sdk::Bytes, _proof: &soroban_sdk::Bytes, _public_signals: &soroban_sdk::Vec<soroban_sdk::BytesN<32>>) -> bool {
    // WARNING: This is a stub for the heavy elliptic curve pairing checks.
    // In practice, this requires a specialized Soroban verifier crate.
    true
}

// --- Contract Logic ---

#[contract]
pub struct AutoPayContract;

#[contractimpl]
impl AutoPayContract {
    /// Initializes the mandate for the user. 
    /// This establishes the target token, the recipient, the ceiling amount, the frequency, and the ZK Commitment.
    /// The user is required to authorize this setup call.
    pub fn initialize(
        env: Env,
        user: Address,
        token: Address,
        recipient: Address,
        commitment_hash: BytesN<32>,
        max_amount: i128,
        interval_ledgers: u32,
        vk: soroban_sdk::Bytes, // The verification key from groth16 setup
    ) -> Result<(), Error> {
        user.require_auth();

        if env.storage().instance().has(&DataKey::MandateConfig) {
            return Err(Error::AlreadyInitialized);
        }

        let mandate = Mandate {
            recipient,
            commitment_hash,
            max_amount,
            interval_ledgers,
            last_executed: env.ledger().sequence(), // Start the clock now
            token,
        };

        // Store configuration
        env.storage().instance().set(&DataKey::MandateConfig, &mandate);
        env.storage().instance().set(&DataKey::VerificationKey, &vk);

        Ok(())
    }

    /// Executed by the relayer (a node backend). The relayer pays the transaction fee,
    /// bringing a ZK Proof that matches the stored commitment.
    pub fn execute(
        env: Env,
        relayer: Address, // Relayer submits the tx
        request_amount: i128,
        proof_bytes: soroban_sdk::Bytes,
    ) -> Result<(), Error> {
        relayer.require_auth();

        // 1. Retrieve the mandate
        let mut mandate: Mandate = env
            .storage()
            .instance()
            .get(&DataKey::MandateConfig)
            .ok_or(Error::NotInitialized)?;
            
        let vk: soroban_sdk::Bytes = env
            .storage()
            .instance()
            .get(&DataKey::VerificationKey)
            .ok_or(Error::NotInitialized)?;

        // 2. Check interval timeline (rate limiting)
        let current_ledger = env.ledger().sequence();
        if current_ledger < mandate.last_executed + mandate.interval_ledgers {
            return Err(Error::IntervalNotReached);
        }

        // 3. Check requested amount against the authorized ceiling
        if request_amount > mandate.max_amount {
            return Err(Error::AmountExceedsCeiling);
        }

        // 4. Verify the Groth16 Proof
        // The circuit outputted `commitment_hash`. The public signals are `[commitment, max_amount, interval, recipient]`.
        // We construct the "public signals" array that the circuit expects the verifier to check.
        // For simplicity, we assume `max_amount` etc. fit in 32-byte chunks as Circom signals.
        let mut public_signals = soroban_sdk::Vec::new(&env);
        public_signals.push_back(mandate.commitment_hash.clone());
        // ... construct other public signals and hash them or format them properly
        
        if !verify_groth16_proof(&env, &vk, &proof_bytes, &public_signals) {
            return Err(Error::ProofInvalid);
        }

        // 5. Execution: Transfer the tokens.
        // We invoke the standard Soroban Token Interface. Wait, we need the `from` address.
        // Since the user is not actively signing THIS transaction, the contract must have been granted 
        // an allowance during `initialize`, OR the tokens are locked in the contract itself! 
        // Let's assume the user pre-funded the contract (simplest for a smart wallet model).
        let token_client = token::Client::new(&env, &mandate.token);
        token_client.transfer(&env.current_contract_address(), &mandate.recipient, &request_amount);

        // 6. Update state
        mandate.last_executed = current_ledger;
        env.storage().instance().set(&DataKey::MandateConfig, &mandate);

        // 7. Emit execution event
        env.events().publish(
            (symbol_short!("autopay"), symbol_short!("exec")),
            (mandate.recipient, request_amount),
        );

        Ok(())
    }
}
