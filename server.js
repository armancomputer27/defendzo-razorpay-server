require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

//////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////

const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

const AUTH = {
    username: RZP_KEY_ID,
    password: RZP_KEY_SECRET
};

//////////////////////////////////////////////////////

app.get("/", (req,res)=>{

    res.send("✅ Defendzo Server Running")

});

//////////////////////////////////////////////////////
// CREATE DEALER + AUTO KYC
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

bankAccount,
ifsc,
beneficiaryName,
city,
state,
pincode,

shop_name

}=req.body;


if(
!dealerUid ||
!name ||
!email ||
!mobile ||
!bankAccount ||
!ifsc
){

return res.status(400).json({

success:false,
error:"Missing fields"

})

}

//////////////////////////////////////////////////////
// CREATE ACCOUNT
//////////////////////////////////////////////////////

const accountCreate=

await axios.post(

"https://api.razorpay.com/v2/accounts",

{

email:email,

phone:mobile,

type:"route",

reference_id:
dealerUid.substring(0,20),

legal_business_name:
shop_name||name,

contact_name:name,

business_type:
"individual",

customer_facing_business_name:
shop_name||name,

profile:{

category:"financial_services",

subcategory:"lending",

addresses:{

registered:{

street1:"shop",

street2:city,

city:city,

state:state||"CG",

postal_code:
pincode||"493001",

country:"IN"

}

}

}

},

{auth:AUTH}

)

const accountId=
accountCreate.data.id;


//////////////////////////////////////////////////////
// ENABLE ROUTE PRODUCT
//////////////////////////////////////////////////////

await axios.post(

`https://api.razorpay.com/v2/accounts/${accountId}/products`,

{

product_name:"route",

tnc_accepted:true

},

{auth:AUTH}

)

//////////////////////////////////////////////////////
// UPDATE BANK KYC
//////////////////////////////////////////////////////

await axios.patch(

`https://api.razorpay.com/v2/accounts/${accountId}`,

{

profile:{

bank_account:{

name:beneficiaryName,

ifsc:ifsc,

account_number:
bankAccount

}

}

},

{auth:AUTH}

)

//////////////////////////////////////////////////////
// FETCH STATUS
//////////////////////////////////////////////////////

const finalData=

await axios.get(

`https://api.razorpay.com/v2/accounts/${accountId}`,

{auth:AUTH}

)

res.json({

success:true,

accountId,

status:
finalData.data.status,

dashboard_access:
finalData.data.dashboard_access,

data:
finalData.data

})

}catch(err){

console.log(
JSON.stringify(
err.response?.data||
err.message,
null,
2
)
)

res.status(500).json({

success:false,

error:
err.response?.data||
err.message

})

}

});

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
dealerAccountId

}=req.body;

const emi=
parseInt(
Number(amount)*100
);

const count=
parseInt(
tenure||12
);

const plan=

await axios.post(

`${RAZORPAY_BASE}/plans`,

{

period:
frequency.toLowerCase(),

interval:1,

item:{

name:"Defendzo EMI",

amount:emi,

currency:"INR"

}

},

{auth:AUTH}

)

const sub=

await axios.post(

`${RAZORPAY_BASE}/subscriptions`,

{

plan_id:
plan.data.id,

customer_notify:1,

total_count:count,

notes:{

dealerAccountId

}

},

{auth:AUTH}

)

const link=

`https://defendzo.web.app/mandate?sub_id=${sub.data.id}`

res.json({

success:true,
link

})

}catch(err){

res.status(500).json({

success:false,

error:
err.response?.data||
err.message

})

}

});

//////////////////////////////////////////////////////
// WEBHOOK
//////////////////////////////////////////////////////

app.post(

"/webhook",

async(req,res)=>{

try{

const event=
req.body.event;

if(
event==="invoice.paid"
){

const invoice=

req.body.payload
.invoice.entity;

const amount=
invoice.amount;

const subscriptionId=
invoice.subscription_id;

const sub=

await axios.get(

`${RAZORPAY_BASE}/subscriptions/${subscriptionId}`,

{auth:AUTH}

)

const account=

sub.data.notes
?.dealerAccountId;


if(account){

const transfer=

await axios.post(

`${RAZORPAY_BASE}/transfers`,

{

account:account,

amount:amount,

currency:"INR"

},

{auth:AUTH}

)

console.log(
"TRANSFER:",
transfer.data.id
)

}

}

res.send("ok")

}catch(e){

console.log(
e.response?.data||
e.message
)

res.status(500)
.send("error")

}

})

//////////////////////////////////////////////////////

const PORT=
process.env.PORT||3000;

app.listen(PORT,()=>{

console.log(
"Running on "+PORT
)

})
