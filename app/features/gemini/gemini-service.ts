import "dotenv/config";
import { genkit, GenkitError } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { ChatInput, ChatInputSchema, ChatOutputSchema, ChatOutput, ImageInput, ImageOutput, ImageOutputDetection, ImageOutputSchema, ImageInputSchema } from "./gemini-model";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { geminiServiceConfig } from "../../config/config";
import { ENUM_PADDY_DISEASE } from "./gemini-enums";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { ChartConfiguration } from "chart.js";

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiServiceConfig.GEMINI_API_KEY })],
  model: googleAI.model("gemini-3-flash-preview"),
});

interface IGeminiService {
  chat(input: ChatInput): Promise<Result<ChatOutput>>;
  image(image_url: string): Promise<Result<ImageOutput>>;
}

class GeminiService implements IGeminiService {
  public readonly chatFlow = ai.defineFlow(
    {
      name: "chatFlow",
      inputSchema: ChatInputSchema,
      outputSchema: ChatOutputSchema,
    },
    async ({ message, history = [] }) => {
      const messages = [
        ...history.map((h) => ({
          role: h.role as "user" | "model",
          content: [{ text: h.content }],
        })),
        { role: "user" as const, content: [{ text: message }] },
      ];

      const { text } = await ai.generate({ messages });
      return { reply: text };
    }
  );

  public readonly imageFlow = ai.defineFlow(
    {
      name: "imageFlow",
      inputSchema: ImageInputSchema,
      outputSchema: ImageOutputSchema,
    },
    async ({ image_url }) => {
      const diseaseList = Object.values(ENUM_PADDY_DISEASE)
        .filter((v) => typeof v === 'string')
        .join(", ");

      const systemPrompt = `
        You are an expert in diagnosing paddy plant diseases. 
        Analyze the image and provide a diagnosis based on these rules:

        For disease:
        - If the image is not a paddy plant: return "NOT DETECTED" with severity 0.
        - If the plant is healthy: return "HEALTHY" with severity 0.
        - If a disease is found: return the name from this list: [${diseaseList}].

        For severity: 
        - Provide a score from 0.0 to 1.0 (0 is healthy, 1.0 is total crop failure).

        For confidence:
        - Provide a score from 0.0 to 1.0 (0 means not detected, 1.0 is absolutely sure the disease is on the plant.)
        
        For detections:
        - Provide any disease found with a score of > 0.4, else you can skip adding them.
      `;

      console.log(`[Gemini] Diagnosing image`);
      const isVideo = image_url.endsWith('.mp4') || image_url.endsWith('.mov'); 
      const contentType = isVideo ? "video/mp4" : "image/jpeg";
      const { output } = await ai.generate({
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { text: "Analyze this image for paddy disease and estimate severity." },
              { media: { url: image_url, contentType: contentType } },
            ],
          },
        ],
        output: {
          schema: ImageOutputSchema,
        },
      });
      console.log(`[Gemini] Image diagnosis Complete`);

      console.log(`[Chartjs] Creating detections chart base64 string`);
      let chart: string = '';
      let disease: string = output?.detections[0]?.disease ?? '';
      if (disease !== '' && disease !== 'NOT DETECTED' && disease !== 'HEALTHY') {
        const detections = output?.detections ?? [];
        chart = await this.generateDetectionChart(detections);
      }
      console.log(`[Chartjs] Base64 string generated`);

      return {
        detections: output?.detections ?? [],
        chart: chart ?? '', 
      };
    }
  );

  public async chat(input: ChatInput): Promise<Result<ChatOutput>> {
    const output = await this.chatFlow(input);

    if (!output?.reply) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "AI failed to generate a reply.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Chat response generated.");
  }

  public async image(image_url: string): Promise<Result<ImageOutput>> {

    const input: ImageInput = {
      image_url
    };

    try {
      const output = await this.imageFlow(input);
      if (!output.detections[0]?.disease) {
        return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "AI failed to read the image.");
      }

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Diagnosis generated.");
    } catch (error) {
      if (error instanceof GenkitError) {
        let errorMessage: string = error.message;
        if (error.detail) {
          if (error.detail.error) {
            if (error.detail.error.message) {
              errorMessage = error.detail.error.message;
            }
          }
        }
        if (error.code === 503) {
          return Result.fail(ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE, errorMessage);
        } else if (error.code === 429) {
          return Result.fail(ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS, errorMessage);
        }
      }
      throw error;
    }
  }

  private async generateDetectionChart (detections: ImageOutputDetection[]): Promise<string> {
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 500, height: 250 });
    const configuration: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: detections.map(d => d.disease),
        datasets: [{
          label: 'Severity Level',
          data: detections.map(d => d.severity),
          backgroundColor: detections.map(d => {
            if (d.severity <= 0.3) return '#FFEB3B';
            if (d.severity <= 0.7) return '#FB8C00';
            return '#F44336';
          }),
          barThickness: 20,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        scales: {
          x: {
            beginAtZero: true,
            max: 1.0,
            title: {
              display: true,
              text: 'Severity',
              font: { size: 12, weight: 'bold' }
            },
            grid: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11, weight: 'bold' },
              color: '#333'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              generateLabels: (chart) => [
                { text: 'Mild (≤ 0.3)', fillStyle: '#FFEB3B' },
                { text: 'Moderate (0.3 - 0.7)', fillStyle: '#FB8C00' },
                { text: 'Severe (> 0.7)', fillStyle: '#F44336' }
              ]
            }
          },
          title: {
            display: true,
            text: 'Disease Severity Analysis',
            font: { size: 14 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.parsed.x ?? 0;
                let status = val <= 0.3 ? 'Mild' : val <= 0.7 ? 'Moderate' : 'Severe';
                return ` Severity: ${val} (${status})`;
              }
            }
          }
        }
      }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    return buffer.toString('base64');
  }
}

export default new GeminiService();