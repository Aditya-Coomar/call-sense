import twilio from "twilio";
import { CommunicationChannel } from "@prisma/client";

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

// Send SMS
export async function sendSMS(to: string, message: string, from?: string) {
  try {
    const client = getTwilioClient();
    const config = getTwilioConfig();

    const result = await client.messages.create({
      body: message,
      from: from || config.phoneNumber,
      to: to,
    });

    return {
      success: true,
      externalId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Send WhatsApp message
export async function sendWhatsApp(to: string, message: string) {
  try {
    const client = getTwilioClient();
    const config = getTwilioConfig();

    // Enhanced phone number formatting for WhatsApp
    let whatsappTo = to;

    // Remove existing whatsapp: prefix if present
    if (whatsappTo.startsWith("whatsapp:")) {
      whatsappTo = whatsappTo.substring(9);
    }

    // Ensure the number starts with + for international format
    if (!whatsappTo.startsWith("+")) {
      whatsappTo = "+" + whatsappTo;
    }

    // Add whatsapp: prefix
    whatsappTo = `whatsapp:${whatsappTo}`;

    console.log("Sending WhatsApp message:", {
      from: config.whatsappNumber,
      to: whatsappTo,
      originalTo: to,
      messageLength: message.length,
    });

    const result = await client.messages.create({
      body: message,
      from: config.whatsappNumber,
      to: whatsappTo,
    });

    console.log("WhatsApp message sent successfully:", {
      sid: result.sid,
      status: result.status,
      to: whatsappTo,
    });

    return {
      success: true,
      externalId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error("Failed to send WhatsApp:", {
      error: error instanceof Error ? error.message : "Unknown error",
      to,
      from: getTwilioConfig().whatsappNumber,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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

// Process incoming webhook - Enhanced with all Twilio parameters
export interface TwilioWebhookData {
  MessageSid: string;
  SmsSid?: string;
  SmsMessageSid?: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  NumSegments?: string;

  // Media parameters
  MediaUrl0?: string;
  MediaContentType0?: string;
  MediaUrl1?: string;
  MediaContentType1?: string;
  MediaUrl2?: string;
  MediaContentType2?: string;
  MediaUrl3?: string;
  MediaContentType3?: string;
  MediaUrl4?: string;
  MediaContentType4?: string;

  // Geographic data
  FromCity?: string;
  FromState?: string;
  FromZip?: string;
  FromCountry?: string;
  ToCity?: string;
  ToState?: string;
  ToZip?: string;
  ToCountry?: string;

  // WhatsApp specific parameters
  ProfileName?: string;
  WaId?: string;
  Forwarded?: string;
  FrequentlyForwarded?: string;
  ButtonText?: string;
  Latitude?: string;
  Longitude?: string;
  Address?: string;
  Label?: string;

  // WhatsApp advertisement parameters
  ReferralBody?: string;
  ReferralHeadline?: string;
  ReferralSourceId?: string;
  ReferralSourceType?: string;
  ReferralSourceUrl?: string;
  ReferralMediaId?: string;
  ReferralMediaContentType?: string;
  ReferralMediaUrl?: string;
  ReferralNumMedia?: string;
  ReferralCtwaClid?: string;

  // Reply parameters
  OriginalRepliedMessageSender?: string;
  OriginalRepliedMessageSid?: string;
}

export function processTwilioWebhook(data: TwilioWebhookData) {
  const numMedia = parseInt(data.NumMedia || "0");

  // Process all media attachments
  const attachments = [];
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = data[`MediaUrl${i}` as keyof TwilioWebhookData] as string;
    const mediaType = data[
      `MediaContentType${i}` as keyof TwilioWebhookData
    ] as string;

    if (mediaUrl && mediaType) {
      attachments.push({
        filename: `media_${Date.now()}_${i}`,
        url: mediaUrl,
        contentType: mediaType,
        size: 0, // Size not available from Twilio webhook
      });
    }
  }

  // Determine channel type
  const channel = data.From.startsWith("whatsapp:")
    ? CommunicationChannel.WHATSAPP
    : CommunicationChannel.SMS;

  return {
    externalId: data.MessageSid,
    from: data.From,
    to: data.To,
    content: data.Body || "",
    hasMedia: numMedia > 0,
    attachments,
    channel,
    metadata: {
      accountSid: data.AccountSid,
      messagingServiceSid: data.MessagingServiceSid,
      numSegments: data.NumSegments,

      // Geographic data
      fromCity: data.FromCity,
      fromState: data.FromState,
      fromZip: data.FromZip,
      fromCountry: data.FromCountry,
      toCity: data.ToCity,
      toState: data.ToState,
      toZip: data.ToZip,
      toCountry: data.ToCountry,

      // WhatsApp specific data
      profileName: data.ProfileName,
      waId: data.WaId,
      forwarded: data.Forwarded === "true",
      frequentlyForwarded: data.FrequentlyForwarded === "true",
      buttonText: data.ButtonText,
      latitude: data.Latitude,
      longitude: data.Longitude,
      address: data.Address,
      label: data.Label,

      // Reply data
      originalRepliedMessageSender: data.OriginalRepliedMessageSender,
      originalRepliedMessageSid: data.OriginalRepliedMessageSid,

      // Advertisement data (WhatsApp)
      referral: data.ReferralBody
        ? {
            body: data.ReferralBody,
            headline: data.ReferralHeadline,
            sourceId: data.ReferralSourceId,
            sourceType: data.ReferralSourceType,
            sourceUrl: data.ReferralSourceUrl,
            mediaId: data.ReferralMediaId,
            mediaContentType: data.ReferralMediaContentType,
            mediaUrl: data.ReferralMediaUrl,
            numMedia: data.ReferralNumMedia,
            ctwaClid: data.ReferralCtwaClid,
          }
        : undefined,
    },
  };
}
