require("dotenv").config();

const express=require("express");
const axios=require("axios");

const app=express();

app.use(express.json());

//////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////

const RZP_KEY_ID=
process.env.RZP_KEY_ID;

const RZP_KEY_SECRET=
process.env.RZP_KEY_SECRET;

const RAZORPAY_BASE=
"https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// TEST
//////////////////////////////////////////////////////

app.get("/",(req,res)=>{

res.send(
"✅ Defendzo Server Running"
);

});

//////////////////////////////////////////////////////
// CREATE DEALER LINKED ACCOUNT
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
!city||
!state||
!pincode

){

return res.status(400)
.json({

success:false,

error:
"Missing fields"

});

}

const payload = {
  email: email,
  phone: mobile,

  type: "route",

  reference_id:
    (dealerUid || "dealer")
    .substring(0,20),

  legal_business_name:
    shop_name || name,

  contact_name: name,

  business_type: "individual",

  profile: {
    category: "financial_services",

    subcategory: "lending",

    addresses: {
      registered: {
        street1:
          shop_name || "Shop",

        street2: city,

        city: city,

        state: state,

        postal_code: pincode,

        country: "IN"
      }
    }
  }
};

const linkedRes=

await axios.post(

"https://api.razorpay.com/v2/accounts",

payload,

{

auth:{

username:
RZP_KEY_ID,

password:
RZP_KEY_SECRET

}

}

);

res.json({

success:true,

accountId:
linkedRes.data.id

});

}catch(err){

console.log(

JSON.stringify(

err.response?.data
||err.message,

null,
2

)

);

res.status(500)

.json({

success:false,

error:

err.response?.data
||err.message

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

name,
mobile,
amount,
tenure,
frequency,
dealer_name,
dealerAccountId,
start_date

}=req.body;

if(

!name||
!mobile||
!amount||
!frequency

){

return res.status(400)
.json({

success:false,
error:"Missing fields"

});

}

const freq=
frequency.toLowerCase();

const emiAmount=
parseInt(
Number(amount)*100
);

const totalCount=
parseInt(
tenure||12
);

let planPeriod=
"monthly";

switch(freq){

case "daily":

planPeriod=
"weekly";

break;

case "weekly":

planPeriod=
"weekly";

break;

case "monthly":

planPeriod=
"monthly";

break;

case "yearly":

planPeriod=
"yearly";

break;

}

//////////////////////////////////////////////////////
// PLAN
//////////////////////////////////////////////////////

const planRes=

await axios.post(

`${RAZORPAY_BASE}/plans`,

{

period:
planPeriod,

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

auth:{

username:
RZP_KEY_ID,

password:
RZP_KEY_SECRET

}

}

);

//////////////////////////////////////////////////////
// DATE
//////////////////////////////////////////////////////

let startTimestamp=
Math.floor(
Date.now()/1000
);

if(
start_date
){

try{

const parts=
start_date
.split("-");

const dt=
new Date(

parts[2],
parts[1]-1,
parts[0]

);

startTimestamp=
Math.floor(

dt.getTime()/1000

);

}catch{}

}

//////////////////////////////////////////////////////
// SUBSCRIPTION
//////////////////////////////////////////////////////

const subRes=

await axios.post(

`${RAZORPAY_BASE}/subscriptions`,

{

plan_id:
planRes.data.id,

customer_notify:
1,

total_count:
totalCount,

start_at:
startTimestamp,

notes:{

dealerAccountId:
dealerAccountId||""

}

},

{

auth:{

username:
RZP_KEY_ID,

password:
RZP_KEY_SECRET

}

}

);

const link=

`https://defendzo.web.app/mandate`+

`?sub_id=${subRes.data.id}`+

`&dealer_name=${encodeURIComponent(
dealer_name||"Dealer"
)}`+

`&customer_name=${encodeURIComponent(
name
)}`+

`&mobile=${mobile}`+

`&amount=${amount}`;

res.json({

success:true,

subscription_id:
subRes.data.id,

link

});

}catch(err){

console.log(

JSON.stringify(

err.response?.data
||err.message,

null,
2

)

);

res.status(500)

.json({

success:false,

error:

err.response?.data
||err.message

});

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

console.log(
"EVENT:",
event
);

//////////////////////////////////////////////////////
// EMI PAID
//////////////////////////////////////////////////////

if(
event==="invoice.paid"
){

const invoice=

req.body.payload
.invoice
.entity;

const amount=
invoice.amount;

const subscriptionId=
invoice.subscription_id;

const subRes=

await axios.get(

`${RAZORPAY_BASE}/subscriptions/${subscriptionId}`,

{

auth:{

username:
RZP_KEY_ID,

password:
RZP_KEY_SECRET

}

}

);

const dealerAccountId=

subRes.data.notes
?.dealerAccountId;

if(
dealerAccountId
){

const transferRes=

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

auth:{

username:
RZP_KEY_ID,

password:
RZP_KEY_SECRET

}

}

);

console.log(

"TRANSFER:",

transferRes.data.id

);

}

}

res.status(200)
.send("ok");

}catch(err){

console.log(
err.message
);

res
.status(500)
.send(
"error"
);

}

});

//////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////

const PORT=
process.env.PORT||3000;

app.listen(

PORT,

()=>{

console.log(

`Running ${PORT}`

);

}

);
