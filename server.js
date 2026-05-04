require('dotenv').config();

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ✅ ENV
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
// 🚀 CREATE MANDATE LINK (DYNAMIC PLAN FIXED)
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
      start_date
    } = req.body;

    // ✅ VALIDATION
    if (!name || !mobile || !amount || !frequency) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // 🔥 NORMALIZE FREQUENCY
    const freq = frequency.toLowerCase(); // daily, weekly, monthly, yearly

    //////////////////////////////////////////////////////
    // 🔥 STEP 1: CREATE PLAN (DYNAMIC)
    //////////////////////////////////////////////////////
    const planRes = await axios.post(
      `${RAZORPAY_BASE}/plans`,
      {
        period: freq,        // 🔥 IMPORTANT
        interval: 1,
        item: {
          name: "Defendzo Mandate",
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
    // 🔥 STEP 2: CREATE SUBSCRIPTION
    //////////////////////////////////////////////////////
    const subRes = await axios.post(
      `${RAZORPAY_BASE}/subscriptions`,
      {
        plan_id: planRes.data.id,
        customer_notify: 1,
        total_count: tenure || 12
      },
      {
        auth: {
          username: RZP_KEY_ID,
          password: RZP_KEY_SECRET
        }
      }
    );

    //////////////////////////////////////////////////////
    // 🔥 STEP 3: CREATE LINK
    //////////////////////////////////////////////////////
    const link =
      `https://defendzo.web.app/mandate` +
      `?sub_id=${subRes.data.id}` +
      `&dealer_name=${encodeURIComponent(dealer_name || "Defendzo Dealer")}` +
      `&customer_name=${encodeURIComponent(name)}` +
      `&mobile=${mobile}` +
      `&amount=${amount}` +
      `&tenure=${tenure}` +
      `&frequency=${frequency}` +   // 🔥 FIX
      `&date=${encodeURIComponent(start_date || "Today")}`;

    res.json({
      success: true,
      link: link
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
// 🔔 WEBHOOK
//////////////////////////////////////////////////////
app.post("/webhook", (req, res) => {

  const event = req.body.event;
  console.log("🔥 EVENT:", event);

  if (event === "subscription.activated") {
    console.log("✅ Mandate Activated:",
      req.body.payload.subscription.entity.id
    );
  }

  if (event === "invoice.paid") {
    console.log("💰 EMI Paid:",
      req.body.payload.invoice.entity.id
    );
  }

  if (event === "invoice.payment_failed") {
    console.log("❌ EMI Failed:",
      req.body.payload.invoice.entity.id
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
