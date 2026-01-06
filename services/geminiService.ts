import { GoogleGenAI } from "@google/genai";

const cleanBase64 = (dataUri: string) => {
  return dataUri.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
};

const resizeAndCompressImage = (base64Str: string, maxWidth = 1024, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          resolve(base64Str);
          return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => resolve(base64Str);
  });
};

export const generateAiFrame = async (prompt: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
          parts: [{ text: `Create a professional 4:5 portrait photo frame border with theme: ${prompt}. The center must be transparent. High-tech minimalist style.` }] 
      },
      config: { 
        imageConfig: { aspectRatio: "3:4" } 
      }, 
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated.");
  } catch (error) {
    console.error("Frame generation error:", error);
    throw error;
  }
};

export const remixUserPhoto = async (imageSrc: string, style: 'mascot' | 'cyberpunk' | 'anime' | 'portrait'): Promise<string> => {
  const apiKey = process.env.API_KEY || "";
  if (!apiKey) {
    throw new Error("CRITICAL: API_KEY is missing. Please set it in Vercel Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const optimizedImage = await resizeAndCompressImage(imageSrc, 1024, 0.85);
  const base64Data = cleanBase64(optimizedImage);

  const prompt = `Task: Add the mascot "AIYOGU" into this photo.
  Mascot: Friendly orange 3D creature, cyan glowing horns, gold chain.
  Placement: Stand NEXT to the person in the photo like a friend.
  Constraint: Keep original face and background 100% same.
  Output: Return the modified image.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
          { text: prompt },
        ],
      },
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("AI response did not contain image data.");
  } catch (error) {
    console.error("AI Mascot Process Error:", error);
    throw error;
  }
};