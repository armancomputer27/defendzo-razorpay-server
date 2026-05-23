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

app.get("/",(req,res)=>{

res.send(
"✅ Defendzo Razorpay Running"
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
ifsc

}=req.body;

if(

!dealerUid ||
!name ||
!email ||
!mobile ||
!bankAccount ||
!ifsc

){

return res.status(400)
.json({

success:false,

error:
"Missing fields"

});

}

//////////////////////////////////////////////////////
// CREATE LINKED ACCOUNT
//////////////////////////////////////////////////////

const linkedRes=

await axios.post(

"https://api.razorpay.com/v2/accounts",

{

email:email,

phone:mobile,

type:"route",

legal_business_name:name,

business_type:"individual",

contact_name:name,

profile:{

category:
"financial_services",

subcategory:
"lending"

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

const accountId=
linkedRes.data.id;

console.log(
"ACCOUNT CREATED:",
accountId
);

//////////////////////////////////////////////////////
// RESPONSE
//////////////////////////////////////////////////////

res.json({

success:true,

accountId:
accountId

});

}catch(err){

console.log(

JSON.stringify(

err.response?.data ||

err.message,

null,
2

)

);

res.status(500)

.json({

success:false,

error:

err.response?.data ||

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

name,
mobile,
amount,
tenure,
frequency,
dealer_name,
start_date,
dealerAccountId

}=req.body;

if(

!name ||
!mobile ||
!amount ||
!frequency

){

return res.status(400)

.json({

success:false,

error:
"Missing"

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
tenure || 12
);

//////////////////////////////////////////////////////
// FREQUENCY
//////////////////////////////////////////////////////

let planPeriod=
"monthly";

let interval=1;

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

default:

planPeriod=
"monthly";

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

interval:
interval,

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
// START DATE
//////////////////////////////////////////////////////

const startTimestamp=

Math.floor(
Date.now()/1000
);

//////////////////////////////////////////////////////
// SUB
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
dealerAccountId ||

""

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
// LINK
//////////////////////////////////////////////////////

const link=

`https://defendzo.web.app/mandate`+

`?sub_id=${subRes.data.id}`+

`&dealer_name=${dealer_name}`+

`&customer_name=${name}`+

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

err.response?.data ||

err.message,

null,
2

)

);

res.status(500)

.json({

success:false,

error:
err.response?.data
||
err.message

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
// MANDATE ACTIVE
//////////////////////////////////////////////////////

if(
event===
"subscription.activated"
){

const sub=

req.body
.payload
.subscription
.entity;

console.log(
"ACTIVE:",
sub.id
);

}

//////////////////////////////////////////////////////
// EMI PAID
//////////////////////////////////////////////////////

if(
event===
"invoice.paid"
){

const invoice=

req.body
.payload
.invoice
.entity;

console.log(
"EMI RECEIVED"
);

const amount=
invoice.amount;

const dealerAccount=

invoice.notes
?.dealerAccountId;

if(
dealerAccount
){

const dealerAmount=

Math.floor(
amount*0.80
);

try{

await axios.post(

`${RAZORPAY_BASE}/transfers`,

{

account:
dealerAccount,

amount:
dealerAmount,

currency:
"INR",

notes:{

subscription:

invoice
.subscription_id

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
"TRANSFER DONE"
);

}catch(e){

console.log(
e.response?.data
);

}

}

}

//////////////////////////////////////////////////////
// EMI FAILED
//////////////////////////////////////////////////////

if(
event===
"invoice.payment_failed"
){

console.log(
"EMI FAILED"
);

}

res
.status(200)
.send("ok");

}catch(err){

console.log(
err.message
);

res
.status(500)
.send("error");

}

});

//////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////

const PORT=
process.env.PORT
||3000;

app.listen(

PORT,

()=>{

console.log(
`Running ${PORT}`
);

}

);
