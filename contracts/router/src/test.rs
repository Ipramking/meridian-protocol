use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, IntoVal, String, Vec,
};

// Integration tests run against the real vault and compliance contracts.
// Build them first: `cargo build --target wasm32v1-none --release`.
mod vault_wasm {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/meridian_vault.wasm");
}
mod compliance_wasm {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/meridian_compliance.wasm"
    );
}
type MeridianRwaVaultClient<'a> = vault_wasm::Client<'a>;
type MeridianComplianceClient<'a> = compliance_wasm::Client<'a>;

/// Mirrors the real Soroswap router: `to.require_auth()`, then the input token is
/// transferred FROM `to` straight into the pair. Pays out 2 output tokens per input.
#[contract]
pub struct MockSoroswap;

#[contractimpl]
impl MockSoroswap {
    pub fn set_pair(env: Env, pair: Address) {
        env.storage().instance().set(&symbol_short!("pair"), &pair);
    }

    pub fn router_pair_for(env: Env, _token_a: Address, _token_b: Address) -> Address {
        env.storage().instance().get(&symbol_short!("pair")).unwrap()
    }

    pub fn swap_exact_tokens_for_tokens(
        env: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        _deadline: u64,
    ) -> Vec<i128> {
        to.require_auth();
        let pair: Address = env.storage().instance().get(&symbol_short!("pair")).unwrap();
        TokenClient::new(&env, &path.get(0).unwrap()).transfer(&to, &pair, &amount_in);

        let out = amount_in * 2;
        assert!(out >= amount_out_min, "slippage");
        TokenClient::new(&env, &path.get(path.len() - 1).unwrap()).transfer(
            &env.current_contract_address(),
            &to,
            &out,
        );
        vec![&env, amount_in, out]
    }
}

struct Setup<'a> {
    env: Env,
    usdc_addr: Address,
    usdc: TokenClient<'a>,
    usdc_admin: StellarAssetClient<'a>,
    admin: Address,
    router_id: Address,
    router: MeridianRouterClient<'a>,
    compliance: MeridianComplianceClient<'a>,
    open_vault: MeridianRwaVaultClient<'a>,
    kyc_vault: MeridianRwaVaultClient<'a>,
    soroswap_id: Address,
}

fn new_vault<'a>(
    env: &Env,
    admin: &Address,
    usdc: &Address,
    router: &Address,
    name: &str,
    symbol: &str,
) -> MeridianRwaVaultClient<'a> {
    let id = env.register(vault_wasm::WASM, ());
    let client = MeridianRwaVaultClient::new(env, &id);
    client.initialize(
        admin,
        usdc,
        router,
        &String::from_str(env, name),
        &String::from_str(env, symbol),
    );
    client
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 1_000);

    let token_admin = Address::generate(&env);
    let usdc_addr = env.register_stellar_asset_contract_v2(token_admin).address();
    let usdc = TokenClient::new(&env, &usdc_addr);
    let usdc_admin = StellarAssetClient::new(&env, &usdc_addr);

    let admin = Address::generate(&env);
    let compliance_id = env.register(compliance_wasm::WASM, ());
    let compliance = MeridianComplianceClient::new(&env, &compliance_id);
    compliance.initialize(&admin);

    let soroswap_id = env.register(MockSoroswap, ());
    MockSoroswapClient::new(&env, &soroswap_id).set_pair(&Address::generate(&env));

    let router_id = env.register(MeridianRouter, ());
    let router = MeridianRouterClient::new(&env, &router_id);
    router.initialize(&admin, &usdc_addr, &soroswap_id, &compliance_id, &500);

    let open_vault = new_vault(&env, &admin, &usdc_addr, &router_id, "Open", "mvUSDC");
    let kyc_vault = new_vault(&env, &admin, &usdc_addr, &router_id, "Accredited", "maUSDC");
    router.set_vault(&open_vault.address, &true, &false);
    router.set_vault(&kyc_vault.address, &true, &true);

    Setup {
        env,
        usdc_addr,
        usdc,
        usdc_admin,
        admin,
        router_id,
        router,
        compliance,
        open_vault,
        kyc_vault,
        soroswap_id,
    }
}

fn intent(s: &Setup, recipient: &Address, vault: Option<Address>) -> CrossChainIntent {
    CrossChainIntent {
        origin_domain: 3,
        sender: BytesN::from_array(&s.env, &[1u8; 32]),
        recipient: recipient.clone(),
        amount_in: 500_000_000,
        min_amount_out: 490_000_000,
        deadline: 2_000,
        swap_path: vec![&s.env, s.usdc_addr.clone()],
        vault_target: vault,
        relayer_fee: 5_000_000, // 1%, within the 5% cap
    }
}

#[test]
fn test_router_initialization() {
    let s = setup();
    let config = s.router.get_config();
    assert_eq!(config.admin, s.admin);
    assert_eq!(config.usdc_token, s.usdc_addr);
    assert_eq!(config.soroswap_router, s.soroswap_id);
    assert_eq!(config.max_relayer_fee_bps, 500);
    assert!(!config.paused);

    let dup = s.router.try_initialize(
        &s.admin,
        &s.usdc_addr,
        &s.soroswap_id,
        &config.compliance,
        &500,
    );
    assert_eq!(dup, Err(Ok(RouterError::AlreadyInitialized)));

    // Fee ceiling is enforced at initialization
    let fresh = MeridianRouterClient::new(&s.env, &s.env.register(MeridianRouter, ()));
    let too_high = fresh.try_initialize(
        &s.admin,
        &s.usdc_addr,
        &s.soroswap_id,
        &config.compliance,
        &1_001,
    );
    assert_eq!(too_high, Err(Ok(RouterError::InvalidFeeConfig)));
}

#[test]
fn test_fill_uses_relayer_liquidity_and_blocks_replay() {
    let s = setup();
    let relayer = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);
    s.usdc_admin.mint(&relayer, &1_000_000_000);

    let i = intent(&s, &recipient, None);
    let msg = BytesN::from_array(&s.env, &[10u8; 32]);

    let out = s.router.execute_intent(&i, &msg, &relayer);
    assert_eq!(out, 495_000_000);
    assert_eq!(s.usdc.balance(&recipient), 495_000_000);
    assert_eq!(s.usdc.balance(&relayer), 505_000_000);
    assert_eq!(s.usdc.balance(&s.router_id), 0);

    let id = s.router.order_id(&i, &msg);
    let fill = s.router.get_fill(&id).unwrap();
    assert_eq!(fill.relayer, relayer);
    assert_eq!(fill.amount_out, 495_000_000);

    let replay = s.router.try_execute_intent(&i, &msg, &relayer);
    assert_eq!(replay, Err(Ok(RouterError::AlreadyFilled)));

    // A different intent under the same message hash gets a different order id
    let mut other = i.clone();
    other.amount_in = 400_000_000;
    assert_ne!(s.router.order_id(&other, &msg), id);
}

#[test]
fn test_router_balance_cannot_be_drained() {
    let s = setup();
    let attacker = Address::generate(&s.env);
    // Funds sitting in the router (e.g. a mistaken transfer) must stay put
    s.usdc_admin.mint(&s.router_id, &1_000_000_000);

    let mut i = intent(&s, &attacker, None);
    i.amount_in = 1_000_000_000;
    i.min_amount_out = 0;
    i.relayer_fee = 0;

    // The attacker holds no USDC, so the fill can't be funded
    let res = s
        .router
        .try_execute_intent(&i, &BytesN::from_array(&s.env, &[7u8; 32]), &attacker);
    assert!(res.is_err());
    assert_eq!(s.usdc.balance(&s.router_id), 1_000_000_000);
    assert_eq!(s.usdc.balance(&attacker), 0);
}

#[test]
fn test_fill_into_open_vault_mints_shares() {
    let s = setup();
    let relayer = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);
    s.usdc_admin.mint(&relayer, &1_000_000_000);

    let i = intent(&s, &recipient, Some(s.open_vault.address.clone()));
    let out = s
        .router
        .execute_intent(&i, &BytesN::from_array(&s.env, &[20u8; 32]), &relayer);

    assert_eq!(out, 495_000_000);
    assert_eq!(s.open_vault.get_shares(&recipient), 495_000_000);
    assert_eq!(s.usdc.balance(&s.open_vault.address), 495_000_000);
    assert_eq!(s.usdc.balance(&s.router_id), 0);
}

#[test]
fn test_vault_must_be_allowlisted() {
    let s = setup();
    let relayer = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);
    s.usdc_admin.mint(&relayer, &1_000_000_000);

    let rogue = new_vault(&s.env, &s.admin, &s.usdc_addr, &s.router_id, "Rogue", "rg");
    let i = intent(&s, &recipient, Some(rogue.address.clone()));
    let res = s
        .router
        .try_execute_intent(&i, &BytesN::from_array(&s.env, &[30u8; 32]), &relayer);
    assert_eq!(res, Err(Ok(RouterError::VaultNotAllowed)));

    s.router.set_vault(&s.open_vault.address, &false, &false);
    let res = s
        .router
        .try_deposit(&relayer, &10_000_000, &s.open_vault.address);
    assert_eq!(res, Err(Ok(RouterError::VaultNotAllowed)));
}

#[test]
fn test_kyc_vault_requires_eligibility() {
    let s = setup();
    let user = Address::generate(&s.env);
    s.usdc_admin.mint(&user, &100_000_000);

    let denied = s.router.try_deposit(&user, &50_000_000, &s.kyc_vault.address);
    assert_eq!(denied, Err(Ok(RouterError::NotEligible)));
    assert_eq!(s.usdc.balance(&user), 100_000_000);

    s.compliance
        .set_verification(&user, &566, &true, &(s.env.ledger().timestamp() + 86_400));
    assert_eq!(
        s.router.deposit(&user, &50_000_000, &s.kyc_vault.address),
        50_000_000
    );
    assert_eq!(s.kyc_vault.get_shares(&user), 50_000_000);
}

#[test]
fn test_deadline_fee_and_amount_bounds() {
    let s = setup();
    let relayer = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);
    s.usdc_admin.mint(&relayer, &1_000_000_000);
    let msg = BytesN::from_array(&s.env, &[40u8; 32]);

    let mut expired = intent(&s, &recipient, None);
    expired.deadline = 999;
    assert_eq!(
        s.router.try_execute_intent(&expired, &msg, &relayer),
        Err(Ok(RouterError::ExpiredDeadline))
    );

    let mut too_far = intent(&s, &recipient, None);
    too_far.deadline = 1_000 + 7 * 24 * 60 * 60 + 1;
    assert_eq!(
        s.router.try_execute_intent(&too_far, &msg, &relayer),
        Err(Ok(RouterError::DeadlineTooFar))
    );

    let mut greedy = intent(&s, &recipient, None);
    greedy.relayer_fee = 25_000_001; // just over 5%
    assert_eq!(
        s.router.try_execute_intent(&greedy, &msg, &relayer),
        Err(Ok(RouterError::RelayerFeeExceeded))
    );

    let mut negative = intent(&s, &recipient, None);
    negative.relayer_fee = -1;
    assert_eq!(
        s.router.try_execute_intent(&negative, &msg, &relayer),
        Err(Ok(RouterError::RelayerFeeExceeded))
    );

    let mut tight = intent(&s, &recipient, None);
    tight.min_amount_out = 496_000_000;
    assert_eq!(
        s.router.try_execute_intent(&tight, &msg, &relayer),
        Err(Ok(RouterError::SlippageExceeded))
    );

    let mut bad_path = intent(&s, &recipient, None);
    bad_path.swap_path = vec![&s.env, Address::generate(&s.env)];
    assert_eq!(
        s.router.try_execute_intent(&bad_path, &msg, &relayer),
        Err(Ok(RouterError::InvalidPath))
    );

    assert_eq!(
        s.router.try_deposit(&relayer, &0, &s.open_vault.address),
        Err(Ok(RouterError::ZeroAmount))
    );
}

#[test]
fn test_pause_blocks_execution() {
    let s = setup();
    let relayer = Address::generate(&s.env);
    s.usdc_admin.mint(&relayer, &1_000_000_000);

    s.router.set_paused(&true);
    assert!(s.router.get_config().paused);

    let i = intent(&s, &relayer, None);
    assert_eq!(
        s.router
            .try_execute_intent(&i, &BytesN::from_array(&s.env, &[50u8; 32]), &relayer),
        Err(Ok(RouterError::Paused))
    );
    assert_eq!(
        s.router.try_deposit(&relayer, &10_000_000, &s.open_vault.address),
        Err(Ok(RouterError::Paused))
    );

    s.router.set_paused(&false);
    assert!(!s.router.get_config().paused);
}

/// Only the relayer's own signature is mocked. The router's transfer into the
/// Soroswap pair must be covered by `authorize_as_current_contract`, so this test
/// fails if that pre-authorization is missing.
#[test]
fn test_swap_leg_with_strict_auth() {
    let s = setup();
    let relayer = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);
    s.usdc_admin.mint(&relayer, &1_000_000_000);

    let out_token = s
        .env
        .register_stellar_asset_contract_v2(Address::generate(&s.env))
        .address();
    StellarAssetClient::new(&s.env, &out_token).mint(&s.soroswap_id, &10_000_000_000);
    let pair = MockSoroswapClient::new(&s.env, &s.soroswap_id).router_pair_for(&s.usdc_addr, &out_token);

    let mut i = intent(&s, &recipient, None);
    i.swap_path = vec![&s.env, s.usdc_addr.clone(), out_token.clone()];
    i.min_amount_out = 980_000_000;
    let msg = BytesN::from_array(&s.env, &[60u8; 32]);
    let net = i.amount_in - i.relayer_fee;

    let transfer_in = [MockAuthInvoke {
        contract: &s.usdc_addr,
        fn_name: "transfer",
        args: (relayer.clone(), s.router_id.clone(), net).into_val(&s.env),
        sub_invokes: &[],
    }];
    let auths = [MockAuth {
        address: &relayer,
        invoke: &MockAuthInvoke {
            contract: &s.router_id,
            fn_name: "execute_intent",
            args: (i.clone(), msg.clone(), relayer.clone()).into_val(&s.env),
            sub_invokes: &transfer_in,
        },
    }];

    let out = s.router.mock_auths(&auths).execute_intent(&i, &msg, &relayer);
    assert_eq!(out, 990_000_000);
    assert_eq!(TokenClient::new(&s.env, &out_token).balance(&recipient), 990_000_000);
    assert_eq!(s.usdc.balance(&pair), net);
    assert_eq!(s.usdc.balance(&s.router_id), 0);
}

/// Only the depositor's signature is mocked: the router -> vault -> token chain
/// (approve, router auth on vault.deposit, transfer_from) must authorize itself.
#[test]
fn test_deposit_with_strict_auth() {
    let s = setup();
    let user = Address::generate(&s.env);
    s.usdc_admin.mint(&user, &200_000_000);

    let vault = s.open_vault.address.clone();
    let transfer_in = [MockAuthInvoke {
        contract: &s.usdc_addr,
        fn_name: "transfer",
        args: (user.clone(), s.router_id.clone(), 150_000_000i128).into_val(&s.env),
        sub_invokes: &[],
    }];
    let auths = [MockAuth {
        address: &user,
        invoke: &MockAuthInvoke {
            contract: &s.router_id,
            fn_name: "deposit",
            args: (user.clone(), 150_000_000i128, vault.clone()).into_val(&s.env),
            sub_invokes: &transfer_in,
        },
    }];

    let shares = s.router.mock_auths(&auths).deposit(&user, &150_000_000, &vault);
    assert_eq!(shares, 150_000_000);
    assert_eq!(s.open_vault.get_shares(&user), 150_000_000);
    assert_eq!(s.usdc.balance(&user), 50_000_000);
    assert_eq!(s.usdc.balance(&vault), 150_000_000);
    assert_eq!(s.usdc.balance(&s.router_id), 0);
}
