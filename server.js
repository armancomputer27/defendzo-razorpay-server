```javascript
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

//////////////////////////////////////////////////////
// RAW BODY
//////////////////////////////////////////////////////

app.use(express.json({

  verify:(req,res,buf)=>{

    req.rawBody = buf.toString();

  }

}));

//////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////

const {

  RZP_KEY_ID,
  RZP_KEY_SECRET,
  WEBHOOK_SECRET,
  PORT

} = process.env;

if(

  !RZP_KEY_ID ||
  !RZP_KEY_SECRET

){

  console.log("❌ Missing ENV");

  process.exit(1);

}

//////////////////////////////////////////////////////
// AUTH
//////////////////////////////////////////////////////

const AUTH = {

  username:RZP_KEY_ID,
  password:RZP_KEY_SECRET

};

const RAZORPAY_BASE =
"https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// ROOT
//////////////////////////////////////////////////////

app.get("/",(req,res)=>{

  res.send(
    "✅ Defendzo Server Running"
  );

});

//////////////////////////////////////////////////////
// ENGLISH CHECK
//////////////////////////////////////////////////////

function isEnglish(text){

  return /^[A-Za-z0-9 .]+$/.test(text);

}

//////////////////////////////////////////////////////
// CREATE DEALER ACCOUNT
//////////////////////////////////////////////////////

app.post(

  "/create-dealer-account",

  async(req,res)=>{

    try{

      const{

        dealerUid,
        name,
        email,
        mobile,
        city,
        state,
        pincode,
        shop_name

      } = req.body;

      //////////////////////////////////////////////////
      // VALIDATION
      //////////////////////////////////////////////////

      if(

        !dealerUid ||
        !name ||
        !email ||
        !mobile ||
        !city ||
        !state ||
        !pincode

      ){

        return res.status(400).json({

          success:false,
          error:"Missing fields"

        });

      }

      //////////////////////////////////////////////////
      // ENGLISH VALIDATION
      //////////////////////////////////////////////////

      if(!isEnglish(name)){

        return res.status(400).json({

          success:false,
          error:"Name must be in English"

        });

      }

      if(

        shop_name &&
        !isEnglish(shop_name)

      ){

        return res.status(400).json({

          success:false,
          error:"Shop name must be in English"

        });

      }

      //////////////////////////////////////////////////
      // PAYLOAD
      //////////////////////////////////////////////////

      const payload = {

        email: email,

        phone: mobile,

        type: "route",

        reference_id:
        (dealerUid || "dealer")
        .substring(0,20),

        legal_business_name:
        shop_name || name,

        contact_name:
        name,

        business_type:
        "individual",

        profile: {

          category:
          "financial_services",

          subcategory:
          "lending",

          addresses: {

            registered: {

              street1:
              "Shop Address",

              street2:
              "Near Market",

              city:
              city,

              state:
              state,

              postal_code:
              pincode,

              country:
              "IN"

            }

          }

        }

      };

      console.log(

        "PAYLOAD =>",

        JSON.stringify(
          payload,
          null,
          2
        )

      );

      //////////////////////////////////////////////////
      // CREATE ACCOUNT
      //////////////////////////////////////////////////

      const linkedRes = await axios.post(

        "https://api.razorpay.com/v2/accounts",

        payload,

        {

          auth:AUTH

        }

      );

      console.log(

        "ACCOUNT CREATED =>",

        linkedRes.data.id

      );

      //////////////////////////////////////////////////
      // RESPONSE
      //////////////////////////////////////////////////

      res.json({

        success:true,

        accountId:
        linkedRes.data.id,

        data:
        linkedRes.data

      });

    }catch(err){

      console.log(

        "CREATE ACCOUNT ERROR =>",

        JSON.stringify(

          err.response?.data ||
          err.message,

          null,
          2

        )

      );

      res.status(500).json({

        success:false,

        error:
        err.response?.data ||
        err.message

      });

    }

  }

);

//////////////////////////////////////////////////////
// CREATE MANDATE
//////////////////////////////////////////////////////

app.post(

  "/create-mandate-link",

  async(req,res)=>{

    try{

      const{

        name,
        mobile,
        amount,
        tenure,
        frequency,
        dealer_name,
        dealerAccountId,
        start_date

      } = req.body;

      //////////////////////////////////////////////////
      // VALIDATION
      //////////////////////////////////////////////////

      if(

        !name ||
        !mobile ||
        !amount ||
        !frequency

      ){

        return res.status(400).json({

          success:false,
          error:"Missing fields"

        });

      }

      //////////////////////////////////////////////////
      // FREQUENCY
      //////////////////////////////////////////////////

      const freq =
      frequency.toLowerCase();

      let period =
      "monthly";

      switch(freq){

        case "daily":

          period = "weekly";

          break;

        case "weekly":

          period = "weekly";

          break;

        case "monthly":

          period = "monthly";

          break;

        case "yearly":

          period = "yearly";

          break;

      }

      //////////////////////////////////////////////////
      // EMI
      //////////////////////////////////////////////////

      const emiAmount =

      parseInt(
        Number(amount) * 100
      );

      const totalCount =

      parseInt(
        tenure || 12
      );

      //////////////////////////////////////////////////
      // CREATE PLAN
      //////////////////////////////////////////////////

      const planRes = await axios.post(

        `${RAZORPAY_BASE}/plans`,

        {

          period:
          period,

          interval:1,

          item:{

            name:
            "Defendzo EMI",

            amount:
            emiAmount,

            currency:
            "INR"

          }

        },

        {

          auth:AUTH

        }

      );

      //////////////////////////////////////////////////
      // DATE
      //////////////////////////////////////////////////

      let startTimestamp =

      Math.floor(
        Date.now()/1000
      );

      if(start_date){

        try{

          const parts =
          start_date.split("-");

          const dt = new Date(

            parts[2],
            parts[1]-1,
            parts[0]

          );

          startTimestamp =

          Math.floor(
            dt.getTime()/1000
          );

        }catch{}

      }

      //////////////////////////////////////////////////
      // SUBSCRIPTION
      //////////////////////////////////////////////////

      const subRes = await axios.post(

        `${RAZORPAY_BASE}/subscriptions`,

        {

          plan_id:
          planRes.data.id,

          customer_notify:1,

          total_count:
          totalCount,

          start_at:
          startTimestamp,

          notes:{

            dealerAccountId:
            dealerAccountId || ""

          }

        },

        {

          auth:AUTH

        }

      );

      //////////////////////////////////////////////////
      // LINK
      //////////////////////////////////////////////////

      const link =

      `https://defendzo.web.app/mandate`+

      `?sub_id=${subRes.data.id}`+

      `&dealer_name=${encodeURIComponent(
        dealer_name || "Dealer"
      )}`+

      `&customer_name=${encodeURIComponent(
        name
      )}`+

      `&mobile=${mobile}`+

      `&amount=${amount}`;

      //////////////////////////////////////////////////
      // RESPONSE
      //////////////////////////////////////////////////

      res.json({

        success:true,

        subscription_id:
        subRes.data.id,

        link

      });

    }catch(err){

      console.log(

        "MANDATE ERROR =>",

        JSON.stringify(

          err.response?.data ||
          err.message,

          null,
          2

        )

      );

      res.status(500).json({

        success:false,

        error:
        err.response?.data ||
        err.message

      });

    }

  }

);

//////////////////////////////////////////////////////
// WEBHOOK VERIFY
//////////////////////////////////////////////////////

function verifyWebhook(req){

  try{

    const signature =

    req.headers[
      "x-razorpay-signature"
    ];

    const expected =

    crypto

    .createHmac(

      "sha256",

      WEBHOOK_SECRET

    )

    .update(
      req.rawBody
    )

    .digest(
      "hex"
    );

    return(
      signature === expected
    );

  }catch{

    return false;

  }

}

//////////////////////////////////////////////////////
// WEBHOOK
//////////////////////////////////////////////////////

app.post(

  "/webhook",

  async(req,res)=>{

    try{

      //////////////////////////////////////////////////
      // VERIFY
      //////////////////////////////////////////////////

      if(

        WEBHOOK_SECRET &&
        !verifyWebhook(req)

      ){

        return res
        .status(401)
        .send("invalid");

      }

      const event =
      req.body.event;

      console.log(
        "EVENT =>",
        event
      );

      //////////////////////////////////////////////////
      // EMI PAID
      //////////////////////////////////////////////////

      if(
        event === "invoice.paid"
      ){

        const invoice =

        req.body.payload
        .invoice
        .entity;

        const amount =
        invoice.amount;

        const subscriptionId =
        invoice.subscription_id;

        //////////////////////////////////////////////////
        // FETCH SUB
        //////////////////////////////////////////////////

        const subRes = await axios.get(

          `${RAZORPAY_BASE}/subscriptions/${subscriptionId}`,

          {

            auth:AUTH

          }

        );

        const dealerAccountId =

        subRes.data.notes
        ?.dealerAccountId;

        //////////////////////////////////////////////////
        // TRANSFER
        //////////////////////////////////////////////////

        if(dealerAccountId){

          const transferRes =

          await axios.post(

            `${RAZORPAY_BASE}/transfers`,

            {

              account:
              dealerAccountId,

              amount:
              amount,

              currency:
              "INR",

              notes:{

                type:
                "EMI_TRANSFER"

              }

            },

            {

              auth:AUTH

            }

          );

          console.log(

            "TRANSFER SUCCESS =>",

            transferRes.data.id

          );

        }

      }

      res
      .status(200)
      .send("ok");

    }catch(err){

      console.log(

        "WEBHOOK ERROR =>",

        JSON.stringify(

          err.response?.data ||
          err.message,

          null,
          2

        )

      );

      res
      .status(500)
      .send("error");

    }

  }

);

//////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////

app.listen(

  PORT || 3000,

  ()=>{

    console.log(

      `🚀 Running on ${PORT || 3000}`

    );

  }

);
```
