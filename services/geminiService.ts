// Fix: Follow @google/genai guidelines for imports and model initialization
import {GoogleGenAI} from "@google/genai";

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
    // Fix: Create instance right before API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
          parts: [{ text: `Create a professional 4:5 portrait photo frame border with theme: ${prompt}. Center must be transparent.` }] 
      },
      config: { 
        imageConfig: { aspectRatio: "3:4" } 
      }, 
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      // Fix: Iterate parts to find the image part as per guideline
      for (const part of parts) {
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
  // Fix: Create instance right before API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const optimizedImage = await resizeAndCompressImage(imageSrc, 1024, 0.85);
  const base64Data = cleanBase64(optimizedImage);

  // Assertive prompt for Mascot placement
  let prompt = `URGENT TASK: ADD A 3D MASCOT CHARACTER "AIYOGU" INTO THIS PHOTO.
  
  MASCOT APPEARANCE: 
  A friendly, vibrant orange 3D plump creature. It has curved horns with glowing cyan/neon blue rings. Sparkling big eyes. Wearing a thick gold chain with a medallion that says "Aiyogu".
  
  PLACEMENT RULE:
  - Place Aiyogu standing or floating IMMEDIATELY NEXT to the person in the photo.
  - The mascot should occupy about 25% of the frame.
  - KEEP THE ORIGINAL PERSON AND BACKGROUND 100% THE SAME.
  - Lighting should match the original photo.
  
  Return ONLY the modified image.`;

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

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("Empty response from Gemini");

    const parts = candidates[0].content.parts;
    // Fix: Iterate parts to find the image part
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image found in AI response");
  } catch (error) {
    console.error("AI Remix service error:", error);
    throw error;
  }
};