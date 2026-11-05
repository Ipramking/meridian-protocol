#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
const BALANCE_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const BALANCE_THRESHOLD: u32 = BALANCE_BUMP - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ZeroAmount = 4,
    InsufficientShares = 5,
    Paused = 6,
    NoShares = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultMetadata {
    pub admin: Address,
    pub underlying_asset: Address,
    pub router: Address,
    pub name: String,
    pub symbol: String,
    pub total_assets: i128,
    pub total_shares: i128,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Metadata,
    Shares(Address),
}

/// USDC share vault. Share price = total_assets / total_shares and only moves when
/// the manager pushes realized yield in with `distribute_yield`; nothing is accrued
/// from a hardcoded rate.
#[contract]
pub struct MeridianRwaVault;

#[contractimpl]
impl MeridianRwaVault {
    pub fn initialize(
        env: Env,
        admin: Address,
        underlying_asset: Address,
        router: Address,
        name: String,
        symbol: String,
    ) -> Result<(), VaultError> {
        if env.storage().instance().has(&DataKey::Metadata) {
            return Err(VaultError::AlreadyInitialized);
        }
        admin.require_auth();

        let meta = VaultMetadata {
            admin,
            underlying_asset,
            router,
            name,
            symbol,
            total_assets: 0,
            total_shares: 0,
            paused: false,
        };

        Self::save(&env, &meta);
        Ok(())
    }

    pub fn get_metadata(env: Env) -> Result<VaultMetadata, VaultError> {
        Self::load(&env)
    }

    pub fn get_shares(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Shares(account))
            .unwrap_or(0)
    }

    /// Underlying assets currently redeemable for `shares`
    pub fn convert_to_assets(env: Env, shares: i128) -> Result<i128, VaultError> {
        let meta = Self::load(&env)?;
        if meta.total_shares == 0 {
            return Ok(shares);
        }
        Ok((shares * meta.total_assets) / meta.total_shares)
    }

    /// Deposit entrypoint for the configured MeridianRouter only.
    /// Pulls `amount` from the router via its allowance and credits `on_behalf_of`.
    pub fn deposit(env: Env, amount: i128, on_behalf_of: Address) -> Result<i128, VaultError> {
        if amount <= 0 {
            return Err(VaultError::ZeroAmount);
        }
        let meta = Self::load(&env)?;
        meta.router.require_auth();

        token::Client::new(&env, &meta.underlying_asset).transfer_from(
            &env.current_contract_address(),
            &meta.router,
            &env.current_contract_address(),
            &amount,
        );

        let shares = Self::mint(&env, meta, amount, &on_behalf_of)?;
        env.events()
            .publish((symbol_short!("v_dep"), on_behalf_of), (amount, shares));
        Ok(shares)
    }

    /// Direct deposit entrypoint where an individual investor deposits directly
    pub fn deposit_direct(
        env: Env,
        from: Address,
        amount: i128,
        on_behalf_of: Address,
    ) -> Result<i128, VaultError> {
        if amount <= 0 {
            return Err(VaultError::ZeroAmount);
        }
        from.require_auth();
        let meta = Self::load(&env)?;

        token::Client::new(&env, &meta.underlying_asset).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        let shares = Self::mint(&env, meta, amount, &on_behalf_of)?;
        env.events()
            .publish((symbol_short!("v_dep_dir"), on_behalf_of), (amount, shares));
        Ok(shares)
    }

    /// Redeem vault shares back into the underlying asset. Allowed while paused,
    /// so a pause can never lock depositors out of their funds.
    pub fn withdraw(env: Env, owner: Address, shares: i128) -> Result<i128, VaultError> {
        if shares <= 0 {
            return Err(VaultError::ZeroAmount);
        }
        owner.require_auth();

        let mut meta = Self::load(&env)?;
        let user_shares = Self::get_shares(env.clone(), owner.clone());
        if user_shares < shares || meta.total_shares < shares {
            return Err(VaultError::InsufficientShares);
        }

        let assets_out = (shares * meta.total_assets) / meta.total_shares;
        meta.total_shares -= shares;
        meta.total_assets -= assets_out;
        Self::save(&env, &meta);
        Self::set_shares(&env, &owner, user_shares - shares);

        token::Client::new(&env, &meta.underlying_asset).transfer(
            &env.current_contract_address(),
            &owner,
            &assets_out,
        );

        env.events()
            .publish((symbol_short!("v_wd"), owner), (shares, assets_out));

        Ok(assets_out)
    }

    /// Manager pushes realized yield into the vault, raising the share price for
    /// every holder. Requires outstanding shares so yield can't be captured by a
    /// first depositor.
    pub fn distribute_yield(env: Env, amount: i128) -> Result<i128, VaultError> {
        if amount <= 0 {
            return Err(VaultError::ZeroAmount);
        }
        let mut meta = Self::load(&env)?;
        meta.admin.require_auth();
        if meta.total_shares == 0 {
            return Err(VaultError::NoShares);
        }

        token::Client::new(&env, &meta.underlying_asset).transfer(
            &meta.admin,
            &env.current_contract_address(),
            &amount,
        );
        meta.total_assets += amount;
        Self::save(&env, &meta);

        env.events()
            .publish((symbol_short!("v_yield"),), (amount, meta.total_assets));
        Ok(meta.total_assets)
    }

    /// Admin function to pause or unpause new deposits
    pub fn set_paused(env: Env, paused: bool) -> Result<(), VaultError> {
        let mut meta = Self::load(&env)?;
        meta.admin.require_auth();
        meta.paused = paused;
        Self::save(&env, &meta);
        Ok(())
    }

    fn load(env: &Env) -> Result<VaultMetadata, VaultError> {
        env.storage()
            .instance()
            .get(&DataKey::Metadata)
            .ok_or(VaultError::NotInitialized)
    }

    fn save(env: &Env, meta: &VaultMetadata) {
        env.storage().instance().set(&DataKey::Metadata, meta);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }

    fn set_shares(env: &Env, account: &Address, shares: i128) {
        let key = DataKey::Shares(account.clone());
        env.storage().persistent().set(&key, &shares);
        env.storage()
            .persistent()
            .extend_ttl(&key, BALANCE_THRESHOLD, BALANCE_BUMP);
    }

    fn mint(
        env: &Env,
        mut meta: VaultMetadata,
        amount: i128,
        on_behalf_of: &Address,
    ) -> Result<i128, VaultError> {
        if amount <= 0 {
            return Err(VaultError::ZeroAmount);
        }
        if meta.paused {
            return Err(VaultError::Paused);
        }

        let shares_to_mint = if meta.total_shares == 0 || meta.total_assets == 0 {
            amount
        } else {
            (amount * meta.total_shares) / meta.total_assets
        };
        if shares_to_mint == 0 {
            return Err(VaultError::ZeroAmount);
        }

        meta.total_assets += amount;
        meta.total_shares += shares_to_mint;
        Self::save(env, &meta);

        let current = Self::get_shares(env.clone(), on_behalf_of.clone());
        Self::set_shares(env, on_behalf_of, current + shares_to_mint);

        Ok(shares_to_mint)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        token::{Client as TokenClient, StellarAssetClient},
        Env, IntoVal,
    };

    struct Setup<'a> {
        env: Env,
        usdc: TokenClient<'a>,
        usdc_admin: StellarAssetClient<'a>,
        admin: Address,
        router: Address,
        vault_id: Address,
        vault: MeridianRwaVaultClient<'a>,
    }

    fn setup<'a>() -> Setup<'a> {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin);
        let usdc = TokenClient::new(&env, &sac.address());
        let usdc_admin = StellarAssetClient::new(&env, &sac.address());

        let admin = Address::generate(&env);
        let router = Address::generate(&env);
        let vault_id = env.register(MeridianRwaVault, ());
        let vault = MeridianRwaVaultClient::new(&env, &vault_id);
        vault.initialize(
            &admin,
            &sac.address(),
            &router,
            &String::from_str(&env, "Meridian Open USDC Vault"),
            &String::from_str(&env, "mvUSDC"),
        );

        Setup { env, usdc, usdc_admin, admin, router, vault_id, vault }
    }

    #[test]
    fn test_vault_deposit_and_withdraw_lifecycle() {
        let s = setup();
        let investor = Address::generate(&s.env);

        s.usdc_admin.mint(&s.router, &1_000_000_000);
        s.usdc.approve(&s.router, &s.vault_id, &500_000_000, &100);

        let minted = s.vault.deposit(&500_000_000, &investor);
        assert_eq!(minted, 500_000_000);
        assert_eq!(s.vault.get_shares(&investor), 500_000_000);
        assert_eq!(s.vault.get_metadata().total_assets, 500_000_000);
        assert_eq!(s.usdc.balance(&s.vault_id), 500_000_000);

        let redeemed = s.vault.withdraw(&investor, &200_000_000);
        assert_eq!(redeemed, 200_000_000);
        assert_eq!(s.vault.get_shares(&investor), 300_000_000);
        assert_eq!(s.usdc.balance(&investor), 200_000_000);

        let too_many = s.vault.try_withdraw(&investor, &300_000_001);
        assert_eq!(too_many, Err(Ok(VaultError::InsufficientShares)));
    }

    #[test]
    fn test_deposit_requires_router_auth() {
        let s = setup();
        let attacker = Address::generate(&s.env);

        s.usdc_admin.mint(&s.router, &1_000_000_000);
        s.usdc.approve(&s.router, &s.vault_id, &500_000_000, &100);

        // Only the attacker authorizes; the router never does, so the call must fail
        // even though the router has an open allowance to the vault.
        let res = s
            .vault
            .mock_auths(&[MockAuth {
                address: &attacker,
                invoke: &MockAuthInvoke {
                    contract: &s.vault_id,
                    fn_name: "deposit",
                    args: (500_000_000i128, attacker.clone()).into_val(&s.env),
                    sub_invokes: &[],
                },
            }])
            .try_deposit(&500_000_000, &attacker);
        assert!(res.is_err());
        assert_eq!(s.vault.get_shares(&attacker), 0);
        assert_eq!(s.usdc.balance(&s.router), 1_000_000_000);
    }

    #[test]
    fn test_vault_direct_deposit_and_pause() {
        let s = setup();
        let user = Address::generate(&s.env);

        s.usdc_admin.mint(&user, &300_000_000);
        let minted = s.vault.deposit_direct(&user, &300_000_000, &user);
        assert_eq!(minted, 300_000_000);
        assert_eq!(s.vault.get_shares(&user), 300_000_000);

        s.vault.set_paused(&true);
        assert!(s.vault.get_metadata().paused);

        s.usdc_admin.mint(&user, &100_000_000);
        let err = s.vault.try_deposit_direct(&user, &100_000_000, &user);
        assert_eq!(err, Err(Ok(VaultError::Paused)));

        // Withdrawals stay open while paused
        assert_eq!(s.vault.withdraw(&user, &300_000_000), 300_000_000);
    }

    #[test]
    fn test_distributed_yield_raises_share_price() {
        let s = setup();
        let alice = Address::generate(&s.env);
        let bob = Address::generate(&s.env);

        let early = s.vault.try_distribute_yield(&10_000_000);
        assert_eq!(early, Err(Ok(VaultError::NoShares)));

        s.usdc_admin.mint(&alice, &100_000_000);
        s.vault.deposit_direct(&alice, &100_000_000, &alice);

        // Manager pushes 10 USDC of realized yield: 100 shares now back 110 USDC
        s.usdc_admin.mint(&s.admin, &10_000_000);
        assert_eq!(s.vault.distribute_yield(&10_000_000), 110_000_000);
        assert_eq!(s.vault.convert_to_assets(&100_000_000), 110_000_000);

        // Bob deposits 110 USDC and receives 100 shares at the new price
        s.usdc_admin.mint(&bob, &110_000_000);
        assert_eq!(s.vault.deposit_direct(&bob, &110_000_000, &bob), 100_000_000);

        assert_eq!(s.vault.withdraw(&alice, &100_000_000), 110_000_000);
        assert_eq!(s.usdc.balance(&alice), 110_000_000);
    }

    #[test]
    fn test_zero_amount_rejected() {
        let s = setup();
        let user = Address::generate(&s.env);
        assert_eq!(
            s.vault.try_deposit_direct(&user, &0, &user),
            Err(Ok(VaultError::ZeroAmount))
        );
        assert_eq!(s.vault.try_withdraw(&user, &0), Err(Ok(VaultError::ZeroAmount)));
    }
}
