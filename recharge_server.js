require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

//////////////////////////////////////////////////////
// ⚙️ ENV CONFIGURATION & KEYS
//////////////////////////////////////////////////////
// Aap in keys ko .env file me bhi rakh sakte hain ya direct yahan se manage kar sakte hain
const PORT = process.env.RECHARGE_PORT || 3001; // Razorpay se alag port (3001) rakha hai
const CYRUS_API_KEY = process.env.CYRUS_API_KEY || "4C4E6480F9";
const CYRUS_MEMBER_ID = process.env.CYRUS_MEMBER_ID || "AP263748";

// Health Check Endpoint
app.get("/", (req, res) => {
  res.send("⚡ Defendzo Dedicated Cyrus Recharge Server is Running!");
});

//////////////////////////////////////////////////////
// 🚀 ENDPOINT 1: LIVE RECHARGE EXECUTION
//////////////////////////////////////////////////////
app.post("/api/cyrus/recharge", async (req, res) => {
  try {
    const { mobile, amount, opCode, lat, long } = req.body;

    // Basic Validations
    if (!mobile || !amount || !opCode) {
      console.log("⚠️ Validation Failed: Missing parameters in request body.");
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields (mobile, amount, or opCode)" 
      });
    }

    const reqId = Date.now(); // Unique request ID via Timestamp
    
    // Cyrus API URL Construction
    const liveUrl = `https://cyrusrecharge.in/api/recharge.aspx?api_key=${CYRUS_API_KEY}&member_id=${CYRUS_MEMBER_ID}&mobile=${mobile}&amount=${amount}&op_code=${opCode}&lat=${lat || "0.0"}&long=${long || "0.0"}&req_id=${reqId}`;

    console.log("\n==================================================");
    console.log(`📡 OUTGOING REQUEST TO CYRUS`);
    console.log(`📱 Mobile: ${mobile} | 💰 Amount: ₹${amount} | 🔢 OpCode: ${opCode}`);
    console.log(`🔗 Request ID: ${reqId}`);
    console.log("==================================================");

    // Hit Cyrus Server
    const cyrusRes = await axios.get(liveUrl);
    const responseData = cyrusRes.data;

    console.log(`🎯 CYRUS RAW RESPONSE FROM SERVER => "${responseData}"`);
    console.log("==================================================\n");

    // Check if response contains generic API error signatures
    const upperRes = responseData.toUpperCase();
    if (upperRes.includes("ERROR") || upperRes.includes("INVALID") || upperRes.includes("NOT WHITELISTED")) {
      return res.json({
        success: false,
        status: "FAILED",
        cyrus_msg: responseData,
        error_details: "Transaction rejected by Cyrus Operator System"
      });
    }

    // Success or Pending responses
    res.json({
      success: true,
      status: "SUCCESS_OR_PENDING",
      cyrus_msg: responseData
    });

  } catch (err) {
    console.error("❌ SERVER EXCEPTION CRASH =>", err.message);
    res.status(500).json({
      success: false,
      error: "Internal Backend Server Error",
      details: err.response?.data || err.message
    });
  }
});

//////////////////////////////////////////////////////
// 🔍 ENDPOINT 2: AUTOMATIC OPERATOR FINDER
//////////////////////////////////////////////////////
app.get("/api/cyrus/find-operator", async (req, res) => {
  try {
    const { mobile } = req.query;
    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ success: false, error: "10-digit mobile number is mandatory" });
    }

    const lookupUrl = `https://cyrusrecharge.in/api/operatorfind.aspx?api_key=${CYRUS_API_KEY}&mobile=${mobile}`;
    
    console.log(`🔍 Fetching Operator details for Mobile: ${mobile}`);
    const infoRes = await axios.get(lookupUrl);
    
    console.log(`🎯 Finder Raw Response => "${infoRes.data}"`);
    res.json({ success: true, raw_data: infoRes.data });

  } catch (err) {
    console.error("❌ OPERATOR LOOKUP EXCEPTION =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//////////////////////////////////////////////////////
// 🌐 START RECHARGE SERVER
//////////////////////////////////////////////////////
app.listen(PORT, () => {
  console.log(`\n🚀 ==================================================`);
  console.log(`⚡ CYRUS RECHARGE SERVER IS ALIVE ON PORT: ${PORT}`);
  console.log(`🎯 Endpoints Ready:`);
  console.log(`   - POST http://localhost:${PORT}/api/cyrus/recharge`);
  console.log(`   - GET  http://localhost:${PORT}/api/cyrus/find-operator`);
  console.log(`====================================================\n`);
});
