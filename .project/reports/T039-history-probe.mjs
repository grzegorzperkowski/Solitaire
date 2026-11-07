// Isolated history experiment; does not modify or load the production app.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const launcher = url.pathname === '/launcher';
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:0}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
    ${launcher ? '<h1>Launcher</h1><a id="open" href="/game">Gra</a>' :
      '<h1>Gra</h1><a id="exit" href="/launcher">Playground</a>'}
    <script>
      const mode = new URL(location.href).searchParams.get('mode');
      window.traversals = [];
      window.navigation?.addEventListener('navigate', event => {
        if (event.navigationType !== 'traverse') return;
        const result = { cancelable: event.cancelable, sameDocument: event.destination.sameDocument };
        if (event.cancelable) event.preventDefault();
        window.traversals.push(result);
        sessionStorage.setItem('probe-traversal', JSON.stringify(result));
      });
      if (${launcher}) {
        const link = document.querySelector('#open');
        link.href = '/game?mode=' + encodeURIComponent(mode);
        if (mode === 'replace') link.onclick = event => {
          event.preventDefault(); location.replace(link.href);
        };
        if (mode === 'frame') link.onclick = event => {
          event.preventDefault();
          const frame = document.createElement('iframe');
          frame.src = link.href; frame.title = 'Gra'; document.body.append(frame);
        };
        if (mode === 'same-document') link.onclick = event => {
          event.preventDefault();
          history.pushState({view: 'game'}, '', link.href);
          document.body.innerHTML = '<h1>Gra</h1><a id="exit" href="/launcher">Playground</a>';
        };
      }
    </script>`);
});
await new Promise(resolve => server.listen(0, 'localhost', resolve));
const base = `http://localhost:${server.address().port}`;
let browser;

try {
  browser = await chromium.launch();
  for (const mode of ['plain', 'replace', 'frame', 'same-document']) {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true });
    await page.goto(`${base}/launcher?mode=${mode}`);
    const before = await page.evaluate(() => history.length);
    await page.locator('#open').click();
    if (mode === 'frame') {
      await page.frameLocator('iframe').locator('h1').waitFor();
      const after = await page.evaluate(() => history.length);
      assert.equal(after, before);
      assert.equal(new URL(page.url()).pathname, '/launcher');
      assert.equal((await page.locator('iframe').boundingBox()).width, 320);
      console.log(JSON.stringify({mode, before, after, topPage: '/launcher', frameWidth: 320}));
    } else {
      await page.waitForURL('**/game?mode=*');
      const after = await page.evaluate(() => history.length);
      assert.equal(after, before + (mode === 'replace' ? 0 : 1));
      if (mode === 'same-document') {
        const cancellation = await page.evaluate(async () => {
          try { await navigation.back().finished; return 'not canceled'; }
          catch (error) { return error.name; }
        });
        assert.equal(cancellation, 'AbortError');
        assert.equal(new URL(page.url()).pathname, '/game');
        const traversal = await page.evaluate(() => window.traversals.at(-1));
        assert.equal(traversal.sameDocument, true);
        assert.equal(traversal.cancelable, true);
        await page.locator('#exit').click();
        await page.waitForURL('**/launcher');
        console.log(JSON.stringify({mode, before, after, traversal, cancellation, explicitExit: '/launcher'}));
      } else {
        await page.goBack();
        if (mode === 'plain') {
          await page.waitForURL('**/launcher?mode=plain');
          const traversal = await page.evaluate(() => JSON.parse(sessionStorage.getItem('probe-traversal')));
          assert.equal(traversal.sameDocument, false);
          assert.equal(traversal.cancelable, false);
          console.log(JSON.stringify({mode, before, after, backTo: '/launcher', traversal}));
        } else {
          assert.equal(page.url(), 'about:blank');
          console.log(JSON.stringify({mode, before, after, backTo: page.url()}));
        }
      }
    }
    await page.close();
  }
  console.log('PASS: history assertions only; no Android/iOS edge gesture claim.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
