require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// CREATE MANDATE
app.post('/create-mandate', async (req, res) => {
    try {
        const { name, mobile, loan_amount, tenure, frequency, dealerUid, dealer_name } = req.body;

        if (!name || !mobile || !loan_amount) {
            return res.status(400).json({ success: false, message: "Name, Mobile and Amount are required" });
        }

        const customer = await razorpay.customers.create({
            name,
            contact: mobile,
            email: `${mobile}@defendzo.in`,
        });

        const subscription = await razorpay.subscriptions.create({
            plan_id: "plan_dummy", // Abhi ke liye dummy (baad mein dynamic bana denge)
            customer_id: customer.id,
            total_count: parseInt(tenure),
            quantity: 1,
            notes: {
                dealerUid,
                dealer_name,
                loan_amount,
                frequency
            }
        });

        res.json({
            success: true,
            link: subscription.short_url,
            subscription_id: subscription.id,
            customer_id: customer.id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.error?.description || error.message
        });
    }
});

// KYC / BANK ACCOUNT
app.post('/kyc', async (req, res) => {
    try {
        const { dealerUid, name, email, contact, business_name, account_number, ifsc, pan } = req.body;

        const contactRes = await razorpay.contacts.create({
            name,
            email,
            contact,
            type: "vendor",
            reference_id: dealerUid
        });

        const fundAccount = await razorpay.fundAccounts.create({
            contact_id: contactRes.id,
            account_type: "bank_account",
            bank_account: {
                name,
                ifsc,
                account_number
            }
        });

        res.json({
            success: true,
            account_id: fundAccount.id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.error?.description || error.message
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
