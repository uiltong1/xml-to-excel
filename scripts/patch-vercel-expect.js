const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { join } = require('node:path');

const MARKER = '/*nfe-patch:strip-expect*/';
const ANCHOR = 'async function onDevRequest(req, res) {';

function patchFile(target) {
  if (!existsSync(target)) return false;

  const source = readFileSync(target, 'utf8');
  if (source.includes(MARKER)) {
    return true;
  }
  if (!source.includes(ANCHOR)) {
    console.warn(`[patch-expect] âncora ausente nesta versão: ${target}`);
    return false;
  }

  const patched = source.replace(
    ANCHOR,
    `${ANCHOR}\n  ${MARKER} if (req.headers) { delete req.headers.expect; delete req.headers.Expect; }`,
  );
  writeFileSync(target, patched);
  return true;
}

function findGlobalDevServer() {
  try {
    const npmRoot = execSync('npm root -g', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return join(npmRoot, 'vercel', 'node_modules', '@vercel', 'node', 'dist', 'dev-server.mjs');
  } catch {
    return null;
  }
}

const targets = [
  join(__dirname, '..', 'node_modules', '@vercel', 'node', 'dist', 'dev-server.mjs'),
  findGlobalDevServer(),
].filter(Boolean);

let ok = false;
for (const target of targets) {
  ok = patchFile(target) || ok;
}
if (!ok) {
  console.warn(
    '[patch-expect] nenhuma cópia patcheada — uploads grandes com curl podem falhar com ' +
      '"expect header not supported" no vercel dev.',
  );
}
