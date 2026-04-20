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
// 🔥 CREATE SUBSCRIPTION (OLD)
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
// 🚀 CREATE MANDATE LINK (NEW)
//////////////////////////////////////////////////////
app.post("/create-mandate-link", async (req, res) => {
  try {
    const { name, mobile } = req.body;

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

    const link = `https://defendzo.web.app/mandate?sub_id=${response.data.id}&name=${name}&mobile=${mobile}`;

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
// ✅ START SERVER
//////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
