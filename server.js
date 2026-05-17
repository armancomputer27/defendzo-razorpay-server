require("dotenv").config();

const express=require("express");
const axios=require("axios");

const admin=require("firebase-admin");

const serviceAccount=
require("./firebase.json");

admin.initializeApp({

credential:
admin.credential.cert(
serviceAccount
)

});

const db=
admin.firestore();

const app=express();

app.use(express.json());

//////////////////////////////////////////////////////

const RZP_KEY_ID=
process.env.RZP_KEY_ID;

const RZP_KEY_SECRET=
process.env.RZP_KEY_SECRET;

const RAZORPAY_BASE=
"https://api.razorpay.com/v1";

//////////////////////////////////////////////////////

app.get("/",(req,res)=>{

res.send(
"Defendzo Running"
)

});

//////////////////////////////////////////////////////
// CREATE DEALER ROUTE ACCOUNT
//////////////////////////////////////////////////////

app.post(
"/dealer-kyc",
async(req,res)=>{

try{

const{

dealerUid,
name,
email,
contact,
business_name,
account_number,
ifsc,
pan

}=req.body;

//////////////////////////////////////////////////////
// CREATE ROUTE ACCOUNT
//////////////////////////////////////////////////////

const routeRes=
await axios.post(

`${RAZORPAY_BASE}/accounts`,

{

email:email,

phone:contact,

type:"route",

reference_id:
dealerUid,

legal_business_name:
business_name,

business_type:
"individual",

contact_name:
name,

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
routeRes.data.id;

//////////////////////////////////////////////////////
// UPDATE KYC
//////////////////////////////////////////////////////

await axios.patch(

`${RAZORPAY_BASE}/accounts/${accountId}`,

{

legal_info:{

pan:pan

},

bank_account:{

ifsc:ifsc,

account_number:
account_number

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
// SAVE FIRESTORE
//////////////////////////////////////////////////////

await db
.collection("users")
.doc(dealerUid)
.update({

razorpay_account:
accountId,

kyc_status:
"submitted"

});

res.json({

success:true,

account_id:
accountId

})

}catch(e){

console.log(
e.response?.data||
e.message
)

res.status(500)
.json({

success:false,

error:
e.response?.data||
e.message

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

loan_amount,

tenure,

frequency,

dealerUid,

dealer_name,

start_date

}=req.body;

//////////////////////////////////////////////////////

const dealerDoc=

await db
.collection("users")
.doc(dealerUid)
.get();

if(!dealerDoc.exists){

return res.json({

success:false

})

}

const dealer=
dealerDoc.data();

const dealerAccount=
dealer.razorpay_account;

if(!dealerAccount){

return res.json({

success:false,
error:
"route missing"

})

}

//////////////////////////////////////////////////////

const loan=
parseInt(
loan_amount
);

const months=
parseInt(
tenure
);

const emi=
Math.round(
loan/months
);

//////////////////////////////////////////////////////
// YOUR PROFIT
//////////////////////////////////////////////////////

const authCharge=

Math.round(
loan*0.025
)+1;

//////////////////////////////////////////////////////
// PLAN
//////////////////////////////////////////////////////

const planRes=
await axios.post(

`${RAZORPAY_BASE}/plans`,

{

period:
frequency.toLowerCase(),

interval:1,

item:{

name:
"Defendzo EMI",

amount:
emi*100,

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
months,

notes:{

dealerAccount:
dealerAccount,

dealerUid:
dealerUid

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

await db
.collection("mandates")
.doc(subRes.data.id)
.set({

customer:name,

mobile,

dealerUid,

subscription:
subRes.data.id,

loan_amount:
loan,

emi,

authCharge,

status:
"created",

timestamp:
Date.now()

})

//////////////////////////////////////////////////////

const link=

`https://defendzo.web.app/mandate`+

`?sub_id=${subRes.data.id}`+

`&name=${name}`+

`&loan=${loan}`+

`&tenure=${months}`+

`&emi=${emi}`+

`&auth=${authCharge}`+

`&dealer=${dealer_name}`+

`&date=${start_date}`;

//////////////////////////////////////////////////////

res.json({

success:true,

subscription:
subRes.data.id,

authCharge,

emi,

link

})

}catch(e){

console.log(
e.response?.data||
e.message
)

res.status(500)
.json({

success:false,

error:
e.response?.data||
e.message

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

console.log(
event
);

//////////////////////////////////////////////////////

if(
event==
"subscription.activated"
){

const sub=

req.body
.payload
.subscription
.entity;

await db
.collection(
"mandates"
)
.doc(sub.id)
.update({

status:
"active"

})

}

//////////////////////////////////////////////////////

if(
event==
"invoice.paid"
){

const invoice=

req.body
.payload
.invoice
.entity;

const amount=
invoice.amount;

const subId=
invoice.subscription_id;

//////////////////////////////////////////////////////

const subRes=
await axios.get(

`${RAZORPAY_BASE}/subscriptions/${subId}`,

{

auth:{

username:
RZP_KEY_ID,

password:
RZP_KEY_SECRET

}

}

);

const dealerAccount=

subRes
.data
.notes
.dealerAccount;

//////////////////////////////////////////////////////
// TRANSFER
//////////////////////////////////////////////////////

await axios.post(

`${RAZORPAY_BASE}/transfers`,

{

account:
dealerAccount,

amount:
amount,

currency:
"INR"

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

await db
.collection(
"emi_history"
)
.add({

subscription:
subId,

dealer:
dealerAccount,

amount:
amount/100,

timestamp:
Date.now()

})

}

//////////////////////////////////////////////////////

if(
event==
"invoice.payment_failed"
){

const invoice=

req.body
.payload
.invoice
.entity;

await db
.collection(
"failed_emi"
)
.add({

subscription:
invoice.subscription_id,

timestamp:
Date.now()

})

}

res.send("ok");

}catch(e){

console.log(
e.response?.data||
e.message
)

res.status(500)
.send("error")

}

});

//////////////////////////////////////////////////////

const PORT=
process.env.PORT||3000;

app.listen(PORT,()=>{

console.log(
"running:"+PORT
)

});
