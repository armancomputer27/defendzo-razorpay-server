require("dotenv").config();
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

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

app.get("/", (req, res) => {
  res.send("✅ Defendzo Server Running");
});

//////////////////////////////////////////////////////
// 1. FIXED: DEALER KYC
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

    // 🔥 FIX: Alag se PATCH call lagane ke bajay, Account creation 
    // ke waqt hi legal info, bank details aur T&C accept state payload me bhejein.
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
      // 🔥 CRITICAL COMPLIANCE FIX: Razorpay sub-account creation demands T&C acknowledgment
      apps: {
        websites: ["https://defendzo.web.app"],
        tnc_accepted: true
      }
    };

    const accountRes = await axios.post(`${BASE}/accounts`, accountPayload, { auth });
    const accountId = accountRes.data.id;

    console.log("ACCOUNT CREATED SUCCESSFULLY:", accountId);

    // Save Status to Firebase Firestore
    await db.collection("users").document(dealerUid).set({
      razorpay_account: accountId,
      dealer_name: name,
      business_name: business_name || "",
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
// 2. FIXED: CREATE MANDATE
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
      dealer_name,
      start_date
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
      return res.status(400).json({ success: false, error: "KYC not complete or account mapping missing" });
    }

    const loan = parseInt(loan_amount);
    const months = parseInt(tenure);
    const emi = Math.round(loan / months);
    const authCharge = Math.round(loan * 0.025) + 1;

    // Sanitize period state (Razorpay requires: daily, weekly, monthly, yearly)
    const normalizedFrequency = frequency ? frequency.toLowerCase().trim() : "monthly";

    console.log(`Creating Plan for EMI Amount: ${emi * 100} Paise`);

    // Step A: Create Plan
    const plan = await axios.post(`${BASE}/plans`, {
      period: normalizedFrequency,
      interval: 1,
      item: {
        name: "Defendzo EMI Plan",
        amount: emi * 100, // Amount in paise
        currency: "INR"
      }
    }, { auth });

    console.log("Plan Created, ID:", plan.data.id);

    // Step B: Create Subscription Link
    const sub = await axios.post(`${BASE}/subscriptions`, {
      plan_id: plan.data.id,
      customer_notify: 1,
      total_count: months,
      notes: {
        dealerAccount: dealer.razorpay_account,
        dealerUid: dealerUid
      }
    }, { auth });

    // Step C: Save Details in Firestore Database
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

    const link = `https://defendzo.web.app/mandate?sub_id=${sub.data.id}&loan=${loan}&emi=${emi}&auth=${authCharge}&dealer=${encodeURIComponent(dealer_name || '')}`;

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
// 3. WEBHOOK ROUTE
//////////////////////////////////////////////////////
app.post("/webhook", async (req, res) => {
  try {
    const event = req.body.event;
    console.log("WEBHOOK EVENT RECEIVED:", event);

    if (event === "invoice.paid") {
      const invoice = req.body.payload.invoice.entity;
      const amount = invoice.amount;
      const subId = invoice.subscription_id;

      // Fetch active details to look up linked dealer account
      const sub = await axios.get(`${BASE}/subscriptions/${subId}`, { auth });
      const dealerAccount = sub.data.notes?.dealerAccount;

      if (dealerAccount) {
        await axios.post(`${BASE}/transfers`, {
          account: dealerAccount,
          amount,
          currency: "INR",
          notes: { type: "EMI_COLLECTION" }
        }, { auth });
        console.log(`Successfully split transferred ${amount / 100} INR to Account ${dealerAccount}`);
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
  console.log("Defendzo secure node engine active on port: " + PORT);
});
