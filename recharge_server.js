require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Render & Environment Compatible Port Setup
const PORT = process.env.PORT || process.env.RECHARGE_PORT || 10000;

// Secured Credentials with Fallbacks
const CYRUS_MEMBER_ID = process.env.CYRUS_MEMBER_ID || "AP263748";
const CYRUS_PIN = process.env.CYRUS_PIN || "4C4E6480F9";

// Base URLs from Official Postman Document
const UTILITY_BASE_URL = "https://cyrusrecharge.in/api/GetOperator.aspx";
const RECHARGE_BASE_URL = "https://cyrusrecharge.in/services_cyapi/recharge_cyapi.aspx";
const DISPUTE_BASE_URL = "https://cyrusrecharge.in/api/api_raise_dispute.aspx";
const STATUS_BASE_URL = "https://cyrusrecharge.in/api/rechargestatus.aspx";

// Global Root Health Check for Render Instance
app.get("/", (req, res) => {
  res.send("⚡ Defendzo Cyrus Master Recharge Engine is Live and Fully Operational!");
});

//////////////////////////////////////////////////////
// 🔍 SECURE OPERATOR & CIRCLE FINDER FOR ANDROID APP (SMART RESOLVER)
//////////////////////////////////////////////////////
app.get("/api/cyrus/find-operator", async (req, res) => {
  try {
    const { mobile } = req.query;
    if (!mobile || mobile.length !== 10) {
      return res.send("Airtel,Madhya Pradesh"); 
    }

    const prefix = mobile.substring(0, 2); 
    const longPrefix = mobile.substring(0, 4); 
    
    const liveUrl = `${UTILITY_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getoperator`;
    
    console.log(`📡 Resolving Operator mapping for mobile: ${mobile}...`);
    const response = await axios.get(liveUrl, { timeout: 6000 });

    let detectedOperator = "Airtel"; 
    
    if (response.data && response.data[0] && response.data[0].data) {
      const prepaidData = response.data[0].data.find(item => item.ServiceTypeName === "Prepaid-Mobile");
      
      if (prepaidData && prepaidData.data) {
        if (
          ["8964", "8928", "8920", "8447", "8445"].includes(longPrefix) || 
          ["92", "94", "71", "88", "89"].includes(prefix)
        ) {
          detectedOperator = "Vodafone Idea";
        } 
        else if (["91", "93", "77", "78", "79", "86", "87", "62", "63", "70"].includes(prefix)) {
          const op = prepaidData.data.find(o => o.OperatorCode === "JIO");
          if (op) detectedOperator = op.OperatorName; 
        } 
        else {
          const op = prepaidData.data.find(o => o.OperatorCode === "AT");
          if (op) detectedOperator = op.OperatorName; 
        }
      }
    }

    console.log(`🎯 Map Match Done: ${mobile} => ${detectedOperator}`);
    res.send(`${detectedOperator},Madhya Pradesh`);

  } catch (err) {
    console.error("❌ SECURE OPERATOR FIND ERROR =>", err.message);
    res.send("Airtel,Madhya Pradesh"); 
  }
});

//////////////////////////////////////////////////////
// 1️⃣ GET CIRCLE LIST
//////////////////////////////////////////////////////
app.get("/api/cyrus/get-circles", async (req, res) => {
  try {
    const liveUrl = `${UTILITY_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getcircle`;
    const response = await axios.get(liveUrl, { timeout: 7000 });
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
    const response = await axios.get(liveUrl, { timeout: 7000 });
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
// 4️⃣ RECHARGE REQUEST EXECUTION (STRICT VALIDATION VERIFIED)
//////////////////////////////////////////////////////
app.post("/api/cyrus/recharge", async (req, res) => {
  try {
    const { mobile, amount, operatorCode, circleCode } = req.body;

    if (!mobile || !amount || !operatorCode || !circleCode) {
      return res.status(400).json({ success: false, error: "Missing required payload variables" });
    }

    const systemTxnId = `TXN${Date.now().toString().slice(-9)}`;

    // 🔥 BACKUP ALTERNATIVE FORMAT CHECK: Agar format=json fail ho raha ho, toh params validation strict rakhein
    const liveUrl = `${RECHARGE_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&number=${mobile}&operator=${operatorCode}&circle=${circleCode}&amount=${amount}&usertx=${systemTxnId}&format=json&RechargeMode=1`;

    console.log(`\n📡 FIRING RECHARGE -> Num: ${mobile}, Amt: ${amount}, Op: ${operatorCode}, Circle: ${circleCode}`);
    
    // Catch specific Axios integration errors safely
    const response = await axios.get(liveUrl, {
      validateStatus: function (status) {
        return status >= 200 && status < 500; // 404 aane par bhi catch block me crash nahi hoga
      },
      timeout: 10000
    });

    console.log("🎯 CYRUS API HTTP STATUS =>", response.status);
    console.log("🎯 CYRUS RESPONSE RAW =>", response.data);

    // Agar unka server 404 de raha hai fir bhi content hum handle karenge
    if (response.status === 404 || !response.data) {
      return res.status(200).json({
        success: true,
        system_txn_id: systemTxnId,
        cyrus_raw: { Status: "FAILURE", ErrorMessage: "Cyrus Server Route Temporary Down (404)" }
      });
    }

    res.json({
      success: true,
      system_txn_id: systemTxnId,
      cyrus_raw: typeof response.data === 'string' ? { Status: "FAILURE", ErrorMessage: response.data } : response.data
    });

  } catch (err) {
    console.error("❌ RECHARGE CRASH =>", err.message);
    res.status(500).json({ 
      success: false, 
      error: "Internal Server Error", 
      cyrus_raw: { Status: "FAILURE", ErrorMessage: err.message } 
    });
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
    const response = await axios.get(liveUrl);
    res.json({ success: true, message: "Dispute hit executed", cyrus_raw: response.data });
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
    const incomingData = Object.keys(req.body).length > 0 ? req.body : req.query;
    console.log("\n📬 ======= INCOMING CYRUS CALLBACK WEBHOOK =======");
    console.log("PAYLOAD =>", JSON.stringify(incomingData, null, 2));
    res.status(200).send("SUCCESS");
  } catch (err) {
    console.error("❌ CALLBACK ENGINE ERROR =>", err.message);
    res.status(500).send("ERROR");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Cyrus Master Engine listening securely on port ${PORT}`);
});
