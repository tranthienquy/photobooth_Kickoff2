import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, CloudUpload, Camera, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Frame, ThemeConfig, Language } from '../types';
import { remixUserPhoto } from '../services/geminiService';
import { uploadToFirebase, deleteFromFirebase, incrementPhotoCount } from '../services/firebaseService';
import QRCode from 'react-qr-code';

const AiyoguLoadingIcon = ({ label, customIconUrl, fontSize }: { label: string, customIconUrl?: string, fontSize?: number }) => (
  <div className="relative w-64 h-64 flex flex-col items-center justify-center scale-125 sm:scale-150">
    <div className="relative mb-10 w-full flex justify-center">
        {customIconUrl ? (
             <div className="relative w-[140px] h-[140px] animate-[bounce_2s_infinite]">
                 <img src={customIconUrl} className="w-full h-full object-contain" alt="Loading" />
             </div>
        ) : (
            <>
                <div className="absolute -top-4 -right-4 animate-pulse z-10">
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 10 L58 42 L90 50 L58 58 L50 90 L42 58 L10 50 L42 42 Z" fill="#a855f7" fillOpacity="0.8" />
                    <circle cx="75" cy="35" r="5" fill="#a855f7" fillOpacity="0.6" />
                </svg>
                </div>
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
        className="font-black text-white uppercase tracking-tighter drop-shadow-lg text-center leading-none px-4"
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

  const currentFrame = frames.find(f => f.id === selectedFrameId) || frames[0];
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
  }, [isCameraReady, step]);

  useEffect(() => {
    if (step === 'result') {
      setAutoHomeCountdown(60); 
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
      const constraints: MediaStreamConstraints = {
        video: {
            deviceId: theme.preferredCameraId ? { ideal: theme.preferredCameraId } : undefined,
            facingMode: theme.preferredCameraId ? undefined : 'user',
            width: { ideal: 1920 }, 
            height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraReady(true);
    } catch (err) {
      setCameraError(language === 'vi' ? "Lỗi truy cập Camera" : "Camera error");
    }
  };

  const compositeFrame = (userImg: string, frameUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const uImg = new Image();
      uImg.crossOrigin = "anonymous";
      uImg.src = userImg;
      
      uImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = uImg.naturalWidth;
        canvas.height = uImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(userImg);
        ctx.drawImage(uImg, 0, 0);
        const fImg = new Image();
        fImg.crossOrigin = "anonymous";
        fImg.src = frameUrl;
        fImg.onload = () => {
          ctx.drawImage(fImg, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        fImg.onerror = () => resolve(userImg);
      };
      uImg.onerror = () => resolve(userImg);
    });
  };

  const processImage = async (base64Image: string) => {
    setProcessingState('ai');
    try {
      // 1. Gọi AI Mascot
      const remixedImage = await remixUserPhoto(base64Image, 'mascot');
      // 2. Ghép khung
      const finalResult = await compositeFrame(remixedImage, currentFrame.url);
      setFinalImage(finalResult);
      stopCamera();
      setStep('result');

      // 3. Upload Firebase
      if (theme.firebaseConfig?.apiKey) {
          setProcessingState('uploading');
          try {
              const url = await uploadToFirebase(finalResult, theme.firebaseConfig);
              setCloudUrl(url);
              await incrementPhotoCount(theme.firebaseConfig);
              onPhotoTaken();
          } catch (e) {
              console.error("Upload failed:", e);
          } finally {
              setProcessingState('idle');
          }
      } else {
          setProcessingState('idle');
          onPhotoTaken();
      }
    } catch (error) {
      console.error("AI Mascot Process Failed:", error);
      const fallback = await compositeFrame(base64Image, currentFrame.url);
      setFinalImage(fallback);
      stopCamera();
      setStep('result');
      setProcessingState('idle');
      onPhotoTaken(); 
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sourceW = video.videoWidth;
    const sourceH = video.videoHeight;
    const targetRatio = 4 / 5;
    let dW, dH, dX, dY;

    if (sourceW / sourceH > targetRatio) {
        dH = sourceH;
        dW = sourceH * targetRatio;
        dX = (sourceW - dW) / 2;
        dY = 0;
    } else {
        dW = sourceW;
        dH = sourceW / targetRatio;
        dX = 0;
        dY = (sourceH - dH) / 2;
    }

    if (!theme.preferredCameraId) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(video, dX, dY, dW, dH, 0, 0, canvas.width, canvas.height);
    processImage(canvas.toDataURL('image/jpeg', 0.95));
  };

  const handleRetake = async () => {
    if (cloudUrl && theme.firebaseConfig) {
        setIsDeleting(true);
        try { await deleteFromFirebase(cloudUrl, theme.firebaseConfig); } catch (e) {} finally { setIsDeleting(false); }
    }
    setFinalImage(null);
    setCloudUrl(null);
    setStep('home');
  };

  const startCountdown = () => {
    if (countdown !== null || !isCameraReady) return;
    let count = 3;
    setCountdown(count);
    const timer = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(timer);
        setCountdown(null);
        handleCapture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  if (step === 'home') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-between animate-fade-in overflow-hidden relative pb-3 pt-2">
        {showFlash && <div className="fixed inset-0 z-[100] bg-white animate-pulse" />}
        {processingState !== 'idle' && (
            <div className="fixed inset-0 z-[110] bg-slate-950/98 backdrop-blur-[40px] flex flex-col items-center justify-center text-center animate-fade-in">
                <AiyoguLoadingIcon 
                  label={processingState === 'ai' ? "Đang nhờ Aiyogu đứng cùng bạn..." : "Đang đẩy ảnh lên mây..."} 
                  customIconUrl={theme.loadingIconUrl}
                  fontSize={fonts.loadingText}
                />
            </div>
        )}

        <div className="w-full text-center px-4 mb-1">
            <div className="inline-flex items-center px-3 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-widest mb-1 shadow-lg text-[10px]">
                {theme.topBadgeText}
            </div>
            <h2 className="font-black tracking-tighter leading-none text-white uppercase drop-shadow-2xl mb-1" style={{ fontSize: `${fonts.title * 0.7}px` }}>
                {theme.eventTitle}
            </h2>
        </div>

        <div className="flex-grow w-full flex items-center justify-center px-4 overflow-hidden">
            <div className="relative h-full w-auto aspect-[4/5] max-w-full overflow-hidden rounded-[2rem] border-2 border-white/10 bg-black shadow-2xl flex items-center justify-center">
                 {isCameraReady ? (
                    <>
                       <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!theme.preferredCameraId ? 'scale-x-[-1]' : ''}`} />
                       <img src={currentFrame.url} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10" />
                       {countdown !== null && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
                           <span className="text-[10rem] font-black text-white animate-ping">{countdown}</span>
                         </div>
                       )}
                    </>
                 ) : (
                    <div className="text-center p-6">
                       {cameraError ? <p className="text-red-400 font-bold">{cameraError}</p> : <RefreshCw className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />}
                    </div>
                 )}
            </div>
        </div>

        <div className="w-full max-w-[320px] px-4 mt-2">
            <Button 
                variant="visual" 
                onClick={startCountdown} 
                disabled={!isCameraReady || processingState !== 'idle' || countdown !== null} 
                className="w-full py-3"
            >
                {countdown !== null ? "CHỜ XÍU..." : <><Camera className="w-5 h-5" /> {theme.captureButtonText}</>}
            </Button>
        </div>
      </div>
    );
  }

  if (step === 'result' && finalImage) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center px-4 pb-6 pt-2 animate-fade-in gap-3 overflow-hidden">
        <div className="text-center">
            <h2 className="font-black text-white mb-0.5 uppercase tracking-tighter" style={{ fontSize: `${fonts.resultTitle * 0.7}px` }}>{theme.congratsText}</h2>
            <p className="text-slate-400 text-xs">{theme.resultInstructions}</p>
        </div>

        <div className="relative h-[65%] w-auto aspect-[4/5] rounded-[1.5rem] overflow-hidden shadow-2xl border-2 border-white/10 shrink-0">
            <img src={finalImage} alt="Result" className="w-full h-full object-contain" />
        </div>

        <div className="w-full max-w-[340px] flex items-stretch gap-2 shrink-0 h-24">
            <div className="flex-[3] bg-white rounded-[1.5rem] p-2 flex items-center gap-3 shadow-2xl border-2 border-emerald-400/50">
                <div className="h-full aspect-square bg-slate-50 rounded-xl p-1 flex items-center justify-center border border-slate-100 overflow-hidden">
                    {cloudUrl ? <QRCode value={cloudUrl} style={{ height: "100%", width: "100%" }} /> : <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />}
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0">
                     <p className="font-black leading-none text-slate-900 uppercase text-sm mb-1">{theme.qrScanText}</p>
                     <p className="text-[10px] text-emerald-600 font-bold italic truncate">
                        {cloudUrl ? "Quét để tải ngay!" : "Đang tạo mã..."}
                     </p>
                </div>
            </div>
            <Button variant="secondary" onClick={handleRetake} isLoading={isDeleting} className="flex-1 rounded-[1.5rem] flex-col !p-0">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-black uppercase">{theme.retakeButtonText}</span>
            </Button>
        </div>
      </div>
    );
  }
  return null;
};