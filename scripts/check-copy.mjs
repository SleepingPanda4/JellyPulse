import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', 'dist']);
const textExtensions = new Set(['.md', '.html', '.js', '.mjs', '.ts', '.json', '.yml', '.yaml', '.txt', '.example']);
const forbiddenDash = String.fromCodePoint(0x2014);
const failures = [];

function inspect(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    if (ignored.has(relative(root, path))) return;
    for (const name of readdirSync(path)) {
      if (ignored.has(name)) continue;
      inspect(join(path, name));
    }
    return;
  }
  const name = relative(root, path);
  if (!textExtensions.has(extname(path)) && !['Dockerfile', '.gitignore'].includes(name)) return;
  readFileSync(path, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (line.includes(forbiddenDash)) failures.push(`${name}:${index + 1}`);
  });
}

inspect(root);
if (failures.length) {
  console.error(`Em dash found in repository copy:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('Copy style check passed.');
