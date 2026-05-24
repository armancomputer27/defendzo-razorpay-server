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

const AUTH={

username:RZP_KEY_ID,
password:RZP_KEY_SECRET

};

//////////////////////////////////////////////////////
// TEST
//////////////////////////////////////////////////////

app.get("/",(req,res)=>{

res.send(
"✅ Defendzo Server Running"
);

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
!ifsc

){

return res.status(400)
.json({

success:false,
error:"Missing fields"

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

reference_id:
(dealerUid||"dealer")
.substring(0,20),

legal_business_name:
shop_name||name,

contact_name:
name,

business_type:
"individual",

customer_facing_business_name:
shop_name||name,

dashboard_access:true,

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

},

{auth:AUTH}

);

const accountId=
linkedRes.data.id;

//////////////////////////////////////////////////////
// ADD BANK
//////////////////////////////////////////////////////

try{

await axios.patch(

`https://api.razorpay.com/v2/accounts/${accountId}`,

{

bank_account:{

name:name,

ifsc:ifsc,

account_number:
bankAccount

}

},

{auth:AUTH}

);

}catch(e){

console.log(
"BANK ERROR",
e.response?.data
);

}

//////////////////////////////////////////////////////
// REQUEST ROUTE PRODUCT
//////////////////////////////////////////////////////

try{

await axios.post(

`https://api.razorpay.com/v2/accounts/${accountId}/products`,

{

product_name:
"route",

tnc_accepted:true

},

{auth:AUTH}

);

}catch(e){

console.log(

"PRODUCT ERROR",

e.response?.data

);

}

res.json({

success:true,

accountId:
accountId

});

}catch(err){

console.log(

JSON.stringify(

err.response?.data
||
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

switch(
frequency.toLowerCase()
){

case "daily":

planPeriod=
"weekly";

break;

case "weekly":

planPeriod=
"weekly";

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

{auth:AUTH}

);

//////////////////////////////////////////////////////
// DATE
//////////////////////////////////////////////////////

let startTimestamp=
Math.floor(
Date.now()/1000
);

if(start_date){

try{

const p=
start_date
.split("-");

const dt=
new Date(
p[2],
p[1]-1,
p[0]
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

customer_notify:1,

total_count:
totalCount,

start_at:
startTimestamp,

notes:{

dealerAccountId:
dealerAccountId||""

}

},

{auth:AUTH}

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
err.response?.data
||
err.message
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

if(
event==="invoice.paid"
){

const invoice=

req.body
.payload
.invoice
.entity;

const amount=
invoice.amount;

const subscriptionId=
invoice.subscription_id;

const subRes=

await axios.get(

`${RAZORPAY_BASE}/subscriptions/${subscriptionId}`,

{auth:AUTH}

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

{auth:AUTH}

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

res.status(500)
.send("error");

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
