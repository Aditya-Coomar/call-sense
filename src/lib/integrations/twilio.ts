import twilio from "twilio";
// Get Twilio configuration from environment variables
function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error(
      "Twilio credentials not configured in environment variables"
    );
  }

  return {
    accountSid,
    authToken,
    phoneNumber,
    whatsappNumber: whatsappNumber || "whatsapp:+14155238886", // Default sandbox number
  };
}

// Initialize Twilio client
export function getTwilioClient() {
  const config = getTwilioConfig();
  return twilio(config.accountSid, config.authToken);
}

// Validate webhook signature
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    const config = getTwilioConfig();
    const crypto = require("crypto");

    // Create the expected signature using Twilio's algorithm
    const data = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        return acc + key + params[key];
      }, url);

    const expectedSignature = crypto
      .createHmac("sha1", config.authToken)
      .update(data, "utf-8")
      .digest("base64");

    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(signature, "base64"),
      Buffer.from(expectedSignature, "base64")
    );
  } catch (error) {
    console.error("Webhook validation failed:", error);
    return false;
  }
}
