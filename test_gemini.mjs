import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.VITE_GEMINI_API_KEY;
console.log("Testing with API key:", apiKey ? `SET (${apiKey.length} chars)` : 'NOT SET');

const ai = new GoogleGenAI({ apiKey });

try {
  console.log("Calling Gemini API with model: gemini-2.5-flash");
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: "Say hello"
  });
  
  console.log("✅ Success! Response:", response.text);
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Status code:", error.status);
  console.error("Details:", error.details);
}
