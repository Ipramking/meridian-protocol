use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymasterConfig {
    pub admin: Address,
    pub usdc_token: Address,
    pub native_token: Address,
    pub soroswap_router: Address,
    pub fee_markup_bps: u32,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    SponsoredVolume(Address),
    AccumulatedFees,
}
