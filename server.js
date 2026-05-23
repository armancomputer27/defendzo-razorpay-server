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

//////////////////////////////////////////////////////
// VALIDATION
//////////////////////////////////////////////////////

if(

!dealerUid ||
!name ||
!email ||
!mobile ||
!bankAccount ||
!ifsc ||
!city ||
!state ||
!pincode

){

return res.status(400)

.json({

success:false,

error:"Missing fields"

});

}

//////////////////////////////////////////////////////
// STEP 1
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
dealerUid,

legal_business_name:
shop_name || name,

contact_name:
name,

business_type:
"individual",

profile:{

category:
"financial_services",

subcategory:
"lending",

//////////////////////////////////////////////////////
// IMPORTANT FIX
//////////////////////////////////////////////////////

addresses:{

registered:{

street1:
shop_name || "Dealer Shop",

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
"ACCOUNT CREATED:"
);

console.log(
accountId);

//////////////////////////////////////////////////////
// STEP 2
// SAVE BANK DETAILS (optional log)
//////////////////////////////////////////////////////

console.log(
"BANK:",
bankAccount
);

console.log(
"IFSC:",
ifsc
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
