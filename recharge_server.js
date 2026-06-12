require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Dynamic Port Binding for Render Cloud Environment
const PORT = process.env.PORT || process.env.RECHARGE_PORT || 3001;

// Secured Credentials with Fallback Defaults
const CYRUS_MEMBER_ID = process.env.CYRUS_MEMBER_ID || "AP263748";
const CYRUS_PIN = process.env.CYRUS_PIN || "4C4E6480F9";

// Absolute URLs Extracted from Postman Documentation
const RECHARGE_BASE_URL = "https://cyrusrecharge.in/services_cyapi/recharge_cyapi.aspx";
const UTILITY_BASE_URL = "https://cyrusrecharge.in/api/GetOperator.aspx";

// Health Check Root Route for Render Service Instance Validation
app.get("/", (req, res) => {
  res.send("⚡ Defendzo Cyrus Production Microservice is Live and Running!");
});

//////////////////////////////////////////////////////
// 🚀 ENDPOINT 1: PREPAID RECHARGE TRANSACTION RUNNER
//////////////////////////////////////////////////////
app.post("/api/cyrus/recharge", async (req, res) => {
  try {
    const { mobile, amount, operatorCode, circleCode } = req.body;

    // Strict Request Validation
    if (!mobile || !amount || !operatorCode || !circleCode) {
      return res.status(400).json({
        success: false,
        error: "Bad Request. Required keys missing: mobile, amount, operatorCode, circleCode"
      });
    }

    // System Generated Unique 10-12 Alphanumeric Transaction ID as per Doc specifications
    const systemGeneratedTxn = `TXN${Date.now().toString().slice(-9)}`;

    // Constructing Exact Query String structure requested by Cyrus Framework
    const liveUrl = `${RECHARGE_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&number=${mobile}&operator=${operatorCode}&circle=${circleCode}&amount=${amount}&usertx=${systemGeneratedTxn}&format=json&RechargeMode=1`;

    console.log(`\n📡 OUTBOUND TRANSMISSION TRACE`);
    console.log(`🔗 Target URL: ${liveUrl}`);

    const cyrusResponse = await axios.get(liveUrl);
    
    // Immediate log window on Render Dashboard console terminal
    console.log("🎯 CYRUS PARSED RESPONSE SCHEMA =>", JSON.stringify(cyrusResponse.data, null, 2));

    // Send structure cleanly back to mobile application client environment
    return res.json({
      success: true,
      system_txn_id: systemGeneratedTxn,
      cyrus_raw: cyrusResponse.data
    });

  } catch (err) {
    console.error("❌ CRITICAL RECHARGE CRASH EXCEPTION =>", err.message);
    return res.status(500).json({
      success: false,
      error: "Backend Internal Server Error Exception",
      details: err.message
    });
  }
});

//////////////////////////////////////////////////////
// 🔍 ENDPOINT 2: MASTER CIRCLES DATA SYNC ENDPOINT
//////////////////////////////////////////////////////
app.get("/api/cyrus/get-circles", async (req, res) => {
  try {
    const circleUrl = `${UTILITY_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getcircle`;
    const response = await axios.get(circleUrl);
    return res.json(response.data);
  } catch (err) {
    console.error("❌ MASTER CIRCLES ACCESS EXCEPTION =>", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Activate Express HTTP Engine Listen Node
app.listen(PORT, () => {
  console.log(`🚀 Cyrus Production Node Engine Activated Safely on Port ${PORT}`);
});
