#!/usr/bin/env node

/**
 * Hover-State Contrast Testing (WCAG SC 1.4.3)
 *
 * Standalone script that reuses BackstopJS scenarios, auth pattern,
 * and CLI conventions to check hover-state color contrast ratios.
 *
 * Discovers hoverable elements via CSSOM :hover rule scanning,
 * triggers hover states with Puppeteer, measures foreground/background
 * contrast, and reports WCAG 2.1 violations.
 *
 * Usage:
 *   node scripts/hover-contrast-test.js [options]
 *
 * Options:
 *   --prod              Use production URLs (default: local)
 *   --scenario=<label>  Run single scenario by label (partial match)
 *   --viewport=<label>  Viewport to use: xs, sm, md, lg, xl, xxl (default: lg)
 *   --timeout=<ms>      Per-page timeout in milliseconds (default: 30000)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// ---------------------------------------------------------------------------
// CLI argument parsing (matches a11y-test.js / backstop-config.js conventions)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

const useProd = args.includes('--prod');

function getArgValue(flag) {
  const arg = args.find(a => a.startsWith(`${flag}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

const scenarioFilter = getArgValue('--scenario');
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
const RESULTS_DIR = path.join(ROOT, 'backstop_data', 'hover_contrast_results');

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

  return scenarios;
}

// ---------------------------------------------------------------------------
// getViewport — reads viewport from backstop.base.json
// ---------------------------------------------------------------------------

function getViewport() {
  const base = JSON.parse(fs.readFileSync(BASE_CONFIG_PATH, 'utf8'));
  const allVps = base.viewports;

  const label = viewportArg || 'lg';
  const vp = allVps.find(v => v.label === label);
  if (!vp) {
    const available = allVps.map(v => v.label).join(', ');
    console.error(`Unknown viewport "${label}". Available: ${available}`);
    process.exit(1);
  }

  return vp;
}

// ---------------------------------------------------------------------------
// setupAuth — replicates onBefore.js auth pattern (same-origin only)
// ---------------------------------------------------------------------------

async function setupAuth(page, scenario, targetUrl) {
  const username = process.env.BACKSTOP_AUTH_USER;
  const password = process.env.BACKSTOP_AUTH_PASS;

  if (!scenario.requiresAuth || !username || !password) return;

  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  let targetOrigin;
  try {
    targetOrigin = new URL(targetUrl).origin;
  } catch (e) {
    return;
  }

  // Use request interception to send auth only to same-origin requests,
  // preventing credential leakage to cross-origin subresources (CDNs, etc.)
  await page.setRequestInterception(true);
  page.on('request', request => {
    try {
      const reqOrigin = new URL(request.url()).origin;
      if (reqOrigin === targetOrigin) {
        request.continue({
          headers: { ...request.headers(), 'Authorization': `Basic ${credentials}` }
        });
      } else {
        request.continue();
      }
    } catch (e) {
      request.continue();
    }
  });

  console.error(`  Auth enabled for: ${scenario.label}`);
}

// ---------------------------------------------------------------------------
// WCAG contrast calculation (inline — zero dependencies)
// ---------------------------------------------------------------------------

/** Parse CSS rgb/rgba string from getComputedStyle */
function parseRGB(css) {
  const m = css.match(
    /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/
  );
  if (!m) return null;
  return {
    r: Number(m[1]), g: Number(m[2]), b: Number(m[3]),
    a: m[4] !== undefined ? Number(m[4]) : 1
  };
}

/** Linearize a single sRGB channel (0-255) per WCAG 2.1 */
function linearize(v) {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance */
function luminance(r, g, b) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g)
       + 0.0722 * linearize(b);
}

/** WCAG 2.1 contrast ratio */
function contrastRatio(fg, bg) {
  const l1 = luminance(fg.r, fg.g, fg.b);
  const l2 = luminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Composite foreground over background (alpha compositing) */
function compositeColors(fg, bg) {
  return {
    r: Math.round(fg.a * fg.r + (1 - fg.a) * bg.r),
    g: Math.round(fg.a * fg.g + (1 - fg.a) * bg.g),
    b: Math.round(fg.a * fg.b + (1 - fg.a) * bg.b),
    a: 1
  };
}

/** Check if text qualifies as "large" per WCAG (>= 24px or >= 18.66px bold) */
function isLargeText(fontSize, fontWeight) {
  return fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
}

// ---------------------------------------------------------------------------
// In-browser shared helpers (injected once per page via page.evaluate)
//
// Attaches parseRGB, composite, and getEffectiveBackground to window.__hct
// so both discoverAndMeasureDefaults and readHoverStyles can reference them
// without duplicating ~60 lines of code.
// ---------------------------------------------------------------------------

const SHARED_BROWSER_HELPERS = `(() => {
  window.__hct = {};

  window.__hct.parseRGB = function(css) {
    const m = css.match(
      /rgba?\\(\\s*([\\d.]+)[\\s,]+([\\d.]+)[\\s,]+([\\d.]+)(?:[\\s,/]+([\\d.]+))?\\s*\\)/
    );
    if (!m) return null;
    return {
      r: Number(m[1]), g: Number(m[2]), b: Number(m[3]),
      a: m[4] !== undefined ? Number(m[4]) : 1
    };
  };

  window.__hct.composite = function(fg, bg) {
    return {
      r: Math.round(fg.a * fg.r + (1 - fg.a) * bg.r),
      g: Math.round(fg.a * fg.g + (1 - fg.a) * bg.g),
      b: Math.round(fg.a * fg.b + (1 - fg.a) * bg.b),
      a: 1
    };
  };

  window.__hct.getEffectiveBackground = function(element) {
    const layers = [];
    let el = element;
    let cumulativeOpacity = 1;

    while (el) {
      const style = getComputedStyle(el);
      const opacity = parseFloat(style.opacity);
      cumulativeOpacity *= opacity;

      const bgImage = style.backgroundImage;
      if (bgImage !== 'none') {
        const reason = /gradient/.test(bgImage) ? 'bgGradient' : 'bgImage';
        return { color: null, reason: reason, cumulativeOpacity: cumulativeOpacity };
      }

      if (['IMG','CANVAS','OBJECT','IFRAME','VIDEO','SVG']
          .includes(el.nodeName)) {
        return { color: null, reason: 'imgNode', cumulativeOpacity: cumulativeOpacity };
      }

      if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
        return { color: null, reason: 'blendMode', cumulativeOpacity: cumulativeOpacity };
      }

      if (style.filter && style.filter !== 'none') {
        return { color: null, reason: 'cssFilter', cumulativeOpacity: cumulativeOpacity };
      }

      const bgColor = window.__hct.parseRGB(style.backgroundColor);
      if (!bgColor) { el = el.parentElement; continue; }
      bgColor.a *= opacity;

      if (bgColor.a > 0) layers.push(bgColor);
      if (bgColor.a >= 1) break;

      el = el.parentElement;
    }

    if (layers.length === 0 || layers[layers.length - 1].a < 1) {
      layers.push({ r: 255, g: 255, b: 255, a: 1 });
    }

    let result = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) {
      result = window.__hct.composite(layers[i], result);
    }
    return { color: result, reason: null, cumulativeOpacity: cumulativeOpacity };
  };
})()`;

// ---------------------------------------------------------------------------
// In-browser functions (serialized into page.evaluate)
// ---------------------------------------------------------------------------

/**
 * Discover hoverable elements via CSSOM :hover rule scanning.
 * Falls back to interactive element query if CSSOM yields nothing.
 * Returns array of { selector, tagName, textContent, fontSize, fontWeight,
 *   fgColor, bgInfo, bgCumulativeOpacity } for each visible, hoverable element.
 *
 * Depends on window.__hct (injected by SHARED_BROWSER_HELPERS).
 */
const discoverAndMeasureDefaults = `
function discoverAndMeasureDefaults() {
  // --- Unique selector generation ---
  function getUniqueSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let current = el;
    while (current && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift('#' + CSS.escape(current.id));
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\\s+/)
          .filter(c => c && !c.startsWith('hover') && !c.startsWith('active'))
          .slice(0, 2)
          .map(c => '.' + CSS.escape(c));
        if (classes.length > 0) selector += classes.join('');
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          c => c.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          selector += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  // --- Visibility filter ---
  function isHoverable(el) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      cs.display !== 'none' &&
      cs.visibility !== 'hidden' &&
      cs.visibility !== 'collapse' &&
      parseFloat(cs.opacity) > 0 &&
      cs.pointerEvents !== 'none' &&
      rect.width > 0 && rect.height > 0 &&
      !el.closest('.sr-only, .visually-hidden')
    );
  }

  // --- Tier 1: CSSOM :hover rule scanning (recurses into @media/@supports/@layer) ---
  const hoverSelectors = new Set();

  function collectHoverSelectors(rules, out) {
    for (const rule of rules) {
      if (rule.cssRules) {
        collectHoverSelectors(rule.cssRules, out);
      } else if (rule.selectorText && rule.selectorText.includes(':hover')) {
        rule.selectorText.split(',')
          .filter(s => s.includes(':hover'))
          .map(s => {
            s = s.replace(/:hover/g, '').trim();
            s = s.replace(/::[\\w-]+(?:\\(.*?\\))?/g, '').trim();
            return s;
          })
          .forEach(s => { if (s) out.add(s); });
      }
    }
  }

  for (const sheet of document.styleSheets) {
    try {
      collectHoverSelectors(sheet.cssRules, hoverSelectors);
    } catch (e) {
      // Cross-origin stylesheet — skip (SecurityError)
    }
  }

  // Match discovered :hover selectors against DOM elements
  const elements = new Set();
  for (const sel of hoverSelectors) {
    try {
      document.querySelectorAll(sel).forEach(el => elements.add(el));
    } catch (e) { /* invalid selector — skip */ }
  }

  // --- Tier 2: Interactive element fallback ---
  if (elements.size === 0) {
    const INTERACTIVE_SELECTOR = [
      'a[href]', 'button', 'input', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[role="tab"]', '[tabindex]', 'details > summary'
    ].join(', ');
    document.querySelectorAll(INTERACTIVE_SELECTOR).forEach(el => elements.add(el));
  }

  // --- Filter and extract default styles ---
  const results = [];
  for (const el of elements) {
    if (!isHoverable(el)) continue;

    const cs = getComputedStyle(el);
    const bgInfo = window.__hct.getEffectiveBackground(el);
    const textContent = (el.textContent || '').trim().slice(0, 80);

    // Skip elements with no text content (nothing to measure contrast for)
    if (!textContent) continue;

    results.push({
      selector: getUniqueSelector(el),
      tagName: el.tagName.toLowerCase(),
      textContent: textContent,
      fontSize: parseFloat(cs.fontSize),
      fontWeight: parseInt(cs.fontWeight, 10),
      fgColor: cs.color,
      bgColor: bgInfo.color
        ? 'rgb(' + bgInfo.color.r + ', ' + bgInfo.color.g + ', ' + bgInfo.color.b + ')'
        : null,
      bgReason: bgInfo.reason,
      bgCumulativeOpacity: bgInfo.cumulativeOpacity,
      html: el.outerHTML.slice(0, 200)
    });
  }

  return results;
}
`;

/**
 * Read computed styles for a single element after hover.
 * Returns { fgColor, bgColor, bgReason, bgCumulativeOpacity } or null.
 *
 * Depends on window.__hct (injected by SHARED_BROWSER_HELPERS).
 */
const readHoverStyles = `
function readHoverStyles(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;

  const cs = getComputedStyle(el);
  const bgInfo = window.__hct.getEffectiveBackground(el);

  return {
    fgColor: cs.color,
    bgColor: bgInfo.color
      ? 'rgb(' + bgInfo.color.r + ', ' + bgInfo.color.g + ', ' + bgInfo.color.b + ')'
      : null,
    bgReason: bgInfo.reason,
    bgCumulativeOpacity: bgInfo.cumulativeOpacity
  };
}
`;

// ---------------------------------------------------------------------------
// Transition/animation killer CSS
// ---------------------------------------------------------------------------

const TRANSITION_KILLER_CSS = `
*, *::before, *::after {
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
}
`;

// ---------------------------------------------------------------------------
// Overlay dismissal script (IIFE — must self-invoke, not just define)
// ---------------------------------------------------------------------------

const DISMISS_OVERLAYS_SCRIPT = `(() => {
  // Bootstrap tooltips
  document.querySelectorAll('.tooltip.show').forEach(el => {
    try { bootstrap?.Tooltip?.getInstance?.(el)?.hide(); } catch(e) {}
    el.remove();
  });
  // Bootstrap popovers
  document.querySelectorAll('.popover.show').forEach(el => {
    try { bootstrap?.Popover?.getInstance?.(el)?.hide(); } catch(e) {}
    el.remove();
  });
  // Bootstrap dropdowns
  document.querySelectorAll('.dropdown-menu.show').forEach(el => {
    el.classList.remove('show');
  });
})()`;

// ---------------------------------------------------------------------------
// HTML escaping for security (page-sourced content in reports)
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// runHoverContrastOnPage — open page, discover, hover, measure, close
// ---------------------------------------------------------------------------

async function runHoverContrastOnPage(browser, scenario, viewport) {
  const url = scenario.urls[urlEnv];
  const page = await browser.newPage();
  const pageResults = {
    scenario: scenario.label,
    url,
    viewport: viewport.label,
    elementsChecked: 0,
    pass: 0,
    fail: 0,
    needsReview: 0,
    skip: 0,
    error: null,
    violations: [],
    needsReviewItems: [],
    passes: []
  };

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await setupAuth(page, scenario, url);

    // Navigate and check HTTP response status
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: pageTimeout
    });

    if (!response || !response.ok()) {
      const status = response ? response.status() : 'no response';
      pageResults.error = `HTTP ${status} for ${url}`;
      console.error(`  HTTP ${status} — skipping`);
      return pageResults;
    }

    // Respect scenario delay (same as BackstopJS)
    const delay = scenario.delay || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Inject transition/animation killer CSS
    await page.addStyleTag({ content: TRANSITION_KILLER_CSS });

    // Inject shared in-browser helpers (once per page)
    await page.evaluate(SHARED_BROWSER_HELPERS);

    // Discover hoverable elements and batch-read default styles
    const elements = await page.evaluate(`(${discoverAndMeasureDefaults})()`);

    if (elements.length === 0) {
      console.error(`  No hoverable elements found`);
      return pageResults;
    }

    console.error(`  Found ${elements.length} hoverable element(s)`);

    // Hover + measure loop
    for (const info of elements) {
      pageResults.elementsChecked++;

      // If default background couldn't be resolved, flag for manual review
      if (info.bgReason) {
        pageResults.needsReview++;
        pageResults.needsReviewItems.push({
          selector: info.selector,
          html: escapeHtml(info.html),
          textContent: escapeHtml(info.textContent),
          reason: info.bgReason,
          status: 'needs-review'
        });
        continue;
      }

      try {
        // Dismiss overlays
        await page.evaluate(DISMISS_OVERLAYS_SCRIPT);

        // Reset mouse to neutral position
        await page.mouse.move(0, 0);
        await page.evaluate(() =>
          new Promise(r => requestAnimationFrame(r))
        );

        // Re-query element handle (stale reference guard)
        const elHandle = await page.$(info.selector);
        if (!elHandle) {
          pageResults.skip++;
          continue;
        }

        // Hover the element
        await elHandle.hover();

        // Double-rAF — wait for browser to apply :hover and paint
        await page.evaluate(() => new Promise(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));

        // Read hover computed styles
        const hoverStyles = await page.evaluate(
          `(${readHoverStyles})(${JSON.stringify(info.selector)})`
        );

        await elHandle.dispose();

        if (!hoverStyles) {
          pageResults.skip++;
          continue;
        }

        // If hover background can't be resolved, flag for manual review
        if (hoverStyles.bgReason) {
          pageResults.needsReview++;
          pageResults.needsReviewItems.push({
            selector: info.selector,
            html: escapeHtml(info.html),
            textContent: escapeHtml(info.textContent),
            reason: hoverStyles.bgReason,
            status: 'needs-review'
          });
          continue;
        }

        // Parse colors
        const defaultFg = parseRGB(info.fgColor);
        const defaultBg = parseRGB(info.bgColor);
        const hoverFg = parseRGB(hoverStyles.fgColor);
        const hoverBg = parseRGB(hoverStyles.bgColor);

        if (!defaultFg || !defaultBg || !hoverFg || !hoverBg) {
          pageResults.skip++;
          continue;
        }

        // Apply cumulative ancestor opacity to foreground alpha.
        // CSS opacity creates a compositing group — it dims both text
        // and background equally. The background walk already accounts
        // for opacity on each layer; the foreground also needs adjustment.
        const defaultCumOpacity = info.bgCumulativeOpacity || 1;
        const hoverCumOpacity = hoverStyles.bgCumulativeOpacity || 1;
        const adjDefaultFg = { ...defaultFg, a: defaultFg.a * defaultCumOpacity };
        const adjHoverFg = { ...hoverFg, a: hoverFg.a * hoverCumOpacity };

        // Composite foreground alpha if needed
        const effectiveDefaultFg = adjDefaultFg.a < 1
          ? compositeColors(adjDefaultFg, defaultBg)
          : adjDefaultFg;
        const effectiveHoverFg = adjHoverFg.a < 1
          ? compositeColors(adjHoverFg, hoverBg)
          : adjHoverFg;

        // Calculate contrast ratios
        const defaultRatio = contrastRatio(effectiveDefaultFg, defaultBg);
        const hoverRatio = contrastRatio(effectiveHoverFg, hoverBg);
        const large = isLargeText(info.fontSize, info.fontWeight);
        const requiredRatio = large ? 3 : 4.5;

        const hoverPasses = hoverRatio >= requiredRatio;

        const result = {
          selector: info.selector,
          html: escapeHtml(info.html),
          textContent: escapeHtml(info.textContent),
          fontSize: info.fontSize + 'px',
          fontWeight: String(info.fontWeight),
          isLargeText: large,
          requiredRatio,
          defaultState: {
            fgColor: info.fgColor,
            bgColor: info.bgColor,
            contrastRatio: Math.round(defaultRatio * 100) / 100
          },
          hoverState: {
            fgColor: hoverStyles.fgColor,
            bgColor: hoverStyles.bgColor,
            contrastRatio: Math.round(hoverRatio * 100) / 100
          },
          status: hoverPasses ? 'pass' : 'fail'
        };

        if (hoverPasses) {
          pageResults.pass++;
          pageResults.passes.push(result);
        } else {
          pageResults.fail++;
          pageResults.violations.push(result);
        }
      } catch (elErr) {
        // Individual element hover failed — log selector for diagnosis
        console.error(`    skip: ${info.selector} — ${elErr.message}`);
        pageResults.skip++;
      }
    }

    return pageResults;
  } catch (err) {
    pageResults.error = err.message;
    return pageResults;
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Console output formatting
// ---------------------------------------------------------------------------

function formatConsoleSummary(results) {
  const lines = [];
  let totalFail = 0;
  let totalPass = 0;
  let totalReview = 0;
  let totalSkip = 0;
  let totalChecked = 0;
  let totalErrors = 0;

  lines.push('');
  lines.push('='.repeat(70));
  lines.push('  Hover-State Contrast Test Results (WCAG SC 1.4.3)');
  lines.push('='.repeat(70));
  lines.push('');

  for (const r of results) {
    totalChecked += r.elementsChecked;
    totalFail += r.fail;
    totalPass += r.pass;
    totalReview += r.needsReview;
    totalSkip += r.skip;

    if (r.error) {
      totalErrors++;
      lines.push(`  ERROR  ${r.scenario} [${r.viewport}]`);
      lines.push(`         ${r.error}`);
      lines.push('');
      continue;
    }

    const marker = r.fail > 0 ? 'FAIL' : 'PASS';
    lines.push(`  ${marker}  ${r.scenario} [${r.viewport}]`);
    lines.push(`        ${r.url}`);
    lines.push(`        ${r.elementsChecked} checked, ${r.pass} pass, ${r.fail} fail, ${r.needsReview} review, ${r.skip} skip`);

    if (r.fail > 0) {
      for (const v of r.violations) {
        lines.push(`        - FAIL ${v.selector}`);
        lines.push(`          "${v.textContent.slice(0, 50)}"`);
        lines.push(`          hover ${v.hoverState.contrastRatio}:1 < ${v.requiredRatio}:1 required`);
      }
    }
    lines.push('');
  }

  lines.push('-'.repeat(70));
  lines.push(`  Total: ${results.length} page(s), ${totalChecked} element(s) checked`);
  lines.push(`  Pass: ${totalPass}, Fail: ${totalFail}, Needs review: ${totalReview}, Skip: ${totalSkip}, Errors: ${totalErrors}`);
  lines.push('-'.repeat(70));
  lines.push('');

  return { text: lines.join('\n'), totalFail, totalErrors };
}

// ---------------------------------------------------------------------------
// JSON output (with timestamped archive, matching a11y-test.js pattern)
// ---------------------------------------------------------------------------

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function writeJsonResults(results, ts) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const output = {
    timestamp: new Date().toISOString(),
    environment: useProd ? 'production' : 'local',
    viewport: viewportArg || 'lg',
    summary: {
      scenarios: results.length,
      elementsChecked: results.reduce((s, r) => s + r.elementsChecked, 0),
      pass: results.reduce((s, r) => s + r.pass, 0),
      fail: results.reduce((s, r) => s + r.fail, 0),
      needsReview: results.reduce((s, r) => s + r.needsReview, 0),
      skip: results.reduce((s, r) => s + r.skip, 0)
    },
    pages: results
  };

  // Write latest.json (always overwritten)
  const latestPath = path.join(RESULTS_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));
  console.error(`JSON results:  ${path.relative(ROOT, latestPath)}`);

  // Write timestamped archive
  const archivePath = path.join(RESULTS_DIR, `hover_${ts}.json`);
  fs.writeFileSync(archivePath, JSON.stringify(output, null, 2));
  console.error(`JSON archive:  ${path.relative(ROOT, archivePath)}`);
}

// ---------------------------------------------------------------------------
// HTML report
// ---------------------------------------------------------------------------

function writeHtmlReport(results, ts) {
  const env = useProd ? 'production' : 'local';
  const vpLabel = viewportArg || 'lg';
  const generated = new Date().toISOString();

  const totalChecked = results.reduce((s, r) => s + r.elementsChecked, 0);
  const totalPass = results.reduce((s, r) => s + r.pass, 0);
  const totalFail = results.reduce((s, r) => s + r.fail, 0);
  const totalReview = results.reduce((s, r) => s + r.needsReview, 0);
  const totalSkip = results.reduce((s, r) => s + r.skip, 0);
  const totalErrors = results.filter(r => r.error).length;

  // Collect all violations, passes, and review items across scenarios
  const allViolations = [];
  const allReviewItems = [];
  const allPasses = [];

  for (const r of results) {
    if (r.error) continue;
    for (const v of r.violations) {
      allViolations.push({ ...v, scenario: r.scenario, viewport: r.viewport, url: r.url });
    }
    for (const item of r.needsReviewItems) {
      allReviewItems.push({ ...item, scenario: r.scenario, viewport: r.viewport, url: r.url });
    }
    for (const p of r.passes) {
      allPasses.push({ ...p, scenario: r.scenario, viewport: r.viewport, url: r.url });
    }
  }

  function colorSwatch(css) {
    if (!css) return '';
    return '<span class="swatch" style="background:' + escapeHtml(css) + '"></span>';
  }

  function contrastResultRow(item, showStatus) {
    const statusClass = item.status === 'fail' ? 'fail' : item.status === 'pass' ? 'pass' : 'review';
    const statusLabel = item.status === 'fail' ? 'FAIL' : item.status === 'pass' ? 'PASS' : 'REVIEW';

    // needs-review items don't have contrast data
    if (item.status === 'needs-review') {
      return '<tr class="' + statusClass + '">'
        + '<td>' + (showStatus ? '<span class="badge badge-' + statusClass + '">' + statusLabel + '</span>' : '') + '</td>'
        + '<td><code>' + escapeHtml(item.selector) + '</code></td>'
        + '<td>' + escapeHtml(item.textContent || '').slice(0, 60) + '</td>'
        + '<td colspan="4">Needs manual review: ' + escapeHtml(item.reason) + '</td>'
        + '<td>' + escapeHtml(item.scenario) + '</td>'
        + '</tr>';
    }

    return '<tr class="' + statusClass + '">'
      + '<td>' + (showStatus ? '<span class="badge badge-' + statusClass + '">' + statusLabel + '</span>' : '') + '</td>'
      + '<td><code>' + escapeHtml(item.selector) + '</code></td>'
      + '<td>' + escapeHtml(item.textContent || '').slice(0, 60) + '</td>'
      + '<td>'
        + colorSwatch(item.defaultState.fgColor) + ' '
        + colorSwatch(item.defaultState.bgColor)
        + ' ' + item.defaultState.contrastRatio + ':1'
      + '</td>'
      + '<td>'
        + colorSwatch(item.hoverState.fgColor) + ' '
        + colorSwatch(item.hoverState.bgColor)
        + ' ' + item.hoverState.contrastRatio + ':1'
      + '</td>'
      + '<td>' + item.requiredRatio + ':1'
        + (item.isLargeText ? ' <small>(large text)</small>' : '')
      + '</td>'
      + '<td>' + item.fontSize + ' / ' + item.fontWeight + '</td>'
      + '<td>' + escapeHtml(item.scenario) + '</td>'
      + '</tr>';
  }

  const violationRows = allViolations.map(v => contrastResultRow(v, true)).join('\n');
  const reviewRows = allReviewItems.map(v => contrastResultRow(v, true)).join('\n');

  // Build collapsible passes section (can be large)
  const passRows = allPasses.map(p => contrastResultRow(p, false)).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hover Contrast Report — ${escapeHtml(env)} — ${escapeHtml(generated)}</title>
<style>
  :root { --pass: #2e7d32; --fail: #c62828; --review: #e65100; --bg: #fafafa; --border: #ddd; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 1.5rem; background: var(--bg); color: #212121; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
  .meta { color: #666; font-size: 0.85rem; margin-bottom: 1rem; }
  .summary { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .stat { background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 0.75rem 1.25rem; min-width: 100px; }
  .stat .num { font-size: 1.6rem; font-weight: 700; }
  .stat .label { font-size: 0.8rem; color: #666; text-transform: uppercase; }
  .stat.fail .num { color: var(--fail); }
  .stat.pass .num { color: var(--pass); }
  .stat.review .num { color: var(--review); }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #fff; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); }
  th { background: #f5f5f5; font-weight: 600; position: sticky; top: 0; }
  tr.fail td { background: #ffebee; }
  tr.review td { background: #fff3e0; }
  code { font-size: 0.8rem; word-break: break-all; }
  .swatch { display: inline-block; width: 14px; height: 14px; border: 1px solid #999; border-radius: 2px; vertical-align: middle; }
  .badge { display: inline-block; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.75rem; font-weight: 700; color: #fff; }
  .badge-fail { background: var(--fail); }
  .badge-pass { background: var(--pass); }
  .badge-review { background: var(--review); }
  details { margin-top: 1rem; }
  summary { cursor: pointer; font-weight: 600; font-size: 1rem; padding: 0.5rem 0; }
  .empty { color: #999; font-style: italic; padding: 1rem; }
</style>
</head>
<body>
<h1>Hover-State Contrast Report (WCAG SC 1.4.3)</h1>
<p class="meta">Environment: <strong>${escapeHtml(env)}</strong> &middot; Viewport: <strong>${escapeHtml(vpLabel)}</strong> &middot; Generated: ${escapeHtml(generated)}</p>

<div class="summary">
  <div class="stat"><div class="num">${totalChecked}</div><div class="label">Checked</div></div>
  <div class="stat pass"><div class="num">${totalPass}</div><div class="label">Pass</div></div>
  <div class="stat fail"><div class="num">${totalFail}</div><div class="label">Fail</div></div>
  <div class="stat review"><div class="num">${totalReview}</div><div class="label">Review</div></div>
  <div class="stat"><div class="num">${totalSkip}</div><div class="label">Skip</div></div>
  ${totalErrors > 0 ? '<div class="stat fail"><div class="num">' + totalErrors + '</div><div class="label">Errors</div></div>' : ''}
</div>

<h2>Violations (${allViolations.length})</h2>
${allViolations.length > 0 ? `
<table>
<thead><tr><th>Status</th><th>Selector</th><th>Text</th><th>Default (fg/bg)</th><th>Hover (fg/bg)</th><th>Required</th><th>Size / Weight</th><th>Scenario</th></tr></thead>
<tbody>
${violationRows}
</tbody>
</table>` : '<p class="empty">No violations found.</p>'}

${allReviewItems.length > 0 ? `
<h2>Needs Review (${allReviewItems.length})</h2>
<table>
<thead><tr><th>Status</th><th>Selector</th><th>Text</th><th colspan="4">Reason</th><th>Scenario</th></tr></thead>
<tbody>
${reviewRows}
</tbody>
</table>` : ''}

<details>
<summary>Passing Elements (${allPasses.length})</summary>
${allPasses.length > 0 ? `
<table>
<thead><tr><th></th><th>Selector</th><th>Text</th><th>Default (fg/bg)</th><th>Hover (fg/bg)</th><th>Required</th><th>Size / Weight</th><th>Scenario</th></tr></thead>
<tbody>
${passRows}
</tbody>
</table>` : '<p class="empty">No passing elements.</p>'}
</details>

</body>
</html>`;

  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const htmlPath = path.join(RESULTS_DIR, 'latest.html');
  fs.writeFileSync(htmlPath, html);
  console.error(`HTML report:   ${path.relative(ROOT, htmlPath)}`);

  const archivePath = path.join(RESULTS_DIR, `hover_${ts}.html`);
  fs.writeFileSync(archivePath, html);
  console.error(`HTML archive:  ${path.relative(ROOT, archivePath)}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const scenarios = loadScenarios();
  const viewport = getViewport();

  const envLabel = useProd ? 'production' : 'local';
  console.error(`\nHover contrast test — ${envLabel} — viewport: ${viewport.label}`);
  console.error(`Scenarios: ${scenarios.length}\n`);

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
      console.error(`Testing: ${scenario.label} [${viewport.label}]...`);
      const result = await runHoverContrastOnPage(browser, scenario, viewport);
      allResults.push(result);

      // Brief inline status
      if (result.error) {
        console.error(`  -> ERROR: ${result.error}`);
      } else if (result.fail > 0) {
        console.error(`  -> ${result.fail} violation(s)`);
      } else {
        console.error(`  -> PASS (${result.pass} checked)`);
      }
    }
  } finally {
    await browser.close();
  }

  // Output
  const { text, totalFail, totalErrors } = formatConsoleSummary(allResults);
  console.log(text);

  const ts = makeTimestamp();
  writeJsonResults(allResults, ts);
  writeHtmlReport(allResults, ts);

  // Exit code: 0 = pass, 1 = violations, 2 = fatal
  if (totalFail > 0 || totalErrors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
