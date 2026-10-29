#![no_std]

pub mod errors;
pub mod types;

#[cfg(test)]
mod test;

use errors::RouterError;
use types::{CrossChainIntent, DataKey, RouterConfig};
use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

#[contract]
pub struct MeridianRouter;

#[contractimpl]
impl MeridianRouter {
    /// Initialize the Meridian Router configuration
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        cctp_forwarder: Address,
        soroswap_router: Address,
        max_relayer_fee_bps: u32,
    ) -> Result<(), RouterError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(RouterError::AlreadyInitialized);
        }

        admin.require_auth();

        let config = RouterConfig {
            admin,
            usdc_token,
            cctp_forwarder,
            soroswap_router,
            max_relayer_fee_bps,
            paused: false,
        };

        env.storage().instance().set(&DataKey::Config, &config);

        env.events().publish(
            (symbol_short!("init"),),
            (config.admin, config.usdc_token),
        );

        Ok(())
    }

    /// Retrieve the current router configuration
    pub fn get_config(env: Env) -> Result<RouterConfig, RouterError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(RouterError::NotInitialized)
    }

    /// Execute a verified cross-chain intent
    /// This function handles:
    /// 1. Replay protection using the message hash
    /// 2. Relayer fee deduction and payout
    /// 3. Atomic swap execution via Soroswap
    /// 4. Optional target yield/RWA vault deposit
    pub fn execute_intent(
        env: Env,
        intent: CrossChainIntent,
        message_hash: BytesN<32>,
        relayer: Address,
    ) -> Result<i128, RouterError> {
        relayer.require_auth();

        let config = Self::get_config(env.clone())?;
        if config.paused {
            return Err(RouterError::Unauthorized);
        }

        // 1. Deadline verification
        let current_time = env.ledger().timestamp();
        if intent.deadline < current_time {
            return Err(RouterError::ExpiredDeadline);
        }

        // 2. Replay protection
        if env.storage().temporary().has(&DataKey::ProcessedMessage(message_hash.clone())) {
            return Err(RouterError::AlreadyInitialized);
        }
        env.storage().temporary().set(&DataKey::ProcessedMessage(message_hash.clone()), &true);

        if intent.amount_in <= 0 {
            return Err(RouterError::ZeroAmount);
        }

        // 3. Relayer fee bounds check (basis points check)
        let max_allowed_fee = (intent.amount_in * (config.max_relayer_fee_bps as i128)) / 10_000;
        if intent.relayer_fee > max_allowed_fee {
            return Err(RouterError::RelayerFeeExceeded);
        }

        // Transfer relayer fee from contract balance (funded via inbound CCTP mint)
        let net_swap_amount = intent.amount_in - intent.relayer_fee;
        if intent.relayer_fee > 0 {
            let usdc_client = token::Client::new(&env, &config.usdc_token);
            usdc_client.transfer(
                &env.current_contract_address(),
                &relayer,
                &intent.relayer_fee,
            );
        }

        // 4. Execute atomic swap if path has more than 1 token
        let final_amount = if intent.swap_path.len() > 1 {
            let first_token = intent.swap_path.get(0).unwrap();
            let last_token = intent.swap_path.get(intent.swap_path.len() - 1).unwrap();

            if first_token != config.usdc_token {
                return Err(RouterError::InvalidPath);
            }

            // Perform Soroswap swap invocation
            let swap_args: Vec<Val> = (
                net_swap_amount,
                intent.min_amount_out,
                intent.swap_path.clone(),
                env.current_contract_address(),
                intent.deadline,
            )
                .into_val(&env);

            let swap_result: Vec<i128> = env.invoke_contract(
                &config.soroswap_router,
                &Symbol::new(&env, "swap_exact_tokens_for_tokens"),
                swap_args,
            );

            let output_amount = swap_result.get(swap_result.len() - 1).unwrap();
            if output_amount < intent.min_amount_out {
                return Err(RouterError::SlippageExceeded);
            }

            // 5. If a vault target is specified, deposit into vault; otherwise transfer to recipient
            if let Some(vault_address) = intent.vault_target {
                Self::route_to_vault(&env, &last_token, &vault_address, output_amount, &intent.recipient)?;
            } else {
                let out_token_client = token::Client::new(&env, &last_token);
                out_token_client.transfer(
                    &env.current_contract_address(),
                    &intent.recipient,
                    &output_amount,
                );
            }

            output_amount
        } else {
            // Direct transfer without swap (pure cross-chain USDC transfer or direct vault deposit)
            if let Some(vault_address) = intent.vault_target {
                Self::route_to_vault(&env, &config.usdc_token, &vault_address, net_swap_amount, &intent.recipient)?;
            } else {
                let usdc_client = token::Client::new(&env, &config.usdc_token);
                usdc_client.transfer(
                    &env.current_contract_address(),
                    &intent.recipient,
                    &net_swap_amount,
                );
            }

            net_swap_amount
        };

        // Emit Intent Executed event
        env.events().publish(
            (symbol_short!("intent"), intent.recipient),
            (message_hash, intent.amount_in, final_amount),
        );

        Ok(final_amount)
    }

    /// Internal helper to deposit into a target yield/RWA vault (e.g. Blend, Spiko, or yield aggregator)
    fn route_to_vault(
        env: &Env,
        asset: &Address,
        vault: &Address,
        amount: i128,
        on_behalf_of: &Address,
    ) -> Result<(), RouterError> {
        let asset_client = token::Client::new(env, asset);
        asset_client.approve(
            &env.current_contract_address(),
            vault,
            &amount,
            &(env.ledger().sequence() + 100),
        );

        let deposit_args: Vec<Val> = (amount, on_behalf_of.clone()).into_val(env);
        let _: Val = env.invoke_contract(vault, &Symbol::new(env, "deposit"), deposit_args);

        Ok(())
    }

    /// Admin function to pause or unpause the router
    pub fn set_paused(env: Env, paused: bool) -> Result<(), RouterError> {
        let mut config = Self::get_config(env.clone())?;
        config.admin.require_auth();
        config.paused = paused;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }
}
