import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';

const explicit = process.env.API_URL || '';
const host = process.env.BACKEND_HOST || '';
let api = '';
try {
  if (explicit || host) {
    if (host && !explicit && !/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host)) throw new Error();
    const input = explicit || `https://${host}/api`;
    const url = new URL(input);
    const hostname = url.hostname.replace(/\.$/, '');
    if (!/^https:\/\/[^/\\?#]/.test(input) || input.includes('\\') || /[\u0000-\u0020\u007f]/.test(input) ||
        url.protocol !== 'https:' || url.username || url.password || input.includes('?') || input.includes('#') ||
        isIP(hostname) || !hostname.includes('.') || hostname.endsWith('.localhost')) throw new Error();
    api = url.href.replace(/\/$/, '');
  }
} catch {
  console.error('Invalid public API configuration');
  process.exit(1);
}

const args = ['build', ...process.argv.slice(2)];
if (api) args.push('--define', `__API_URL__=${JSON.stringify(api)}`);
const result = spawnSync('ng', args, { stdio: 'inherit' });
if (result.error) {
  console.error('Unable to start Angular build');
  process.exit(1);
}
process.exit(result.status ?? 1);
