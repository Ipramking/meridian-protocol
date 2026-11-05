use soroban_sdk::{contracttype, Address, BytesN, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RouterConfig {
    pub admin: Address,
    pub usdc_token: Address,
    pub soroswap_router: Address,
    pub compliance: Address,
    pub max_relayer_fee_bps: u32,
    pub paused: bool,
}

/// Routing policy for a destination vault. Only allowlisted vaults can receive capital.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultPolicy {
    pub enabled: bool,
    pub requires_kyc: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossChainIntent {
    pub origin_domain: u32,
    pub sender: BytesN<32>,
    pub recipient: Address,
    pub amount_in: i128,
    pub min_amount_out: i128,
    pub deadline: u64,
    pub swap_path: Vec<Address>,
    pub vault_target: Option<Address>,
    pub relayer_fee: i128,
}

/// Record of a filled intent, keyed by its order id.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Fill {
    pub relayer: Address,
    pub amount_out: i128,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    Vault(Address),
    Fill(BytesN<32>),
}
