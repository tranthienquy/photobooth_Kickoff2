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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
          parts: [{ text: `Create a professional 4:5 portrait photo frame border with theme: ${prompt}. The center of the frame must be perfectly transparent white or empty space. Style: High-tech, clean, minimalist.` }] 
      },
      config: { 
        imageConfig: { aspectRatio: "3:4" } 
      }, 
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const optimizedImage = await resizeAndCompressImage(imageSrc, 1024, 0.85);
  const base64Data = cleanBase64(optimizedImage);

  // Re-engineered prompt for consistent mascot generation
  let prompt = `URGENT PHOTO EDITING TASK: Add the official 3D mascot "AIYOGU" into this portrait.
  
  MASCOT CHARACTER DESCRIPTION:
  - Name: AIYOGU
  - Appearance: A friendly, plump, vibrant orange 3D creature.
  - Features: Curved horns with glowing cyan/neon blue rings at the base. Big, sparkling, expressive eyes.
  - Accessory: Wearing a chunky gold chain with a medallion.
  - Style: Modern 3D animation style (like Pixar or Dreamworks).

  PLACEMENT INSTRUCTIONS:
  - Place AIYOGU standing right next to the person in the photo, appearing as if they are posing together for a selfie.
  - AIYOGU should be clearly visible and take up approximately 25-30% of the frame.
  - IMPORTANT: Maintain the original person, background, and lighting of the source photo perfectly.
  - Blend the mascot's lighting to match the environment of the photo.

  RETURN ONLY THE MODIFIED IMAGE.`;

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
    if (!candidates || candidates.length === 0) throw new Error("Empty response from AI");

    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image part found in AI response");
  } catch (error) {
    console.error("AI Remix service error:", error);
    throw error;
  }
};