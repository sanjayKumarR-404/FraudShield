# Twilio Configuration Guide

This guide describes how to configure Twilio inside FraudShield for the Phase 7 Multi-Channel Alert System.

## Prerequisites
1. Create an account at https://www.twilio.com/
2. You will be assigned a trial balance and an **Account SID** & **Auth Token**. You can find these on the Twilio Console (home page). 
3. *Never* commit your `TWILIO_AUTH_TOKEN` to source control.

## Sandbox Activation 
Since FraudShield operates out of the box in development, we rely on the Twilio WhatsApp Sandbox natively.
1. Open up **Messaging > Try it out > Send a WhatsApp message** in the Twilio Dashboard.
2. Note your designated sandbox number, usually `whatsapp:+14155238886`.
3. Read the prompt on the screen requiring your target device to send the word `join <keyword>` to this number. E.g. `join bright-river`.
4. Without doing this opt-in step, WhatsApp delivery to your unverified number will fail with error `21211`.

## Voice Alerts Number
Obtain an active Twilio number to place voice calls.
1. Search and provision a number in **Phone Numbers > Manage > Buy a number**.
2. Once purchased, ensure you verify your **Caller ID** phone number via **Develop > Phone Numbers > Manage > Verified Caller IDs** so trial accounts can dial outwards legally.

## Environment Mapping
Map the following keys inside your `.env` within `/server`:

```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_VOICE_FROM=+1xxxxxxxxxx
ALERT_PHONE_NUMBER=+91XXXXXXXXXX
```

Start up `npm run dev` in `/server`. The system will parse Twilio securely and attach `[AlertService]` dispatches gracefully to the background logic stack.
