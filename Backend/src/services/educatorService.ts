import schedule from 'node-schedule';

const resetUsageQuota = () => {
  // Logic to reset usage quota for all accounts
  console.log('Resetting usage quota for all accounts...');
};

// Update Gemini model name to the recommended stable version
const GEMINI_MODEL_NAME = 'gemini-2.5-flash';

// Schedule the reset to run daily at midnight
schedule.scheduleJob('0 0 * * *', resetUsageQuota);
