// Generates deployment configuration only; does not contact Google or read secrets.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!args[i]?.startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Use --project ID --region REGION --model MODEL [--public-url HTTPS_ORIGIN]');
  const key = args[i].slice(2);
  if (!['project', 'region', 'model', 'public-url', 'site'].includes(key)) throw new Error(`Unknown option --${key}`);
  options[key] = args[i + 1];
}
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(options.project || '') || /YOUR|REPLACE|EXAMPLE/i.test(options.project)) throw new Error('Supply the real Firebase/Google Cloud project ID.');
const region = options.region || 'us-central1';
if (!/^[a-z]+-[a-z]+\d+$/.test(region)) throw new Error('Invalid Cloud Run region.');
if (!options.model || !/^[a-zA-Z0-9._-]+$/.test(options.model) || /CONFIGURE|REPLACE|MODEL_FROM|YOUR/i.test(options.model)) throw new Error('Supply a currently available Gemini model ID from your Google AI account.');
const origin = new URL(options['public-url'] || `https://${options.project}.web.app`);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Public URL must be an HTTPS origin without a path, credentials, query or fragment.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const firebase = JSON.parse(await readFile(path.join(root, 'firebase.json'), 'utf8'));
for (const rewrite of firebase.hosting.rewrites) if (rewrite.run) rewrite.run.region = region;
if (options.site) {
  if (!/^[a-z0-9-]+$/.test(options.site)) throw new Error('Invalid Firebase Hosting site ID.');
  firebase.hosting.site = options.site;
}
await writeFile(path.join(root, 'firebase.json'), JSON.stringify(firebase, null, 2) + '\n');
await writeFile(path.join(root, '.firebaserc'), JSON.stringify({ projects: { default: options.project } }, null, 2) + '\n');
const env = {
  APP_MODE: 'production', AUTO_MIGRATE: 'false', SEED_ON_STARTUP: 'false', DEMO_PASSWORD: 'disabled-in-production',
  SESSION_COOKIE_NAME: '__session', PUBLIC_BASE_URL: origin.origin,
  CORS_ORIGINS: [...new Set([origin.origin, `https://${options.project}.web.app`, `https://${options.project}.firebaseapp.com`])].join(','),
  THROTTLING_BACKEND: 'database', TRUSTED_PROXIES: '127.0.0.1,::1',
  DOCUMENT_STORAGE_DIR: '/mnt/documents', LLM_PROVIDER: 'gemini', LLM_MODEL: options.model,
  LLM_TIMEOUT_SECONDS: '15', JOB_MAX_RETRIES: '0', SESSION_CLEANUP_ENABLED: 'true', MAIL_PROVIDER: 'none',
};
// JSON is valid YAML and avoids shell quoting problems for comma-separated origins.
await writeFile(path.join(root, 'deploy/google-cloud/backend.generated.yaml'), JSON.stringify(env, null, 2) + '\n');
console.log(`Prepared firebase.json, .firebaserc and non-secret Cloud Run environment for ${options.project} (${region}).`);
console.log('Configure SMTP before relying on team invitations or password recovery. No deployment was performed.');
