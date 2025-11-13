import { z } from "zod";

// Jambonz configuration schema
const JambonzConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiToken: z.string().min(1),
  accountSid: z.string().min(1),
  applicationSid: z.string().optional(),
});

// Jambonz API types
export interface JambonzCallRequest {
  from: string;
  to: string;
  call_hook: {
    url: string;
    method: "POST" | "GET";
  };
  call_status_hook?: {
    url: string;
    method: "POST" | "GET";
  };
  tag?: Record<string, any>;
}

export interface JambonzCallResponse {
  sid: string;
  account_sid: string;
  from: string;
  to: string;
  call_status: string;
  call_sid: string;
}

export interface JambonzApplication {
  verb: string;
  actionHook?: string;
  target?: Array<{
    type: "phone" | "sip" | "user";
    number?: string;
    sipUri?: string;
    name?: string;
    trunk?: string;
  }>;
  amd?: {
    actionHook: string;
    thresholdWordCount?: number;
    digitCount?: number;
    timers?: {
      decisionTimeoutMs?: number;
      greetingCompletionTimeoutMs?: number;
      noSpeechTimeoutMs?: number;
      toneTimeoutMs?: number;
    };
  };
  timeout?: number;
  callerId?: string;
  text?: string; // For 'say' verb
  length?: number; // For 'pause' verb
  [key: string]: any; // Allow additional properties for different verbs
}

export function getJambonzConfig() {
  const config = {
    apiUrl: process.env.JAMBONZ_API_URL || "https://api.jambonz.cloud",
    apiToken: process.env.JAMBONZ_API_TOKEN || "",
    accountSid: process.env.JAMBONZ_ACCOUNT_SID || "",
    applicationSid: process.env.JAMBONZ_APPLICATION_SID,
  };

  console.log("Jambonz config validation:", {
    apiUrl: config.apiUrl,
    hasApiToken: !!config.apiToken,
    hasAccountSid: !!config.accountSid,
    hasApplicationSid: !!config.applicationSid,
  });

  try {
    return JambonzConfigSchema.parse(config);
  } catch (error) {
    console.error("Jambonz configuration error:", error);
    throw new Error(`Invalid Jambonz configuration: ${error}`);
  }
}

// Validate and format phone number for Jambonz
export function formatPhoneNumberForJambonz(phoneNumber: string): string {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, "");

  // If it doesn't start with +, add +1 (US default)
  if (!cleaned.startsWith("+")) {
    return `+1${cleaned}`;
  }

  // Enhanced E.164 validation - more inclusive for international numbers
  // E.164 format: + followed by country code (1-4 digits) + national number
  // Total length: 7-15 digits (excluding +)
  const e164Regex = /^\+[1-9]\d{6,14}$/;

  // Additional validation for specific country codes
  const indianNumberRegex = /^\+91[6-9]\d{9}$/; // Indian mobile numbers
  const usNumberRegex = /^\+1[2-9]\d{9}$/; // US/Canada numbers

  const isValidE164 = e164Regex.test(cleaned);
  const isValidIndian = indianNumberRegex.test(cleaned);
  const isValidUS = usNumberRegex.test(cleaned);

  if (!isValidE164 && !isValidIndian && !isValidUS) {
    throw new Error(
      `Invalid phone number format for Jambonz: ${phoneNumber}. Expected E.164 format. Examples: +1234567890 (US) or +917903550110 (India)`
    );
  }

  console.log("Phone number formatted for Jambonz:", {
    original: phoneNumber,
    formatted: cleaned,
    isValidE164,
    isValidIndian,
    isValidUS,
    countryCode: cleaned.substring(0, 3),
  });

  return cleaned;
}

export class JambonzClient {
  private config: z.infer<typeof JambonzConfigSchema>;
  private baseUrl: string;

  constructor() {
    this.config = getJambonzConfig();
    this.baseUrl = `${this.config.apiUrl}/v1/Accounts/${this.config.accountSid}`;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    console.log("Jambonz API request:", {
      method,
      url,
      data: data ? JSON.stringify(data, null, 2) : undefined,
      headers: {
        Authorization: `Bearer ${this.config.apiToken.substring(0, 10)}...`,
        "Content-Type": "application/json",
      },
    });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    console.log("Jambonz API response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Jambonz API error details:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url,
        method,
        requestData: data,
      });

      throw new Error(
        `Jambonz API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const responseData = await response.json();
    console.log("Jambonz API response data:", responseData);

    return responseData;
  }

  // Create outbound call with AMD
  async createCall(
    callRequest: JambonzCallRequest
  ): Promise<JambonzCallResponse> {
    return this.makeRequest<JambonzCallResponse>("/Calls", "POST", callRequest);
  }

  // Get call status
  async getCall(callSid: string): Promise<JambonzCallResponse> {
    return this.makeRequest<JambonzCallResponse>(`/Calls/${callSid}`);
  }

  // Hangup call
  async hangupCall(callSid: string): Promise<void> {
    await this.makeRequest(`/Calls/${callSid}`, "DELETE");
  }

  // Update call in progress
  async updateCall(
    callSid: string,
    application: JambonzApplication[]
  ): Promise<void> {
    await this.makeRequest(`/Calls/${callSid}`, "PUT", application);
  }
}

// Create Jambonz application for AMD dial
export function createJambonzAMDApplication(
  targetNumber: string,
  amdWebhookUrl: string,
  callLogId: string
): JambonzApplication[] {
  return [
    {
      verb: "dial",
      actionHook: `${amdWebhookUrl}/dial-status?strategy=jambonz&callLogId=${callLogId}`,
      callerId: process.env.JAMBONZ_PHONE_NUMBER || "+917903550110",
      timeout: 25,
      target: [
        {
          type: "phone",
          number: targetNumber,
          trunk: "default", // Configure this in Jambonz console
        },
      ],
      amd: {
        actionHook: `${amdWebhookUrl}/amd-events?strategy=jambonz&callLogId=${callLogId}`,
        thresholdWordCount: 8, // Slightly more sensitive than default
        digitCount: 6, // Detect UK/international numbers in greetings
        timers: {
          decisionTimeoutMs: 12000, // 12 seconds to make decision
          greetingCompletionTimeoutMs: 1500, // 1.5s silence before deciding greeting is done
          noSpeechTimeoutMs: 4000, // 4s to wait for speech
          toneTimeoutMs: 15000, // 15s to detect beep
        },
      },
    },
  ];
}

// Generate TwiML-compatible response for Jambonz webhooks
export function generateJambonzResponse(
  action: "connect" | "hangup" | "continue",
  callLogId?: string
): JambonzApplication[] {
  switch (action) {
    case "connect":
      return [
        {
          verb: "say",
          text: "Human detected. This is a test call from CallSense AMD system.",
        },
        {
          verb: "pause",
          length: 2,
        },
        {
          verb: "hangup",
        },
      ];

    case "hangup":
      return [
        {
          verb: "say",
          text: "Voicemail detected. Hanging up now.",
        },
        {
          verb: "hangup",
        },
      ];

    case "continue":
    default:
      return [
        {
          verb: "pause",
          length: 1,
        },
      ];
  }
}

export const jambonzClient = new JambonzClient();
