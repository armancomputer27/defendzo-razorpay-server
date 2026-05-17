require("dotenv").config();

const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

//////////////////////////////////////////////////////
// FIREBASE
//////////////////////////////////////////////////////

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    )
  )
});

const db = admin.firestore();

//////////////////////////////////////////////////////

const app = express();

app.use(express.json());

const PORT =
process.env.PORT || 3000;

const RZP_KEY_ID =
process.env.RZP_KEY_ID;

const RZP_KEY_SECRET =
process.env.RZP_KEY_SECRET;

const BASE =
"https://api.razorpay.com/v1";

//////////////////////////////////////////////////////

const auth = {

username:RZP_KEY_ID,

password:RZP_KEY_SECRET

};

//////////////////////////////////////////////////////

app.get("/",(req,res)=>{

res.send(
"Defendzo Running"
)

});

//////////////////////////////////////////////////////
// DEALER KYC
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

if(
!dealerUid||
!name||
!contact||
!account_number||
!ifsc
){

return res.status(400)
.json({

success:false,
error:"missing fields"

})

}

//////////////////////////////////////////////////////
// CREATE ROUTE ACCOUNT
//////////////////////////////////////////////////////

const route=

await axios.post(

`${BASE}/accounts`,

{

email,

phone:contact,

type:"route",

reference_id:
dealerUid,

legal_business_name:
business_name||name,

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

{auth}

);

const accountId=
route.data.id;

//////////////////////////////////////////////////////
// UPDATE KYC
//////////////////////////////////////////////////////

await axios.patch(

`${BASE}/accounts/${accountId}`,

{

legal_info:{

pan

},

bank_account:{

account_number,

ifsc

}

},

{auth}

);

//////////////////////////////////////////////////////

await db
.collection("users")
.doc(dealerUid)
.set({

razorpay_account:
accountId,

kyc_status:
"submitted"

},{merge:true});

//////////////////////////////////////////////////////

res.json({

success:true,

accountId

})

}catch(e){

console.log(
e.response?.data||
e.message
);

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

const dealerDoc=

await db
.collection("users")
.doc(dealerUid)
.get();

if(!dealerDoc.exists){

return res.json({

success:false,
error:"dealer missing"

})

}

const dealer=
dealerDoc.data();

if(
!dealer.razorpay_account
){

return res.json({

success:false,
error:"route missing"

})

}

//////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////
// PLAN
//////////////////////////////////////////////////////

const plan=

await axios.post(

`${BASE}/plans`,

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

{auth}

);

//////////////////////////////////////////////////////
// SUBSCRIPTION
//////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////

await db
.collection("mandates")
.doc(sub.data.id)
.set({

customer:name,

mobile,

subscription:
sub.data.id,

dealerUid,

loan_amount:loan,

emi,

authCharge,

status:"created",

timestamp:
Date.now()

});

//////////////////////////////////////////////////////

const link=

`https://defendzo.web.app/mandate?sub_id=${sub.data.id}&loan=${loan}&emi=${emi}&auth=${authCharge}&tenure=${months}&dealer=${dealer_name}&date=${start_date}`;

//////////////////////////////////////////////////////

res.json({

success:true,

subscription:
sub.data.id,

emi,

authCharge,

link

})

}catch(e){

console.log(
e.response?.data||
e.message
);

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
"EVENT:",
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

const sub=

await axios.get(

`${BASE}/subscriptions/${subId}`,

{auth}

);

const dealerAccount=

sub.data.notes
.dealerAccount;

//////////////////////////////////////////////////////
// TRANSFER
//////////////////////////////////////////////////////

await axios.post(

`${BASE}/transfers`,

{

account:
dealerAccount,

amount,

currency:"INR",

notes:{

type:"EMI"

}

},

{auth}

);

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
);

res
.status(500)
.send("error");

}

});

//////////////////////////////////////////////////////

app.listen(
PORT,
()=>{

console.log(
"running:"+PORT
)

});
