import { NextRequest, NextResponse } from "next/server";
import { CommunicationChannel } from "@prisma/client";
import {
  processTwilioWebhook,
  validateTwilioSignature,
} from "@/lib/integrations/twilio";
import { processInboundMessage } from "@/lib/services/message-service";
import { broadcastUpdate } from "@/app/api/conversations/updates/route";

// Helper function to generate TwiML response
function generateTwiMLResponse(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${message}</Message>
</Response>`;
  } else {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature for validation
    const signature = request.headers.get("x-twilio-signature") || "";
    const url = request.url;

    // Parse form data
    const formData = await request.formData();
    const params: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Validate webhook signature
    if (process.env.NODE_ENV === "production" && signature) {
      if (!validateTwilioSignature(signature, url, params)) {
        console.error("Invalid Twilio webhook signature");
        return new NextResponse(generateTwiMLResponse(), {
          status: 401,
          headers: { "Content-Type": "text/xml" },
        });
      }
    }

    // Process the webhook data
    const webhookData = processTwilioWebhook(params as any);

    // Process the inbound message using our service
    const result = await processInboundMessage({
      from: webhookData.from.replace("whatsapp:", ""),
      to: webhookData.to,
      content: webhookData.content,
      channel: webhookData.channel as CommunicationChannel,
      externalId: webhookData.externalId,
      timestamp: new Date(),
      metadata: webhookData.metadata,
      attachments: webhookData.attachments,
    });

    if (!result.success) {
      console.error("Failed to process inbound message:", result.error);
      // Still return success TwiML to avoid webhook retries
      return new NextResponse(generateTwiMLResponse(), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Log successful processing
    console.log("Successfully processed inbound message:", {
      messageId: result.message?.id,
      conversationId: result.conversation?.id,
      contactId: result.contact?.id,
      channel: webhookData.channel,
      from: webhookData.from,
    });

    // Broadcast real-time update to all connected clients
    if (result.success && result.message && result.conversation) {
      try {
        broadcastUpdate({
          type: "new_message",
          message: {
            id: result.message.id,
            content: result.message.content,
            channel: result.message.channel,
            direction: result.message.direction,
            createdAt: result.message.createdAt,
            status: result.message.status,
          },
          conversation: {
            id: result.conversation.id,
            lastMessageAt: result.conversation.lastMessageAt,
            unreadCount: result.conversation.unreadCount || 0,
          },
          contact: {
            id: result.contact?.id,
            firstName: result.contact?.firstName,
            lastName: result.contact?.lastName,
            phone: result.contact?.phone,
            email: result.contact?.email,
          },
        });
        console.log(
          "Real-time update broadcasted for message:",
          result.message.id
        );
      } catch (updateError) {
        console.error("Failed to broadcast real-time update:", updateError);
        // Don't fail the webhook for broadcast errors
      }
    }

    // Return empty TwiML response (no auto-reply)
    return new NextResponse(generateTwiMLResponse(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    // Return empty TwiML response even on error to avoid webhook retries
    return new NextResponse(generateTwiMLResponse(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
