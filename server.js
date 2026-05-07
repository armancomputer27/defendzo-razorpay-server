require('dotenv').config();

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

//////////////////////////////////////////////////////
// ✅ ENV
//////////////////////////////////////////////////////

const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// ✅ TEST ROUTE
//////////////////////////////////////////////////////

app.get("/", (req, res) => {
  res.send("✅ Defendzo Razorpay Server Running");
});

//////////////////////////////////////////////////////
// 🚀 CREATE MANDATE LINK
//////////////////////////////////////////////////////

app.post("/create-mandate-link", async (req, res) => {

  try {

    //////////////////////////////////////////////////////
    // ✅ GET BODY
    //////////////////////////////////////////////////////

    const {
      name,
      mobile,
      amount,
      tenure,
      frequency,
      dealer_name,
      start_date
    } = req.body;

    //////////////////////////////////////////////////////
    // ✅ VALIDATION
    //////////////////////////////////////////////////////

    if (!name || !mobile || !amount || !frequency) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    //////////////////////////////////////////////////////
    // ✅ NORMALIZE DATA
    //////////////////////////////////////////////////////

    const freq = frequency.toLowerCase();

    const emiAmount = parseInt(Number(amount) * 100);

    const totalCount = parseInt(tenure || 12);

    //////////////////////////////////////////////////////
    // 🔥 STEP 1: CREATE PLAN
    //////////////////////////////////////////////////////

    const planRes = await axios.post(
      `${RAZORPAY_BASE}/plans`,
      {
        period: freq,
        interval: 1,

        item: {
          name: "Defendzo EMI",
          amount: emiAmount,
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

        total_count: totalCount
      },
      {
        auth: {
          username: RZP_KEY_ID,
          password: RZP_KEY_SECRET
        }
      }
    );

    //////////////////////////////////////////////////////
    // 🔥 STEP 3: CREATE FRONTEND LINK
    //////////////////////////////////////////////////////

    const link =
      `https://defendzo.web.app/mandate` +
      `?sub_id=${subRes.data.id}` +
      `&dealer_name=${encodeURIComponent(dealer_name || "Defendzo Dealer")}` +
      `&customer_name=${encodeURIComponent(name)}` +
      `&mobile=${mobile}` +
      `&amount=${amount}` +
      `&tenure=${totalCount}` +
      `&frequency=${frequency}` +
      `&date=${encodeURIComponent(start_date || "Today")}`;

    //////////////////////////////////////////////////////
    // ✅ RESPONSE
    //////////////////////////////////////////////////////

    res.json({
      success: true,
      subscription_id: subRes.data.id,
      link: link
    });

  } catch (err) {

    console.log("❌ ERROR:");

    console.log(
      err.response?.data || err.message
    );

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

  try {

    const event = req.body.event;

    console.log("🔥 EVENT:", event);

    //////////////////////////////////////////////////////
    // ✅ MANDATE ACTIVATED
    //////////////////////////////////////////////////////

    if (event === "subscription.activated") {

      const subscription =
        req.body.payload.subscription.entity;

      console.log("✅ Mandate Activated");

      console.log("Subscription ID:", subscription.id);

      console.log("Status:", subscription.status);
    }

    //////////////////////////////////////////////////////
    // 💰 EMI SUCCESS
    //////////////////////////////////////////////////////

    if (event === "invoice.paid") {

      const invoice =
        req.body.payload.invoice.entity;

      console.log("💰 EMI Paid");

      console.log("Invoice ID:", invoice.id);

      console.log("Amount:", invoice.amount / 100);

      console.log("Subscription:", invoice.subscription_id);
    }

    //////////////////////////////////////////////////////
    // ❌ EMI FAILED
    //////////////////////////////////////////////////////

    if (event === "invoice.payment_failed") {

      const invoice =
        req.body.payload.invoice.entity;

      console.log("❌ EMI Failed");

      console.log("Invoice ID:", invoice.id);

      console.log("Subscription:", invoice.subscription_id);
    }

    //////////////////////////////////////////////////////
    // ✅ SUCCESS RESPONSE
    //////////////////////////////////////////////////////

    res.status(200).send("ok");

  } catch (err) {

    console.log("❌ WEBHOOK ERROR:", err.message);

    res.status(500).send("Webhook Error");
  }
});

//////////////////////////////////////////////////////
// ✅ START SERVER
//////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`✅ Server running on port ${PORT}`);

});
