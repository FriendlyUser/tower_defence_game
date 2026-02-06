
import { GoogleGenAI, Type } from "@google/genai";
import { LevelIntel } from "../types";

export async function getLevelIntel(level: number): Promise<LevelIntel> {
  try {
    // Initialize inside the function to ensure process.env.API_KEY is available at runtime
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a cool sci-fi mission title and a 1-sentence tactical briefing for a minimalist tower defense game at level ${level}. Level 30 is the final boss wave. Format as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            briefing: { type: Type.STRING },
          },
          required: ["title", "briefing"],
        },
      },
    });

    const text = response.text || "";
    const cleanJson = text.trim();
    const data = JSON.parse(cleanJson);
    return data as LevelIntel;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      title: `Sector ${level} Breach`,
      briefing: "Enemy reinforcements detected. Maintain the perimeter and optimize turret array."
    };
  }
}