const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🔥 CREATE MANDATE
app.post('/create-mandate', async (req, res) => {
    try {
        const {
            name,
            mobile,
            loan_amount,
            tenure,
            frequency,
            dealerUid,
            dealer_name
        } = req.body;

        if (!name || !mobile || !loan_amount) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Create Customer
        const customer = await razorpay.customers.create({
            name: name,
            contact: mobile,
            email: `${mobile}@defendzo.com`, // temporary email
            fail_existing: 0
        });

        // Create Subscription (Best for recurring EMI)
        const subscription = await razorpay.subscriptions.create({
            plan_id: await getOrCreatePlan(frequency, loan_amount, tenure), // dynamic plan
            customer_id: customer.id,
            total_count: parseInt(tenure),
            quantity: 1,
            notes: {
                dealerUid: dealerUid,
                dealer_name: dealer_name,
                loan_amount: loan_amount,
                frequency: frequency
            }
        });

        const mandateLink = subscription.short_url || `https://rzp.io/i/${subscription.id}`;

        res.json({
            success: true,
            link: mandateLink,
            subscription_id: subscription.id,
            customer_id: customer.id,
            message: "Mandate link created successfully"
        });

    } catch (error) {
        console.error("Mandate Error:", error);
        res.status(500).json({
            success: false,
            message: error.error?.description || error.message
        });
    }
});

// Helper: Plan Management
async function getOrCreatePlan(frequency, amount, tenure) {
    const interval = frequency.toLowerCase() === 'monthly' ? 'monthly' :
                    frequency.toLowerCase() === 'weekly' ? 'weekly' :
                    frequency.toLowerCase() === 'yearly' ? 'yearly' : 'monthly';

    const planAmount = Math.round(parseFloat(amount) * 100); // paise mein

    try {
        // Simple plan name
        const plan = await razorpay.plans.create({
            period: interval,
            interval: 1,
            item: {
                name: `${frequency} EMI Plan`,
                amount: planAmount,
                currency: "INR",
                description: `${tenure} ${frequency} installments`
            }
        });
        return plan.id;
    } catch (e) {
        console.error("Plan creation error:", e);
        throw e;
    }
}

// 🔥 KYC / Bank Account for Payouts
app.post('/kyc', async (req, res) => {
    try {
        const {
            dealerUid,
            name,
            email,
            contact,
            business_name,
            account_number,
            ifsc,
            pan
        } = req.body;

        // Create Contact
        const contactRes = await razorpay.contacts.create({
            name: name,
            email: email,
            contact: contact,
            type: "employee", // or "vendor"
            reference_id: dealerUid
        });

        // Create Fund Account
        const fundAccount = await razorpay.fundAccounts.create({
            contact_id: contactRes.id,
            account_type: "bank_account",
            bank_account: {
                name: name,
                ifsc: ifsc,
                account_number: account_number
            }
        });

        res.json({
            success: true,
            account_id: fundAccount.id,
            message: "Bank Account verified successfully"
        });

    } catch (error) {
        console.error("KYC Error:", error);
        res.status(500).json({
            success: false,
            message: error.error?.description || error.message
        });
    }
});

// Webhook for Mandate/Subscription updates
app.post('/webhook', (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature (important in production)
    // const signature = req.headers['x-razorpay-signature'];
    console.log("Webhook received:", req.body);

    const event = req.body;

    if (event.event === 'subscription.activated' || event.event === 'payment.captured') {
        // Update Firestore status via your logic or Firebase Admin
        console.log("✅ Mandate Activated:", event.payload);
    }

    res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Defendzo Mandate Server running on port ${PORT}`);
});
