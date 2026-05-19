require("dotenv").config();
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

// FIREBASE ADMIN INITIALIZATION
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;
const BASE = "https://api.razorpay.com/v1";

const auth = {
  username: RZP_KEY_ID,
  password: RZP_KEY_SECRET
};

// Root Health Check Route
app.get("/", (req, res) => {
  res.send("✅ Defendzo Server Running");
});

//////////////////////////////////////////////////////
// 1. COMPLETELY OPTIMIZED: DEALER KYC
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

    // Validation Check
    if (!dealerUid || !name || !contact || !account_number || !ifsc) {
      return res.status(400).json({ success: false, error: "missing fields" });
    }

    console.log("Processing KYC for Dealer UID:", dealerUid);

    // Razorpay Route Account Creation Payload Structure
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
        pan: pan || undefined
      },
      bank_account: {
        beneficiary_name: name,
        account_number: account_number,
        ifsc: ifsc
      },
      apps: {
        websites: ["https://defendzo.web.app"],
        tnc_accepted: true // Mandatory legal parameter for automated active verification
      }
    };

    const accountRes = await axios.post(`${BASE}/accounts`, accountPayload, { auth });
    const accountId = accountRes.data.id;

    console.log("ACCOUNT CREATED SUCCESSFULLY:", accountId);

    // Node.js Firebase SDK handles `.doc(id)` securely. Sync with your real database structure
    await db.collection("users").doc(dealerUid).set({
      razorpay_account: accountId, // This mapping is strictly required for Mandates
      kyc_status: "approved", 
      updated: Date.now()
    }, { merge: true });

    res.json({
      success: true,
      account_id: accountId
    });

  } catch (e) {
    console.log("KYC ERROR LOGGED:");
    console.log(e.response?.data || e.message);
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

    // Read Dealer document from Firestore database
    const dealerDoc = await db.collection("users").doc(dealerUid).get();
    if (!dealerDoc.exists) {
      return res.status(404).json({ success: false, error: "Dealer not found in database" });
    }

    const dealer = dealerDoc.data();
    
    // Check if Dealer has undergone successful account link setup
    if (!dealer.razorpay_account) {
      return res.status(400).json({ success: false, error: "KYC not complete or Razorpay account mapping missing" });
    }

    // Fallback handlers mapping precisely to your real Firestore Document schema keys (`name` & `shop_name`)
    const finalDealerName = dealer_name || dealer.name || dealer.shop_name || "Authorized Dealer";

    const loan = parseInt(loan_amount);
    const months = parseInt(tenure);
    const emi = Math.round(loan / months);
    const authCharge = Math.round(loan * 0.025) + 1;

    // Sanitize period context safely
    const normalizedFrequency = frequency ? frequency.toLowerCase().trim() : "monthly";

    console.log(`Creating Plan for EMI Amount: ${emi * 100} Paise`);

    // Step A: Create Recurring Mandate Subscription Plan
    const plan = await axios.post(`${BASE}/plans`, {
      period: normalizedFrequency,
      interval: 1,
      item: {
        name: "Defendzo EMI Plan",
        amount: emi * 100, // Amount structured in paise
        currency: "INR"
      }
    }, { auth });

    console.log("Plan Created, ID:", plan.data.id);

    // Step B: Build Subscription Instance inside Razorpay Engine
    const sub = await axios.post(`${BASE}/subscriptions`, {
      plan_id: plan.data.id,
      customer_notify: 1,
      total_count: months,
      notes: {
        dealerAccount: dealer.razorpay_account, // Retained perfectly for transfer automation routing
        dealerUid: dealerUid
      }
    }, { auth });

    // Step C: Log transaction entity parameters inside Firestore mandates registry
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

    const link = `https://defendzo.web.app/mandate?sub_id=${sub.data.id}&loan=${loan}&emi=${emi}&auth=${authCharge}&dealer=${encodeURIComponent(finalDealerName)}`;

    res.json({
      success: true,
      subscription: sub.data.id,
      link
    });

  } catch (e) {
    console.log("MANDATE ERROR LOGGED:");
    console.log(e.response?.data || e.message);
    res.status(500).json({
      success: false,
      error: e.response?.data || e.message
    });
  }
});

//////////////////////////////////////////////////////
// 3. AUTO-SPLIT PRODUCTION WEBHOOK ROUTE
//////////////////////////////////////////////////////
app.post("/webhook", async (req, res) => {
  try {
    const event = req.body.event;
    console.log("WEBHOOK EVENT RECEIVED:", event);

    if (event === "invoice.paid") {
      const invoice = req.body.payload.invoice.entity;
      const amount = invoice.amount;
      const subId = invoice.subscription_id;

      // Fetch operational metadata notes from the subscription payload
      const sub = await axios.get(`${BASE}/subscriptions/${subId}`, { auth });
      const dealerAccount = sub.data.notes?.dealerAccount;

      if (dealerAccount) {
        // Automatically transfer collected subscription capital to corresponding linked dealer account
        await axios.post(`${BASE}/transfers`, {
          account: dealerAccount,
          amount,
          currency: "INR",
          notes: { type: "EMI_COLLECTION" }
        }, { auth });
        
        console.log(`Successfully split transferred ${amount / 100} INR directly to Linked Account ${dealerAccount}`);
      }
    }
    res.send("ok");
  } catch (e) {
    console.log("WEBHOOK PROCESS ERROR:");
    console.log(e.response?.data || e.message);
    res.status(500).send("error");
  }
});

app.listen(PORT, () => {
  console.log("Defendzo secure node engine active on production port: " + PORT);
});
