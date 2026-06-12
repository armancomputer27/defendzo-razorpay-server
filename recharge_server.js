require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

//////////////////////////////////////////////////////
// ⚙️ UPDATED CREDENTIALS STRUCTURE
//////////////////////////////////////////////////////
const PORT = process.env.RECHARGE_PORT || 3001;

// Naye doc ke mutabik unhone API Key ko 'pin' bola hai aur member_id ko 'memberid'
const CYRUS_MEMBER_ID = process.env.CYRUS_MEMBER_ID || "AP263748";
const CYRUS_PIN = process.env.CYRUS_PIN || "4C4E6480F9"; // Purani API key hi aapka PIN hai

// Base URL as per your new documentation
const CYRUS_BASE_URL = "https://Cyrusrecharge.in/api/GetOperator.aspx";

app.get("/", (req, res) => {
  res.send("⚡ Defendzo Cyrus Server Updated to New API Schema!");
});

//////////////////////////////////////////////////////
// 🚀 ENDPOINT 1: RECHARGE TRANSACTION
//////////////////////////////////////////////////////
app.post("/api/cyrus/recharge", async (req, res) => {
  try {
    const { mobile, amount, opCode } = req.body;

    if (!mobile || !amount || !opCode) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    // Naye format ke hisab se URL parameters set kiye hain
    // Note: Agar unka method recharge ke liye alag hai to wo query string me pass hoga
    const liveUrl = `${CYRUS_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=recharge&mobile=${mobile}&amount=${amount}&op_code=${opCode}&req_id=${Date.now()}`;

    console.log(`\n📡 HIT -> ${liveUrl}`);

    const cyrusRes = await axios.get(liveUrl);
    console.log("🎯 RESPONSE =>", cyrusRes.data);

    res.json({
      success: true,
      data: cyrusRes.data
    });

  } catch (err) {
    console.error("❌ CRASH =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//////////////////////////////////////////////////////
// 🔍 ENDPOINT 2: GET CIRCLE LIST (Based on your shared Doc)
//////////////////////////////////////////////////////
app.get("/api/cyrus/get-circles", async (req, res) => {
  try {
    // Exact URL from your document
    const circleUrl = `${CYRUS_BASE_URL}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PIN}&Method=getcircle`;
    
    console.log(`📡 Fetching Circle List from Cyrus...`);
    const cyrusRes = await axios.get(circleUrl);
    
    // Yeh direct aapko wahi JSON return karega jo aapne mujhe bheja
    res.json(cyrusRes.data);

  } catch (err) {
    console.error("❌ CIRCLE FETCH ERROR =>", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Cyrus Server running on port ${PORT}`);
});
