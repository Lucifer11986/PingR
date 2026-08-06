import express, { Request, Response } from 'express';
import DevUser from '../models/DevUser';
import axios from 'axios';

const router = express.Router();

// PayPal Configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Get PayPal Access Token
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post(
    `${PAYPAL_API_BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

// Plan IDs (You create these in PayPal Dashboard)
const PLAN_IDS = {
  pro: process.env.PAYPAL_PRO_PLAN_ID || 'P-xxx', // €29/month
  enterprise: process.env.PAYPAL_ENTERPRISE_PLAN_ID || 'P-yyy', // Custom
};

// POST /api/payments/create-subscription - Create PayPal Subscription
router.post('/create-subscription', async (req: Request, res: Response) => {
  try {
    const { plan, userId } = req.body;

    if (!plan || !userId) {
      return res.status(400).json({ error: 'Plan und User ID erforderlich' });
    }

    if (!PLAN_IDS[plan as keyof typeof PLAN_IDS]) {
      return res.status(400).json({ error: 'Ungültiger Plan' });
    }

    const accessToken = await getPayPalAccessToken();

    // Create Subscription
    const response = await axios.post(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions`,
      {
        plan_id: PLAN_IDS[plan as keyof typeof PLAN_IDS],
        application_context: {
          brand_name: 'Nokki Developer',
          return_url: `${process.env.FRONTEND_URL}/dev-dashboard?payment=success`,
          cancel_url: `${process.env.FRONTEND_URL}/dev-dashboard?payment=cancelled`,
          user_action: 'SUBSCRIBE_NOW',
        },
        custom_id: userId, // Store userId for webhook
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Get approval URL
    const approvalUrl = response.data.links.find((link: any) => link.rel === 'approve')?.href;

    res.json({
      success: true,
      subscriptionId: response.data.id,
      approvalUrl,
    });
  } catch (error: any) {
    console.error('PayPal create subscription error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Fehler beim Erstellen der Subscription',
      details: error.response?.data?.message 
    });
  }
});

// POST /api/payments/webhook - PayPal Webhook Handler
router.post('/webhook', express.json(), async (req: Request, res: Response) => {
  try {
    const event = req.body;

    console.log('?? PayPal Webhook Event:', event.event_type);

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;

      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handleSubscriptionUpdated(event);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await handleSubscriptionCancelled(event);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        console.log('? Payment completed:', event.resource.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(500).send('Webhook Error');
  }
});

// Handle Subscription Activated
async function handleSubscriptionActivated(event: any) {
  try {
    const userId = event.resource.custom_id;
    const subscriptionId = event.resource.id;
    const planId = event.resource.plan_id;

    if (!userId) {
      console.error('? No userId in webhook event');
      return;
    }

    // Determine plan from plan_id
    let plan = 'free';
    if (planId === PLAN_IDS.pro) plan = 'pro';
    if (planId === PLAN_IDS.enterprise) plan = 'enterprise';

    // Update user
    await DevUser.findByIdAndUpdate(userId, {
      plan: plan,
      paypalSubscriptionId: subscriptionId,
      planStartDate: new Date(),
      apiCallsLimit: plan === 'pro' ? 600000 : plan === 'enterprise' ? 999999999 : 60000,
    });

    console.log(`? User ${userId} upgraded to ${plan} plan`);

    // TODO: Send confirmation email
  } catch (error) {
    console.error('Handle subscription activated error:', error);
  }
}

// Handle Subscription Updated
async function handleSubscriptionUpdated(event: any) {
  try {
    const subscriptionId = event.resource.id;
    const status = event.resource.status;

    const user = await DevUser.findOne({ paypalSubscriptionId: subscriptionId });
    if (!user) {
      console.error('? User not found for subscription:', subscriptionId);
      return;
    }

    if (status !== 'ACTIVE') {
      user.plan = 'free';
      user.apiCallsLimit = 60000;
      await user.save();
      console.log(`?? User ${user._id} subscription status: ${status}, downgraded to free`);
    }
  } catch (error) {
    console.error('Handle subscription updated error:', error);
  }
}

// Handle Subscription Cancelled
async function handleSubscriptionCancelled(event: any) {
  try {
    const subscriptionId = event.resource.id;

    const user = await DevUser.findOne({ paypalSubscriptionId: subscriptionId });
    if (!user) {
      console.error('? User not found for subscription:', subscriptionId);
      return;
    }

    user.plan = 'free';
    user.apiCallsLimit = 60000;
    user.paypalSubscriptionId = undefined;
    await user.save();

    console.log(`? User ${user._id} subscription cancelled, downgraded to free`);

    // TODO: Send cancellation email
  } catch (error) {
    console.error('Handle subscription cancelled error:', error);
  }
}

// GET /api/payments/subscription-status - Get current subscription status
router.get('/subscription-status', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    const user = await DevUser.findById(userId);
    if (!user || !user.paypalSubscriptionId) {
      return res.json({ 
        success: true, 
        plan: 'free',
        hasSubscription: false 
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Get subscription details from PayPal
    const response = await axios.get(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${user.paypalSubscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      plan: user.plan,
      hasSubscription: true,
      status: response.data.status,
      nextBillingTime: response.data.billing_info?.next_billing_time,
    });
  } catch (error: any) {
    console.error('Get subscription status error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Fehler beim Laden des Status' });
  }
});

// POST /api/payments/cancel-subscription - Cancel subscription
router.post('/cancel-subscription', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    const user = await DevUser.findById(userId);
    if (!user || !user.paypalSubscriptionId) {
      return res.status(404).json({ error: 'Keine aktive Subscription gefunden' });
    }

    const accessToken = await getPayPalAccessToken();

    // Cancel subscription in PayPal
    await axios.post(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${user.paypalSubscriptionId}/cancel`,
      { reason: 'User requested cancellation' },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update user (webhook will also handle this)
    user.plan = 'free';
    user.apiCallsLimit = 60000;
    user.paypalSubscriptionId = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription erfolgreich gekündigt',
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Fehler beim Kündigen' });
  }
});

export default router;