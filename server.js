require("dotenv").config();
const express=require("express");
const axios=require("axios");
const admin=require("firebase-admin");
const crypto=require("crypto");

const app=express();
app.use(express.json());

if(!admin.apps.length){
admin.initializeApp({
credential:admin.credential.cert(
JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
)
})
}

const db=admin.firestore();

const PORT=process.env.PORT||3000;

const BASE="https://api.razorpay.com/v2";

const auth={
username:process.env.RZP_KEY_ID,
password:process.env.RZP_KEY_SECRET
};

////////////////////////////////////////////////////////

app.get("/",(_,res)=>{
res.send("DEFENDZO RUNNING");
});

////////////////////////////////////////////////////////
// DEALER KYC
////////////////////////////////////////////////////////

app.post("/dealer-kyc",async(req,res)=>{

try{

console.log(req.body);

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

if(
!dealerUid||
!name||
!contact||
!account_number||
!ifsc
){
return res.status(400).json({
success:false,
error:"missing fields"
});
}

const accountPayload={

email:email||"test@gmail.com",

phone:contact,

type:"route",

reference_id:dealerUid,

legal_business_name:
business_name||name,

business_type:"individual",

contact_name:name,

profile:{
category:"healthcare"
},

bank_account:{
beneficiary_name:name,
account_number:account_number,
ifsc:ifsc
},

apps:{
websites:[
"https://defendzo.web.app"
]
}
};

if(pan){
accountPayload.legal_info={
pan:pan.toUpperCase()
}
}

const response=
await axios.post(
`${BASE}/accounts`,
accountPayload,
{auth}
);

await db
.collection("users")
.doc(dealerUid)
.set({

razorpay_account:
response.data.id,

kyc_status:"approved",

updated:Date.now()

},{merge:true})

res.json({
success:true,
account_id:
response.data.id
})

}catch(e){

console.log(
e.response?.data||
e.message
)

res.status(500).json({
success:false,
error:
e.response?.data||
e.message
})

}

});

////////////////////////////////////////////////////////
// MANDATE CREATE
////////////////////////////////////////////////////////

app.post(
"/create-mandate-link",
async(req,res)=>{

try{

console.log(req.body);

const{
name,
mobile,
loan_amount,
tenure,
frequency,
dealerUid,
dealer_name
}=req.body;

const dealerDoc=
await db
.collection("users")
.doc(dealerUid)
.get();

if(!dealerDoc.exists){

return res.status(404)
.json({
success:false,
error:"dealer not found"
})

}

const dealer=
dealerDoc.data();

if(
!dealer.razorpay_account
){

return res.status(400)
.json({
success:false,
error:"complete kyc first"
})
}

const loan=
parseInt(loan_amount);

const months=
parseInt(tenure);

const emi=
Math.round(
loan/months
);

const authCharge=
Math.round(
loan*0.025
)+1;

const plan=
await axios.post(
`${BASE}/plans`,
{

period:
frequency.toLowerCase(),

interval:1,

item:{

name:"EMI",

amount:emi*100,

currency:"INR"

}

},
{auth}
);

const sub=
await axios.post(
`${BASE}/subscriptions`,
{

plan_id:
plan.data.id,

customer_notify:1,

total_count:
months,

notes:{

dealerAccount:
dealer.razorpay_account,

dealerUid

}

},

{auth}
);

await db
.collection("mandates")
.doc(sub.data.id)
.set({

customer:name,

mobile,

dealerUid,

loan_amount:loan,

emi,

subscription:
sub.data.id,

status:"created",

timestamp:
Date.now()

});

const link=
`https://defendzo.web.app/mandate?sub_id=${sub.data.id}&loan=${loan}&emi=${emi}&auth=${authCharge}&dealer=${encodeURIComponent(dealer_name||dealer.name)}`;

res.json({
success:true,
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

////////////////////////////////////////////////////////
// WEBHOOK
////////////////////////////////////////////////////////

app.post(
"/webhook",
async(req,res)=>{

res.sendStatus(200);

try{

const event=
req.body.event;

if(
event!=="invoice.paid"
)return;

const invoice=
req.body.payload
.invoice
.entity;

const amount=
invoice.amount;

const subId=
invoice.subscription_id;

const sub=
await axios.get(
`${BASE}/subscriptions/${subId}`,
{auth}
);

const account=
sub.data.notes
.dealerAccount;

await axios.post(
`${BASE}/transfers`,
{

account,

amount,

currency:"INR"

},
{auth}
);

}catch(e){

console.log(
e.response?.data||
e.message
)

}

});

app.listen(PORT,()=>{
console.log("SERVER START");
});
