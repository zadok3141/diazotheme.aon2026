#!/usr/bin/env node

/**
 * Simple BackstopJS configuration generator
 * Combines base config with scenarios and applies URL/reference environment settings
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const useProd = args.includes('--prod');
const useRefProd = args.includes('--ref-prod');
const useRefLocal = args.includes('--ref-local');
const useShowcase = args.includes('--showcase');
const useLinkStyles = args.includes('--link-styles');
const useListingView = args.includes('--listing-view');
const useHeaded = args.includes('--headed');
const quickIndex = args.indexOf('--quick');
const useQuick = quickIndex !== -1;
// Check for optional viewport argument after --quick (e.g., --quick sm)
let quickViewport = 'lg'; // default
if (useQuick && quickIndex + 1 < args.length) {
  const nextArg = args[quickIndex + 1];
  // Only treat as viewport if it's not another flag
  if (!nextArg.startsWith('--')) {
    quickViewport = nextArg;
  }
}
const viewportArg = args.find(arg => arg.startsWith('--viewport='));
const viewportFilter = viewportArg ? viewportArg.split('=')[1] : (useQuick ? quickViewport : null);
const thresholdArg = args.find(arg => arg.startsWith('--threshold='));
const thresholdOverride = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : null;

// Determine environments
const urlEnv = useProd ? 'production' : 'local';
const refEnv = useRefProd ? 'production' : (useRefLocal ? 'local' : urlEnv);

// File paths
const baseConfigPath = path.join(__dirname, '..', useShowcase ? 'backstop.showcase.json' : 'backstop.base.json');
const scenariosPath = path.join(__dirname, '..',
  useLinkStyles ? 'backstop.link-styles.json' :
  (useListingView ? 'backstop.listing-view.json' :
  'backstop.scenarios.json'));

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    process.exit(1);
  }
}

function validateScenario(scenario, index) {
  // Define known fields for scenarios
  const knownFields = [
    'label', 'urls', 'features', 'delay', 'selectors',
    'misMatchThreshold', 'requireSameDimensions',
    'hideSelectors', 'removeSelectors', 'clickSelector',
    'hoverSelector', 'hoverSelectors', 'scrollToSelector', 'postInteractionWait',
    'selectorExpansion', 'expect', 'viewports', 'debug', 'debugWindow',
    'keyPressSelectors', 'referers', 'requiresAuth'
  ];

  // Check for unrecognized fields
  const unrecognizedFields = Object.keys(scenario).filter(
    field => !knownFields.includes(field)
  );

  if (unrecognizedFields.length > 0) {
    console.error(`\n⚠️  Warning: Scenario "${scenario.label}" (index ${index}) contains unrecognized fields:`);
    unrecognizedFields.forEach(field => {
      console.error(`   - "${field}" (value: ${JSON.stringify(scenario[field])})`);
    });
    console.error('\nThese fields will be ignored. Valid fields are:');
    console.error(`   ${knownFields.join(', ')}\n`);
  }

  // Validate required fields
  if (!scenario.label) {
    throw new Error(`Scenario at index ${index} is missing required field "label"`);
  }
  if (!scenario.urls) {
    throw new Error(`Scenario "${scenario.label}" is missing required field "urls"`);
  }
  if (!scenario.urls.local || !scenario.urls.production) {
    throw new Error(`Scenario "${scenario.label}" must have both "local" and "production" URLs`);
  }

  // Validate feature keywords
  if (scenario.features && Array.isArray(scenario.features)) {
    const validFeatures = loadValidFeatures();
    if (validFeatures.length > 0) {
      const invalidFeatures = scenario.features.filter(
        feature => !validFeatures.includes(feature)
      );

      if (invalidFeatures.length > 0) {
        console.error(`\n⚠️  Warning: Scenario "${scenario.label}" (index ${index}) contains unrecognized feature keywords:`);
        invalidFeatures.forEach(feature => {
          console.error(`   - "${feature}"`);
        });
        console.error('\nValid feature keywords are:');
        console.error(`   ${validFeatures.join(', ')}`);
        console.error('\nTo add new features, update backstop.features.json\n');
      }
    }
  }
}

function loadValidFeatures() {
  const featuresPath = path.join(__dirname, '..', 'backstop.features.json');
  try {
    const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
    return featuresData.validFeatures || [];
  } catch (error) {
    console.error(`Warning: Could not load feature keywords from ${featuresPath}`);
    return [];
  }
}

function updateFeatureCounts(scenarios) {
  const featuresPath = path.join(__dirname, '..', 'backstop.features.json');

  try {
    // Load current features data
    const featuresData = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
    const originalFeatures = new Set(featuresData.validFeatures || []);

    // Count current usage from scenarios
    const currentCounts = {};
    const allFeatures = new Set();

    scenarios.forEach(scenario => {
      if (scenario.features && Array.isArray(scenario.features)) {
        scenario.features.forEach(feature => {
          currentCounts[feature] = (currentCounts[feature] || 0) + 1;
          allFeatures.add(feature);
        });
      }
    });

    // Update valid features list with any new ones
    featuresData.validFeatures = Array.from(allFeatures).sort();

    // Update counts - sort by count descending
    const sortedFeatures = featuresData.validFeatures
      .map(feature => ({ feature, count: currentCounts[feature] || 0 }))
      .sort((a, b) => b.count - a.count);

    featuresData.featureCounts = {};
    sortedFeatures.forEach(({ feature, count }) => {
      featuresData.featureCounts[feature] = count;
    });

    // Write back to file
    fs.writeFileSync(featuresPath, JSON.stringify(featuresData, null, 2) + '\n');

    // Report any new features added
    const newFeatures = Array.from(allFeatures).filter(
      feature => !originalFeatures.has(feature)
    );

    if (newFeatures.length > 0) {
      console.error(`\n✅ Added new feature keywords to backstop.features.json:`);
      newFeatures.forEach(feature => {
        console.error(`   + "${feature}" (used ${currentCounts[feature]} time${currentCounts[feature] !== 1 ? 's' : ''})`);
      });
      console.error('');
    }

  } catch (error) {
    console.error(`Warning: Could not update feature counts in ${featuresPath}:`, error.message);
  }
}

function generateConfig() {
  // Display warning when cross-testing (URL env differs from reference env)
  if (urlEnv !== refEnv) {
    console.error('\n' + '='.repeat(80));
    console.error('⚠️  CROSS-TESTING: Static content pages will always fail');
    console.error('='.repeat(80));
    console.error('When one of the test or reference images is from localhost,');
    console.error('static content page tests will always fail because the content');
    console.error('is served differently between local and production environments.');
    console.error('There are 5 static content scenarios (30 tests across 6 viewports)');
    console.error('that are expected to fail in cross-testing mode.');
    console.error('='.repeat(80) + '\n');
  }

  // Read base configuration and scenarios
  const baseConfig = readJsonFile(baseConfigPath);
  let { scenarios } = readJsonFile(scenariosPath);

  // Filter scenarios for showcase mode
  if (useShowcase) {
    const originalCount = scenarios.length;
    scenarios = scenarios.filter(scenario =>
      scenario.features && scenario.features.includes('showcase')
    );
    console.error(`Showcase mode: Using ${scenarios.length} of ${originalCount} scenarios`);
  }

  if (thresholdOverride !== null) {
    console.error(`Threshold override: Using misMatchThreshold=${thresholdOverride} for all scenarios`);
  }

  // Update feature counts only for local configuration (not showcase mode)
  if (!useShowcase) {
    updateFeatureCounts(scenarios);
  }

  // Validate all scenarios (after features are updated)
  scenarios.forEach((scenario, index) => {
    validateScenario(scenario, index);
  });

  // Convert scenarios to BackstopJS format
  const backstopScenarios = scenarios.map(scenario => {
    const backstopScenario = {
      label: scenario.label,
      url: scenario.urls[urlEnv],
      delay: scenario.delay || 1000,
      selectors: scenario.selectors || ['document'],
      misMatchThreshold: thresholdOverride ?? (scenario.misMatchThreshold || 0.1),
      requireSameDimensions: scenario.requireSameDimensions !== false
    };

    // Handle referer environment selection (same pattern as URL handling)
    if (scenario.referers && scenario.referers[urlEnv]) {
      backstopScenario.referer = scenario.referers[urlEnv];
    }

    // Add optional properties if they exist
    ['hideSelectors', 'removeSelectors', 'clickSelector', 'hoverSelector', 'hoverSelectors', 'scrollToSelector', 'postInteractionWait', 'debug', 'debugWindow', 'keyPressSelectors', 'requiresAuth'].forEach(prop => {
      if (scenario[prop]) {
        backstopScenario[prop] = scenario[prop];
      }
    });

    // Inherit global hideSelectors if not overridden
    if (baseConfig.hideSelectors && !scenario.hideSelectors) {
      backstopScenario.hideSelectors = baseConfig.hideSelectors;
    }

    return backstopScenario;
  });

  // Build final configuration
  const config = {
    ...baseConfig,
    scenarios: backstopScenarios,
    paths: {
      ...baseConfig.paths,
      bitmaps_reference: useShowcase ?
        `backstop_data/showcase_bitmaps_reference_${refEnv}` :
        (useLinkStyles ?
          `backstop_data/link_styles_bitmaps_reference_${refEnv}` :
          (useListingView ?
            `backstop_data/listing_view_bitmaps_reference_${refEnv}` :
            `backstop_data/bitmaps_reference_${refEnv}`))
    }
  };

  // Add link-styles specific path overrides
  if (useLinkStyles) {
    config.paths.bitmaps_test = 'backstop_data/link_styles_bitmaps_test';
    config.paths.html_report = 'backstop_data/link_styles_html_report';
    config.paths.json_report = 'backstop_data/link_styles_json_report';
    // engine_scripts remains shared
  }

  // Add listing-view specific path overrides
  if (useListingView) {
    config.paths.bitmaps_test = 'backstop_data/listing_view_bitmaps_test';
    config.paths.html_report = 'backstop_data/listing_view_html_report';
    config.paths.json_report = 'backstop_data/listing_view_json_report';
    // engine_scripts remains shared
  }

  // Add quick mode specific path overrides
  if (useQuick) {
    config.paths.bitmaps_reference = `backstop_data/quick_bitmaps_reference_${refEnv}`;
    config.paths.bitmaps_test = 'backstop_data/quick_bitmaps_test';
    config.paths.html_report = 'backstop_data/quick_html_report';
    config.paths.json_report = 'backstop_data/quick_json_report';
    // engine_scripts remains shared
  }

  // Filter to only 'lg' viewport for link-styles testing
  if (useLinkStyles && config.viewports) {
    config.viewports = config.viewports.filter(vp => vp.label === 'lg');
  }

  // Filter to specified viewport (--viewport=<label> or --quick)
  if (viewportFilter && config.viewports) {
    const originalCount = config.viewports.length;
    config.viewports = config.viewports.filter(vp => vp.label === viewportFilter);

    if (config.viewports.length === 0) {
      console.error(`\n⚠️  Error: No viewport found with label "${viewportFilter}"`);
      console.error(`Available viewports: ${['xs', 'sm', 'md', 'lg', 'xl', 'xxl'].join(', ')}\n`);
      process.exit(1);
    }

    console.error(`Viewport filter: Using only "${viewportFilter}" viewport (${config.viewports.length}/${originalCount})`);
  }

  // // Add production-specific settings when capturing from production URLs
  // if (urlEnv === 'production') {
  //   // Limit to sequential captures to avoid overwhelming production server
  //   config.asyncCaptureLimit = 1;
  // }

  // Enable non-headless mode when explicitly requested
  if (useHeaded) {
    config.engineOptions = {
      ...config.engineOptions,
      headless: false
    };
  }

  return config;
}

// Generate and output configuration
try {
  const config = generateConfig();
  console.log(JSON.stringify(config, null, 2));
} catch (error) {
  console.error('Error generating config:', error.message);
  process.exit(1);
}
