
import { initializeApp, getApp, getApps } from "firebase/app";
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from "firebase/firestore";
import { FirebaseConfig, Frame, ThemeConfig, AdminStats } from "../types";

// Helper để upload ảnh asset (khung, logo)
const uploadAsset = async (storage: any, base64String: string, path: string): Promise<string> => {
  if (!base64String || !base64String.startsWith('data:')) return base64String;
  
  const storageRef = ref(storage, path);
  const dataPart = base64String.split(',')[1];
  await uploadString(storageRef, dataPart, 'base64', { contentType: 'image/png' });
  return await getDownloadURL(storageRef);
};

export const uploadToFirebase = async (base64Image: string, config: FirebaseConfig): Promise<string> => {
  if (!config.apiKey || !config.storageBucket) {
    throw new Error("Firebase config is incomplete");
  }
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  const storage = getStorage(app);
  
  const fileName = `photos/aiyogu_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const storageRef = ref(storage, fileName);

  try {
    const dataPart = base64Image.split(',')[1];
    await uploadString(storageRef, dataPart, 'base64', { contentType: 'image/jpeg' });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Firebase upload error:", error);
    throw error;
  }
};

export const deleteFromFirebase = async (imageUrl: string, config: FirebaseConfig): Promise<void> => {
  if (!config.apiKey || !imageUrl) return;

  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  const storage = getStorage(app);
  
  const storageRef = ref(storage, imageUrl);

  try {
    await deleteObject(storageRef);
    console.log("Deleted image from cloud:", imageUrl);
  } catch (error) {
    console.error("Error deleting image:", error);
  }
};

export const incrementPhotoCount = async (config: FirebaseConfig): Promise<void> => {
  if (!config.apiKey || !config.projectId) return;
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  const db = getFirestore(app);
  const docRef = doc(db, "settings", "global");
  
  try {
    await updateDoc(docRef, {
        "stats.totalPhotos": increment(1)
    });
  } catch (error) {
      // If doc doesn't exist yet, set it
      console.warn("Stats doc missing, creating new one...");
      await setDoc(docRef, { stats: { totalPhotos: 1 } }, { merge: true });
  }
};

export const saveSystemConfiguration = async (
  frames: Frame[],
  theme: ThemeConfig,
  stats: AdminStats,
  config: FirebaseConfig
): Promise<{ frames: Frame[], theme: ThemeConfig }> => {
  if (!config.apiKey || !config.projectId) throw new Error("Missing Firebase Config");

  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  const storage = getStorage(app);
  const db = getFirestore(app);

  // 1. Xử lý upload ảnh Frames (nếu đang là base64)
  const processedFrames = await Promise.all(frames.map(async (frame) => {
    if (frame.url.startsWith('data:')) {
      const url = await uploadAsset(storage, frame.url, `assets/frames/${frame.id}.png`);
      return { ...frame, url };
    }
    return frame;
  }));

  // 2. Xử lý upload Assets trong Theme (Logo, Background, Loading Icon)
  let processedTheme = { ...theme };
  
  if (theme.logoUrl && theme.logoUrl.startsWith('data:')) {
    const url = await uploadAsset(storage, theme.logoUrl, `assets/branding/logo.png`);
    processedTheme.logoUrl = url;
  }

  if (theme.loadingIconUrl && theme.loadingIconUrl.startsWith('data:')) {
    // Timestamp để tránh cache
    const url = await uploadAsset(storage, theme.loadingIconUrl, `assets/branding/loading_${Date.now()}.png`);
    processedTheme.loadingIconUrl = url;
  }

  if (theme.backgroundImageUrl && theme.backgroundImageUrl.startsWith('data:')) {
    const url = await uploadAsset(storage, theme.backgroundImageUrl, `assets/branding/background_${Date.now()}.png`);
    processedTheme.backgroundImageUrl = url;
  }

  // 3. Lưu JSON vào Firestore
  try {
    await setDoc(doc(db, "settings", "global"), {
      frames: processedFrames,
      theme: processedTheme,
      stats: stats,
      updatedAt: new Date().toISOString()
    });
    
    return { frames: processedFrames, theme: processedTheme };
  } catch (error) {
    console.error("Error saving configuration:", error);
    throw error;
  }
};

export const getSystemConfiguration = async (
  config: FirebaseConfig
): Promise<{ frames: Frame[], theme: ThemeConfig, stats: AdminStats } | null> => {
  if (!config.apiKey || !config.projectId) return null;
  
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  const db = getFirestore(app);
  
  try {
    const docRef = doc(db, "settings", "global");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        frames: data.frames || [],
        theme: data.theme || {},
        stats: data.stats || { totalPhotos: 0 }
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching config:", error);
    return null;
  }
};
