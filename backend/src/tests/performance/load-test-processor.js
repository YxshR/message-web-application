// Artillery.js processor for custom functions and setup

module.exports = {
  setupTestUsers,
  generateRandomMessage,
  validateResponse
};

async function setupTestUsers(context, events, done) {
  // This function runs once before the test starts
  console.log('Setting up test users for load testing...');
  
  // In a real scenario, you'd create test users here
  // For now, we assume they exist
  
  return done();
}

function generateRandomMessage(context, events, done) {
  context.vars.randomMessage = `Load test message ${Math.random().toString(36).substring(7)} at ${new Date().toISOString()}`;
  return done();
}

function validateResponse(requestParams, response, context, ee, next) {
  // Custom response validation
  if (response.statusCode >= 400) {
    console.error(`Error response: ${response.statusCode} - ${response.body}`);
  }
  
  return next();
}