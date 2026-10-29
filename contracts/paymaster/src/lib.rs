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

    /// Reimburse gas cost from user's USDC balance and sponsor native fee
    pub fn record_sponsorship(
        env: Env,
        caller: Address,
        user: Address,
        usdc_fee_amount: i128,
    ) -> Result<(), PaymasterError> {
        caller.require_auth();

        let config: PaymasterConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(PaymasterError::NotInitialized)?;

        if !config.active {
            return Err(PaymasterError::Inactive);
        }

        // Pull USDC fee from user or router
        let usdc_client = token::Client::new(&env, &config.usdc_token);
        usdc_client.transfer(&user, &env.current_contract_address(), &usdc_fee_amount);

        // Update accumulated fees
        let current_fees: i128 = env.storage().instance().get(&DataKey::AccumulatedFees).unwrap_or(0);
        env.storage().instance().set(&DataKey::AccumulatedFees, &(current_fees + usdc_fee_amount));

        env.events().publish(
            (symbol_short!("sponsor"), user),
            (usdc_fee_amount,),
        );

        Ok(())
    }

    /// Auto-rebalance: Swaps accumulated USDC fees back into native XLM via Soroswap
    pub fn rebalance_native(
        env: Env,
        amount_to_swap: i128,
        min_xlm_out: i128,
        deadline: u64,
    ) -> Result<i128, PaymasterError> {
        let config: PaymasterConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(PaymasterError::NotInitialized)?;

        config.admin.require_auth();

        let accumulated: i128 = env.storage().instance().get(&DataKey::AccumulatedFees).unwrap_or(0);
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
        ).into_val(&env);

        let swap_result: Vec<i128> = env.invoke_contract(
            &config.soroswap_router,
            &Symbol::new(&env, "swap_exact_tokens_for_tokens"),
            swap_args,
        );

        let xlm_received = swap_result.get(swap_result.len() - 1).unwrap();
        env.storage().instance().set(&DataKey::AccumulatedFees, &(accumulated - amount_to_swap));

        env.events().publish(
            (symbol_short!("rebal"),),
            (amount_to_swap, xlm_received),
        );

        Ok(xlm_received)
    }
}
