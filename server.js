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

const {
 RZP_KEY_ID,
 RZP_KEY_SECRET,
 WEBHOOK_SECRET,
 PORT
}=process.env;

const AUTH={

 username:RZP_KEY_ID,
 password:RZP_KEY_SECRET

};

const RAZORPAY_BASE=
"https://api.razorpay.com/v1";

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
error:"Missing fields"

});

}

//////////////////////////////////////////////////////
// CREATE LINKED ACCOUNT
//////////////////////////////////////////////////////

const accountRes=

await axios.post(

"https://api.razorpay.com/v2/accounts",

{

email:email,

phone:mobile,

type:"route",

reference_id:
dealerUid.substring(0,20),

legal_business_name:
shop_name||name,

contact_name:name,

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

city:city,

state:state,

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
accountRes.data.id;

//////////////////////////////////////////////////////
// ENABLE ROUTE
//////////////////////////////////////////////////////

const productRes=

await axios.post(

`https://api.razorpay.com/v2/accounts/${accountId}/products`,

{

product_name:"route",

tnc_accepted:true

},

{auth:AUTH}

);

//////////////////////////////////////////////////////
// ADD BANK DETAILS
//////////////////////////////////////////////////////

try{

await axios.patch(

`https://api.razorpay.com/v2/accounts/${accountId}`,

{

bank_account:{

name:
beneficiaryName,

account_number:
bankAccount,

ifsc:
ifsc

}

},

{auth:AUTH}

);

}catch(e){

console.log(
"BANK ERROR:",
JSON.stringify(
e.response?.data||
e.message,
null,
2
));

}

//////////////////////////////////////////////////////
// CREATE KYC LINK
//////////////////////////////////////////////////////

let kycLink="";

try{

const onboard=

await axios.post(

`https://api.razorpay.com/v2/accounts/${accountId}/products/${productRes.data.id}/onboarding_links`,

{

platform_name:
"Defendzo",

redirect_url:
"https://defendzo.web.app/kyc-success"

},

{auth:AUTH}

);

kycLink=
onboard.data.short_url;

}catch(e){

console.log(
"KYC LINK ERROR",
e.response?.data
);

}

//////////////////////////////////////////////////////
// ACCOUNT STATUS
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

kycLink,

data:
finalData.data

});

}catch(err){

console.log(
JSON.stringify(
err.response?.data||
err.message,
null,
2
)
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

let period=
"monthly";

switch(
frequency.toLowerCase()
){

case "daily":
period="weekly";
break;

case "weekly":
period="weekly";
break;

case "monthly":
period="monthly";
break;

case "yearly":
period="yearly";
break;

}

const plan=

await axios.post(

`${RAZORPAY_BASE}/plans`,

{

period:period,

interval:1,

item:{

name:"Defendzo EMI",

amount:
Number(amount)*100,

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
tenure||12,

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

success:false,

error:
e.response?.data||
e.message

});

}

});

//////////////////////////////////////////////////////
// WEBHOOK VERIFY
//////////////////////////////////////////////////////

function verify(req){

const sig=

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

return sig===expected;

}

//////////////////////////////////////////////////////
// WEBHOOK
//////////////////////////////////////////////////////

app.post(
"/webhook",
async(req,res)=>{

try{

if(!verify(req)){

return res
.status(401)
.send("invalid");

}

console.log(
req.body.event
);

res.send("ok");

}catch(e){

res.status(500)
.send("error");

}

});

//////////////////////////////////////////////////////

app.listen(
PORT||3000,
()=>{

console.log(
"Running:",
PORT||3000
);

});
