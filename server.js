require('dotenv').config();

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// ✅ TEST
//////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.send("✅ Defendzo Razorpay Server Running");
});

//////////////////////////////////////////////////////
// 🚀 CREATE MANDATE LINK (FINAL PRODUCTION)
//////////////////////////////////////////////////////
app.post("/create-mandate-link", async (req, res) => {
  try {
    const {
      name,
      mobile,
      amount,
      tenure,
      frequency,
      dealer_name,
      dealer_account_id,   // 🔥 IMPORTANT
      start_date
    } = req.body;

    //////////////////////////////////////////////////////
    // ✅ VALIDATION
    //////////////////////////////////////////////////////
    if (!name || !mobile || !amount || !frequency || !dealer_account_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    const freq = frequency.toLowerCase(); // daily/weekly/monthly/yearly

    //////////////////////////////////////////////////////
    // 🔥 STEP 1: CREATE PLAN (EMI ONLY)
    //////////////////////////////////////////////////////
    const planRes = await axios.post(
      `${RAZORPAY_BASE}/plans`,
      {
        period: freq,
        interval: 1,
        item: {
          name: "Defendzo EMI",
          amount: parseInt(amount * 100), // paise
          currency: "INR"
        }
      },
      {
        auth: {
          username: RZP_KEY_ID,
          password: RZP_KEY_SECRET
        }
      }
    );

    //////////////////////////////////////////////////////
    // 🔥 STEP 2: CALCULATE CHARGES
    //////////////////////////////////////////////////////
    const handlingFee = amount * 0.025;   // 2.5%
    const authAmount = 1;                 // ₹1
    const totalCharge = handlingFee + authAmount;

    //////////////////////////////////////////////////////
    // 🔥 STEP 3: CREATE SUBSCRIPTION (AUTO PAYOUT)
    //////////////////////////////////////////////////////
    const subRes = await axios.post(
      `${RAZORPAY_BASE}/subscriptions`,
      {
        plan_id: planRes.data.id,
        customer_notify: 1,
        total_count: tenure || 12,

        // 🔥 AUTO PAYOUT TO DEALER
        transfer_data: {
          destination: dealer_account_id
        },

        // 🔥 ONE TIME CHARGE (₹1 + 2.5%)
        addons: [
          {
            item: {
              name: "Authorization + Handling Fee",
              amount: parseInt(totalCharge * 100),
              currency: "INR"
            }
          }
        ]
      },
      {
        auth: {
          username: RZP_KEY_ID,
          password: RZP_KEY_SECRET
        }
      }
    );

    //////////////////////////////////////////////////////
    // 🔥 STEP 4: CREATE LINK
    //////////////////////////////////////////////////////
    const link =
      `https://defendzo.web.app/mandate` +
      `?sub_id=${subRes.data.id}` +
      `&dealer_name=${encodeURIComponent(dealer_name || "Dealer")}` +
      `&customer_name=${encodeURIComponent(name)}` +
      `&mobile=${mobile}` +
      `&amount=${amount}` +
      `&tenure=${tenure}` +
      `&frequency=${frequency}` +
      `&date=${encodeURIComponent(start_date || "Today")}`;

    //////////////////////////////////////////////////////
    // ✅ RESPONSE
    //////////////////////////////////////////////////////
    res.json({
      success: true,
      link: link,
      subscription_id: subRes.data.id
    });

  } catch (err) {
    console.log("❌ ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

//////////////////////////////////////////////////////
// 🔔 WEBHOOK (PAYMENT TRACKING)
//////////////////////////////////////////////////////
app.post("/webhook", (req, res) => {

  const event = req.body.event;
  console.log("🔥 EVENT:", event);

  //////////////////////////////////////////////////////
  // ✅ MANDATE SUCCESS
  //////////////////////////////////////////////////////
  if (event === "subscription.activated") {
    const sub = req.body.payload.subscription.entity;

    console.log("✅ Mandate Activated:", sub.id);
  }

  //////////////////////////////////////////////////////
  // 💰 EMI PAID
  //////////////////////////////////////////////////////
  if (event === "invoice.paid") {
    const invoice = req.body.payload.invoice.entity;

    console.log("💰 EMI Paid:",
      invoice.amount / 100,
      "Subscription:", invoice.subscription_id
    );

    // 🔥 यहाँ Firestore update कर सकते हो
  }

  //////////////////////////////////////////////////////
  // ❌ EMI FAILED
  //////////////////////////////////////////////////////
  if (event === "invoice.payment_failed") {
    const invoice = req.body.payload.invoice.entity;

    console.log("❌ EMI Failed:",
      invoice.subscription_id
    );
  }

  res.status(200).send("ok");
});

//////////////////////////////////////////////////////
// ✅ START SERVER
//////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
