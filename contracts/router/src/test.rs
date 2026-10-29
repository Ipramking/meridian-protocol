use super::*;
use soroban_sdk::{testutils::Address as _, Env};

#[test]
fn test_router_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MeridianRouter, ());
    let client = MeridianRouterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let forwarder = Address::generate(&env);
    let soroswap = Address::generate(&env);

    client.initialize(&admin, &usdc, &forwarder, &soroswap, &500);

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert_eq!(config.usdc_token, usdc);
    assert_eq!(config.max_relayer_fee_bps, 500);
    assert_eq!(config.paused, false);
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MeridianRouter, ());
    let client = MeridianRouterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let forwarder = Address::generate(&env);
    let soroswap = Address::generate(&env);

    client.initialize(&admin, &usdc, &forwarder, &soroswap, &500);
    assert_eq!(client.get_config().paused, false);

    client.set_paused(&true);
    assert_eq!(client.get_config().paused, true);

    client.set_paused(&false);
    assert_eq!(client.get_config().paused, false);
}
