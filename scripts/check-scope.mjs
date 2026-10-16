#!/usr/bin/env node
/** Advisory path scope gate; combine with branch protection + human review. */
import { execFileSync } from 'node:child_process';

const [role, base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
const allowed = {
  attacker: [/^experiments\/attacker\//, /^tests\/attack\//],
  defender: [/^apps\/server\/src\/security\/policies\//, /^experiments\/defender\//, /^tests\/defense\//],
};
if (!Object.hasOwn(allowed, role)) {
  console.error('Usage: node scripts/check-scope.mjs <attacker|defender> [base] [head]');
  process.exit(2);
}
try {
  const files = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const violations = files.filter(file => !allowed[role].some(pattern => pattern.test(file)));
  if (violations.length) {
    console.error(`Files outside ${role} ownership:\n${violations.join('\n')}`);
    process.exit(1);
  }
  console.log(`${role}: ${files.length} changed file(s), scope OK`);
} catch (error) {
  console.error('Could not check git diff:', error.message);
  process.exit(2);
}
