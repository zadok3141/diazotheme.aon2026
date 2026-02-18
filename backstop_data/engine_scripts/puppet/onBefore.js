module.exports = async (page, scenario, vp) => {
  // HTTP Basic Auth from environment variables
  const username = process.env.BACKSTOP_AUTH_USER;
  const password = process.env.BACKSTOP_AUTH_PASS;

  // Build extra headers object
  const extraHeaders = {};

  // Add proactive Basic Auth header only if scenario requires it
  // Set "requiresAuth": true in the scenario to enable authentication
  if (scenario.requiresAuth && username && password) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    extraHeaders['Authorization'] = `Basic ${credentials}`;
    console.log(`HTTP Basic Auth enabled for scenario: ${scenario.label}`);
  }

  // Add scenario-specific referer header
  if (scenario.referer) {
    extraHeaders['Referer'] = scenario.referer;
  }

  // Set all extra headers at once
  if (Object.keys(extraHeaders).length > 0) {
    await page.setExtraHTTPHeaders(extraHeaders);
  }
};
