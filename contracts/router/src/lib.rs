#![no_std]

pub mod errors;
pub mod types;

#[cfg(test)]
mod test;

use errors::RouterError;
use types::{CrossChainIntent, DataKey, Fill, RouterConfig, VaultPolicy};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractimpl, symbol_short, token, vec, xdr::ToXdr, Address, Bytes, BytesN, Env,
    IntoVal, Symbol, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
const RECORD_BUMP: u32 = 90 * DAY_IN_LEDGERS;
const RECORD_THRESHOLD: u32 = RECORD_BUMP - DAY_IN_LEDGERS;

/// Intents may not be valid for longer than this, so a fill record always outlives
/// the window in which the same intent could be replayed.
const MAX_DEADLINE_WINDOW_SECS: u64 = 7 * 24 * 60 * 60;
/// Hard ceiling on the relayer fee the admin can configure (10%).
const MAX_FEE_BPS_CEILING: u32 = 1_000;

#[contract]
pub struct MeridianRouter;

#[contractimpl]
impl MeridianRouter {
    /// Initialize the Meridian Router configuration
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        soroswap_router: Address,
        compliance: Address,
        max_relayer_fee_bps: u32,
    ) -> Result<(), RouterError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(RouterError::AlreadyInitialized);
        }
        if max_relayer_fee_bps > MAX_FEE_BPS_CEILING {
            return Err(RouterError::InvalidFeeConfig);
        }

        admin.require_auth();

        let config = RouterConfig {
            admin,
            usdc_token,
            soroswap_router,
            compliance,
            max_relayer_fee_bps,
            paused: false,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);

        env.events().publish(
            (symbol_short!("init"),),
            (config.admin, config.usdc_token),
        );

        Ok(())
    }

    /// Retrieve the current router configuration
    pub fn get_config(env: Env) -> Result<RouterConfig, RouterError> {
        Self::load_config(&env)
    }

    /// Admin: allow (or disable) a destination vault and set whether it requires KYC
    pub fn set_vault(
        env: Env,
        vault: Address,
        enabled: bool,
        requires_kyc: bool,
    ) -> Result<(), RouterError> {
        let config = Self::load_config(&env)?;
        config.admin.require_auth();

        let key = DataKey::Vault(vault.clone());
        env.storage()
            .persistent()
            .set(&key, &VaultPolicy { enabled, requires_kyc });
        env.storage()
            .persistent()
            .extend_ttl(&key, RECORD_THRESHOLD, RECORD_BUMP);
        Self::bump_instance(&env);

        env.events()
            .publish((symbol_short!("vault"), vault), (enabled, requires_kyc));
        Ok(())
    }

    /// Routing policy for a vault, if it has been allowlisted
    pub fn get_vault(env: Env, vault: Address) -> Option<VaultPolicy> {
        env.storage().persistent().get(&DataKey::Vault(vault))
    }

    /// Deterministic order id: sha256(message_hash || xdr(intent)).
    /// Binding the id to the full intent means one CCTP message can't be reused
    /// to block or alter a different intent.
    pub fn order_id(env: Env, intent: CrossChainIntent, message_hash: BytesN<32>) -> BytesN<32> {
        let mut data = Bytes::new(&env);
        data.append(&message_hash.into());
        data.append(&intent.to_xdr(&env));
        env.crypto().sha256(&data).into()
    }

    /// Fill record for an order id, if it has been filled
    pub fn get_fill(env: Env, order_id: BytesN<32>) -> Option<Fill> {
        env.storage().persistent().get(&DataKey::Fill(order_id))
    }

    /// Fast-fill a cross-chain intent on Stellar.
    ///
    /// The relayer fronts the net amount from its OWN USDC balance (it is repaid
    /// off-chain by the CCTP mint on settlement), so the router never spends
    /// funds it holds. The router then:
    /// 1. enforces deadline, fee bounds and replay protection
    /// 2. optionally swaps through Soroswap
    /// 3. delivers to the recipient or deposits into an allowlisted vault
    pub fn execute_intent(
        env: Env,
        intent: CrossChainIntent,
        message_hash: BytesN<32>,
        relayer: Address,
    ) -> Result<i128, RouterError> {
        relayer.require_auth();

        let config = Self::load_config(&env)?;
        if config.paused {
            return Err(RouterError::Paused);
        }
        Self::check_deadline(&env, intent.deadline)?;

        if intent.amount_in <= 0 {
            return Err(RouterError::ZeroAmount);
        }
        let max_allowed_fee = (intent.amount_in * (config.max_relayer_fee_bps as i128)) / 10_000;
        if intent.relayer_fee < 0 || intent.relayer_fee > max_allowed_fee {
            return Err(RouterError::RelayerFeeExceeded);
        }

        let id = Self::order_id(env.clone(), intent.clone(), message_hash.clone());
        let fill_key = DataKey::Fill(id.clone());
        if env.storage().persistent().has(&fill_key) {
            return Err(RouterError::AlreadyFilled);
        }

        let net_amount = intent.amount_in - intent.relayer_fee;
        token::Client::new(&env, &config.usdc_token).transfer(
            &relayer,
            &env.current_contract_address(),
            &net_amount,
        );

        let amount_out = Self::deliver(
            &env,
            &config,
            net_amount,
            &intent.swap_path,
            intent.min_amount_out,
            intent.vault_target.clone(),
            &intent.recipient,
            intent.deadline,
        )?;

        env.storage().persistent().set(
            &fill_key,
            &Fill {
                relayer: relayer.clone(),
                amount_out,
                ledger: env.ledger().sequence(),
            },
        );
        env.storage()
            .persistent()
            .extend_ttl(&fill_key, RECORD_THRESHOLD, RECORD_BUMP);
        Self::bump_instance(&env);

        env.events().publish(
            (symbol_short!("fill"), intent.recipient),
            (id, message_hash, intent.origin_domain, intent.amount_in, amount_out, relayer),
        );

        Ok(amount_out)
    }

    /// Stellar-native entry: route the caller's own USDC into an allowlisted vault.
    /// Returns the vault shares minted to `from`.
    pub fn deposit(
        env: Env,
        from: Address,
        amount: i128,
        vault: Address,
    ) -> Result<i128, RouterError> {
        from.require_auth();

        let config = Self::load_config(&env)?;
        if config.paused {
            return Err(RouterError::Paused);
        }
        if amount <= 0 {
            return Err(RouterError::ZeroAmount);
        }

        token::Client::new(&env, &config.usdc_token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        let shares =
            Self::route_to_vault(&env, &config, &config.usdc_token, &vault, amount, &from)?;
        Self::bump_instance(&env);

        env.events()
            .publish((symbol_short!("deposit"), from), (vault, amount, shares));

        Ok(shares)
    }

    /// Admin function to pause or unpause the router
    pub fn set_paused(env: Env, paused: bool) -> Result<(), RouterError> {
        let mut config = Self::load_config(&env)?;
        config.admin.require_auth();
        config.paused = paused;
        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);
        Ok(())
    }

    fn load_config(env: &Env) -> Result<RouterConfig, RouterError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(RouterError::NotInitialized)
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }

    fn check_deadline(env: &Env, deadline: u64) -> Result<(), RouterError> {
        let now = env.ledger().timestamp();
        if deadline < now {
            return Err(RouterError::ExpiredDeadline);
        }
        if deadline > now + MAX_DEADLINE_WINDOW_SECS {
            return Err(RouterError::DeadlineTooFar);
        }
        Ok(())
    }

    /// Swap (if the path has more than one hop) and hand the output to the
    /// recipient or the target vault. Returns the amount delivered.
    #[allow(clippy::too_many_arguments)]
    fn deliver(
        env: &Env,
        config: &RouterConfig,
        amount: i128,
        path: &Vec<Address>,
        min_amount_out: i128,
        vault_target: Option<Address>,
        recipient: &Address,
        deadline: u64,
    ) -> Result<i128, RouterError> {
        if path.len() > 0 && path.get(0).unwrap() != config.usdc_token {
            return Err(RouterError::InvalidPath);
        }

        let (out_token, amount_out) = if path.len() > 1 {
            let out = Self::swap(env, config, amount, path, min_amount_out, deadline)?;
            (path.get(path.len() - 1).unwrap(), out)
        } else {
            (config.usdc_token.clone(), amount)
        };

        if amount_out < min_amount_out {
            return Err(RouterError::SlippageExceeded);
        }

        match vault_target {
            Some(vault) => {
                Self::route_to_vault(env, config, &out_token, &vault, amount_out, recipient)?;
            }
            None => {
                token::Client::new(env, &out_token).transfer(
                    &env.current_contract_address(),
                    recipient,
                    &amount_out,
                );
            }
        }

        Ok(amount_out)
    }

    /// Swap through Soroswap. Soroswap pulls the input token from `to` (this
    /// contract) into the first pair, so that nested transfer has to be
    /// pre-authorized for the current contract.
    fn swap(
        env: &Env,
        config: &RouterConfig,
        amount: i128,
        path: &Vec<Address>,
        min_amount_out: i128,
        deadline: u64,
    ) -> Result<i128, RouterError> {
        let token_in = path.get(0).unwrap();
        let first_pair: Address = env.invoke_contract(
            &config.soroswap_router,
            &Symbol::new(env, "router_pair_for"),
            vec![env, token_in.to_val(), path.get(1).unwrap().to_val()],
        );

        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: token_in,
                    fn_name: Symbol::new(env, "transfer"),
                    args: (env.current_contract_address(), first_pair, amount).into_val(env),
                },
                sub_invocations: Vec::new(env),
            }),
        ]);

        let amounts: Vec<i128> = env.invoke_contract(
            &config.soroswap_router,
            &Symbol::new(env, "swap_exact_tokens_for_tokens"),
            (
                amount,
                min_amount_out,
                path.clone(),
                env.current_contract_address(),
                deadline,
            )
                .into_val(env),
        );

        Ok(amounts.get(amounts.len() - 1).unwrap())
    }

    /// Deposit into an allowlisted vault on behalf of `on_behalf_of`, checking
    /// compliance first when the vault requires it. Returns shares minted.
    fn route_to_vault(
        env: &Env,
        config: &RouterConfig,
        asset: &Address,
        vault: &Address,
        amount: i128,
        on_behalf_of: &Address,
    ) -> Result<i128, RouterError> {
        let policy: VaultPolicy = env
            .storage()
            .persistent()
            .get(&DataKey::Vault(vault.clone()))
            .ok_or(RouterError::VaultNotAllowed)?;
        if !policy.enabled {
            return Err(RouterError::VaultNotAllowed);
        }

        if policy.requires_kyc {
            let eligible: bool = env.invoke_contract(
                &config.compliance,
                &Symbol::new(env, "is_eligible"),
                vec![env, on_behalf_of.to_val()],
            );
            if !eligible {
                return Err(RouterError::NotEligible);
            }
        }

        token::Client::new(env, asset).approve(
            &env.current_contract_address(),
            vault,
            &amount,
            &(env.ledger().sequence() + 1),
        );

        let shares: i128 = env.invoke_contract(
            vault,
            &Symbol::new(env, "deposit"),
            (amount, on_behalf_of.clone()).into_val(env),
        );

        Ok(shares)
    }
}
