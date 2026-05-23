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

const RAZORPAY_BASE =
    "https://api.razorpay.com/v1";

//////////////////////////////////////////////////////
// TEST
//////////////////////////////////////////////////////

app.get("/", (req,res)=>{

    res.send(
        "✅ Defendzo Razorpay Server Running"
    );

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
start_date

}=req.body;

//////////////////////////////////////////////////////
// VALIDATION
//////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////
// NORMALIZE
//////////////////////////////////////////////////////

const freq=
frequency.toLowerCase();

const emiAmount=
parseInt(
Number(amount)*100
);

const totalCount=
parseInt(tenure || 12);

//////////////////////////////////////////////////////
// FREQUENCY FIX
//////////////////////////////////////////////////////

let planPeriod="monthly";

let planInterval=1;

switch(freq){

case "daily":

    // Razorpay Daily issue
    // fallback

    planPeriod="weekly";

    planInterval=1;

    break;

case "weekly":

    planPeriod="weekly";

    break;

case "monthly":

    planPeriod="monthly";

    break;

case "yearly":

    planPeriod="yearly";

    break;

default:

    planPeriod="monthly";

}

console.log(
"Frequency:",
freq
);

console.log(
"Mapped:",
planPeriod
);

//////////////////////////////////////////////////////
// STEP 1 PLAN
//////////////////////////////////////////////////////

const planRes=
await axios.post(

`${RAZORPAY_BASE}/plans`,

{

period:
planPeriod,

interval:
planInterval,

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

console.log(
"PLAN CREATED:",
planRes.data.id
);

//////////////////////////////////////////////////////
// START DATE
//////////////////////////////////////////////////////

let startTimestamp;

if(
start_date &&
start_date!=""
){

try{

const parts=
start_date.split("-");

const dateObj=
new Date(
parts[2],
parts[1]-1,
parts[0]
);

startTimestamp=
Math.floor(
dateObj.getTime()/1000
);

}catch{

startTimestamp=
Math.floor(
Date.now()/1000
);

}

}else{

startTimestamp=
Math.floor(
Date.now()/1000
);

}

//////////////////////////////////////////////////////
// STEP 2 SUBSCRIPTION
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
startTimestamp

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
"SUB CREATED:",
subRes.data.id
);

//////////////////////////////////////////////////////
// STEP 3 LINK
//////////////////////////////////////////////////////

const link=

`https://defendzo.web.app/mandate`+

`?sub_id=${subRes.data.id}`+

`&dealer_name=${encodeURIComponent(
dealer_name || "Defendzo Dealer"
)}`+

`&customer_name=${encodeURIComponent(
name
)}`+

`&mobile=${mobile}`+

`&amount=${amount}`+

`&tenure=${totalCount}`+

`&frequency=${frequency}`+

`&date=${encodeURIComponent(
start_date || "Today"
)}`;

//////////////////////////////////////////////////////
// RESPONSE
//////////////////////////////////////////////////////

res.json({

success:true,

subscription_id:
subRes.data.id,

link:link

});

}catch(err){

console.log(
"❌ ERROR"
);

console.log(

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

});

//////////////////////////////////////////////////////
// WEBHOOK
//////////////////////////////////////////////////////

app.post(
"/webhook",

(req,res)=>{

try{

const event=
req.body.event;

console.log(
"🔥 EVENT:",
event
);

if(
event==="subscription.activated"
){

const sub=

req.body.payload
.subscription
.entity;

console.log(
"✅ Mandate Active"
);

console.log(
sub.id
);

}

if(
event==="invoice.paid"
){

const invoice=

req.body.payload
.invoice
.entity;

console.log(
"💰 EMI PAID"
);

console.log(
invoice.subscription_id
);

}

if(
event==="invoice.payment_failed"
){

const invoice=

req.body.payload
.invoice
.entity;

console.log(
"❌ EMI FAILED"
);

console.log(
invoice.subscription_id
);

}

res.status(200)
.send("ok");

}catch(err){

console.log(
"Webhook Error:",
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
process.env.PORT || 3000;

app.listen(

PORT,

()=>{

console.log(

`✅ Server running ${PORT}`

);

}

);
