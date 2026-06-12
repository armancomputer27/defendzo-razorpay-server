require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Render and Local Environment Compatible Port
const PORT = process.env.PORT || process.env.RECHARGE_PORT || 3001;

// Credentials from Environment or Fallback Defaults
const CYRUS_MEMBER_ID = process.env.CYRUS_MEMBER_ID || "AP263748";
const CYRUS_PIN = process.env.CYRUS_PIN || "4C4E6480F9"; 

// 🔥 Exact Base URLs from your shared documentation
const RECHARGE_URL = "https://cyrusrecharge.in/services_cyapi/recharge_cyapi.aspx";
const UTILITY_URL = "https://Cyrusrecharge.in/api/GetOperator.aspx";

// Health Check Endpoint for Render
app.get("/", (req, res) => {
  res.send("⚡ Defendzo Cyrus Production Server is Live and Ready!");
});

//////////////////////////////////////////////////////
// 🚀 ENDPOINT 1: LIVE RECHARGE EXECUTION (As per Doc)
//////////////////////////////////////////////////////
app.post("/api/cyrus/recharge", async (req, res) => {
  try {
    // Android App se dynamic parameters le rahe hain
    const { mobile, amount, opCode, circleCode } = req.body;

    if (!mobile || !amount || !opCode) {
      return res.status(400).json({ success: false, error: "Missing required parameters (mobile, amount, or opCode)" });
    }

    // Creating a clean unique 10-12 alphanumeric txn ID using timestamp
    const userTxnId = `TXN${Date.now().toString().slice(-9)}`;

    // 🔥 Building exact Query string as per your shared text documentation
    const liveUrl = `${RECHARGE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&number=${mobile}&operator=${opCode}&circle=${circleCode || "19"}&amount=${amount}&usertx=${userTxnId}&format=json&RechargeMode=1`;

    console.log(`\n📡 FIRING RECHARGE REQUEST`);
    console.log(`📱 Number: ${mobile} | Code: ${opCode} | Amt: ₹${amount} | TxID: ${userTxnId}`);
    
    // Hitting Cyrus Server
    const cyrusRes = await axios.get(liveUrl);
    
    // Direct log for debugging on Render Dashboard
    console.log("🎯 CYRUS RESPONSE =>", JSON.stringify(cyrusRes.data, null, 2));

    // Response send to Android Application
    res.json({
      success: true,
      cyrus_raw: cyrusRes.data
    });

  } catch (err) {
    console.error("❌ BACKEND EXCEPTION =>", err.message);
    res.status(500).json({ success: false, error: "Internal Server Crash", details: err.message });
  }
});

//////////////////////////////////////////////////////
// 🔍 ENDPOINT 2: GET CIRCLE LIST
//////////////////////////////////////////////////////
app.get("/api/cyrus/get-circles", async (req, res) => {
  try {
    const circleUrl = `${UTILITY_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getcircle`;
    const cyrusRes = await axios.get(circleUrl);
    res.json(cyrusRes.data);
  } catch (err) {
    console.error("❌ CIRCLE FETCH ERROR =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Dedicated Recharge Server operational on port ${PORT}`);
});
