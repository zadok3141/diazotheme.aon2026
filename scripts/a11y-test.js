#!/usr/bin/env node

/**
 * Accessibility Testing with axe-core
 *
 * Standalone script that reuses BackstopJS scenarios, auth pattern,
 * and CLI conventions to run axe-core audits against rendered pages.
 *
 * Usage:
 *   node scripts/a11y-test.js [options]
 *
 * Options:
 *   --prod              Use production URLs (default: local)
 *   --scenario=<label>  Run single scenario by label (partial match)
 *   --feature=<tags>    Filter by feature tag(s), comma-separated
 *   --tags=<axeTags>    axe rule tags: wcag2a, wcag2aa, wcag21aa, best-practice
 *   --rules=<ids>       Specific axe rule IDs (e.g., color-contrast)
 *   --disable-rules=<ids>  Exclude specific axe rules
 *   --viewport=<label>  Viewport to use: xs, sm, md, lg, xl, xxl (default: lg)
 *   --all-viewports     Test all 6 viewports
 *   --timeout=<ms>      Per-page timeout in milliseconds (default: 30000)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const { createHtmlReport } = require('axe-html-reporter');

// ---------------------------------------------------------------------------
// CLI argument parsing (matches backstop-config.js conventions)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

const useProd = args.includes('--prod');
const allViewports = args.includes('--all-viewports');

function getArgValue(flag) {
  const arg = args.find(a => a.startsWith(`${flag}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

const scenarioFilter = getArgValue('--scenario');
const featureFilter = getArgValue('--feature');
const axeTagsArg = getArgValue('--tags');
const axeRulesArg = getArgValue('--rules');
const disableRulesArg = getArgValue('--disable-rules');
const viewportArg = getArgValue('--viewport');
const timeoutArg = getArgValue('--timeout');

const pageTimeout = timeoutArg ? parseInt(timeoutArg, 10) : 30000;
const urlEnv = useProd ? 'production' : 'local';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const SCENARIOS_PATH = path.join(ROOT, 'backstop.scenarios.json');
const BASE_CONFIG_PATH = path.join(ROOT, 'backstop.base.json');
const RESULTS_DIR = path.join(ROOT, 'backstop_data', 'a11y_results');

// ---------------------------------------------------------------------------
// loadScenarios — reads and filters backstop.scenarios.json
// ---------------------------------------------------------------------------

function loadScenarios() {
  const raw = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8'));
  let scenarios = raw.scenarios;

  // Filter by --scenario (case-insensitive partial match on label)
  if (scenarioFilter) {
    const needle = scenarioFilter.toLowerCase();
    scenarios = scenarios.filter(s =>
      s.label.toLowerCase().includes(needle)
    );
    if (scenarios.length === 0) {
      console.error(`No scenarios matching "${scenarioFilter}"`);
      process.exit(1);
    }
    console.error(`Matched ${scenarios.length} scenario(s) for "${scenarioFilter}"`);
  }

  // Filter by --feature (comma-separated, scenario must have ALL specified features)
  if (featureFilter) {
    const requiredFeatures = featureFilter.split(',').map(f => f.trim().toLowerCase());
    scenarios = scenarios.filter(s => {
      const scenarioFeatures = (s.features || []).map(f => f.toLowerCase());
      return requiredFeatures.every(rf => scenarioFeatures.includes(rf));
    });
    if (scenarios.length === 0) {
      console.error(`No scenarios with feature(s): ${featureFilter}`);
      process.exit(1);
    }
    console.error(`Matched ${scenarios.length} scenario(s) for feature(s): ${featureFilter}`);
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// getViewports — reads viewports from backstop.base.json
// ---------------------------------------------------------------------------

function getViewports() {
  const base = JSON.parse(fs.readFileSync(BASE_CONFIG_PATH, 'utf8'));
  const allVps = base.viewports;

  if (allViewports) {
    return allVps;
  }

  const label = viewportArg || 'lg';
  const vp = allVps.find(v => v.label === label);
  if (!vp) {
    const available = allVps.map(v => v.label).join(', ');
    console.error(`Unknown viewport "${label}". Available: ${available}`);
    process.exit(1);
  }

  return [vp];
}

// ---------------------------------------------------------------------------
// setupAuth — replicates onBefore.js auth pattern
// ---------------------------------------------------------------------------

async function setupAuth(page, scenario) {
  const username = process.env.BACKSTOP_AUTH_USER;
  const password = process.env.BACKSTOP_AUTH_PASS;
  const extraHeaders = {};

  if (scenario.requiresAuth && username && password) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    extraHeaders['Authorization'] = `Basic ${credentials}`;
    console.error(`  Auth enabled for: ${scenario.label}`);
  }

  if (Object.keys(extraHeaders).length > 0) {
    await page.setExtraHTTPHeaders(extraHeaders);
  }
}

// ---------------------------------------------------------------------------
// buildAxeOptions — translates CLI flags to AxePuppeteer chain
// ---------------------------------------------------------------------------

function applyAxeOptions(axeBuilder) {
  if (axeTagsArg) {
    axeBuilder = axeBuilder.withTags(axeTagsArg.split(',').map(t => t.trim()));
  }
  if (axeRulesArg) {
    axeBuilder = axeBuilder.withRules(axeRulesArg.split(',').map(r => r.trim()));
  }
  if (disableRulesArg) {
    axeBuilder = axeBuilder.disableRules(disableRulesArg.split(',').map(r => r.trim()));
  }
  return axeBuilder;
}

// ---------------------------------------------------------------------------
// runAxeOnPage — open page, auth, navigate, run axe, close
// ---------------------------------------------------------------------------

async function runAxeOnPage(browser, scenario, viewport) {
  const url = scenario.urls[urlEnv];
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await setupAuth(page, scenario);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: pageTimeout });

    // Respect scenario delay (same as BackstopJS)
    const delay = scenario.delay || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    let axeBuilder = new AxePuppeteer(page);
    axeBuilder = applyAxeOptions(axeBuilder);
    const results = await axeBuilder.analyze();

    return {
      scenario: scenario.label,
      url,
      viewport: viewport.label,
      violations: results.violations,
      passes: results.passes.length,
      incomplete: results.incomplete,
      inapplicable: results.inapplicable.length,
      timestamp: results.timestamp,
      error: null,
    };
  } catch (err) {
    return {
      scenario: scenario.label,
      url,
      viewport: viewport.label,
      violations: [],
      passes: 0,
      incomplete: [],
      inapplicable: 0,
      timestamp: new Date().toISOString(),
      error: err.message,
    };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Console output formatting
// ---------------------------------------------------------------------------

function formatConsoleSummary(results) {
  const lines = [];
  let totalViolations = 0;
  let totalPasses = 0;
  let totalErrors = 0;

  lines.push('');
  lines.push('='.repeat(70));
  lines.push('  axe-core Accessibility Test Results');
  lines.push('='.repeat(70));
  lines.push('');

  for (const r of results) {
    const violationCount = r.violations.length;
    totalViolations += violationCount;
    totalPasses += r.passes;

    if (r.error) {
      totalErrors++;
      lines.push(`  ERROR  ${r.scenario} [${r.viewport}]`);
      lines.push(`         ${r.error}`);
      lines.push('');
      continue;
    }

    const marker = violationCount > 0 ? 'FAIL' : 'PASS';
    lines.push(`  ${marker}  ${r.scenario} [${r.viewport}]`);
    lines.push(`        ${r.url}`);
    lines.push(`        ${violationCount} violation(s), ${r.passes} passed, ${r.incomplete.length} incomplete`);

    if (violationCount > 0) {
      for (const v of r.violations) {
        const nodeCount = v.nodes.length;
        lines.push(`        - [${v.impact}] ${v.id}: ${v.description} (${nodeCount} node${nodeCount !== 1 ? 's' : ''})`);
      }
    }
    lines.push('');
  }

  lines.push('-'.repeat(70));
  lines.push(`  Total: ${results.length} test(s), ${totalViolations} violation(s), ${totalPasses} passed, ${totalErrors} error(s)`);
  lines.push('-'.repeat(70));
  lines.push('');

  return { text: lines.join('\n'), totalViolations, totalErrors };
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function writeJsonResults(results, ts) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Write latest.json (always overwritten)
  const latestPath = path.join(RESULTS_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(results, null, 2));
  console.error(`JSON results:  ${path.relative(ROOT, latestPath)}`);

  // Write timestamped archive
  const archivePath = path.join(RESULTS_DIR, `a11y_${ts}.json`);
  fs.writeFileSync(archivePath, JSON.stringify(results, null, 2));
  console.error(`JSON archive:  ${path.relative(ROOT, archivePath)}`);
}

// ---------------------------------------------------------------------------
// HTML report (axe-html-reporter)
// ---------------------------------------------------------------------------

function writeHtmlReport(results, ts) {
  // axe-html-reporter expects a single AxeResults-shaped object.
  // We merge all violations/passes/incomplete/inapplicable across scenarios
  // into one combined result for a unified report.
  const merged = {
    violations: [],
    passes: [],
    incomplete: [],
    inapplicable: [],
  };

  // Track unique rules to avoid duplicating rule-level entries.
  // Nodes get merged under the same rule if the rule appears in multiple scenarios.
  const violationMap = new Map();
  const incompleteMap = new Map();

  for (const r of results) {
    if (r.error) continue;

    for (const v of r.violations) {
      const key = v.id;
      if (violationMap.has(key)) {
        // Merge nodes, annotating with scenario context
        const existing = violationMap.get(key);
        const annotatedNodes = v.nodes.map(n => ({
          ...n,
          // Prepend scenario/viewport info to the failure summary
          failureSummary: `[${r.scenario} @ ${r.viewport}] ${n.failureSummary || ''}`,
        }));
        existing.nodes = existing.nodes.concat(annotatedNodes);
      } else {
        const annotatedNodes = v.nodes.map(n => ({
          ...n,
          failureSummary: `[${r.scenario} @ ${r.viewport}] ${n.failureSummary || ''}`,
        }));
        violationMap.set(key, { ...v, nodes: annotatedNodes });
      }
    }

    for (const inc of r.incomplete) {
      const key = inc.id;
      if (incompleteMap.has(key)) {
        const existing = incompleteMap.get(key);
        const annotatedNodes = inc.nodes.map(n => ({
          ...n,
          failureSummary: `[${r.scenario} @ ${r.viewport}] ${n.failureSummary || ''}`,
        }));
        existing.nodes = existing.nodes.concat(annotatedNodes);
      } else {
        const annotatedNodes = inc.nodes.map(n => ({
          ...n,
          failureSummary: `[${r.scenario} @ ${r.viewport}] ${n.failureSummary || ''}`,
        }));
        incompleteMap.set(key, { ...inc, nodes: annotatedNodes });
      }
    }
  }

  merged.violations = Array.from(violationMap.values());
  merged.incomplete = Array.from(incompleteMap.values());

  const scenarioCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  const env = useProd ? 'production' : 'local';
  const customSummary = [
    `<p><strong>Environment:</strong> ${env}</p>`,
    `<p><strong>Scenarios tested:</strong> ${scenarioCount}</p>`,
    errorCount > 0 ? `<p><strong>Errors:</strong> ${errorCount}</p>` : '',
    `<p><strong>Generated:</strong> ${new Date().toISOString()}</p>`,
  ].join('\n');

  const html = createHtmlReport({
    results: merged,
    options: {
      projectKey: `OAG 2025 Theme — Accessibility (${env})`,
      customSummary,
      doNotCreateReportFile: true,
    },
  });

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const htmlPath = path.join(RESULTS_DIR, 'latest.html');
  fs.writeFileSync(htmlPath, html);
  console.error(`HTML report:   ${path.relative(ROOT, htmlPath)}`);

  // Write timestamped archive
  const archivePath = path.join(RESULTS_DIR, `a11y_${ts}.html`);
  fs.writeFileSync(archivePath, html);
  console.error(`HTML archive:  ${path.relative(ROOT, archivePath)}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const scenarios = loadScenarios();
  const viewports = getViewports();

  const envLabel = useProd ? 'production' : 'local';
  const vpLabels = viewports.map(v => v.label).join(', ');
  console.error(`\naxe-core a11y test — ${envLabel} — viewports: ${vpLabels}`);
  console.error(`Scenarios: ${scenarios.length}, Viewports: ${viewports.length}`);
  console.error(`Total tests: ${scenarios.length * viewports.length}\n`);

  // Read browser args from backstop.base.json
  const base = JSON.parse(fs.readFileSync(BASE_CONFIG_PATH, 'utf8'));
  const browserArgs = (base.engineOptions && base.engineOptions.args) || ['--no-sandbox', '--disable-setuid-sandbox'];
  const ignoreHTTPSErrors = base.engineOptions ? base.engineOptions.ignoreHTTPSErrors : true;

  const browser = await puppeteer.launch({
    args: browserArgs,
    headless: true,
    ignoreHTTPSErrors,
  });

  const allResults = [];

  try {
    for (const scenario of scenarios) {
      for (const viewport of viewports) {
        const label = `${scenario.label} [${viewport.label}]`;
        console.error(`Testing: ${label}...`);
        const result = await runAxeOnPage(browser, scenario, viewport);
        allResults.push(result);

        // Brief inline status
        if (result.error) {
          console.error(`  -> ERROR: ${result.error}`);
        } else if (result.violations.length > 0) {
          console.error(`  -> ${result.violations.length} violation(s)`);
        } else {
          console.error(`  -> PASS`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  // Output
  const { text, totalViolations, totalErrors } = formatConsoleSummary(allResults);
  console.log(text);

  const ts = makeTimestamp();
  writeJsonResults(allResults, ts);
  writeHtmlReport(allResults, ts);

  // Exit code: 1 if any violations or errors
  if (totalViolations > 0 || totalErrors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
