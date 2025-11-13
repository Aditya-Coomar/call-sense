import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// Gemini configuration schema
const GeminiConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default("gemini-2.0-flash-exp"),
});

// Gemini AMD analysis types
export interface GeminiAMDRequest {
  audioData: Buffer;
  duration: number;
  format: string;
  callLogId: string;
}

export interface GeminiAMDResponse {
  label: "human" | "machine";
  confidence: number;
  reasoning: string;
  analysis: {
    speechPattern: string;
    voiceCharacteristics: string;
    backgroundNoise: string;
    greeting: string;
  };
}

export function getGeminiConfig() {
  const config = {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY || "",
    model: process.env.GOOGLE_GEMINI_MODEL || "gemini-2.0-flash-exp",
  };

  console.log("Gemini config validation:", {
    hasApiKey: !!config.apiKey,
    model: config.model,
  });

  try {
    return GeminiConfigSchema.parse(config);
  } catch (error) {
    console.error("Gemini configuration error:", error);
    throw new Error(`Invalid Gemini configuration: ${error}`);
  }
}

export class GeminiAMDAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config: z.infer<typeof GeminiConfigSchema>;

  constructor() {
    this.config = getGeminiConfig();
    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.config.model });
  }

  async analyzeAudio(request: GeminiAMDRequest): Promise<GeminiAMDResponse> {
    const startTime = Date.now();

    console.log("Gemini AMD analysis starting:", {
      callLogId: request.callLogId,
      audioSize: request.audioData.length,
      duration: request.duration,
      format: request.format,
    });

    try {
      // Convert audio buffer to base64 for Gemini
      const audioBase64 = request.audioData.toString("base64");

      // Create the prompt for AMD analysis
      const prompt = `
You are an advanced Answering Machine Detection (AMD) system. Analyze this audio clip to determine if it's a human speaker or an answering machine/voicemail system.

Audio Details:
- Duration: ${request.duration} seconds
- Format: ${request.format}
- Context: Phone call greeting analysis

Please analyze the audio and determine:
1. Is this a HUMAN speaker or an ANSWERING MACHINE/VOICEMAIL?
2. What is your confidence level (0.0 to 1.0)?
3. What are the key indicators that led to your decision?

Key indicators to consider:
- Speech patterns (natural vs. recorded)
- Voice characteristics (live vs. pre-recorded quality)
- Background noise patterns
- Greeting style (personal vs. generic)
- Audio quality consistency
- Presence of beeps or tones
- Natural pauses vs. artificial timing

Respond in this exact JSON format:
{
  "label": "human" or "machine",
  "confidence": 0.85,
  "reasoning": "Brief explanation of decision",
  "analysis": {
    "speechPattern": "Description of speech characteristics",
    "voiceCharacteristics": "Voice quality analysis", 
    "backgroundNoise": "Background audio analysis",
    "greeting": "Greeting content analysis"
  }
}
`;

      // Prepare the content for Gemini
      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: `audio/${request.format}`,
            data: audioBase64,
          },
        },
      ];

      console.log("Sending audio to Gemini for analysis...");

      // Generate content with Gemini
      const result = await this.model.generateContent(parts);
      const response = await result.response;
      const text = response.text();

      console.log("Gemini raw response:", text);

      // Parse the JSON response
      let parsedResponse: GeminiAMDResponse;
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : text;
        parsedResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error("Failed to parse Gemini response:", parseError);

        // Fallback analysis based on response text
        const isHuman =
          text.toLowerCase().includes("human") &&
          !text.toLowerCase().includes("machine");

        parsedResponse = {
          label: isHuman ? "human" : "machine",
          confidence: 0.6, // Lower confidence for unparseable response
          reasoning: "Fallback analysis due to parsing error",
          analysis: {
            speechPattern: "Could not analyze",
            voiceCharacteristics: "Could not analyze",
            backgroundNoise: "Could not analyze",
            greeting: text.substring(0, 100),
          },
        };
      }

      const latency = Date.now() - startTime;

      console.log("Gemini AMD analysis complete:", {
        callLogId: request.callLogId,
        result: parsedResponse.label,
        confidence: parsedResponse.confidence,
        latencyMs: latency,
        reasoning: parsedResponse.reasoning,
      });

      return parsedResponse;
    } catch (error: any) {
      console.error("Gemini AMD analysis error:", {
        callLogId: request.callLogId,
        error: error.message,
        stack: error.stack,
      });

      // Return fallback response on error
      return {
        label: "machine", // Conservative fallback
        confidence: 0.3,
        reasoning: `Analysis failed: ${error.message}`,
        analysis: {
          speechPattern: "Error occurred",
          voiceCharacteristics: "Error occurred",
          backgroundNoise: "Error occurred",
          greeting: "Error occurred",
        },
      };
    }
  }

  // Analyze streaming audio chunks
  async analyzeStreamingAudio(
    audioChunks: Buffer[],
    callLogId: string
  ): Promise<GeminiAMDResponse> {
    // Combine audio chunks
    const combinedAudio = Buffer.concat(audioChunks);

    return this.analyzeAudio({
      audioData: combinedAudio,
      duration: audioChunks.length * 0.5, // Estimate duration
      format: "wav",
      callLogId,
    });
  }

  // Test connection to Gemini API
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.model.generateContent("Test connection");
      const response = await result.response;
      return !!response.text();
    } catch (error) {
      console.error("Gemini connection test failed:", error);
      return false;
    }
  }
}

export const geminiAMDAnalyzer = new GeminiAMDAnalyzer();
