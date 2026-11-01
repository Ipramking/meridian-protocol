use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, Vec,
};

#[contract]
pub struct MockVault;

#[contractimpl]
impl MockVault {
    pub fn deposit(env: Env, amount: i128, on_behalf_of: Address) {
        env.storage().persistent().set(&on_behalf_of, &amount);
    }

    pub fn get_deposit(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&user).unwrap_or(0)
    }
}

fn create_token<'a>(env: &Env, admin: &Address) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let addr = sac.address();
    (
        addr.clone(),
        TokenClient::new(env, &addr),
        StellarAssetClient::new(env, &addr),
    )
}

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

#[test]
fn test_execute_intent_direct_and_vault_routing_with_replay_protection() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.timestamp = 1_000;
    });

    let token_admin = Address::generate(&env);
    let (usdc_addr, usdc_token, usdc_admin) = create_token(&env, &token_admin);

    let admin = Address::generate(&env);
    let forwarder = Address::generate(&env);
    let soroswap = Address::generate(&env);
    let relayer = Address::generate(&env);
    let recipient = Address::generate(&env);

    let vault_id = env.register(MockVault, ());
    let vault_client = MockVaultClient::new(&env, &vault_id);

    let contract_id = env.register(MeridianRouter, ());
    let client = MeridianRouterClient::new(&env, &contract_id);

    client.initialize(&admin, &usdc_addr, &forwarder, &soroswap, &500);

    // Fund router contract with 1,000 USDC (simulating inbound CCTP mint)
    usdc_admin.mint(&contract_id, &1_000_000_000);

    let mut path = Vec::new(&env);
    path.push_back(usdc_addr.clone());

    let intent = CrossChainIntent {
        origin_domain: 3,
        sender: BytesN::from_array(&env, &[1u8; 32]),
        recipient: recipient.clone(),
        amount_in: 500_000_000,
        min_amount_out: 490_000_000,
        deadline: 2_000,
        swap_path: path.clone(),
        vault_target: None,
        relayer_fee: 5_000_000, // 1% fee (within 5% max_relayer_fee_bps)
    };

    let msg_hash_1 = BytesN::from_array(&env, &[10u8; 32]);
    let out_amt = client.execute_intent(&intent, &msg_hash_1, &relayer);
    assert_eq!(out_amt, 495_000_000);
    assert_eq!(usdc_token.balance(&relayer), 5_000_000);
    assert_eq!(usdc_token.balance(&recipient), 495_000_000);

    // Replay with identical message hash must be rejected
    let replay = client.try_execute_intent(&intent, &msg_hash_1, &relayer);
    assert_eq!(replay, Err(Ok(RouterError::AlreadyInitialized)));

    // Execute intent targeting RWA Vault
    let vault_intent = CrossChainIntent {
        origin_domain: 6,
        sender: BytesN::from_array(&env, &[2u8; 32]),
        recipient: recipient.clone(),
        amount_in: 500_000_000,
        min_amount_out: 495_000_000,
        deadline: 2_000,
        swap_path: path,
        vault_target: Some(vault_id.clone()),
        relayer_fee: 5_000_000,
    };
    let msg_hash_2 = BytesN::from_array(&env, &[20u8; 32]);
    let vault_out = client.execute_intent(&vault_intent, &msg_hash_2, &relayer);
    assert_eq!(vault_out, 495_000_000);
    assert_eq!(vault_client.get_deposit(&recipient), 495_000_000);
}
