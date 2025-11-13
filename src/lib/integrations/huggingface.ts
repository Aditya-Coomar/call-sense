import { z } from "zod";

// Hugging Face AMD service configuration
const HuggingFaceConfigSchema = z.object({
  serviceUrl: z.string().url(),
  timeout: z.number().default(30000),
});

// Hugging Face AMD analysis types
export interface HuggingFaceAMDRequest {
  audioData: Buffer;
  format: string;
  callLogId: string;
}

export interface HuggingFaceAMDResponse {
  label: "human" | "machine";
  confidence: number;
  raw_predictions: number[];
  model: string;
}

export function getHuggingFaceConfig() {
  const config = {
    serviceUrl: process.env.PYTHON_ML_SERVICE_URL || "http://localhost:8000",
    timeout: 120000, // Increase timeout to 2 minutes for ML processing
  };

  console.log("HuggingFace config validation:", {
    serviceUrl: config.serviceUrl,
    timeout: config.timeout,
  });

  try {
    return HuggingFaceConfigSchema.parse(config);
  } catch (error) {
    console.error("HuggingFace configuration error:", error);
    throw new Error(`Invalid HuggingFace configuration: ${error}`);
  }
}

export class HuggingFaceAMDAnalyzer {
  private config: z.infer<typeof HuggingFaceConfigSchema>;

  constructor() {
    this.config = getHuggingFaceConfig();
  }

  async analyzeAudio(
    request: HuggingFaceAMDRequest
  ): Promise<HuggingFaceAMDResponse> {
    const startTime = Date.now();

    console.log("HuggingFace AMD analysis starting:", {
      callLogId: request.callLogId,
      audioSize: request.audioData.length,
      format: request.format,
      serviceUrl: this.config.serviceUrl,
    });

    try {
      // Create FormData for file upload
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array(request.audioData)], {
        type: `audio/${request.format}`,
      });
      formData.append("file", audioBlob, `audio.${request.format}`);

      console.log("Sending audio to HuggingFace ML service...");

      // Send request to Python ML service
      const response = await fetch(`${this.config.serviceUrl}/predict`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ML service error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result: HuggingFaceAMDResponse = await response.json();
      const latency = Date.now() - startTime;

      console.log("HuggingFace AMD analysis complete:", {
        callLogId: request.callLogId,
        result: result.label,
        confidence: result.confidence,
        latencyMs: latency,
        model: result.model,
      });

      return result;
    } catch (error: any) {
      console.error("HuggingFace AMD analysis error:", {
        callLogId: request.callLogId,
        error: error.message,
        stack: error.stack,
      });

      // Return fallback response on error
      return {
        label: "machine", // Conservative fallback
        confidence: 0.3,
        raw_predictions: [0.7, 0.3],
        model: "fallback",
      };
    }
  }

  // Test connection to ML service
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serviceUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return false;
      }

      const health = await response.json();
      console.log("HuggingFace service health:", health);

      return health.status === "healthy";
    } catch (error) {
      console.error("HuggingFace connection test failed:", error);
      return false;
    }
  }

  // Get service info
  async getServiceInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.config.serviceUrl}/`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Service info request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get service info:", error);
      return null;
    }
  }

  // Process streaming audio chunks
  async processStreamingAudio(
    audioChunks: Buffer[],
    callLogId: string
  ): Promise<HuggingFaceAMDResponse> {
    // Combine audio chunks into single buffer
    const combinedAudio = Buffer.concat(audioChunks);

    console.log("Processing streaming audio chunks:", {
      callLogId,
      numChunks: audioChunks.length,
      totalSize: combinedAudio.length,
    });

    return this.analyzeAudio({
      audioData: combinedAudio,
      format: "wav",
      callLogId,
    });
  }
}

export const huggingFaceAMDAnalyzer = new HuggingFaceAMDAnalyzer();
