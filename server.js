require('dotenv').config();

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ❗ ENV से लो (fallback मत रखो production में)
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
// 🚀 CREATE MANDATE LINK (UPDATED)
//////////////////////////////////////////////////////
app.post("/create-mandate-link", async (req, res) => {
  try {
    const {
      name,
      mobile,
      amount,
      tenure,
      frequency,
      dealer_name
    } = req.body;

    // 🔥 SUBSCRIPTION CREATE (same plan use)
    const response = await axios.post(
      `${RAZORPAY_BASE}/subscriptions`,
      {
        plan_id: "plan_Sfl6vdpmOL6qf9",
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

    // 🔥 IMPORTANT FIX (dealer_name + amount pass karo)
    const link =
      `https://defendzo.web.app/mandate` +
      `?sub_id=${response.data.id}` +
      `&name=${encodeURIComponent(dealer_name || name)}` +
      `&mobile=${mobile}` +
      `&amount=${amount}` +
      `&tenure=${tenure}`;

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
// 🔔 WEBHOOK (ADD THIS)
//////////////////////////////////////////////////////
app.post("/webhook", (req, res) => {
  console.log("🔥 EVENT:", req.body.event);

  if (req.body.event === "subscription.activated") {
    console.log("✅ Mandate Activated:", req.body.payload.subscription.entity.id);
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
