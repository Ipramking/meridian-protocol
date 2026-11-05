use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Vec,
};

/// Mirrors the real Soroswap router: `to.require_auth()`, then the input token is
/// transferred FROM `to` straight into the pair.
#[contract]
pub struct MockSoroswapRouter;

#[contractimpl]
impl MockSoroswapRouter {
    pub fn router_pair_for(env: Env, _token_a: Address, _token_b: Address) -> Address {
        env.storage().instance().get(&symbol_short!("pair")).unwrap()
    }

    pub fn set_pair(env: Env, pair: Address) {
        env.storage().instance().set(&symbol_short!("pair"), &pair);
    }

    pub fn swap_exact_tokens_for_tokens(
        env: Env,
        amount_in: i128,
        min_out: i128,
        path: Vec<Address>,
        to: Address,
        _deadline: u64,
    ) -> Vec<i128> {
        to.require_auth();
        let token_in = path.get(0).unwrap();
        let token_out = path.get(path.len() - 1).unwrap();
        let pair: Address = env.storage().instance().get(&symbol_short!("pair")).unwrap();

        let in_client = TokenClient::new(&env, &token_in);
        in_client.transfer(&to, &pair, &amount_in);

        // Simulate 1 USDC = 10 XLM conversion rate
        let xlm_out = amount_in * 10;
        assert!(xlm_out >= min_out, "slippage exceeded");

        let out_client = TokenClient::new(&env, &token_out);
        out_client.transfer(&env.current_contract_address(), &to, &xlm_out);

        let mut amounts = Vec::new(&env);
        amounts.push_back(amount_in);
        amounts.push_back(xlm_out);
        amounts
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
fn test_paymaster_init_and_config_validation() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MeridianPaymaster, ());
    let client = MeridianPaymasterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let native = Address::generate(&env);
    let soroswap = Address::generate(&env);

    client.initialize(&admin, &usdc, &native, &soroswap, &250);

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert_eq!(config.usdc_token, usdc);
    assert_eq!(config.native_token, native);
    assert_eq!(config.soroswap_router, soroswap);
    assert_eq!(config.fee_markup_bps, 250);
    assert!(config.active);
    assert_eq!(client.get_accumulated_fees(), 0);

    // Verify duplicate initialization is rejected
    let dup = client.try_initialize(&admin, &usdc, &native, &soroswap, &250);
    assert_eq!(dup, Err(Ok(PaymasterError::AlreadyInitialized)));
}

#[test]
fn test_record_sponsorship_deducts_usdc_with_markup_and_accumulates() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (usdc_addr, usdc_token, usdc_admin) = create_token(&env, &token_admin);
    let (xlm_addr, _xlm_token, _xlm_admin) = create_token(&env, &token_admin);

    let admin = Address::generate(&env);
    let relayer = Address::generate(&env);
    let user = Address::generate(&env);
    let soroswap = Address::generate(&env);

    let contract_id = env.register(MeridianPaymaster, ());
    let client = MeridianPaymasterClient::new(&env, &contract_id);

    // 200 bps = 2% markup
    client.initialize(&admin, &usdc_addr, &xlm_addr, &soroswap, &200);

    // Mint 100 USDC (100_0000000 stroops) to user
    usdc_admin.mint(&user, &1_000_000_000);

    // Sponsor 10 USDC base fee -> 2% markup = 0.20 USDC -> total 10.20 USDC (102_000_000)
    let charged = client.record_sponsorship(&relayer, &user, &100_000_000);
    assert_eq!(charged, 102_000_000);

    assert_eq!(usdc_token.balance(&user), 898_000_000);
    assert_eq!(usdc_token.balance(&contract_id), 102_000_000);
    assert_eq!(client.get_accumulated_fees(), 102_000_000);
    assert_eq!(client.get_sponsored_volume(&user), 102_000_000);
}

#[test]
fn test_rebalance_native_swaps_accumulated_usdc_for_xlm() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (usdc_addr, usdc_token, usdc_admin) = create_token(&env, &token_admin);
    let (xlm_addr, xlm_token, xlm_admin) = create_token(&env, &token_admin);

    let soroswap_id = env.register(MockSoroswapRouter, ());
    let pair = Address::generate(&env);
    MockSoroswapRouterClient::new(&env, &soroswap_id).set_pair(&pair);
    // Fund MockSoroswapRouter with XLM liquidity
    xlm_admin.mint(&soroswap_id, &10_000_000_000);

    let admin = Address::generate(&env);
    let relayer = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(MeridianPaymaster, ());
    let client = MeridianPaymasterClient::new(&env, &contract_id);

    // 0 bps markup for clean arithmetic check
    client.initialize(&admin, &usdc_addr, &xlm_addr, &soroswap_id, &0);

    usdc_admin.mint(&user, &500_000_000);
    client.record_sponsorship(&relayer, &user, &200_000_000);
    assert_eq!(client.get_accumulated_fees(), 200_000_000);

    // Rebalance 150 USDC into XLM (1 USDC -> 10 XLM in mock router = 1,500 XLM)
    let xlm_received = client.rebalance_native(&150_000_000, &1_400_000_000, &99999);
    assert_eq!(xlm_received, 1_500_000_000);

    // Verify remaining accumulated USDC fees and XLM reserve balance
    assert_eq!(client.get_accumulated_fees(), 50_000_000);
    assert_eq!(usdc_token.balance(&contract_id), 50_000_000);
    assert_eq!(usdc_token.balance(&pair), 150_000_000);
    assert_eq!(xlm_token.balance(&contract_id), 1_500_000_000);
}

#[test]
fn test_paymaster_pause_and_error_guards() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let (usdc_addr, _usdc_token, usdc_admin) = create_token(&env, &token_admin);
    let (xlm_addr, _xlm_token, _xlm_admin) = create_token(&env, &token_admin);

    let admin = Address::generate(&env);
    let relayer = Address::generate(&env);
    let user = Address::generate(&env);
    let soroswap = Address::generate(&env);

    let contract_id = env.register(MeridianPaymaster, ());
    let client = MeridianPaymasterClient::new(&env, &contract_id);

    client.initialize(&admin, &usdc_addr, &xlm_addr, &soroswap, &100);
    usdc_admin.mint(&user, &500_000_000);

    // Reject zero/negative fee sponsorship
    let zero_res = client.try_record_sponsorship(&relayer, &user, &0);
    assert_eq!(zero_res, Err(Ok(PaymasterError::InvalidAmount)));

    // Deactivate paymaster and verify sponsorship is blocked
    client.set_active(&false);
    assert!(!client.get_config().active);

    let inactive_res = client.try_record_sponsorship(&relayer, &user, &50_000_000);
    assert_eq!(inactive_res, Err(Ok(PaymasterError::Inactive)));

    // Rebalance more than accumulated fees must fail with InsufficientBalance
    let insuf_res = client.try_rebalance_native(&10_000_000, &1_000_000, &99999);
    assert_eq!(insuf_res, Err(Ok(PaymasterError::InsufficientBalance)));
}
