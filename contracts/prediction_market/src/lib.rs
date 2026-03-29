#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketStatus {
    Open = 0,
    Resolved = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Outcome {
    Yes = 0,
    No = 1,
}

#[contracttype]
#[derive(Clone)]
pub struct Market {
    pub creator: Address,
    pub oracle: Address,
    pub title: Symbol,
    pub status: MarketStatus,
    pub outcome: Option<Outcome>,
    pub yes_pool: i128,
    pub no_pool: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct Position {
    pub bettor: Address,
    pub market_id: u32,
    pub amount: i128,
}

#[contracttype]
pub enum DataKey {
    Market(u32),
    MarketCount,
    Commitment(BytesN<32>), // Maps ZK Commitment -> Position
    Nullifier(BytesN<32>),  // Maps ZK Nullifier -> bool (spent)
}

#[contract]
pub struct ZKPredictionMarket;

#[contractimpl]
impl ZKPredictionMarket {
    pub fn create_market(env: Env, creator: Address, oracle: Address, title: Symbol) -> u32 {
        creator.require_auth();
        
        let mut id: u32 = env.storage().instance().get(&DataKey::MarketCount).unwrap_or(0);
        id += 1;
        
        let market = Market {
            creator,
            oracle,
            title,
            status: MarketStatus::Open,
            outcome: None,
            yes_pool: 0,
            no_pool: 0,
        };
        
        env.storage().instance().set(&DataKey::MarketCount, &id);
        env.storage().instance().set(&DataKey::Market(id), &market);
        id
    }

    pub fn place_bet(env: Env, bettor: Address, market_id: u32, commitment: BytesN<32>, amount: i128) {
        bettor.require_auth();
        
        let market_key = DataKey::Market(market_id);
        let market: Market = env.storage().instance().get(&market_key).unwrap();
        if market.status != MarketStatus::Open {
            panic!("Market is not open");
        }
        
        let position = Position {
            bettor: bettor.clone(),
            market_id,
            amount,
        };
        
        // Save the commitment. The contract does NOT know if this is a YES or NO bet.
        env.storage().instance().set(&DataKey::Commitment(commitment.clone()), &position);
    }

    pub fn resolve(env: Env, oracle: Address, market_id: u32, outcome: Outcome) {
        oracle.require_auth();
        let market_key = DataKey::Market(market_id);
        let mut market: Market = env.storage().instance().get(&market_key).unwrap();
        
        if oracle != market.oracle {
            panic!("Unauthorized: Caller is not the registered oracle");
        }
        
        market.status = MarketStatus::Resolved;
        market.outcome = Some(outcome);
        env.storage().instance().set(&market_key, &market);
    }

    pub fn claim(
        env: Env, 
        bettor: Address, 
        market_id: u32, 
        commitment: BytesN<32>, 
        nullifier: BytesN<32>, 
        dummy_proof: BytesN<32>
    ) {
        let market_key = DataKey::Market(market_id);
        let market: Market = env.storage().instance().get(&market_key).unwrap();
        
        if market.status != MarketStatus::Resolved {
            panic!("Cannot claim: Market is not resolved");
        }
        
        // Prevent double claiming
        if env.storage().instance().has(&DataKey::Nullifier(nullifier.clone())) {
            panic!("Already claimed");
        }
        
        let pos_key = DataKey::Commitment(commitment.clone());
        let position: Position = env.storage().instance().get(&pos_key).unwrap();
        
        if position.bettor != bettor {
             panic!("Not the commitment owner");
        }
        
        // MOCK ZK VERIFICATION:
        // In a real scenario, we perform a Groth16 verification here:
        // verify(proof, [commitment, nullifier, market.outcome])
        // If the proof is valid, it guarantees the user knew the secret for the commitment
        // and that they picked the winning outcome.
        
        // Mark nullifier as spent.
        env.storage().instance().set(&DataKey::Nullifier(nullifier), &true);
        
        // Initiate payout to bettor...
    }
}
mod test;
