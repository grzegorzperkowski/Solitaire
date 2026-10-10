import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';

function getBuildInfo() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const str = d.toLocaleString('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'short' });
  const zone = str.includes('GMT+2') || str.includes('CEST') ? 'CEST' : 'CET';
  let commit = 'dev';
  try {
    commit = process.env.GITHUB_SHA
      ? process.env.GITHUB_SHA.slice(0, 7)
      : execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    commit = 'dev';
  }
  return `Build ${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute} ${zone} · ${commit}`;
}

export default defineConfig({
  base: './',
  define: {
    __BUILD_INFO__: JSON.stringify(getBuildInfo()),
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
    },
  },
});
