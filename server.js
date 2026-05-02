require('dotenv').config();
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// 🔥 FIREBASE INIT
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔥 RAZORPAY KEYS
const RZP_KEY_ID = process.env.RZP_KEY_ID || "rzp_live_SfI9xBVeNHWIir";
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET || "66HqYM7KHCSZzEg0R3Z7MZZs";

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// ✅ TEST
//////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.send("✅ Server Running");
});

//////////////////////////////////////////////////////
// 🚀 CREATE MANDATE (FULL FIX)
//////////////////////////////////////////////////////
app.post("/create-mandate", async (req, res) => {
  try {
    const {
      name,
      mobile,
      amount,
      tenure,
      frequency,
      dealer_id,
      dealer_name
    } = req.body;

    // 🔥 STEP 1: CREATE PLAN
    const planRes = await axios.post(
      `${RAZORPAY_BASE}/plans`,
      {
        period: frequency.toLowerCase(),
        interval: 1,
        item: {
          name: "Defendzo Plan",
          amount: amount * 100,
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

    // 🔥 STEP 2: CREATE SUBSCRIPTION
    const subRes = await axios.post(
      `${RAZORPAY_BASE}/subscriptions`,
      {
        plan_id: planRes.data.id,
        customer_notify: 1,
        total_count: tenure
      },
      {
        auth: {
          username: RZP_KEY_ID,
          password: RZP_KEY_SECRET
        }
      }
    );

    const subId = subRes.data.id;

    // 🔥 STEP 3: CREATE LINK (FIXED)
    const link = `https://defendzo.web.app/mandate?sub_id=${subId}&name=${name}&mobile=${mobile}&amount=${amount}&tenure=${tenure}&dealer_id=${dealer_id}&dealer_name=${dealer_name}`;

    // 🔥 STEP 4: SAVE IN FIRESTORE
    await db.collection("mandates").doc(subId).set({
      sub_id: subId,
      name,
      mobile,
      amount,
      tenure,
      dealer_id,
      dealer_name,
      status: "CREATED",
      createdAt: new Date(),
      link
    });

    res.json({ link });

  } catch (err) {
    console.log("❌ ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: err.response?.data || err.message
    });
  }
});

//////////////////////////////////////////////////////
// 🔥 WEBHOOK (AUTO UPDATE STATUS)
//////////////////////////////////////////////////////
app.post("/webhook", async (req, res) => {

  const event = req.body.event;
  const data = req.body.payload;

  try {

    // ✅ MANDATE SUCCESS
    if (event === "subscription.activated") {
      const subId = data.subscription.entity.id;

      await db.collection("mandates").doc(subId).update({
        status: "ACTIVE"
      });
    }

    // ❌ PAYMENT FAILED
    if (event === "payment.failed") {
      const subId = data.payment.entity.subscription_id;

      await db.collection("mandates").doc(subId).update({
        status: "FAILED"
      });
    }

    // 🚫 CANCELLED
    if (event === "subscription.cancelled") {
      const subId = data.subscription.entity.id;

      await db.collection("mandates").doc(subId).update({
        status: "CANCELLED"
      });
    }

    res.json({ status: "ok" });

  } catch (e) {
    console.log("Webhook Error:", e);
    res.status(500).send("error");
  }
});

//////////////////////////////////////////////////////
// ✅ START SERVER
//////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
