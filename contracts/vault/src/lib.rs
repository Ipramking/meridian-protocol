#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
};

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
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultMetadata {
    pub admin: Address,
    pub underlying_asset: Address,
    pub router: Address,
    pub name: String,
    pub symbol: String,
    pub apy_bps: u32,
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
        apy_bps: u32,
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
            apy_bps,
            total_assets: 0,
            total_shares: 0,
            paused: false,
        };

        env.storage().instance().set(&DataKey::Metadata, &meta);
        Ok(())
    }

    pub fn get_metadata(env: Env) -> Result<VaultMetadata, VaultError> {
        env.storage()
            .instance()
            .get(&DataKey::Metadata)
            .ok_or(VaultError::NotInitialized)
    }

    pub fn get_shares(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Shares(account))
            .unwrap_or(0)
    }

    /// Standard Soroban Vault deposit entrypoint invoked by MeridianRouter.
    /// Pulls `amount` from the authorized `router` via transfer_from allowance,
    /// mints proportional shares, and credits `on_behalf_of`.
    pub fn deposit(
        env: Env,
        amount: i128,
        on_behalf_of: Address,
    ) -> Result<i128, VaultError> {
        if amount <= 0 {
            return Err(VaultError::ZeroAmount);
        }

        let mut meta = Self::get_metadata(env.clone())?;
        if meta.paused {
            return Err(VaultError::Paused);
        }

        let asset_client = token::Client::new(&env, &meta.underlying_asset);
        // Pull tokens approved by the router
        asset_client.transfer_from(
            &env.current_contract_address(),
            &meta.router,
            &env.current_contract_address(),
            &amount,
        );

        let shares_to_mint = if meta.total_shares == 0 || meta.total_assets == 0 {
            amount
        } else {
            (amount * meta.total_shares) / meta.total_assets
        };

        meta.total_assets += amount;
        meta.total_shares += shares_to_mint;
        env.storage().instance().set(&DataKey::Metadata, &meta);

        let current_shares = Self::get_shares(env.clone(), on_behalf_of.clone());
        env.storage().persistent().set(
            &DataKey::Shares(on_behalf_of.clone()),
            &(current_shares + shares_to_mint),
        );

        env.events().publish(
            (symbol_short!("v_dep"), on_behalf_of),
            (amount, shares_to_mint),
        );

        Ok(shares_to_mint)
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

        let mut meta = Self::get_metadata(env.clone())?;
        if meta.paused {
            return Err(VaultError::Paused);
        }

        let asset_client = token::Client::new(&env, &meta.underlying_asset);
        asset_client.transfer(&from, &env.current_contract_address(), &amount);

        let shares_to_mint = if meta.total_shares == 0 || meta.total_assets == 0 {
            amount
        } else {
            (amount * meta.total_shares) / meta.total_assets
        };

        meta.total_assets += amount;
        meta.total_shares += shares_to_mint;
        env.storage().instance().set(&DataKey::Metadata, &meta);

        let current_shares = Self::get_shares(env.clone(), on_behalf_of.clone());
        env.storage().persistent().set(
            &DataKey::Shares(on_behalf_of.clone()),
            &(current_shares + shares_to_mint),
        );

        env.events().publish(
            (symbol_short!("v_dep_dir"), on_behalf_of),
            (amount, shares_to_mint),
        );

        Ok(shares_to_mint)
    }

    /// Redeem vault shares back into the underlying USDC/RWA settlement token
    pub fn withdraw(env: Env, owner: Address, shares: i128) -> Result<i128, VaultError> {
        if shares <= 0 {
            return Err(VaultError::ZeroAmount);
        }
        owner.require_auth();

        let mut meta = Self::get_metadata(env.clone())?;
        let user_shares = Self::get_shares(env.clone(), owner.clone());
        if user_shares < shares || meta.total_shares < shares {
            return Err(VaultError::InsufficientShares);
        }

        let assets_out = (shares * meta.total_assets) / meta.total_shares;
        meta.total_shares -= shares;
        meta.total_assets -= assets_out;
        env.storage().instance().set(&DataKey::Metadata, &meta);

        env.storage()
            .persistent()
            .set(&DataKey::Shares(owner.clone()), &(user_shares - shares));

        let asset_client = token::Client::new(&env, &meta.underlying_asset);
        asset_client.transfer(&env.current_contract_address(), &owner, &assets_out);

        env.events()
            .publish((symbol_short!("v_wd"), owner), (shares, assets_out));

        Ok(assets_out)
    }

    /// Admin function to pause or unpause vault operations
    pub fn set_paused(env: Env, paused: bool) -> Result<(), VaultError> {
        let mut meta = Self::get_metadata(env.clone())?;
        meta.admin.require_auth();
        meta.paused = paused;
        env.storage().instance().set(&DataKey::Metadata, &meta);
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Env,
    };

    #[test]
    fn test_vault_deposit_and_withdraw_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin);
        let usdc = sac.address();
        let usdc_client = TokenClient::new(&env, &usdc);
        let usdc_admin = StellarAssetClient::new(&env, &usdc);

        let admin = Address::generate(&env);
        let router = Address::generate(&env);
        let investor = Address::generate(&env);

        let vault_id = env.register(MeridianRwaVault, ());
        let vault = MeridianRwaVaultClient::new(&env, &vault_id);

        vault.initialize(
            &admin,
            &usdc,
            &router,
            &String::from_str(&env, "Spiko Euro T-Bills Vault"),
            &String::from_str(&env, "mTBILL"),
            &365,
        );

        // Router approves vault to spend USDC
        usdc_admin.mint(&router, &1_000_000_000);
        usdc_client.approve(&router, &vault_id, &500_000_000, &100);

        // Deposit via router
        let minted = vault.deposit(&500_000_000, &investor);
        assert_eq!(minted, 500_000_000);
        assert_eq!(vault.get_shares(&investor), 500_000_000);
        assert_eq!(vault.get_metadata().total_assets, 500_000_000);

        // Redeem shares
        let redeemed = vault.withdraw(&investor, &200_000_000);
        assert_eq!(redeemed, 200_000_000);
        assert_eq!(vault.get_shares(&investor), 300_000_000);
        assert_eq!(usdc_client.balance(&investor), 200_000_000);
    }

    #[test]
    fn test_vault_direct_deposit_and_pause() {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin);
        let usdc = sac.address();
        let _usdc_client = TokenClient::new(&env, &usdc);
        let usdc_admin = StellarAssetClient::new(&env, &usdc);

        let admin = Address::generate(&env);
        let router = Address::generate(&env);
        let direct_user = Address::generate(&env);

        let vault_id = env.register(MeridianRwaVault, ());
        let vault = MeridianRwaVaultClient::new(&env, &vault_id);

        vault.initialize(
            &admin,
            &usdc,
            &router,
            &String::from_str(&env, "Blend USDC Prime Pool"),
            &String::from_str(&env, "bUSDC"),
            &840,
        );

        usdc_admin.mint(&direct_user, &300_000_000);
        let minted = vault.deposit_direct(&direct_user, &300_000_000, &direct_user);
        assert_eq!(minted, 300_000_000);
        assert_eq!(vault.get_shares(&direct_user), 300_000_000);

        vault.set_paused(&true);
        assert!(vault.get_metadata().paused);

        let err = vault.try_deposit_direct(&direct_user, &100_000_000, &direct_user);
        assert_eq!(err, Err(Ok(VaultError::Paused)));
    }
}
