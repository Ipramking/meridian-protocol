use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RouterError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ExpiredDeadline = 4,
    SlippageExceeded = 5,
    InvalidPath = 6,
    ZeroAmount = 7,
    CctpMintFailed = 8,
    VaultDepositFailed = 9,
    RelayerFeeExceeded = 10,
    InvalidRecipient = 11,
}
