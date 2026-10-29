use super::*;
use soroban_sdk::{testutils::Address as _, Env};

#[test]
fn test_paymaster_init() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MeridianPaymaster, ());
    let client = MeridianPaymasterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let native = Address::generate(&env);
    let soroswap = Address::generate(&env);

    client.initialize(&admin, &usdc, &native, &soroswap, &100);
}
