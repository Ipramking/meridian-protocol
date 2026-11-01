#![no_std]

pub mod storage;

#[cfg(test)]
mod test;

use storage::{DataKey, PaymasterConfig};
use soroban_sdk::{
    contract, contracterror, contractimpl, symbol_short, token, Address, Env, IntoVal, Symbol, Val, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PaymasterError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Inactive = 4,
    InsufficientBalance = 5,
    InvalidAmount = 6,
}

#[contract]
pub struct MeridianPaymaster;

#[contractimpl]
impl MeridianPaymaster {
    /// Initialize the Paymaster contract
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        native_token: Address,
        soroswap_router: Address,
        fee_markup_bps: u32,
    ) -> Result<(), PaymasterError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(PaymasterError::AlreadyInitialized);
        }

        admin.require_auth();

        let config = PaymasterConfig {
            admin,
            usdc_token,
            native_token,
            soroswap_router,
            fee_markup_bps,
            active: true,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::AccumulatedFees, &0i128);

        Ok(())
    }

    /// Return current Paymaster configuration
    pub fn get_config(env: Env) -> Result<PaymasterConfig, PaymasterError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(PaymasterError::NotInitialized)
    }

    /// Return total accumulated USDC fees awaiting rebalance
    pub fn get_accumulated_fees(env: Env) -> Result<i128, PaymasterError> {
        if !env.storage().instance().has(&DataKey::Config) {
            return Err(PaymasterError::NotInitialized);
        }
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::AccumulatedFees)
            .unwrap_or(0))
    }

    /// Return cumulative sponsored USDC fee volume for a specific user
    pub fn get_sponsored_volume(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::SponsoredVolume(user))
            .unwrap_or(0)
    }

    /// Enable or disable sponsorship operations (admin only)
    pub fn set_active(env: Env, active: bool) -> Result<(), PaymasterError> {
        let mut config: PaymasterConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(PaymasterError::NotInitialized)?;

        config.admin.require_auth();
        config.active = active;
        env.storage().instance().set(&DataKey::Config, &config);

        Ok(())
    }

    /// Reimburse gas cost from user's USDC balance and sponsor native fee
    pub fn record_sponsorship(
        env: Env,
        caller: Address,
        user: Address,
        usdc_fee_amount: i128,
    ) -> Result<i128, PaymasterError> {
        caller.require_auth();

        if usdc_fee_amount <= 0 {
            return Err(PaymasterError::InvalidAmount);
        }

        let config: PaymasterConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(PaymasterError::NotInitialized)?;

        if !config.active {
            return Err(PaymasterError::Inactive);
        }

        // Apply markup in basis points
        let markup = (usdc_fee_amount * (config.fee_markup_bps as i128)) / 10_000;
        let total_charge = usdc_fee_amount + markup;

        // Pull USDC fee from user
        user.require_auth();
        let usdc_client = token::Client::new(&env, &config.usdc_token);
        usdc_client.transfer(&user, &env.current_contract_address(), &total_charge);

        // Update accumulated fees
        let current_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AccumulatedFees)
            .unwrap_or(0);
        let updated_fees = current_fees + total_charge;
        env.storage()
            .instance()
            .set(&DataKey::AccumulatedFees, &updated_fees);

        // Track user's cumulative sponsored volume
        let user_vol: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::SponsoredVolume(user.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::SponsoredVolume(user.clone()), &(user_vol + total_charge));

        env.events().publish(
            (symbol_short!("sponsor"), user),
            (total_charge, updated_fees),
        );

        Ok(total_charge)
    }

    /// Auto-rebalance: Swaps accumulated USDC fees back into native XLM via Soroswap
    pub fn rebalance_native(
        env: Env,
        amount_to_swap: i128,
        min_xlm_out: i128,
        deadline: u64,
    ) -> Result<i128, PaymasterError> {
        if amount_to_swap <= 0 {
            return Err(PaymasterError::InvalidAmount);
        }

        let config: PaymasterConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(PaymasterError::NotInitialized)?;

        config.admin.require_auth();

        let accumulated: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AccumulatedFees)
            .unwrap_or(0);
        if accumulated < amount_to_swap {
            return Err(PaymasterError::InsufficientBalance);
        }

        // Prepare path: [USDC, XLM]
        let mut path: Vec<Address> = Vec::new(&env);
        path.push_back(config.usdc_token.clone());
        path.push_back(config.native_token.clone());

        // Approve Soroswap Router to spend USDC
        let usdc_client = token::Client::new(&env, &config.usdc_token);
        usdc_client.approve(
            &env.current_contract_address(),
            &config.soroswap_router,
            &amount_to_swap,
            &(env.ledger().sequence() + 100),
        );

        let swap_args: Vec<Val> = (
            amount_to_swap,
            min_xlm_out,
            path,
            env.current_contract_address(),
            deadline,
        )
            .into_val(&env);

        let swap_result: Vec<i128> = env.invoke_contract(
            &config.soroswap_router,
            &Symbol::new(&env, "swap_exact_tokens_for_tokens"),
            swap_args,
        );

        let xlm_received = swap_result.get(swap_result.len() - 1).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::AccumulatedFees, &(accumulated - amount_to_swap));

        env.events().publish(
            (symbol_short!("rebal"),),
            (amount_to_swap, xlm_received),
        );

        Ok(xlm_received)
    }
}
