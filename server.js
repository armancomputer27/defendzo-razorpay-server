require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

//////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;

if (!RZP_KEY_ID || !RZP_KEY_SECRET) {

  console.log("❌ ENV Missing");
  process.exit(1);

}

//////////////////////////////////////////////////////
// AUTH
//////////////////////////////////////////////////////

const AUTH = {

  username: RZP_KEY_ID,
  password: RZP_KEY_SECRET

};

//////////////////////////////////////////////////////
// BASE
//////////////////////////////////////////////////////

const RAZORPAY_V1 =
  "https://api.razorpay.com/v1";

const RAZORPAY_V2 =
  "https://api.razorpay.com/v2";

//////////////////////////////////////////////////////
// TEST
//////////////////////////////////////////////////////

app.get("/", (req, res) => {

  res.send("✅ Defendzo Running");

});

//////////////////////////////////////////////////////
// CREATE LINKED ACCOUNT
//////////////////////////////////////////////////////

app.post(
  "/create-dealer-account",
  async (req, res) => {

    try {

      const {

        dealerUid,
        name,
        email,
        mobile,
        city,
        state,
        pincode,
        shop_name

      } = req.body;

      //////////////////////////////////////////////////////
      // VALIDATION
      //////////////////////////////////////////////////////

      if (
        !dealerUid ||
        !name ||
        !email ||
        !mobile ||
        !city ||
        !state ||
        !pincode
      ) {

        return res.status(400).json({

          success: false,
          error: "Missing fields"

        });

      }

      //////////////////////////////////////////////////////
      // CLEAN DATA
      //////////////////////////////////////////////////////

      const cleanName = name
        .replace(/[^a-zA-Z ]/g, "")
        .trim();

      const cleanShop = (shop_name || "Shop")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .trim();

      //////////////////////////////////////////////////////
      // CREATE ACCOUNT
      //////////////////////////////////////////////////////

      const payload = {

        email: email,

        phone: mobile,

        type: "route",

        reference_id:
          dealerUid.substring(0, 20),

        legal_business_name:
          cleanShop || cleanName,

        contact_name:
          cleanName,

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
                cleanShop,

              street2:
                city,

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
        "CREATE ACCOUNT PAYLOAD =>",
        JSON.stringify(payload, null, 2)
      );

      const response = await axios.post(

        `${RAZORPAY_V2}/accounts`,

        payload,

        {
          auth: AUTH
        }

      );

      //////////////////////////////////////////////////////
      // ENABLE ROUTE PRODUCT
      //////////////////////////////////////////////////////

      try {

        await axios.post(

          `${RAZORPAY_V2}/accounts/${response.data.id}/products`,

          {

            product_name: "route",

            tnc_accepted: true

          },

          {
            auth: AUTH
          }

        );

        console.log("✅ ROUTE ENABLED");

      } catch (e) {

        console.log(
          "ROUTE ALREADY ENABLED"
        );

      }

      //////////////////////////////////////////////////////
      // SUCCESS
      //////////////////////////////////////////////////////

      res.json({

        success: true,

        accountId:
          response.data.id,

        data:
          response.data

      });

    } catch (err) {

      console.log(

        "CREATE ACCOUNT ERROR =>",

        JSON.stringify(
          err.response?.data || err.message,
          null,
          2
        )

      );

      res.status(500).json({

        success: false,

        error:
          err.response?.data || err.message

      });

    }

  }
);

//////////////////////////////////////////////////////
// UPDATE BANK
//////////////////////////////////////////////////////

app.post(
  "/update-dealer-bank",
  async (req, res) => {

    try {

      const {

        accountId,
        bankAccount,
        ifsc,
        beneficiaryName

      } = req.body;

      //////////////////////////////////////////////////////
      // VALIDATION
      //////////////////////////////////////////////////////

      if (
        !accountId ||
        !bankAccount ||
        !ifsc ||
        !beneficiaryName
      ) {

        return res.status(400).json({

          success: false,
          error: "Missing fields"

        });

      }

      //////////////////////////////////////////////////////
      // WAIT
      //////////////////////////////////////////////////////

      await new Promise(
        r => setTimeout(r, 3000)
      );

      //////////////////////////////////////////////////////
      // FETCH PRODUCTS
      //////////////////////////////////////////////////////

      const productRes = await axios.get(

        `${RAZORPAY_V2}/accounts/${accountId}/products`,

        {
          auth: AUTH
        }

      );

      console.log(
        "PRODUCTS =>",
        JSON.stringify(productRes.data, null, 2)
      );

      //////////////////////////////////////////////////////
      // GET PRODUCT ID
      //////////////////////////////////////////////////////

      const routeProduct =
        productRes.data.items.find(

          p => p.product_name === "route"

        );

      if (!routeProduct) {

        return res.status(400).json({

          success: false,
          error: "Route Product Missing"

        });

      }

      const productId =
        routeProduct.id;

      console.log(
        "ROUTE PRODUCT ID =>",
        productId
      );

      //////////////////////////////////////////////////////
      // UPDATE BANK
      //////////////////////////////////////////////////////

      const updateRes = await axios.patch(

        `${RAZORPAY_V2}/accounts/${accountId}/products/${productId}`,

        {

          settlements: {

            account_number:
              bankAccount,

            ifsc_code:
              ifsc,

            beneficiary_name:
              beneficiaryName

          }

        },

        {
          auth: AUTH
        }

      );

      //////////////////////////////////////////////////////
      // SUCCESS
      //////////////////////////////////////////////////////

      res.json({

        success: true,

        message:
          "Bank Updated",

        data:
          updateRes.data

      });

    } catch (err) {

      console.log(

        "BANK UPDATE ERROR =>",

        JSON.stringify(
          err.response?.data || err.message,
          null,
          2
        )

      );

      res.status(500).json({

        success: false,

        error:
          err.response?.data || err.message

      });

    }

  }
);

//////////////////////////////////////////////////////
// CREATE MANDATE
//////////////////////////////////////////////////////

app.post(
  "/create-mandate-link",
  async (req, res) => {

    try {

      const {

        name,
        mobile,
        amount,
        tenure,
        frequency,
        dealer_name,
        dealerAccountId

      } = req.body;

      if (
        !name ||
        !mobile ||
        !amount ||
        !frequency
      ) {

        return res.status(400).json({

          success: false,
          error: "Missing fields"

        });

      }

      //////////////////////////////////////////////////////
      // PERIOD
      //////////////////////////////////////////////////////

      let period = "monthly";

      switch (
        frequency.toLowerCase()
      ) {

        case "weekly":
          period = "weekly";
          break;

        case "yearly":
          period = "yearly";
          break;

      }

      //////////////////////////////////////////////////////
      // CREATE PLAN
      //////////////////////////////////////////////////////

      const planRes = await axios.post(

        `${RAZORPAY_V1}/plans`,

        {

          period: period,

          interval: 1,

          item: {

            name:
              "Defendzo EMI",

            amount:
              parseInt(amount) * 100,

            currency:
              "INR"

          }

        },

        {
          auth: AUTH
        }

      );

      //////////////////////////////////////////////////////
      // CREATE SUBSCRIPTION
      //////////////////////////////////////////////////////

      const subRes = await axios.post(

        `${RAZORPAY_V1}/subscriptions`,

        {

          plan_id:
            planRes.data.id,

          total_count:
            parseInt(tenure || 12),

          customer_notify:
            1,

          notes: {

            dealerAccountId:
              dealerAccountId || ""

          }

        },

        {
          auth: AUTH
        }

      );

      //////////////////////////////////////////////////////
      // LINK
      //////////////////////////////////////////////////////

      const link =

        `https://defendzo.web.app/mandate` +

        `?sub_id=${subRes.data.id}` +

        `&dealer_name=${encodeURIComponent(
          dealer_name || "Dealer"
        )}` +

        `&customer_name=${encodeURIComponent(
          name
        )}` +

        `&mobile=${mobile}` +

        `&amount=${amount}`;

      res.json({

        success: true,

        subscription_id:
          subRes.data.id,

        link

      });

    } catch (err) {

      console.log(

        "MANDATE ERROR =>",

        JSON.stringify(
          err.response?.data || err.message,
          null,
          2
        )

      );

      res.status(500).json({

        success: false,

        error:
          err.response?.data || err.message

      });

    }

  }
);

//////////////////////////////////////////////////////
// WEBHOOK
//////////////////////////////////////////////////////

app.post(
  "/webhook",
  (req, res) => {

    console.log(
      "EVENT =>",
      req.body.event
    );

    res.send("ok");

  }
);

//////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////

app.listen(PORT, () => {

  console.log(
    `🚀 Running on ${PORT}`
  );

});
