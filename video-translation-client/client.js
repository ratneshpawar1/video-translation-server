const axios = require('axios');

/**
 * This function decides how long we wait before trying again.
 * - If `remainingSeconds` is less than 5, we wait only 1 second (we're almost done).
 * - Otherwise, we double the previous delay (exponential backoff).
 */
function defaultPollingStrategy(attempt, previousDelay, serverHint) {
  if (serverHint && typeof serverHint.remainingSeconds === 'number' && serverHint.remainingSeconds < 5) {
    console.log(`[INFO] Remaining seconds < 5; will poll more frequently.`);
    return 1000; // 1 second
  }
  // Otherwise, just double the delay.
  return previousDelay * 2;
}

class VideoTranslationClient {
  /**
   * You can customize how quickly (or slowly) we poll the server and how long we keep trying.
   */
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;

    // A few key settings:
    this.initialDelay = options.initialDelay ?? 1000;       // How long to wait before the first retry (default 1s)
    this.maxAttempts = options.maxAttempts ?? 10;          // How many times we'll try
    this.pollingStrategy = options.pollingStrategy ?? defaultPollingStrategy;
    this.maxDurationMs = options.maxDurationMs ?? 30000;   // After 30s, give up
    this.token = options.token ?? null;

    // These track how far we've gone:
    this.attempt = 0;
    this.currentDelay = this.initialDelay;
    this.startTime = Date.now();
  }

  /**
   * We'll just make one HTTP GET call here and return the JSON.
   * If there's an error (like the server is down), we throw it so the caller can handle it.
   */
  async getStatus() {
    const headers = {};
    if (this.token) {
      // If you passed in a token, let's attach it.
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/status`, { headers });
      return response.data;
    } catch (err) {
      // We'll wrap the error in a more descriptive message.
      throw new Error(`Error fetching status: ${err.message}`);
    }
  }

  /**
   * This is our main loop. We'll keep polling the server until:
   *  - It says "completed" or "error".
   *  - We run out of attempts.
   *  - Or we exceed our total allowed time (maxDurationMs).
   */
  async waitForCompletion() {
    console.log('[INFO] Starting waitForCompletion...');

    while (this.attempt < this.maxAttempts) {
      // If we've been trying too long overall, let's throw an error.
      const elapsedMs = Date.now() - this.startTime;
      if (elapsedMs > this.maxDurationMs) {
        throw new Error(`[ERROR] Timed out after ${this.maxDurationMs}ms without completion.`);
      }

      let serverResponse;
      try {
        // We'll check the server once each loop.
        serverResponse = await this.getStatus();
        this.attempt += 1;
      } catch (err) {
        console.error(`[WARN] Attempt #${this.attempt + 1} failed: ${err.message}`);
        if (this.attempt >= this.maxAttempts) {
          throw new Error(`[ERROR] Max attempts (${this.maxAttempts}) reached with repeated errors.`);
        }

        // We wait for a bit before trying again.
        console.log(`[INFO] Waiting ${this.currentDelay}ms before next attempt (network error).`);
        await this._sleep(this.currentDelay);

        // We also update our polling delay based on the strategy, but we have no server hint this time.
        this.currentDelay = this.pollingStrategy(this.attempt, this.currentDelay, {});
        continue;
      }

      // The server gave us a result and maybe a hint on how many seconds remain.
      const { result, remainingSeconds } = serverResponse;
      console.log(`[INFO] Attempt #${this.attempt} - result: ${result}, remainingSeconds: ${remainingSeconds ?? 'N/A'}`);

      if (result === 'completed') {
        console.log(`[INFO] Job completed in ${elapsedMs}ms over ${this.attempt} attempts.`);
        return 'completed';
      } else if (result === 'error') {
        // The server said there's an error, so let's bail out now.
        throw new Error('[ERROR] Server returned "error" status.');
      } else {
        // It's still pending, so let's wait and increase our delay as needed.
        console.log(`[INFO] Status pending. Waiting ${this.currentDelay}ms before next attempt...`);
        await this._sleep(this.currentDelay);

        // Update our delay based on the server's hint about remainingSeconds.
        this.currentDelay = this.pollingStrategy(this.attempt, this.currentDelay, { remainingSeconds });
      }
    }

    // If we exit this loop, that means we've hit the max number of attempts without success.
    throw new Error(`[ERROR] Max attempts (${this.maxAttempts}) reached without completion.`);
  }

  /**
   * A tiny helper that pauses our code for the given number of milliseconds.
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VideoTranslationClient;
