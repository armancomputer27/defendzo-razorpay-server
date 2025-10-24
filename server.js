require('dotenv').config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const RZP_KEY_ID = process.env.RZP_KEY_ID || "rzp_test_RWd3JPnadgK0Wo";
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET || "cgAikxCZVE4Fm2UDm1p3Dryn";
const RAZORPAY_BASE = "https://api.razorpay.com/v1";

app.get("/", (req, res) => res.send("✅ Defendzo Razorpay Test Server Running"));

app.post("/create-mandate", async (req, res) => {
  try {
    const { customerName, customerMobile, customerEmail, amount, description, type } = req.body;

    if (!customerName || !customerMobile || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const amountPaise = Math.round(Number(amount) * 100);

    const payload = {
      amount: amountPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: `mandate_${Date.now()}`,
      description: description || "E-Mandate Test Link",
      customer: {
        name: customerName,
        contact: customerMobile,
        email: customerEmail || "test@example.com"
      },
      notify: { sms: true, email: true },
      reminder_enable: true,
      notes: { app: "Defendzo", type: type || "" },
      callback_url: "https://example.com",
      callback_method: "get"
    };

    const response = await axios.post(
      `${RAZORPAY_BASE}/payment_links`,
      payload,
      {
        auth: { username: RZP_KEY_ID, password: RZP_KEY_SECRET }
      }
    );

    res.json({
      success: true,
      link: response.data.short_url || response.data.long_url,
      data: response.data
    });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({
      success: false,
      error: err.response ? err.response.data : err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
