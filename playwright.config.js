// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  projects: [
    { name: 'electron', testMatch: /electron\.(ui|packed)\.spec\.js/ }
  ]
});
