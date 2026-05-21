app.get("/check-route", async(req,res)=>{

try{

const r=await axios.get(
`${BASE_V2}/accounts`,
{auth}
);

res.json(r.data);

}catch(e){

res.json(
e.response?.data||e.message
);

}

});
