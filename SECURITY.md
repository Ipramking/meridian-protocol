# Security Policy

## Supported Versions

Security updates are actively applied to components on the primary release branch.

| Component | Path | Supported |
|---|---|---|
| Soroban Smart Contracts | `contracts/*` | :white_check_mark: |
| TypeScript Client SDK | `packages/sdk` | :white_check_mark: |
| Circle CCTP Relayer Service | `services/relayer` | :white_check_mark: |
| Web Application | `apps/web` | :white_check_mark: |

---

## Reporting a Vulnerability

We value the contributions of security researchers and developers in ensuring the safety of Meridian Protocol. If you discover a security vulnerability or weakness within any smart contract, service, or interface, please disclose it responsibly.

### How to Report

1. **GitHub Security Advisory (Recommended):** Submit a confidential vulnerability report via [GitHub Private Vulnerability Reporting](https://github.com/Ipramking/meridian-protocol/security/advisories/new).
2. **Direct Contact:** If GitHub Security Advisories are unavailable, send an encrypted or direct email to `inioluwasamuel.13pram@gmail.com` with the subject line:
   `[SECURITY] Vulnerability Report: <Component / Target>`

### What to Include

Please provide as much relevant technical context as possible to help us triage and resolve the issue quickly:
- Description of the vulnerability and its potential impact.
- Affected smart contract, method, service, or endpoint.
- Clear step-by-step reproduction instructions or a minimal proof of concept (PoC).
- Any suggestions for mitigation or remediation.

---

## Response Expectations & SLAs

When a vulnerability report is submitted, our team will:
- **Acknowledge receipt:** Within 24-48 hours.
- **Initial assessment & triage:** Within 3-5 business days.
- **Status updates:** Regularly throughout the validation and remediation process.
- **Coordinated disclosure:** We coordinate with reporters prior to publishing advisories or post-mortems once fixes are deployed.

---

## Severity Classification

We follow industry standards to categorize vulnerabilities:

| Severity | Description | Examples |
|---|---|---|
| **Critical** | Direct theft of user funds, permanent freezing of locked capital, or complete protocol takeover. | Drain of Paymaster XLM reserve, bypass of Router invariant checks, unauthorized vault minting. |
| **High** | Temporary freeze of funds, unauthorized state alteration, or high-value economic manipulation. | Manipulation of DEX aggregator routing slippage, replay of CCTP attestations. |
| **Medium** | Griefing attacks, bounded denial-of-service, or non-critical state inconsistency. | Spamming relayer queues causing temporary processing latency. |
| **Low / Informational** | Minor deviations from specification, non-exploitable edge cases, or documentation inaccuracies. | Missing error codes, non-standard event emissions. |

---

## Safe Harbor Policy

Meridian Protocol considers security research conducted under this policy to be authorized, constructive, and ethical. We will not pursue legal action or report researchers to law enforcement provided that you:
- Make a good-faith effort to avoid privacy violations, destruction of data, and interruption or degradation of services.
- Do not exploit a vulnerability beyond the minimum necessary to demonstrate proof-of-concept.
- Keep details of vulnerabilities confidential until an official patch has been deployed and public disclosure is agreed upon.
