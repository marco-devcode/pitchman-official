import { execSync } from 'child_process';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const lines = envContent.split('\n');
const envs = ['production', 'preview', 'development'];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (!match) continue;

  const key = match[1];
  let value = match[2];

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  if (key === 'VERCEL_OIDC_TOKEN') continue;

  console.log(`Processing ${key}...`);

  for (const env of envs) {
    try {
      execSync(`npx vercel env rm ${key} ${env} -y`, { stdio: 'ignore' });
    } catch (e) {}
    
    try {
      execSync(`npx vercel env add ${key} ${env}`, {
        input: value,
        stdio: ['pipe', 'ignore', 'ignore']
      });
      console.log(`  + Added ${key} to ${env}`);
    } catch (error) {
      console.error(`  X Failed to add ${key} to ${env}`);
    }
  }
}

// Remove the test variables we added
try { execSync(`npx vercel env rm TEST_VAR production -y`, { stdio: 'ignore' }); } catch(e) {}
try { execSync(`npx vercel env rm TEST_VAR2 production -y`, { stdio: 'ignore' }); } catch(e) {}

console.log("Environment variables synchronization complete!");
