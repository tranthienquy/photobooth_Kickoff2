
export type Language = 'vi' | 'en';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface InfoBadge {
  id: string;
  iconType: 'circle' | 'vtv' | 'star' | 'award';
  topText: string;
  bottomText: string;
}

export interface Frame {
  id: string;
  name: string;
  url: string; // Data URI or URL
  isAiGenerated?: boolean;
}

export interface AppState {
  currentView: 'home' | 'capture' | 'edit' | 'result' | 'admin';
  selectedFrameId: string;
  userImage: string | null; // Data URI
  finalImage: string | null; // Data URI
  photoCount: number;
}

export interface AdminStats {
  totalPhotos: number;
}

export interface FontSizes {
  title: number;
  subtitle: number;
  badge: number;
  button: number;
  resultTitle: number;
  resultSubtitle: number; // New: Instruction text below Congrats
  loadingText: number;
  qrTitle: number; // New: "SCAN TO DOWNLOAD"
  qrSubtitle: number; // New: "Photos are ready..."
}

export interface ThemeConfig {
  // Brand
  eventTitle: string;
  eventSubtitle: string;
  logoUrl?: string;
  loadingIconUrl?: string; // New field for custom loading icon
  backgroundImageUrl?: string;
  primaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  
  // Font Sizes
  fontSizes?: FontSizes;

  // Hardware
  preferredCameraId?: string;
  
  // Storage
  firebaseConfig?: FirebaseConfig;
  
  // Home Screen Labels
  topBadgeText: string;       // "CUỘC THI SÁNG TẠO CÙNG AI"
  shootWithMascotText: string; // "Chụp ảnh cùng Aiyoru"
  captureButtonText: string;
  uploadButtonText: string;
  
  // Result Screen Labels
  congratsText: string;        // "Xinh Xỉu! ✨"
  resultInstructions: string;  // "Để mở ảnh trên điện thoại của bạn"
  downloadButtonText: string;
  retakeButtonText: string;
  qrScanText: string;         // "Quét mã QR"
  
  // Dynamic Badges
  infoBadges: InfoBadge[];
}
