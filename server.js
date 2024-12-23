const express = require('express');
const cors = require('cors');

// We create our Express app and use CORS so any client can call our endpoints.
const app = express();
app.use(cors());

// If you want to tweak how long it takes to finish, set DELAY_SECONDS in your environment.
const DELAY_SECONDS = process.env.DELAY_SECONDS || 10;

// About 10% of the time, we'll pretend an "error" happened on the server.
const ERROR_PROBABILITY = 0.1;

// We'll keep track of when the server started, so we know when to switch from 'pending' to 'completed'.
let startTime = new Date();

/**
 * This route returns the status of our "translation job".
 * - "pending" if it hasn't reached DELAY_SECONDS yet,
 * - "completed" if it's past that time,
 * - or "error" randomly, based on ERROR_PROBABILITY.
 */
app.get('/status', (req, res) => {
  const now = new Date();
  const diffSeconds = (now - startTime) / 1000;

  // In ~10% of cases, we'll say "error".
  if (Math.random() < ERROR_PROBABILITY) {
    return res.json({ result: 'error' });
  }

  // Calculate how many seconds remain before we consider the job "completed".
  const remainingSeconds = DELAY_SECONDS - diffSeconds;
  if (remainingSeconds <= 0) {
    // If time's up, it's completed—remainingSeconds is just for extra info.
    return res.json({ result: 'completed', remainingSeconds: 0 });
  } else {
    // Otherwise, it's still pending, and we tell the client how many seconds are left.
    return res.json({ result: 'pending', remainingSeconds: Math.ceil(remainingSeconds) });
  }
});

// Finally, we start the server on whatever port you gave us (default 3000).
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
