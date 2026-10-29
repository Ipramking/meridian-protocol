const { execSync } = require('child_process');

const repo = 'Ipramking/meridian-protocol';

const labels = [
  { name: 'Stellar Wave', color: '0e8a16', description: 'Designated for Stellar Wave Program' },
  { name: 'complexity:trivial', color: 'c5def5', description: 'Trivial task - 100 Points' },
  { name: 'complexity:medium', color: 'fbca04', description: 'Medium task - 150 Points' },
  { name: 'complexity:high', color: 'd93f0b', description: 'High task - 200 Points' },
  { name: 'contracts', color: '5319e7', description: 'Soroban smart contracts & Rust logic' },
  { name: 'paymaster', color: '1d76db', description: 'Gas sponsorship & Paymaster infra' },
  { name: 'compliance', color: 'b60205', description: 'Institutional KYC & SEP-8 gate' },
  { name: 'bridges', color: '006b75', description: 'Circle CCTP, Allbridge, and oracles' },
  { name: 'sdk', color: 'bfdadc', description: 'TypeScript client library & tooling' },
  { name: 'frontend', color: 'f9d0c4', description: 'Next.js web client & Web3 integrations' },
  { name: 'sep-fiat', color: '0052cc', description: 'Stellar SEP-24, SEP-6, and fiat anchors' },
  { name: 'devops-security', color: 'e99695', description: 'CI/CD, testing, and security audits' }
];

console.log(`Setting up ${labels.length} labels in ${repo}...`);

for (const label of labels) {
  try {
    const cmd = `gh label create "${label.name}" --repo "${repo}" --color "${label.color}" --description "${label.description}" --force`;
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Failed to create label ${label.name}: ${err.message}`);
  }
}

console.log('All labels ready.');
