import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('step 5 — iPhone viewport (safe layout)', () => {
  it('keeps full-height chain and interactive-widget viewport meta', () => {
    const html = readProjectFile('index.html');
    expect(html).toMatch(/width=device-width/);
    expect(html).toMatch(/initial-scale=1/);
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/interactive-widget=resizes-content/);
    expect(html).not.toMatch(/maximum-scale=1/);
  });

  it('preserves height 100% to avoid blank post-login shell', () => {
    const css = readProjectFile('src/index.css');
    expect(css).toMatch(/html,\s*\nbody,\s*\n#root\s*\{[^}]*height:\s*100%/s);
  });

  it('uses 16px form controls to prevent iOS focus zoom', () => {
    const css = readProjectFile('src/index.css');
    expect(css).toMatch(/input,\s*\ntextarea,\s*\nselect\s*\{[^}]*font-size:\s*16px/s);
    expect(css).toMatch(/\.input-field[\s\S]*text-base/);
  });

  it('uses dvh shell and scrollable main in the app layout', () => {
    const app = readProjectFile('src/App.jsx');
    expect(app).toMatch(/app-shell mx-auto flex min-h-dvh max-w-lg flex-col/);
    expect(app).toMatch(/min-h-0 flex-1 overflow-y-auto/);
  });
});
