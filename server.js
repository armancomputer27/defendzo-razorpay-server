require('dotenv').config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const RZP_KEY_ID = process.env.RZP_KEY_ID || "rzp_live_SfI9xBVeNHWIir";
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET || "66HqYM7KHCSZzEg0R3Z7MZZs";

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// ✅ TEST
//////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.send("✅ Defendzo Razorpay Server Running");
});

//////////////////////////////////////////////////////
// 🔥 OLD API (KEEP THIS - APP USE कर रहा होगा)
//////////////////////////////////////////////////////
app.post("/create-subscription", async (req, res) => {
  try {
    const payload = {
      plan_id: "plan_Sfl6vdpmOL6qf9",
      customer_notify: 1,
      total_count: 12
    };

    const response = await axios.post(
      `${RAZORPAY_BASE}/subscriptions`,
      payload,
      {
        auth: {
          username: RZP_KEY_ID,
          password: RZP_KEY_SECRET
        }
      }
    );

    res.json({
      success: true,
      subscriptionId: response.data.id
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
// 🚀 NEW API (MANDATE LINK GENERATE)
//////////////////////////////////////////////////////
app.post("/create
