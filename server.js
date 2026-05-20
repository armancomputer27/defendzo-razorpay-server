require("dotenv").config();
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const crypto = require("crypto"); 

// FIREBASE ADMIN INITIALIZATION
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;
const RZP_WEBHOOK_SECRET = process.env.RZP_WEBHOOK_SECRET || "DEFENDZO_SECRET_KEY"; 
const BASE = "https://api.razorpay.com/v1";

const auth = {
  username: RZP_KEY_ID,
  password: RZP_KEY_SECRET
};

// Root Health Check Route
app.get("/", (req, res) => {
  res.send("✅ Defendzo Server Running Optimally");
});

//////////////////////////////////////////////////////
// 1. STABLE & SECURED: DEALER KYC
//////////////////////////////////////////////////////
app.post("/dealer-kyc", async (req, res) => {
  try {
    const {
      dealerUid,
      name,
      email,
      contact,
      business_name,
      account_number,
      ifsc,
      pan
    } = req.body;

    if (!dealerUid || !name || !contact || !account_number || !ifsc) {
      return res.status(400).json({ success: false, error: "missing fields" });
    }

    console.log("Processing KYC for Dealer UID:", dealerUid);

    const accountPayload = {
      email: email || "demo@gmail.com",
      phone: contact,
      type: "route",
      reference_id: dealerUid,
      legal_business_name: business_name || name,
      business_type: "individual",
      contact_name: name,
      profile: {
        category: "financial_services",
        subcategory: "lending"
      },
      legal_info: {
        pan: pan ? pan.trim().toUpperCase() : undefined
      },
      bank_account: {
        beneficiary_name: name,
        account_number: account_number.trim(),
        ifsc: ifsc.trim().toUpperCase()
      },
      apps: {
        websites: ["https://defendzo.web.app"],
        tnc_accepted: true 
      }
    };

    const accountRes = await axios.post(`${BASE}/accounts`, accountPayload, { auth });
    const accountId = accountRes.data.id;

    console.log("ACCOUNT CREATED SUCCESSFULLY:", accountId);

    await db.collection("users").doc(dealerUid).set({
      razorpay_account: accountId, 
      kyc_status: "approved", 
      updated: Date.now()
    }, { merge: true });

    res.json({
      success: true,
      account_id: accountId
    });

  } catch (e) {
    console.error("KYC ERROR LOGGED:", e.response?.data || e.message);
    res.status(500).json({
      success: false,
      error: e.response?.data || e.message
    });
  }
});

//////////////////////////////////////////////////////
// 2. FIRESTORE SYNCED: CREATE MANDATE LINK
//////////////////////////////////////////////////////
app.post("/create-mandate-link", async (req, res) => {
  try {
    const {
      name,
      mobile,
      loan_amount,
      tenure,
      frequency,
      dealerUid,
      dealer_name
    } = req.body;

    if (!dealerUid || !loan_amount || !tenure || !frequency) {
      return res.status(400).json({ success: false, error: "Required fields missing" });
    }

    const dealerDoc = await db.collection("users").doc(dealerUid).get();
    if (!dealerDoc.exists) {
      return res.status(404).json({ success: false, error: "Dealer not found in database" });
    }

    const dealer = dealerDoc.data();
    if (!dealer.razorpay_account) {
      return res.status(400).json({ success: false, error: "KYC not complete or Razorpay account mapping missing" });
    }

    const finalDealerName = dealer_name || dealer.name || dealer.shop_name || "Authorized Dealer";
    const loan = parseInt(loan_amount);
    const months = parseInt(tenure);
    const emi = Math.round(loan / months);
    const authCharge = Math.round(loan * 0.025) + 1;
    const normalizedFrequency = frequency ? frequency.toLowerCase().trim() : "monthly";

    console.log(`Creating Plan for EMI Amount: ${emi * 100} Paise`);

    const plan = await axios.post(`${BASE}/plans`, {
      period: normalizedFrequency,
      interval: 1,
      item: {
        name: "Defendzo EMI Plan",
        amount: emi * 100, 
        currency: "INR"
      }
    }, { auth });

    console.log("Plan Created, ID:", plan.data.id);

    const sub = await axios.post(`${BASE}/subscriptions`, {
      plan_id: plan.data.id,
      customer_notify: 1,
      total_count: months,
      notes: {
        dealerAccount: dealer.razorpay_account, 
        dealerUid: dealerUid
      }
    }, { auth });

    await db.collection("mandates").doc(sub.data.id).set({
      customer: name || "Unknown Customer",
      mobile: mobile || "",
      subscription: sub.data.id,
      dealerUid,
      loan_amount: loan,
      emi,
      status: "created",
      timestamp: Date.now()
    });

    const link = `https://defendzo.web.app/mandate?sub_id=${sub.data.id}&loan=${loan}&emi=${emi}&auth=${authCharge}&dealer=${encodeURIComponent(finalDealerName)}&mob=${mobile || ''}`;

    res.json({
      success: true,
      subscription: sub.data.id,
      link
    });

  } catch (e) {
    console.error("MANDATE ERROR LOGGED:", e.response?.data || e.message);
    res.status(500).json({
      success: false,
      error: e.response?.data || e.message
    });
  }
});

//////////////////////////////////////////////////////
// 3. SECURED & INDEPENDENT WEBHOOK PIPELINE
//////////////////////////////////////////////////////
app.post("/webhook", async (req, res) => {
  // Webhook response cleared instantly to avoid timeout blocks
  res.status(200).send("ok");

  try {
    // 🔥 FIX: 'val' ko badal kar Node.js standard 'const' kar diya hai
    const signature = req.headers["x-razorpay-signature"];
    const expectedSignature = crypto
      .createHmac("sha256", RZP_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("⚠️ Webhook Warning: Unauthorized Signature attempt blocked.");
      return;
    }

    const event = req.body.event;
    console.log("Verified Webhook Event Instance:", event);

    if (event === "invoice.paid") {
      const invoice = req.body.payload.invoice.entity;
      const amount = invoice.amount;
      const subId = invoice.subscription_id;

      if (!subId) return;

      const sub = await axios.get(`${BASE}/subscriptions/${subId}`, { auth });
      const dealerAccount = sub.data.notes?.dealerAccount;

      if (dealerAccount) {
        console.log(`Processing split allocation of ${amount / 100} INR to Sub-Account: ${dealerAccount}`);
        
        await axios.post(`${BASE}/transfers`, {
          account: dealerAccount,
          amount: amount, 
          currency: "INR",
          notes: { 
            type: "EMI_COLLECTION",
            linked_subscription: subId
          }
        }, { auth });

        await db.collection("mandates").doc(subId).set({
          status: "active_recurring_paid",
          last_payment_timestamp: Date.now()
        }, { merge: true });

        console.log(`Split Settlement Complete for Account: ${dealerAccount}`);
      }
    }
  } catch (e) {
    console.error("CRITICAL PRODUCTION WEBHOOK ERROR:");
    console.error(e.response?.data || e.message);
  }
});

app.listen(PORT, () => {
  console.log("Defendzo secure node engine active on production port: " + PORT);
});
