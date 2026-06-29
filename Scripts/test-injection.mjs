import { webkit } from 'playwright';

const BASE_URL = process.env.INJECTION_TEST_URL || 'http://127.0.0.1:8090/injection-lab/';

const browser = await webkit.launch();
const page = await browser.newPage();

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForFunction(() => window.__INJECTION_TEST_RESULTS__, null, { timeout: 20000 });
  const results = await page.evaluate(() => window.__INJECTION_TEST_RESULTS__);

  console.log(`Injection lab: ${results.passed} passed, ${results.failed} failed`);
  for (const test of results.tests) {
    console.log(`${test.ok ? 'PASS' : 'FAIL'} ${test.name}${test.detail ? ` — ${test.detail}` : ''}`);
  }

  if (results.failed > 0) {
    process.exit(1);
  }
} catch (err) {
  console.error('Injection test runner failed:', err.message);
  process.exit(1);
} finally {
  await browser.close();
}