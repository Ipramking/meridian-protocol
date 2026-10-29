#!/usr/bin/env node

/**
 * Meridian Protocol — Automated GitHub Issue Seeder
 * 
 * Usage:
 *   node issues/seed-issues.js --repo owner/meridian-protocol --dry-run
 *   node issues/seed-issues.js --repo owner/meridian-protocol
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const repoArgIndex = args.indexOf('--repo');
const targetRepo = repoArgIndex !== -1 ? args[repoArgIndex + 1] : process.env.GITHUB_REPOSITORY;

const issuesPath = path.join(__dirname, 'issues.json');
if (!fs.existsSync(issuesPath)) {
  console.error('Error: issues.json not found! Run generate_issues.js first.');
  process.exit(1);
}

const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));

console.log('========================================================');
console.log('   Meridian Protocol — Drips Wave Issue Seeder');
console.log('========================================================');
console.log(`Total issues to seed : ${issues.length}`);
console.log(`Target Repository    : ${targetRepo || 'Current Repo (gh context)'}`);
console.log(`Mode                 : ${isDryRun ? 'DRY RUN (No issues created)' : 'LIVE EXECUTION'}`);
console.log('--------------------------------------------------------\n');

async function seed() {
  let createdCount = 0;

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const prefix = `[${i + 1}/${issues.length}]`;

    console.log(`${prefix} Seeding: "${issue.title}" [${issue.complexity.toUpperCase()} | ${issue.points} Pts]`);

    if (isDryRun) {
      console.log(`       Labels: ${issue.labels.join(', ')}`);
      continue;
    }

    try {
      const labelsArg = issue.labels.map(l => `--label "${l}"`).join(' ');
      const repoFlag = targetRepo ? `--repo "${targetRepo}"` : '';

      // Create issue using GitHub CLI
      const command = `gh issue create --title "${issue.title.replace(/"/g, '\\"')}" --body "${issue.body.replace(/"/g, '\\"')}" ${labelsArg} ${repoFlag}`;
      
      const out = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      console.log(`       Created: ${out.trim()}`);
      createdCount++;

      // Delay to respect GitHub rate limits
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`       Failed to create issue #${issue.id}: ${err.message}`);
    }
  }

  console.log('\n========================================================');
  console.log(`Seeding complete! Successfully seeded ${createdCount} issues.`);
  console.log('========================================================');
}

seed().catch(console.error);
