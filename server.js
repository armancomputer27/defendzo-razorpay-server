require("dotenv").config();
const express=require("express");
const axios=require("axios");
const admin=require("firebase-admin");

const app=express();
app.use(express.json());

/////////////////////////////////////////////////////
// FIREBASE
/////////////////////////////////////////////////////

if(!admin.apps.length){

admin.initializeApp({

credential:
admin.credential.cert(
JSON.parse(
process.env.FIREBASE_SERVICE_ACCOUNT
))

})

}

const db=admin.firestore();

/////////////////////////////////////////////////////

const PORT=
process.env.PORT||3000;

const BASE=
"https://api.razorpay.com/v1";

const auth={

username:
process.env.RZP_KEY_ID,

password:
process.env.RZP_KEY_SECRET

};

/////////////////////////////////////////////////////

app.get("/",(_,res)=>{

res.send(
"DEFENDZO RUNNING"
);

});

/////////////////////////////////////////////////////
// CREATE MANDATE
/////////////////////////////////////////////////////

app.post(
"/create-mandate-link",
async(req,res)=>{

try{

console.log(
"MANDATE:",
req.body
);

const{

name,
mobile,
loan_amount,
tenure,
frequency

}=req.body;

if(
!name||
!mobile||
!loan_amount||
!tenure
){

return res.status(400)
.json({

success:false,

error:
"missing fields"

})

}

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

const authCharge=
Math.round(
loan*0.025
)+1;

/////////////////////////////////////////////////////
// PLAN
/////////////////////////////////////////////////////

const plan=
await axios.post(

`${BASE}/plans`,

{

period:
frequency.toLowerCase(),

interval:1,

item:{

name:
"EMI Payment",

amount:
emi*100,

currency:
"INR"

}

},

{auth}

);

/////////////////////////////////////////////////////
// SUBSCRIPTION
/////////////////////////////////////////////////////

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

customer:
name,

mobile

}

},

{auth}

);

/////////////////////////////////////////////////////
// SAVE FIRESTORE
/////////////////////////////////////////////////////

await db
.collection("mandates")
.doc(sub.data.id)
.set({

customer:
name,

mobile,

loan_amount:
loan,

emi,

authCharge,

subscription:
sub.data.id,

status:
"created",

timestamp:
Date.now()

});

/////////////////////////////////////////////////////

const link=

sub.data.short_url||
`https://api.razorpay.com/v1/subscriptions/${sub.data.id}`;

res.json({

success:true,

link

});

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

});

}

});

/////////////////////////////////////////////////////
// WEBHOOK
/////////////////////////////////////////////////////

app.post(
"/webhook",
async(req,res)=>{

res.sendStatus(
200
);

try{

console.log(
req.body.event
);

}catch(e){

console.log(e);

}

});

/////////////////////////////////////////////////////

app.listen(
PORT,
()=>{

console.log(
"SERVER START"
)

});
