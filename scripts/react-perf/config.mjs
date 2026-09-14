import assert from 'node:assert/strict';

const prepare = async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('i18nextLng', 'en');
  });
};
const waitForAccount = async (page) => {
  await page.getByRole('textbox', { name: 'My Name', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('select option')].some((option) => option.textContent?.startsWith('u/')));
};
const localBudget = (name, updates) => ({ components: { [name]: { minUpdates: updates, maxUpdates: updates } }, maxCommits: 30, maxRenderMs: 1000, maxActionMs: 5000 });

export default {
  targets: [
    {
      name: 'app',
      server: {
        command: ['corepack', 'yarn', 'exec', 'vite', '--host', '127.0.0.1', '--port', '{port}', '--strictPort'],
        env: { REACT_PERF_RUN: '1', PORTLESS: '0', BROWSER: 'none' },
      },
      scenarios: [
        {
          name: 'display-name-draft',
          path: '/#/settings',
          prepare,
          async run({ page, measure }) {
            await waitForAccount(page);
            const input = page.getByRole('textbox', { name: 'My Name', exact: true });
            await input.fill('');
            await measure(
              'type-five-characters',
              async () => {
                await input.pressSequentially('Alice', { delay: 60 });
                assert.equal(await input.inputValue(), 'Alice');
              },
              localBudget('DisplayNameSetting', 5),
            );
            await measure(
              'clear-draft',
              async () => {
                await input.fill('');
                assert.equal(await input.inputValue(), '');
              },
              localBudget('DisplayNameSetting', 1),
            );
          },
        },
        {
          name: 'theme-toggle',
          path: '/#/settings',
          prepare,
          async run({ page, measure }) {
            await waitForAccount(page);
            const theme = page.getByRole('combobox').nth(1);
            for (const value of ['dark', 'light'])
              await measure(
                `theme-${value}`,
                async () => {
                  await theme.selectOption(value);
                  await page.waitForFunction((expected) => localStorage.getItem('theme') === expected, value);
                },
                localBudget('ThemeSettings', 1),
              );
          },
        },
        {
          name: 'populated-feed',
          path: '/#/s/memes.eth',
          async prepare({ page }) {
            await prepare({ page });
            await page.addInitScript(() => {
              localStorage.setItem('development-debug:v1', JSON.stringify({ mockContentEnabled: true, showFeedResetButton: false }));
            });
            // Fixed built-in protocol fixture, with remote media blocked so the
            // rendering gate is independent of external image/CDN availability.
            await page.route('**/*', (route) =>
              ['image', 'media'].includes(route.request().resourceType()) && !new URL(route.request().url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)
                ? route.abort()
                : route.continue(),
            );
          },
          async run({ page, measure }) {
            const posts = page.locator('.expando-button');
            await posts.first().waitFor();
            assert.ok((await posts.count()) >= 5, 'Expected populated protocol fixture');
            await measure(
              'expand-post',
              async () => {
                await page.locator('.expando-button.collapsed').first().click();
                await page.locator('.expando-button.expanded').first().waitFor();
              },
              {
                components: { ExpandButton: { minUpdates: 1, maxUpdates: 1 }, FeedPost: { minUpdates: 1, maxUpdates: 1 } },
                maxCommits: 100,
                maxRenderMs: 3000,
                maxActionMs: 10000,
              },
            );
            await measure(
              'scroll-feed',
              async () => {
                await page.evaluate(() => window.scrollTo(0, 1000));
                await page.waitForFunction(() => window.scrollY > 0);
              },
              { components: { FeedPost: { minMounts: 1, maxMounts: 20, maxUpdates: 0 } }, maxCommits: 100, maxRenderMs: 3000, maxActionMs: 10000 },
            );
          },
        },
      ],
    },
  ],
};
