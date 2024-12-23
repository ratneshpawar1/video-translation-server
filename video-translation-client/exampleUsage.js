const VideoTranslationClient = require('./client');

(async () => {
  // Here we create a new VideoTranslationClient and adjust its polling behavior:
  const client = new VideoTranslationClient('http://localhost:3000', {
    maxAttempts: 8,       // We'll try up to 8 times before giving up
    initialDelay: 1000,   // Start with a 1-second delay between attempts
    maxDurationMs: 20000, // If it takes longer than 20 seconds, we'll stop
    pollingStrategy: (attempt, previousDelay) => {
      // Each attempt, we just add another second to the delay:
      // 1s -> 2s -> 3s, etc.
      return previousDelay + 1000; 
    },
    token: 'your-secure-token' 
    // If the server needs a token (Bearer authorization), we include it here
  });

  try {
    console.log("[CLIENT] Starting to wait for completion...");
    // This calls our waitForCompletion() method, which polls the server
    // until it reports "completed" or we exceed our time/attempt limits.
    const status = await client.waitForCompletion();
    console.log(`[CLIENT] Final translation status: ${status}`);
  } catch (err) {
    // If something goes wrong or we run out of attempts/time, we’ll see the error here.
    console.error(`[CLIENT] Failed: ${err.message}`);
  }
})();
