import schedule from 'node-schedule';

const resetUsageQuota = () => {
  // Logic to reset usage quota for all accounts
  console.log('Resetting usage quota for all accounts...');
};

// Schedule the reset to run daily at midnight
schedule.scheduleJob('0 0 * * *', resetUsageQuota);
