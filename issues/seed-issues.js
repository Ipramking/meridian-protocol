#!/usr/bin/env node

/**
 * Meridian Protocol — Automated GitHub Issue Seeder
 * 
 * Usage:
 *   node issues/seed-issues.js --repo Ipramking/meridian-protocol --dry-run
 *   node issues/seed-issues.js --repo Ipramking/meridian-protocol
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const repoArgIndex = args.indexOf('--repo');
const targetRepo = repoArgIndex !== -1 ? args[repoArgIndex + 1] : 'Ipramking/meridian-protocol';

const startIndexArg = args.indexOf('--start');
const startIndex = startIndexArg !== -1 ? parseInt(args[startIndexArg + 1], 10) : 0;

const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;

const issuesPath = path.join(__dirname, 'issues.json');
if (!fs.existsSync(issuesPath)) {
  console.error('Error: issues.json not found! Run generate_issues.js first.');
  process.exit(1);
}

const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
const tempBodyFile = path.join(__dirname, '.temp_issue_body.md');

console.log('========================================================');
console.log('   Meridian Protocol — Drips Wave Issue Seeder');
console.log('========================================================');
console.log(`Total issues loaded : ${issues.length}`);
console.log(`Target Repository   : ${targetRepo}`);
console.log(`Start Index         : ${startIndex}`);
console.log(`Limit               : ${limit === Infinity ? 'All' : limit}`);
console.log(`Mode                : ${isDryRun ? 'DRY RUN (No issues created)' : 'LIVE EXECUTION'}`);
console.log('--------------------------------------------------------\n');

async function seed() {
  let createdCount = 0;
  const endIndex = Math.min(issues.length, startIndex + limit);

  for (let i = startIndex; i < endIndex; i++) {
    const issue = issues[i];
    const prefix = `[${i + 1}/${issues.length}]`;

    console.log(`${prefix} Seeding: "${issue.title}" [${issue.complexity.toUpperCase()} | ${issue.points} Pts]`);

    if (isDryRun) {
      console.log(`       Labels: ${issue.labels.join(', ')}`);
      continue;
    }

    try {
      // Write body to file for clean shell handling
      fs.writeFileSync(tempBodyFile, issue.body, 'utf-8');

      const labelsArg = issue.labels.map(l => `--label "${l}"`).join(' ');
      const cleanTitle = issue.title.replace(/"/g, '\\"');

      const command = `gh issue create --repo "${targetRepo}" --title "${cleanTitle}" --body-file "${tempBodyFile}" ${labelsArg}`;
      const out = execSync(command, { encoding: 'utf-8' });
      console.log(`       Created: ${out.trim()}`);
      createdCount++;

      // 1.2s delay to prevent secondary rate-limiting
      await new Promise(r => setTimeout(r, 1200));
    } catch (err) {
      console.error(`       Failed to create issue #${issue.id}: ${err.message}`);
    }
  }

  if (fs.existsSync(tempBodyFile)) {
    fs.unlinkSync(tempBodyFile);
  }

  console.log('\n========================================================');
  console.log(`Seeding complete! Successfully processed ${createdCount} issues.`);
  console.log('========================================================');
}

seed().catch(console.error);
