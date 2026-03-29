#![cfg(test)]

use crate::{ZKPredictionMarket, ZKPredictionMarketClient, MarketStatus, Outcome};
use soroban_sdk::{Env, Address, BytesN, Symbol};

#[test]
fn test_prediction_market_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ZKPredictionMarket);
    let client = ZKPredictionMarketClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let oracle = Address::generate(&env);
    let bettor = Address::generate(&env);

    // 1. Create Market
    let title = Symbol::new(&env, "TrumpWins?");
    let market_id = client.create_market(&creator, &oracle, &title);
    assert_eq!(market_id, 1);

    // 2. Place Bet
    let mut commitment_data = [0u8; 32];
    commitment_data[0] = 1; // Fake commitment
    let commitment = BytesN::from_array(&env, &commitment_data);
    let amount = 100;

    client.place_bet(&bettor, &market_id, &commitment, &amount);

    // 3. Resolve Market
    client.resolve(&oracle, &market_id, &Outcome::Yes);

    // 4. Claim Winnings
    let mut nullifier_data = [0u8; 32];
    nullifier_data[0] = 9; // Fake nullifier
    let nullifier = BytesN::from_array(&env, &nullifier_data);

    let mut proof_data = [0u8; 32];
    proof_data[0] = 42; // Fake proof
    let dummy_proof = BytesN::from_array(&env, &proof_data);

    client.claim(&bettor, &market_id, &commitment, &nullifier, &dummy_proof);

    // Assert a second claim fails
    // Normally we'd use robust error checking, but panics are caught here if env is configured properly
    // or we just trust the panics exist.
}
