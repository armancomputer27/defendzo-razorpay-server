require("dotenv").config();

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

app.use(express.json({
  verify:(req,res,buf)=>{
    req.rawBody=buf.toString();
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
}=process.env;

if(!RZP_KEY_ID || !RZP_KEY_SECRET){

 console.log("Razorpay keys missing");
 process.exit(1);

}

const AUTH={

 username:RZP_KEY_ID,
 password:RZP_KEY_SECRET

};

const RAZORPAY_BASE=
"https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// TEST
//////////////////////////////////////////////////////

app.get("/",(req,res)=>{

 res.send("✅ Defendzo Server Running");

});

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

bankAccount,
ifsc,
beneficiaryName,

city,
state,
pincode,

shop_name

}=req.body;

if(

!dealerUid||
!name||
!email||
!mobile||
!bankAccount||
!ifsc||
!beneficiaryName

){

return res.status(400)
.json({

success:false,
error:"Missing Fields"

});

}

//////////////////////////////////////////////////////
// CREATE LINKED ACCOUNT
//////////////////////////////////////////////////////

const linkedRes=

await axios.post(

"https://api.razorpay.com/v2/accounts",

{

email,

phone:mobile,

type:"route",

reference_id:
dealerUid.substring(0,20),

legal_business_name:
shop_name||name,

contact_name:name,

business_type:
"individual",

profile:{

category:
"financial_services",

subcategory:
"lending",

addresses:{

registered:{

street1:
shop_name||"Shop",

street2:
city,

city,

state,

postal_code:
pincode,

country:"IN"

}

}

}

},

{auth:AUTH}

);

const accountId=
linkedRes.data.id;

//////////////////////////////////////////////////////
// ENABLE ROUTE
//////////////////////////////////////////////////////

await axios.post(

`https://api.razorpay.com/v2/accounts/${accountId}/products`,

{

product_name:"route",

tnc_accepted:true

},

{auth:AUTH}

);

//////////////////////////////////////////////////////
// BANK KYC
//////////////////////////////////////////////////////

try{

await axios.patch(

`https://api.razorpay.com/v2/accounts/${accountId}`,

{

bank_account:{

name:
beneficiaryName,

ifsc:
ifsc,

account_number:
bankAccount

}

},

{auth:AUTH}

);

}catch(e){

console.log(
"KYC ERROR:",
e.response?.data||e.message
);

}

//////////////////////////////////////////////////////
// STATUS
//////////////////////////////////////////////////////

const finalData=

await axios.get(

`https://api.razorpay.com/v2/accounts/${accountId}`,

{auth:AUTH}

);

res.json({

success:true,

accountId,

status:
finalData.data.status,

data:
finalData.data

});

}catch(err){

console.log(
err.response?.data||
err.message
);

res.status(500)
.json({

success:false,

error:
err.response?.data||
err.message

});

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

amount,
tenure,
frequency,
dealerAccountId

}=req.body;

const emi=
Math.round(
Number(amount)*100
);

const total=
parseInt(
tenure||12
);

const plan=

await axios.post(

`${RAZORPAY_BASE}/plans`,

{

period:
frequency,

interval:1,

item:{

name:
"Defendzo EMI",

amount:emi,

currency:"INR"

}

},

{auth:AUTH}

);

const sub=

await axios.post(

`${RAZORPAY_BASE}/subscriptions`,

{

plan_id:
plan.data.id,

customer_notify:1,

total_count:
total,

notes:{

dealerAccountId

}

},

{auth:AUTH}

);

res.json({

success:true,

subscription_id:
sub.data.id

});

}catch(e){

res.status(500)
.json({

error:
e.response?.data||
e.message

});

}

});

//////////////////////////////////////////////////////
// WEBHOOK
//////////////////////////////////////////////////////

function verify(req){

const signature=

req.headers[
"x-razorpay-signature"
];

const expected=

crypto

.createHmac(
"sha256",
WEBHOOK_SECRET
)

.update(
req.rawBody
)

.digest("hex");

return signature===expected;

}

app.post(

"/webhook",

async(req,res)=>{

try{

if(!verify(req)){

return res
.status(401)
.send("invalid");

}

const event=
req.body.event;

if(
event==="invoice.paid"
){

const invoice=

req.body.payload
.invoice
.entity;

console.log(
"PAID:",
invoice.id
);

}

res.send("ok");

}catch(e){

console.log(
e.message
);

res.status(500)
.send("error");

}

});

//////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////

app.listen(

PORT||3000,

()=>{

console.log(
"Running on",
PORT||3000
);

}

);
