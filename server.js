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
// 🚀 CREATE MANDATE LINK (₹1 + 2.5% HANDLING FEE)
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

    if (!name || !mobile || !amount || !frequency) {
      return res.status(400).json({
        success: false,
        error: "Missing fields"
      });
    }

    const freq = frequency.toLowerCase();

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
          amount: parseInt(amount * 100), // EMI amount
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
    // 🔥 STEP 2: CALCULATE HANDLING FEE
    //////////////////////////////////////////////////////
    const handlingFee = amount * 0.025;   // 2.5%
    const authAmount = 1;                 // ₹1 auth
    const totalCharge = handlingFee + authAmount;

    //////////////////////////////////////////////////////
    // 🔥 STEP 3: CREATE SUBSCRIPTION WITH ADDON
    //////////////////////////////////////////////////////
    const subRes = await axios.post(
      `${RAZORPAY_BASE}/subscriptions`,
      {
        plan_id: planRes.data.id,
        customer_notify: 1,
        total_count: tenure || 12,

        // 🔥 ONE-TIME CHARGE (₹1 + 2.5%)
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
      `&dealer_name=${encodeURIComponent(dealer_name || "Defendzo Dealer")}` +
      `&customer_name=${encodeURIComponent(name)}` +
      `&mobile=${mobile}` +
      `&amount=${amount}` +
      `&tenure=${tenure}` +
      `&frequency=${frequency}` +
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
