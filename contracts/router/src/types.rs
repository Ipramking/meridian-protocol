use soroban_sdk::{contracttype, Address, BytesN, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RouterConfig {
    pub admin: Address,
    pub usdc_token: Address,
    pub cctp_forwarder: Address,
    pub soroswap_router: Address,
    pub max_relayer_fee_bps: u32,
    pub paused: bool,
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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    Nonce(Address),
    ProcessedMessage(BytesN<32>),
}
