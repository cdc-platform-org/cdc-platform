import express from 'express';
import { processBogWebhook, processTbcWebhook, processStripeWebhook } from '../services/paymentService';

const router = express.Router();

// BOG Webhook
router.post('/webhook/bog', async (req, res) => {
  try {
    await processBogWebhook(req.body);
    res.status(200).send('BOG Webhook processed successfully');
  } catch (error) {
    console.error('Error processing BOG webhook:', error);
    res.status(500).send('Failed to process BOG webhook');
  }
});

// TBC Webhook
router.post('/webhook/tbc', async (req, res) => {
  try {
    await processTbcWebhook(req.body);
    res.status(200).send('TBC Webhook processed successfully');
  } catch (error) {
    console.error('Error processing TBC webhook:', error);
    res.status(500).send('Failed to process TBC webhook');
  }
});

// Stripe Webhook
router.post('/webhook/stripe', async (req, res) => {
  try {
    await processStripeWebhook(req.body);
    res.status(200).send('Stripe Webhook processed successfully');
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    res.status(500).send('Failed to process Stripe webhook');
  }
});

export default router;
router.post('/webhook/bog', async (req, res) => {
  try {
    if (!req.body.userId) {
      throw new Error('Missing user ID in BOG webhook payload');
    }
    await processBogWebhook(req.body);
    res.status(200).send('BOG Webhook processed successfully');
  } catch (error) {
    console.error('Error processing BOG webhook:', error);
    res.status(400).send(error.message || 'Failed to process BOG webhook');
  }
});

router.post('/webhook/tbc', async (req, res) => {
  try {
    if (!req.body.userId) {
      throw new Error('Missing user ID in TBC webhook payload');
    }
    await processTbcWebhook(req.body);
    res.status(200).send('TBC Webhook processed successfully');
  } catch (error) {
    console.error('Error processing TBC webhook:', error);
    res.status(400).send(error.message || 'Failed to process TBC webhook');
  }
});

router.post('/webhook/stripe', async (req, res) => {
  try {
    if (!req.body.userId) {
      throw new Error('Missing user ID in Stripe webhook payload');
    }
    await processStripeWebhook(req.body);
    res.status(200).send('Stripe Webhook processed successfully');
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    res.status(400).send(error.message || 'Failed to process Stripe webhook');
  }
});
