import React, { useState, useRef, useEffect } from 'react';
import { Download, RefreshCw, XCircle, Cloud, Upload } from 'lucide-react';
import { Button } from './Button';
import { Frame, ThemeConfig, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { remixUserPhoto } from '../services/geminiService';
import { uploadToFirebase, deleteFromFirebase } from '../services/firebaseService';
import QRCode from 'react-qr-code';

const AiyoguLoadingIcon = ({ label, customIconUrl, fontSize }: { label: string, customIconUrl?: string, fontSize?: number }) => (
  <div className="relative w-64 h-64 flex flex-col items-center justify-center scale-150">
    <div className="relative mb-10 w-full flex justify-center">
        {customIconUrl ? (
             <div className="relative w-[140px] h-[140px] animate-[bounce_2s_infinite]">
                 <img src={customIconUrl} className="w-full h-full object-contain" alt="Loading" />
             </div>
        ) : (
            <>
                {/* Purple Sparkle */}
                <div className="absolute -top-4 -right-4 animate-pulse z-10">
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 10 L58 42 L90 50 L58 58 L50 90 L42 58 L10 50 L42 42 Z" fill="#a855f7" fillOpacity="0.8" />
                    <circle cx="75" cy="35" r="5" fill="#a855f7" fillOpacity="0.6" />
                </svg>
                </div>
                {/* Robot Head */}
                <div className="relative animate-[bounce_2s_infinite]">
                <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M42 20V12H58V20" stroke="#00f3ff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="18" y="28" width="64" height="52" rx="14" stroke="#00f3ff" strokeWidth="7" />
                    <rect x="36" y="48" width="7" height="16" rx="3.5" fill="#00f3ff" className="animate-pulse" />
                    <rect x="57" y="48" width="7" height="16" rx="3.5" fill="#00f3ff" className="animate-pulse" />
                </svg>
                </div>
            </>
        )}
    </div>
    <h3 
        className="font-black text-white uppercase tracking-tighter drop-shadow-lg text-center leading-none"
        style={{ fontSize: fontSize ? `${fontSize}px` : '30px' }}
    >
        {label}
    </h3>
  </div>
);

interface PhotoBoothProps {
  frames: Frame[];
  selectedFrameId: string;
  onPhotoTaken: () => void;
  theme: ThemeConfig;
  language: Language;
}

export const PhotoBooth: React.FC<PhotoBoothProps> = ({ frames, selectedFrameId, onPhotoTaken, theme, language }) => {
  const [step, setStep] = useState<'home' | 'result'>('home');
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [cloudUrl, setCloudUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [processingState, setProcessingState] = useState<'idle' | 'ai' | 'uploading'>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoHomeCountdown, setAutoHomeCountdown] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[language];
  const currentFrame = frames.find(f => f.id === selectedFrameId) || frames[0];
  // Ensure we fallback if loadingText is missing in old configs
  const fonts = { 
    title: 60, 
    subtitle: 24, 
    badge: 16, 
    button: 18, 
    resultTitle: 48, 
    resultSubtitle: 20,
    loadingText: 30,
    qrTitle: 32,
    qrSubtitle: 16,
    ...theme.fontSizes
  };

  useEffect(() => {
    if (step === 'home') startCamera();
    return () => stopCamera();
  }, [step, theme.preferredCameraId]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraReady]);

  // Logic đếm ngược tự động quay về trang chủ
  useEffect(() => {
    if (step === 'result') {
      setAutoHomeCountdown(20); // Bắt đầu đếm ngược từ 20 (Trước là 10)
    } else {
      setAutoHomeCountdown(null);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'result' && autoHomeCountdown !== null) {
      if (autoHomeCountdown <= 0) {
        handleRetake();
        return;
      }
      const timer = setTimeout(() => {
        setAutoHomeCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoHomeCountdown, step]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const preferredExists = videoDevices.some(d => d.deviceId === theme.preferredCameraId);

      let constraints: MediaStreamConstraints = {
        video: {
            deviceId: (theme.preferredCameraId && preferredExists) ? { ideal: theme.preferredCameraId } : undefined,
            facingMode: (theme.preferredCameraId && preferredExists) ? undefined : 'user',
            // Request 4K resolution (3840x2160) to get maximum sensor quality. 
            // Browser will fallback to highest available (e.g., 1080p) if 4K is not supported.
            width: { ideal: 3840 }, 
            height: { ideal: 2160 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraReady(true);
    } catch (err) {
      console.error("Camera Access Error:", err);
      setCameraError(language === 'vi' ? "Vui lòng cấp quyền camera" : "Please grant camera access");
    }
  };

  const compositeFrame = (userImg: string, frameUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      // Create canvas based on USER IMAGE dimensions (Highest Quality Source)
      // We do not hardcode 1080x1350 anymore.
      const uImg = new Image();
      uImg.crossOrigin = "anonymous";
      uImg.src = userImg;
      
      uImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = uImg.naturalWidth;
        canvas.height = uImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(userImg);

        // 1. Draw the user photo (background)
        ctx.drawImage(uImg, 0, 0);

        // 2. Load and draw the frame (foreground)
        const fImg = new Image();
        fImg.crossOrigin = "anonymous";
        fImg.src = frameUrl;
        
        fImg.onload = () => {
          // Stretch the frame to match the user photo's resolution exactly
          ctx.drawImage(fImg, 0, 0, canvas.width, canvas.height);
          
          // Export at max quality
          resolve(canvas.toDataURL('image/jpeg', 1.0));
        };
        
        fImg.onerror = () => {
            // Return just user img if frame fails
            resolve(userImg);
        }
      };
    });
  };

  const processAndUpload = async (sourceImage: string) => {
      setProcessingState('ai');
      try {
        const remixedImage = await remixUserPhoto(sourceImage, 'mascot');
        const finalResult = await compositeFrame(remixedImage, currentFrame.url);
        setFinalImage(finalResult);
        
        let uploadSuccess = false;
        if (theme.firebaseConfig?.apiKey) {
            setProcessingState('uploading');
            try {
                const url = await uploadToFirebase(finalResult, theme.firebaseConfig);
                setCloudUrl(url);
                uploadSuccess = true;
            } catch (e) {
                console.error("Firebase auto-upload failed", e);
            }
        }
  
        stopCamera();
        setStep('result');
        
        // LOGIC: Chỉ đếm số lượng ảnh nếu upload thành công hoặc chạy offline
        if (!theme.firebaseConfig?.apiKey || uploadSuccess) {
            onPhotoTaken();
        }
      } catch (error) {
        console.error("AI processing failed, falling back to original", error);
        // Fallback: Composite original capture with frame
        const finalResult = await compositeFrame(sourceImage, currentFrame.url);
        setFinalImage(finalResult);
        stopCamera();
        setStep('result');
        onPhotoTaken(); 
      } finally {
        setProcessingState('idle');
      }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);
    
    const video = videoRef.current;
    
    // Get actual source resolution from the camera stream
    const sourceW = video.videoWidth;
    const sourceH = video.videoHeight;
    
    // Determine target dimensions for 4:5 Crop based on SOURCE resolution
    const targetRatio = 4 / 5; // 0.8
    const videoRatio = sourceW / sourceH;
    
    let renderW, renderH, startX, startY;

    if (videoRatio > targetRatio) {
        // Video is wider than 4:5 (e.g. 16:9) -> Maximize Height
        renderH = sourceH;
        renderW = sourceH * targetRatio;
        startX = (sourceW - renderW) / 2;
        startY = 0;
    } else {
        // Video is taller than 4:5 -> Maximize Width
        renderW = sourceW;
        renderH = sourceW / targetRatio;
        startX = 0;
        startY = (sourceH - renderH) / 2;
    }

    // Set canvas to the CALCULATED high-res dimensions
    const canvas = document.createElement('canvas');
    canvas.width = renderW;
    canvas.height = renderH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const track = streamRef.current?.getVideoTracks()[0];
    const settings = track?.getSettings();
    const isExternal = !!theme.preferredCameraId;
    const shouldMirror = !isExternal && (settings?.facingMode === 'user' || !settings?.facingMode);

    // Draw video frame with cropping
    if (shouldMirror) {
        ctx.translate(renderW, 0);
        ctx.scale(-1, 1);
    }

    // Capture exact crop from video source to canvas
    ctx.drawImage(video, startX, startY, renderW, renderH, 0, 0, renderW, renderH);
    
    // Get high-quality base64
    const capturedImage = canvas.toDataURL('image/jpeg', 1.0);
    
    await processAndUpload(capturedImage);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset value so same file can be chosen again
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        if (!rawBase64) return;
        
        // Manual crop to 4:5 to ensure frame fits perfectly
        const img = new Image();
        img.src = rawBase64;
        await new Promise((resolve) => { img.onload = resolve; });

        const targetRatio = 4/5;
        const srcRatio = img.width / img.height;
        let cropW, cropH, cropX, cropY;

        if (srcRatio > targetRatio) {
            // Wider -> Crop Width
            cropH = img.height;
            cropW = img.height * targetRatio;
            cropX = (img.width - cropW) / 2;
            cropY = 0;
        } else {
            // Taller -> Crop Height
            cropW = img.width;
            cropH = img.width / targetRatio;
            cropX = 0;
            cropY = (img.height - cropH) / 2;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        
        const croppedImage = canvas.toDataURL('image/jpeg', 1.0);
        await processAndUpload(croppedImage);
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = async () => {
    if (cloudUrl && theme.firebaseConfig) {
        setIsDeleting(true);
        try {
            await deleteFromFirebase(cloudUrl, theme.firebaseConfig);
        } catch (e) {
            console.error("Delete failed", e);
        } finally {
            setIsDeleting(false);
        }
    }
    setFinalImage(null);
    setCloudUrl(null);
    setStep('home');
  };

  const startCaptureSequence = () => {
    if (countdown !== null || !isCameraReady) return;
    let currentCount = 3;
    setCountdown(currentCount);
    const interval = setInterval(() => {
      currentCount -= 1;
      if (currentCount === 0) {
        clearInterval(interval);
        setCountdown(null);
        handleCapture();
      } else {
        setCountdown(currentCount);
      }
    }, 1000);
  };

  if (step === 'home') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-between animate-fade-in overflow-hidden relative pb-10 pt-4">
        {showFlash && <div className="fixed inset-0 z-[100] bg-white animate-pulse" />}
        
        {processingState !== 'idle' && (
            <div className="fixed text-cyan-50 inset-0 z-[110] bg-slate-950/98 backdrop-blur-[40px] flex flex-col items-center justify-center pb-4 text-center animate-fade-in">
                <AiyoguLoadingIcon 
                  label={processingState === 'ai' ? "Đang tìm Aiyogu..." : " "} 
                  customIconUrl={theme.loadingIconUrl}
                  fontSize={fonts.loadingText}
                />
                <p 
                    className="text-cyan-50 font-bold mt-12 animate-pulse uppercase tracking-widest"
                    style={{ fontSize: `${fonts.loadingText * 0.8}px` }}
                >
                    {processingState === 'ai' ? "bạn vui lòng chờ xíu nhé" : "đang tải ảnh lên..."}
                </p>
            </div>
        )}

        {/* HEADER SECTION - Scale lớn cho Standee */}
        <div className="w-full text-center flex-shrink-0 px-2 mt-1">
            <div 
                className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-[0.2em] mb-2 shadow-lg"
                style={{ fontSize: `${fonts.badge}px` }}
            >
                {theme.topBadgeText}
            </div>
          <h2 
                className="font-[900] tracking-tighter leading-none text-white uppercase drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                style={{ fontSize: `${fonts.title}px` }}
            >
                {theme.eventTitle}
            </h2>
             <p 
                className="mt-1 font-extrabold bg-gradient-to-r from-[#f59e0b] to-[#10b981] bg-clip-text text-transparent italic"
                style={{ fontSize: `${fonts.subtitle}px` }}
             >
                {theme.eventSubtitle}
            </p>
        </div>

        {/* CAMERA PREVIEW - Tối ưu tỷ lệ lấp đầy */}
        <div className="flex-grow w-full flex items-center justify-center px-6 py-6 min-h-0">
            <div className="relative h-full w-auto aspect-[4/5] max-w-full overflow-hidden rounded-[1.5rem] border-2 border-white/20 bg-emerald-950/20 backdrop-blur-sm shadow-[0_0_80px_rgba(0,0,0,0.7)] flex items-center justify-center ring-4 ring-black/20">
                 {isCameraReady ? (
                    <div className="relative w-full h-full">
                       <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!theme.preferredCameraId ? 'scale-x-[-1]' : ''}`} />
                       <div className="absolute inset-0 pointer-events-none opacity-100 z-10">
                         <img src={currentFrame.url} alt="" className="w-full h-full object-contain" />
                       </div>
                       {countdown !== null && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 animate-fade-in">
                           <span className="text-[12rem] font-black text-white animate-ping drop-shadow-2xl">
                             {countdown}
                           </span>
                         </div>
                       )}
                    </div>
                 ) : (
                    <div className="text-center space-y-6">
                       {cameraError ? <p className="text-white/60 font-bold text-xl">{cameraError}</p> : <div className="w-16 h-16 border-8 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />}
                    </div>
                 )}
            </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="h-[10%] w-full flex items-center justify-center gap-4 mx-auto mb-20 px-6 z-40">
            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
            />
            
            {/* Upload Button */}
            <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={processingState !== 'idle' || countdown !== null}
                className="h-16 w-16 !p-0 rounded-full flex items-center justify-center shadow-lg bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 shrink-0"
            >
                <Upload className="w-6 h-6 text-white" />
            </Button>

            {/* Capture Button */}
            <Button 
                variant="visual" 
                onClick={startCaptureSequence} 
                disabled={!isCameraReady || processingState !== 'idle' || countdown !== null} 
                className="w-full max-w-xs py-3 font-bold rounded-full shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-transform"
                style={{ fontSize: `${fonts.button}px` }}
            >
                {countdown !== null ? `CƯỜI LÊN NÀO... ${countdown}` : theme.captureButtonText}
            </Button>
        </div>
      </div>
    );
  }

  if (step === 'result' && finalImage) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center px-4 pb-10 pt-2 animate-fade-in overflow-hidden gap-6">
        
        {/* RESULT HEADER */}
        <div className="w-full text-center flex-shrink-0">
            <h2 
                className="font-black text-white mb-1 uppercase tracking-tighter drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400"
                style={{ fontSize: `${fonts.resultTitle}px` }}
            >
                {theme.congratsText}
            </h2>
            <p 
                className="text-slate-100 tracking-wide"
                style={{ fontSize: `${fonts.resultSubtitle}px` }}
            >
                {theme.resultInstructions}
            </p>
        </div>

        {/* RESULT IMAGE - Scaled Down (50% Height) */}
        <div className="relative h-[50%] w-auto aspect-[4/5] rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border-4 border-white/20 bg-slate-900 ring-4 ring-black/30 shrink-0">
            <img src={finalImage} alt="Result" className="w-full h-full object-contain" />
        </div>

        {/* ACTIONS CONTAINER - Pushed Up due to Center Layout */}
        <div className="w-full max-w-xl flex items-stretch gap-3 shrink-0 z-20 h-20">
            
            {/* QR Code Container */}
            <div className="flex-1 bg-white rounded-3xl p-2 flex items-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.3)] border-2 border-emerald-400/50">
                <div className="h-full aspect-square bg-slate-50 rounded-2xl p-1.5 flex items-center justify-center border border-slate-100">
                    <QRCode value={cloudUrl || window.location.href} style={{ height: "100%", width: "100%" }} />
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                     <p 
                        className="font-black leading-snug text-slate-900 uppercase tracking-tighter whitespace-nowrap"
                        style={{ fontSize: `${fonts.qrTitle * 0.7}px` }}
                     >
                        {theme.qrScanText}
                     </p>
                     <div 
                        className="flex items-center gap-1.5 text-slate-600 font-bold italic truncate"
                        style={{ fontSize: `${fonts.qrSubtitle * 0.8}px` }}
                     >
                        {cloudUrl ? <Cloud className="w-4 h-4 text-emerald-600" /> : <span className="animate-pulse">...</span>}
                        <span>{cloudUrl ? "Ảnh đã sẵn sàng!" : "Đang tạo mã..."}</span>
                     </div>
                </div>
            </div>

            {/* Retake Button */}
            <Button 
                variant="visual" 
                onClick={handleRetake} 
                isLoading={isDeleting} 
                disabled={isDeleting} 
                className="w-1/3 rounded-3xl flex-col gap-1 !px-2 shadow-lg" 
                style={{ fontSize: `${fonts.button * 0.7}px` }}
            >
                <RefreshCw className="w-6 h-6 mb-1 text-white" /> 
                <span className="leading-none text-center">{theme.retakeButtonText}</span> 
                {autoHomeCountdown !== null && <span className="font-mono text-white/90 font-bold">({autoHomeCountdown})</span>}
            </Button>
        </div>
      </div>
    );
  }
  return null;
};
