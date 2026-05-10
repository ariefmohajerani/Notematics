import { GoogleGenAI } from "@google/genai";
import { tokenService } from "../token_manager/tokenService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export class GeminiService {
  /**
   * General Text Generation
   */
  public async generateContent(prompt: string): Promise<string | null> {
    const hasToken = await tokenService.consumeToken();
    if (!hasToken) throw new Error("Insufficient tokens. Please wait for reset.");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are Notematics Assistant. Provide concise, helpful answers for mobile users. Support markdown."
        }
      });
      return response.text || null;
    } catch (error) {
      console.error("Gemini Error:", error);
      return null;
    }
  }

  /**
   * Receipt Scanner (OCR + Structuring)
   */
  public async scanReceipt(base64Image: string): Promise<string | null> {
    const hasToken = await tokenService.consumeToken();
    if (!hasToken) throw new Error("Insufficient tokens. Please wait for reset.");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          { text: "Extract receipt data into math variables: item_name = total_amount. For example: lunch = 12.50. List each major item." }
        ]
      });
      return response.text || null;
    } catch (error) {
      console.error("Gemini OCR Error:", error);
      return null;
    }
  }

  /**
   * Parse Complex Word Problem into Math
   */
  public async parseComplexMath(problem: string): Promise<string | null> {
    const hasToken = await tokenService.consumeToken();
    if (!hasToken) throw new Error("Insufficient tokens. Please wait for reset.");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Parse this into simple variable assignments for a local math engine: ${problem}. Only return the variable list like: speed = 60, time = 2, distance = speed * time =`
      });
      return response.text || null;
    } catch (error) {
      console.error("Gemini Math Error:", error);
      return null;
    }
  }
}

export const geminiService = new GeminiService();
