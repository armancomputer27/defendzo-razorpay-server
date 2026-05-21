require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(require("cors")());

////////////////////////////////////////////////////////
// ENV
////////////////////////////////////////////////////////
const PORT = process.env.PORT || 5000;
const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;
const BASE = "https://api.razorpay.com/v1";

if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    console.error("❌ Razorpay API Keys missing!");
}

////////////////////////////////////////////////////////
// TEST
////////////////////////////////////////////////////////
app.get("/", (req, res) => {
    res.send("✅ Defendzo Razorpay Server Running");
});

////////////////////////////////////////////////////////
// DEALER KYC
////////////////////////////////////////////////////////
app.post("/dealer-kyc", async (req, res) => {
    try {
        const { name, email, phone, business_name, dealerUid } = req.body;

        const accountRes = await axios.post(
            "https://api.razorpay.com/v2/accounts",
            {
                email,
                phone,
                type: "route",
                legal_business_name: business_name || name,
                business_type: "individual",
                contact_name: name,
                profile: { category: "services", subcategory: "consulting" },
                reference_id: dealerUid
            },
            {
                auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET }
            }
        );

        res.json({
            success: true,
            account_id: accountRes.data.id
        });
    } catch (err) {
        console.error("KYC Error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            error: err.response?.data?.error?.description || err.message
        });
    }
});

////////////////////////////////////////////////////////
// CREATE MANDATE
////////////////////////////////////////////////////////
app.post("/create-mandate-link", async (req, res) => {
    try {
        const {
            name, mobile, amount, tenure, frequency,
            dealer_name, dealer_account_id, start_date
        } = req.body;

        if (!name || !mobile || !amount || !frequency) {
            return res.status(400).json({ success: false, error: "Missing fields" });
        }

        const emiAmount = Math.round(Number(amount) * 100);
        const totalCount = parseInt(tenure) || 12;
        const freq = frequency.toLowerCase();

        // Create Plan
        const planRes = await axios.post(`${BASE}/plans`, {
            period: freq,
            interval: 1,
            item: {
                name: `Defendzo ${frequency} EMI`,
                amount: emiAmount,
                currency: "INR"
            }
        }, { auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET } });

        // Create Subscription
        const subRes = await axios.post(`${BASE}/subscriptions`, {
            plan_id: planRes.data.id,
            customer_notify: 1,
            total_count: totalCount,
            notes: {
                dealer_name,
                dealer_account_id,
                customer_name: name,
                mobile
            }
        }, { auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET } });

        res.json({
            success: true,
            link: subRes.data.short_url,
            subscription_id: subRes.data.id
        });

    } catch (err) {
        console.error("Mandate Error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            error: err.response?.data?.error?.description || err.message
        });
    }
});

////////////////////////////////////////////////////////
// WEBHOOK
////////////////////////////////////////////////////////
app.post("/webhook", async (req, res) => {
    try {
        if (req.body.event === "invoice.paid") {
            const invoice = req.body.payload.invoice.entity;
            const subId = invoice.subscription_id;
            const amount = invoice.amount;

            const subRes = await axios.get(`${BASE}/subscriptions/${subId}`, {
                auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET }
            });

            const dealerAccountId = subRes.data.notes?.dealer_account_id;

            if (dealerAccountId) {
                await axios.post(`${BASE}/transfers`, {
                    account: dealerAccountId,
                    amount: Math.round(amount * 0.95), // 5% platform fee example
                    currency: "INR",
                    notes: { type: "emi" }
                }, { auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET } });
            }
        }
        res.status(200).send("ok");
    } catch (err) {
        console.error("Webhook Error:", err.message);
        res.status(200).send("ok"); // Important: Always return 200 to Razorpay
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
