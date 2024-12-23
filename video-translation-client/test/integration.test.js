const { expect } = require('chai');
const { spawn } = require('child_process');
const path = require('path');

const VideoTranslationClient = require('../client');

describe('Integration Test', function() {
  // Mocha usually times out quickly, so we give it up to 30 seconds
  this.timeout(30000);

  let serverProcess;

  before((done) => {
    // 1) Spawn the server.js from the parent directory
    // 2) We set environment variables to configure the server’s behavior (port, delay, error chance)
    serverProcess = spawn('node', [path.join(__dirname, '../../server.js')], {
      cwd: path.join(__dirname, '../../'),
      env: {
        ...process.env,
        PORT: 3000,
        DELAY_SECONDS: 3,
        ERROR_PROBABILITY: 0.1
      },
      stdio: 'inherit' // Show server logs in the same console
    });

    // Give the server a couple of seconds to get ready
    setTimeout(() => {
      done();
    }, 2000);
  });

  it('should eventually receive a "completed" status', async () => {
    // We create a client pointing to localhost:3000
    // We'll try up to 5 times, waiting 1 second initially, and give up after 15 seconds in total
    const client = new VideoTranslationClient('http://localhost:3000', {
      maxAttempts: 5,
      initialDelay: 1000,
      maxDurationMs: 15000,
      token: 'my-secure-token' // If our server demands an auth token
    });

    // This call waits until the status is "completed" or throws an error if something goes wrong
    const result = await client.waitForCompletion();

    // With Chai, we verify that the final status is indeed "completed"
    expect(result).to.equal('completed');
  });

  after(() => {
    // Once we’re done testing, kill the server process so it doesn’t hang around
    serverProcess.kill();
  });
});
