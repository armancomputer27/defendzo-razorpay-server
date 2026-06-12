require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Render & Environment Compatible Port Setup
const PORT = process.env.PORT || process.env.RECHARGE_PORT || 3001;

// Secured Credentials with Fallbacks
const CYRUS_MEMBER_ID = process.env.CYRUS_MEMBER_ID || "AP263748";
const CYRUS_PIN = process.env.CYRUS_PIN || "4C4E6480F9";

// Base URLs from Official Postman Collection Document
const UTILITY_BASE_URL = "https://cyrusrecharge.in/api/GetOperator.aspx";
const RECHARGE_BASE_URL = "https://cyrusrecharge.in/services_cyapi/recharge_cyapi.aspx";
const DISPUTE_BASE_URL = "https://cyrusrecharge.in/api/api_raise_dispute.aspx";
const STATUS_BASE_URL = "https://cyrusrecharge.in/api/rechargestatus.aspx";

// Global Root Health Check for Render Instance
app.get("/", (req, res) => {
  res.send("⚡ Defendzo Cyrus Master Recharge Engine is Live and Fully Operational!");
});

//////////////////////////////////////////////////////
// 🔍 SECURE OPERATOR & CIRCLE FINDER FOR ANDROID APP
//////////////////////////////////////////////////////
app.get("/api/cyrus/find-operator", async (req, res) => {
  try {
    const { mobile } = req.query;
    if (!mobile) {
      return res.status(400).json({ success: false, error: "Mobile number is required" });
    }

    const liveUrl = `https://cyrusrecharge.in/api/operatorfind.aspx?api_key=${CYRUS_PIN}&mobile=${mobile}`;
    const response = await axios.get(liveUrl);
    
    // Cyrus direct string data bhejta hai (e.g., "JIO, Madhya Pradesh")
    res.send(response.data);
  } catch (err) {
    console.error("❌ SECURE OPERATOR FIND ERROR =>", err.message);
    res.status(500).send("Invalid,Error");
  }
});

//////////////////////////////////////////////////////
// 1️⃣ GET CIRCLE LIST
//////////////////////////////////////////////////////
app.get("/api/cyrus/get-circles", async (req, res) => {
  try {
    const liveUrl = `${UTILITY_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getcircle`;
    const response = await axios.get(liveUrl);
    res.json(response.data);
  } catch (err) {
    console.error("❌ GET CIRCLE ERROR =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//////////////////////////////////////////////////////
// 2️⃣ GET OPERATOR LIST
//////////////////////////////////////////////////////
app.get("/api/cyrus/get-operators", async (req, res) => {
  try {
    const liveUrl = `${UTILITY_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getoperator`;
    const response = await axios.get(liveUrl);
    res.json(response.data);
  } catch (err) {
    console.error("❌ GET OPERATOR ERROR =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//////////////////////////////////////////////////////
// 3️⃣ GET BALANCE CHECK
//////////////////////////////////////////////////////
app.get("/api/cyrus/get-balance", async (req, res) => {
  try {
    const liveUrl = `${UTILITY_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getbalance`;
    const response = await axios.get(liveUrl);
    res.json(response.data);
  } catch (err) {
    console.error("❌ GET BALANCE ERROR =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//////////////////////////////////////////////////////
// 4️⃣ RECHARGE REQUEST EXECUTION
//////////////////////////////////////////////////////
app.post("/api/cyrus/recharge", async (req, res) => {
  try {
    const { mobile, amount, operatorCode, circleCode } = req.body;

    if (!mobile || !amount || !operatorCode || !circleCode) {
      return res.status(400).json({ success: false, error: "Missing mobile, amount, operatorCode, or circleCode" });
    }

    // Unique transaction ID generated via timestamp
    const systemTxnId = `TXN${Date.now().toString().slice(-9)}`;

    const liveUrl = `${RECHARGE_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&number=${mobile}&operator=${operatorCode}&circle=${circleCode}&amount=${amount}&usertx=${systemTxnId}&format=json&RechargeMode=1`;

    console.log(`\n📡 FIRING RECHARGE -> Num: ${mobile}, Amt: ${amount}, Op: ${operatorCode}`);
    const response = await axios.get(liveUrl);
    console.log("🎯 CYRUS RESPONSE =>", JSON.stringify(response.data, null, 2));

    res.json({
      success: true,
      system_txn_id: systemTxnId,
      cyrus_raw: response.data
    });

  } catch (err) {
    console.error("❌ RECHARGE CRASH =>", err.message);
    res.status(500).json({ success: false, error: "Internal Server Crash", details: err.message });
  }
});

//////////////////////////////////////////////////////
// 5️⃣ DISPUTE REQUEST
//////////////////////////////////////////////////////
app.post("/api/cyrus/raise-dispute", async (req, res) => {
  try {
    const { transId, reason } = req.body;

    if (!transId || !reason) {
      return res.status(400).json({ success: false, error: "Missing transId or reason" });
    }

    const liveUrl = `${DISPUTE_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&transid=${transId}&reason=${encodeURIComponent(reason)}`;
    
    console.log(`📡 RAISING DISPUTE FOR TRANSID: ${transId}`);
    const response = await axios.get(liveUrl);
    
    res.json({
      success: true,
      message: "Dispute hit executed",
      cyrus_raw: response.data
    });
  } catch (err) {
    console.error("❌ DISPUTE ERROR =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//////////////////////////////////////////////////////
// 6️⃣ STATUS CHECK
//////////////////////////////////////////////////////
app.get("/api/cyrus/status-check", async (req, res) => {
  try {
    const { transId } = req.query;

    if (!transId) {
      return res.status(400).json({ success: false, error: "Missing transId query parameter" });
    }

    const liveUrl = `${STATUS_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&transid=${transId}`;
    
    console.log(`📡 CHECKING RECHARGE STATUS FOR: ${transId}`);
    const response = await axios.get(liveUrl);

    res.json(response.data);
  } catch (err) {
    console.error("❌ STATUS CHECK ERROR =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//////////////////////////////////////////////////////
// 7️⃣ CALLBACK WEBHOOK RECEIVER
//////////////////////////////////////////////////////
app.all("/api/cyrus/callback", (req, res) => {
  try {
    // Fixed: 'val' changed to 'const' to resolve Node.js compilation crash
    const incomingData = Object.keys(req.body).length > 0 ? req.body : req.query;
    
    console.log("\n📬 ======= INCOMING CYRUS CALLBACK WEBHOOK =======");
    console.log("PAYLOAD =>", JSON.stringify(incomingData, null, 2));
    console.log("================================================\n");

    res.status(200).send("SUCCESS");
  } catch (err) {
    console.error("❌ CALLBACK ENGINE ERROR =>", err.message);
    res.status(500).send("ERROR");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Cyrus Master Engine listening securely on port ${PORT}`);
});
