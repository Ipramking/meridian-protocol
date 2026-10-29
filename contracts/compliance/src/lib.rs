#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
};

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
        Ok(())
    }

    pub fn set_verification(
        env: Env,
        account: Address,
        country_code: u32,
        accredited: bool,
        expires_at: u64,
    ) -> Result<(), ComplianceError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(ComplianceError::Unauthorized)?;
        admin.require_auth();

        let status = VerificationStatus {
            is_verified: true,
            country_code,
            accredited,
            expires_at,
        };

        env.storage().persistent().set(&DataKey::Status(account.clone()), &status);
        env.events().publish((symbol_short!("verify"), account), (country_code, accredited));

        Ok(())
    }

    pub fn check_eligibility(env: Env, account: Address) -> Result<bool, ComplianceError> {
        let status: Option<VerificationStatus> = env.storage().persistent().get(&DataKey::Status(account));
        match status {
            Some(s) => {
                if !s.is_verified || env.ledger().timestamp() > s.expires_at {
                    Err(ComplianceError::NotVerified)
                } else {
                    Ok(true)
                }
            }
            None => Err(ComplianceError::NotVerified),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_compliance_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(MeridianCompliance, ());
        let client = MeridianComplianceClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);
        client.set_verification(&user, &840, &true, &(env.ledger().timestamp() + 10000));

        let is_eligible = client.check_eligibility(&user);
        assert_eq!(is_eligible, true);
    }
}
