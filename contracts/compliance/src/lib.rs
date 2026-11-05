#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
const STATUS_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const STATUS_THRESHOLD: u32 = STATUS_BUMP - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ComplianceError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    NotVerified = 3,
    CountryRestricted = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationStatus {
    pub is_verified: bool,
    pub country_code: u32,
    pub accredited: bool,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Status(Address),
}

/// On-chain eligibility registry. An admin (the KYC provider) records verified
/// accounts; MeridianRouter reads `is_eligible` before routing into KYC-gated vaults.
#[contract]
pub struct MeridianCompliance;

#[contractimpl]
impl MeridianCompliance {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ComplianceError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ComplianceError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn set_verification(
        env: Env,
        account: Address,
        country_code: u32,
        accredited: bool,
        expires_at: u64,
    ) -> Result<(), ComplianceError> {
        Self::admin(&env)?.require_auth();

        let status = VerificationStatus {
            is_verified: true,
            country_code,
            accredited,
            expires_at,
        };
        Self::store(&env, &account, &status);
        env.events()
            .publish((symbol_short!("verify"), account), (country_code, accredited));

        Ok(())
    }

    pub fn revoke(env: Env, account: Address) -> Result<(), ComplianceError> {
        Self::admin(&env)?.require_auth();

        let mut status = Self::get_status(env.clone(), account.clone())
            .ok_or(ComplianceError::NotVerified)?;
        status.is_verified = false;
        Self::store(&env, &account, &status);
        env.events().publish((symbol_short!("revoke"), account), ());

        Ok(())
    }

    pub fn get_status(env: Env, account: Address) -> Option<VerificationStatus> {
        env.storage().persistent().get(&DataKey::Status(account))
    }

    /// Non-failing eligibility check used by MeridianRouter
    pub fn is_eligible(env: Env, account: Address) -> bool {
        match Self::get_status(env.clone(), account) {
            Some(s) => s.is_verified && env.ledger().timestamp() <= s.expires_at,
            None => false,
        }
    }

    pub fn check_eligibility(env: Env, account: Address) -> Result<bool, ComplianceError> {
        if Self::is_eligible(env, account) {
            Ok(true)
        } else {
            Err(ComplianceError::NotVerified)
        }
    }

    fn admin(env: &Env) -> Result<Address, ComplianceError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ComplianceError::Unauthorized)
    }

    fn store(env: &Env, account: &Address, status: &VerificationStatus) {
        let key = DataKey::Status(account.clone());
        env.storage().persistent().set(&key, status);
        env.storage()
            .persistent()
            .extend_ttl(&key, STATUS_THRESHOLD, STATUS_BUMP);
        Self::bump_instance(env);
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };

    #[test]
    fn test_compliance_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(MeridianCompliance, ());
        let client = MeridianComplianceClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);
        assert!(!client.is_eligible(&user));
        assert_eq!(
            client.try_check_eligibility(&user),
            Err(Ok(ComplianceError::NotVerified))
        );

        client.set_verification(&user, &840, &true, &(env.ledger().timestamp() + 10_000));
        assert!(client.is_eligible(&user));
        assert_eq!(client.check_eligibility(&user), true);

        client.revoke(&user);
        assert!(!client.is_eligible(&user));
    }

    #[test]
    fn test_verification_expires() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| li.timestamp = 1_000);

        let contract_id = env.register(MeridianCompliance, ());
        let client = MeridianComplianceClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);
        client.set_verification(&user, &566, &false, &2_000);
        assert!(client.is_eligible(&user));

        env.ledger().with_mut(|li| li.timestamp = 2_001);
        assert!(!client.is_eligible(&user));
    }
}
