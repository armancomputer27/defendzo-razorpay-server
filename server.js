require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

////////////////////////////////////////////////////////
// ENV VARIABLES
////////////////////////////////////////////////////////
const PORT = process.env.PORT || 5000;
const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;
const BASE = "https://api.razorpay.com/v1";

if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    console.error("❌ Razorpay Keys missing in environment variables!");
}

////////////////////////////////////////////////////////
// TEST ROUTE
////////////////////////////////////////////////////////
app.get("/", (req, res) => {
    res.send("✅ Defendzo Razorpay Server Running Successfully");
});

////////////////////////////////////////////////////////
// DEALER KYC + ROUTED ACCOUNT
////////////////////////////////////////////////////////
app.post("/dealer-kyc", async (req, res) => {
    console.log("🔥 Dealer KYC Hit", req.body);

    try {
        const { name, email, phone, business_name, dealerUid } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        const accountRes = await axios.post(
            "https://api.razorpay.com/v2/accounts",
            {
                email: email,
                phone: phone,
                type: "route",
                legal_business_name: business_name || name,
                business_type: "individual",
                contact_name: name,
                profile: {
                    category: "services",
                    subcategory: "consulting"
                },
                reference_id: dealerUid
            },
            {
                auth: {
                    username: RZP_KEY_ID,
                    password: RZP_KEY_SECRET
                }
            }
        );

        console.log("✅ Account Created:", accountRes.data.id);

        res.json({
            success: true,
            account_id: accountRes.data.id
        });

    } catch (err) {
        console.error("❌ KYC Error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            error: err.response?.data || err.message
        });
    }
});

////////////////////////////////////////////////////////
// CREATE MANDATE
////////////////////////////////////////////////////////
app.post("/create-mandate-link", async (req, res) => {
    console.log("🔥 Create Mandate Hit", req.body);

    try {
        const {
            name,
            mobile,
            amount,           // loan_amount
            tenure,
            frequency,
            dealer_name,
            dealer_account_id,
            start_date
        } = req.body;

        if (!name || !mobile || !amount || !frequency) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        const emiAmount = Math.round(Number(amount) * 100); // in paise
        const totalCount = parseInt(tenure) || 12;
        const freq = frequency.toLowerCase();

        // 1. Create Plan
        const planRes = await axios.post(`${BASE}/plans`, {
            period: freq,
            interval: 1,
            item: {
                name: `Defendzo ${frequency} EMI`,
                amount: emiAmount,
                currency: "INR"
            }
        }, {
            auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET }
        });

        // 2. Create Subscription
        const subRes = await axios.post(`${BASE}/subscriptions`, {
            plan_id: planRes.data.id,
            customer_notify: 1,
            total_count: totalCount,
            start_at: start_date ? Math.floor(new Date(start_date).getTime() / 1000) : undefined,
            notes: {
                dealer_name: dealer_name,
                dealer_account_id: dealer_account_id,
                customer_name: name,
                mobile: mobile
            }
        }, {
            auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET }
        });

        const razorpayLink = subRes.data.short_url;

        res.json({
            success: true,
            link: razorpayLink,           // Razorpay ka direct link
            subscription_id: subRes.data.id,
            plan_id: planRes.data.id
        });

    } catch (err) {
        console.error("❌ Mandate Creation Error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            error: err.response?.data?.error?.description || err.message
        });
    }
});

////////////////////////////////////////////////////////
// WEBHOOK (Important for Auto Payout)
////////////////////////////////////////////////////////
app.post("/webhook", async (req, res) => {
    try {
        const event = req.body.event;
        console.log("🔥 Webhook Event:", event);

        if (event === "invoice.paid") {
            const invoice = req.body.payload.invoice.entity;
            const subscriptionId = invoice.subscription_id;
            const amount = invoice.amount;

            // Get Subscription details to know dealer
            const subRes = await axios.get(`${BASE}/subscriptions/${subscriptionId}`, {
                auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET }
            });

            const dealerAccountId = subRes.data.notes?.dealer_account_id;

            if (dealerAccountId) {
                // Auto Transfer to Dealer (minus platform fee)
                await axios.post(`${BASE}/transfers`, {
                    account: dealerAccountId,
                    amount: amount - 500, // ₹5 platform fee example
                    currency: "INR",
                    notes: {
                        subscription_id: subscriptionId,
                        type: "emi_payment"
                    }
                }, {
                    auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET }
                });

                console.log(`✅ ₹${amount/100} transferred to dealer ${dealerAccountId}`);
            }
        }

        res.status(200).send("ok");
    } catch (err) {
        console.error("❌ Webhook Error:", err.response?.data || err.message);
        res.status(500).send("error");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Defendzo Server running on port ${PORT}`);
});
