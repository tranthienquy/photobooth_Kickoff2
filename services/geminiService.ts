
import { GoogleGenAI } from "@google/genai";

const cleanBase64 = (dataUri: string) => {
  return dataUri.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
};

// Helper function to resize and compress image before sending to AI
// This drastically reduces upload time and processing latency
const resizeAndCompressImage = (base64Str: string, maxWidth = 1024, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Scale down if image is larger than maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          resolve(base64Str); // Fallback to original if context fails
          return;
      }
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => {
        resolve(base64Str); // Fallback to original on error
    };
  });
};

export const generateAiFrame = async (prompt: string): Promise<string> => {
  const fullPrompt = `Create a professional 4:5 portrait aspect ratio digital photo frame. 
    Style: ${prompt}. 
    Target dimensions: 1080x1350 pixels.
    The center must be empty/transparent for a person. 
    Design elements should be around the borders and corners.`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: fullPrompt }] },
      config: { imageConfig: { aspectRatio: "3:4" } }, 
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated.");
  } catch (error: any) {
    console.error("Gemini frame generation error:", error);
    throw error;
  }
};

export const remixUserPhoto = async (imageSrc: string, style: 'mascot' | 'cyberpunk' | 'anime' | 'portrait'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // OPTIMIZATION: Resize image to max 1024px width and 0.8 quality.
  // This reduces payload size from ~5MB to ~200KB, significantly speeding up the API call.
  const optimizedImage = await resizeAndCompressImage(imageSrc, 1024, 0.8);
  const base64Data = cleanBase64(optimizedImage);

  let prompt = "";
  if (style === 'mascot') {
    prompt = `ACT AS A PROFESSIONAL PHOTO EDITOR. 
    INPUT PHOTO RATIO IS EXACTLY 4:5 (1080x1350).
    TASK: ADD THE MASCOT "Aiyogu" INTO THE PHOTO.
    
    CRITICAL: 
    - KEEP THE ORIGINAL PERSON AND BACKGROUND 100% THE SAME.
    - OUTPUT MUST BE SUITABLE FOR 4:5 CROP (CENTERED COMPOSITION).
    
    MASCOT "Aiyogu" DETAILS: 
    3D-styled, vibrant orange, plump round creature, large curved horns with glowing cyan rings, sparkling eyes, glowing blush, gold chain with "Aiyogu" pendant.
    
    INTELLIGENT PLACEMENT:
    - Place Aiyogu as a COMPANION next to the person or on their shoulder.
    - Match lighting/shadows perfectly.`;
  } else if (style === 'cyberpunk') {
    prompt = "Transform the image into a futuristic Cyberpunk style with neon effects. Maintain 4:5 portrait ratio and person's identity.";
  } else if (style === 'anime') {
    prompt = "Transform this image into high-quality Japanese anime style. Maintain 4:5 portrait ratio and person's pose.";
  } else if (style === 'portrait') {
    prompt = "Realistic professional retouching: enhance lighting and colors. Maintain 4:5 portrait ratio.";
  }

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
        imageConfig: {
          aspectRatio: "3:4" // SDK doesn't support 4:5, so we use 3:4 and let the frontend crop slightly.
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No remixed image generated.");
  } catch (error: any) {
    console.error("AI Remix error:", error);
    throw error;
  }
};
