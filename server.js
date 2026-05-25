require("dotenv").config();

const express=require("express");
const axios=require("axios");
const crypto=require("crypto");

const app=express();

app.use(express.json({

verify:(req,res,buf)=>{

req.rawBody=buf.toString();

}

}));

//////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////

const{

RZP_KEY_ID,
RZP_KEY_SECRET,
WEBHOOK_SECRET,
PORT

}=process.env;

if(

!RZP_KEY_ID ||
!RZP_KEY_SECRET ||
!WEBHOOK_SECRET

){

console.log("❌ Missing ENV");

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

res.send(
"✅ Defendzo Running"
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

businessName,
businessType,

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

!businessName ||
!businessType ||

!bankAccount ||
!ifsc ||
!beneficiaryName ||

!city ||
!state ||
!pincode

){

return res.status(400)

.json({

success:false,
error:"Missing Fields"

});

}

console.log({

dealerUid,
name,
email,
mobile,
businessName,
businessType,
bankAccount,
ifsc,
beneficiaryName

});

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
(dealerUid||"dealer")
.substring(0,20),

legal_business_name:
businessName || shop_name || name,

contact_name:
name,

business_type:
businessType,

profile:{

category:
"financial_services",

subcategory:
"lending",

addresses:{

registered:{

street1:
businessName,

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

console.log(
"ACCOUNT CREATED:",
accountId
);

//////////////////////////////////////////////////////
// ENABLE ROUTE
//////////////////////////////////////////////////////

await axios.post(

`https://api.razorpay.com/v2/accounts/${accountId}/products`,

{

product_name:"route",

tnc_accepted:{
accepted:true
}

},

{auth:AUTH}

);

console.log(
"ROUTE ENABLED"
);

//////////////////////////////////////////////////////
// WAIT UNTIL ROUTE READY
//////////////////////////////////////////////////////

let routeReady=false;

for(

let i=0;
i<5;
i++

){

try{

const check=

await axios.get(

`https://api.razorpay.com/v2/accounts/${accountId}/products`,

{auth:AUTH}

);

const route=

check.data.items
?.find(

x=>

x.product_name==="route"

);

if(route){

routeReady=true;

break;

}

}catch(e){

console.log(
"WAIT..."
);

}

await new Promise(

r=>setTimeout(
r,
2000
)

);

}

if(!routeReady){

throw new Error(

"Route product not ready"

);

}

//////////////////////////////////////////////////////
// UPDATE BANK
//////////////////////////////////////////////////////

try{

const bankRes=

await axios.patch(

`https://api.razorpay.com/v2/accounts/${accountId}/products/route`,

{

settlements:{

account_number:
bankAccount,

ifsc_code:
ifsc,

beneficiary_name:
beneficiaryName

}

},

{auth:AUTH}

);

console.log(

"SETTLEMENT UPDATED"

);

console.log(

JSON.stringify(
bankRes.data,
null,
2
)

);

}catch(e){

console.log(

"ROUTE ERROR",

JSON.stringify(
e.response?.data ||
e.message,
null,
2
)

);

}

//////////////////////////////////////////////////////
// FETCH FINAL
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

}catch(e){

console.log(

JSON.stringify(

e.response?.data||
e.message,

null,
2

)

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

const allowed=[

"daily",
"weekly",
"monthly",
"yearly"

];

if(

!allowed.includes(
frequency.toLowerCase()
)

){

return res.status(400)

.json({

success:false,
error:"Invalid"

});

}

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

amount:
emi,

currency:
"INR"

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

const link=

`https://defendzo.web.app/mandate?sub_id=${sub.data.id}`;

res.json({

success:true,

subscription_id:
sub.data.id,

link

});

}catch(e){

res.status(500)

.json({

success:false,

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

.digest(
"hex"
);

return(
signature===expected
);

}

app.post(

"/webhook",

(req,res)=>{

if(
!verify(req)
){

return res
.status(401)
.send(
"invalid"
);

}

console.log(
req.body.event
);

res.send(
"ok"
);

});

//////////////////////////////////////////////////////

app.listen(

PORT||3000,

()=>{

console.log(

"🚀 Running on",

PORT||3000

);

}

);
