# Defendzo Razorpay Test Server (Render Version)

This project hosts a Node.js backend that creates Razorpay Payment Links (E-Mandate Test Mode) for the Defendzo Android app.

## 🚀 Deploy on Render

1. Go to https://render.com and login with GitHub.
2. Create a New Web Service.
3. Connect this repository.
4. Build Command: npm install
5. Start Command: npm start

## 🔐 Environment Variables

| Key | Value |
|-----|--------|
| RZP_KEY_ID | rzp_test_RWd3JPnadgK0Wo |
| RZP_KEY_SECRET | cgAikxCZVE4Fm2UDm1p3Dryn |
| NODE_ENV | production |

## 🌐 BASE_URL for Android
val BASE_URL = "https://defendzo-razorpay-test.onrender.com"
