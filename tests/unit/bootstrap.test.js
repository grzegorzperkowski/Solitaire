import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('serves a Polish semantic shell with a local ES module entry and zoom enabled', () => {
  const documentUrl = new URL('../../index.html', import.meta.url);
  expect(existsSync(documentUrl)).toBe(true);

  const html = readFileSync(documentUrl, 'utf8');
  expect(html).toMatch(/<!doctype html>/i);
  expect(html).toMatch(/<html\b[^>]*lang="pl"/);
  expect(html).toMatch(/<meta\b[^>]*charset="UTF-8"/i);
  expect(html).toMatch(/name="viewport"[^>]*content="width=device-width, initial-scale=1/);
  expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=/i);
  expect(html).toMatch(/<main\b[\s\S]*<h1\b[^>]*>Pasjans Klondike<\/h1>[\s\S]*<\/main>/);

  const entry = html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/);
  expect(entry).not.toBeNull();
  expect(entry[1]).toBe('./src/main.js');
  expect(existsSync(new URL(entry[1], documentUrl))).toBe(true);
});

test('loads the actual module entry and its stylesheet without DOM emulation', async () => {
  const entryUrl = new URL('../../src/main.js', import.meta.url);
  expect(existsSync(entryUrl)).toBe(true);
  expect(readFileSync(entryUrl, 'utf8')).toMatch(/import\s+['"]\.\/styles\.css['"]/);
  expect(existsSync(new URL('styles.css', entryUrl))).toBe(true);
  await expect(import('../../src/main.js')).resolves.toBeDefined();
});
