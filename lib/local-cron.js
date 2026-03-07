/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const http = require('http');

/**
 * Starts local cron jobs based on vercel.json configuration.
 * @param {number} port - The port on which the local server is running.
 */
function startLocalCron(port) {
  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  
  if (!fs.existsSync(vercelJsonPath)) {
    console.warn('[Local Cron] vercel.json not found. Skipping local cron setup.');
    return;
  }

  let vercelConfig;
  try {
    vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  } catch (error) {
    console.error('[Local Cron] Error parsing vercel.json:', error.message);
    return;
  }

  const crons = vercelConfig.crons || [];
  
  if (crons.length === 0) {
    console.log('[Local Cron] No crons defined in vercel.json.');
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[Local Cron] WARNING: CRON_SECRET is not set. Cron requests may fail if your endpoints require it.');
  }

  console.log(`[Local Cron] Initializing ${crons.length} cron jobs...`);

  crons.forEach((cronJob) => {
    if (!cronJob.schedule || !cronJob.path) {
      console.warn(`[Local Cron] Invalid cron entry skipped: ${JSON.stringify(cronJob)}`);
      return;
    }

    try {
      cron.schedule(cronJob.schedule, () => {
        console.log(`[Local Cron] Executing job: ${cronJob.path}`);
        
        const options = {
          hostname: 'localhost',
          port: port,
          path: cronJob.path,
          method: 'GET',
          headers: {}
        };

        if (cronSecret) {
          options.headers['Authorization'] = `Bearer ${cronSecret}`;
        }

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            console.log(`[Local Cron] Job ${cronJob.path} completed with status ${res.statusCode}`);
            if (res.statusCode >= 400) {
              console.log(`[Local Cron] Response: ${data.substring(0, 200)}`);
            }
          });
        });

        req.on('error', (error) => {
          console.error(`[Local Cron] Job ${cronJob.path} failed:`, error.message);
        });

        req.end();
      });
      console.log(`[Local Cron] Scheduled: ${cronJob.path} (${cronJob.schedule})`);
    } catch (error) {
      console.error(`[Local Cron] Failed to schedule job ${cronJob.path}:`, error.message);
    }
  });
}

module.exports = { startLocalCron };
