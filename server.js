require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;

//////////////////////////////////////////////////////
// TEST
//////////////////////////////////////////////////////

app.get("/", (req,res)=>{
    res.send("Server Running");
});

//////////////////////////////////////////////////////
// CREATE DEALER ACCOUNT
//////////////////////////////////////////////////////

app.post(
"/create-dealer-account",

async(req,res)=>{

try{

const {
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

return res.status(400).json({

success:false,
error:"Missing fields"

});

}

const payload={

email:email,

phone:mobile,

type:"route",

reference_id:dealerUid,

legal_business_name:
shop_name || name,

contact_name:name,

business_type:"individual",

profile:{

category:"financial_services",

subcategory:"lending",

addresses:{

registered:{

street1:
shop_name || "Dealer Shop",

street2:
city,

city:city,

state:state,

postal_code:pincode,

country:"IN"

}

}

}

};

const linkedRes=

await axios.post(

"https://api.razorpay.com/v2/accounts",

payload,

{

auth:{

username:RZP_KEY_ID,

password:RZP_KEY_SECRET

}

}

);

res.json({

success:true,

accountId:
linkedRes.data.id

});

}catch(err){

console.log(

err.response?.data ||
err.message

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
// START
//////////////////////////////////////////////////////

const PORT=
process.env.PORT || 3000;

app.listen(PORT,()=>{

console.log(
`Running ${PORT}`
);

});
