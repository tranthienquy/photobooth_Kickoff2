import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, CloudUpload, Camera } from 'lucide-react';
import { Button } from './Button';
import { Frame, ThemeConfig, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { remixUserPhoto } from '../services/geminiService';
import { uploadToFirebase, deleteFromFirebase } from '../services/firebaseService';
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
      setAutoHomeCountdown(45); 
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
            width: { ideal: 1920 }, 
            height: { ideal: 1080 }
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
    });
  };

  const processImage = async (base64Image: string) => {
    setProcessingState('ai');
    try {
      const remixedImage = await remixUserPhoto(base64Image, 'mascot');
      const finalResult = await compositeFrame(remixedImage, currentFrame.url);
      setFinalImage(finalResult);
      
      if (theme.firebaseConfig?.apiKey) {
          setProcessingState('uploading');
          try {
              const url = await uploadToFirebase(finalResult, theme.firebaseConfig);
              setCloudUrl(url);
          } catch (e) {
              console.error("Firebase auto-upload failed", e);
              // Fallback to locally generated image even if upload fails
          }
      }

      stopCamera();
      setStep('result');
      onPhotoTaken();
      
    } catch (error) {
      console.error("AI processing failed, falling back to original", error);
      const finalResult = await compositeFrame(base64Image, currentFrame.url);
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
    const track = streamRef.current?.getVideoTracks()[0];
    const settings = track?.getSettings();
    
    const sourceW = video.videoWidth;
    const sourceH = video.videoHeight;
    const targetRatio = 4 / 5;
    const videoRatio = sourceW / sourceH;
    
    let renderW, renderH, startX, startY;

    if (videoRatio > targetRatio) {
        renderH = sourceH;
        renderW = sourceH * targetRatio;
        startX = (sourceW - renderW) / 2;
        startY = 0;
    } else {
        renderW = sourceW;
        renderH = sourceW / targetRatio;
        startX = 0;
        startY = (sourceH - renderH) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isExternal = !!theme.preferredCameraId;
    const shouldMirror = !isExternal && (settings?.facingMode === 'user' || !settings?.facingMode);

    if (shouldMirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, renderW, renderH, 0, 0, canvas.width, canvas.height);
    const capturedImage = canvas.toDataURL('image/jpeg', 1.0);
    
    processImage(capturedImage);
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
      <div className="h-full w-full flex flex-col items-center justify-between animate-fade-in overflow-hidden relative pb-3 pt-2">
        {showFlash && <div className="fixed inset-0 z-[100] bg-white animate-pulse" />}
        
        {processingState !== 'idle' && (
            <div className="fixed text-cyan-50 inset-0 z-[110] bg-slate-950/98 backdrop-blur-[40px] flex flex-col items-center justify-center pb-4 text-center animate-fade-in">
                <AiyoguLoadingIcon 
                  label={processingState === 'ai' ? "Đang nhờ Aiyogu đứng cùng bạn..." : "Đang chuẩn bị ảnh cho bạn..."} 
                  customIconUrl={theme.loadingIconUrl}
                  fontSize={fonts.loadingText}
                />
            </div>
        )}

        {/* HEADER */}
        <div className="w-full text-center flex-shrink-0 px-4 mb-1">
            <div 
                className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-[0.1em] mb-1 shadow-lg"
                style={{ fontSize: `${fonts.badge * 0.7}px` }}
            >
                {theme.topBadgeText}
            </div>
            <h2 
                className="font-[900] tracking-tighter leading-none text-white uppercase drop-shadow-2xl mb-1"
                style={{ fontSize: `${fonts.title * 0.8}px` }}
            >
                {theme.eventTitle}
            </h2>
            {theme.eventSubtitle && (
              <p 
                className="text-slate-400 font-medium tracking-wide uppercase opacity-80"
                style={{ fontSize: `${fonts.subtitle * 0.6}px` }}
              >
                {theme.eventSubtitle}
              </p>
            )}
        </div>

        {/* CAMERA AREA */}
        <div className="flex-grow w-full flex items-center justify-center px-4 py-0 min-h-0 relative overflow-hidden">
            <div className="relative h-full w-auto aspect-[4/5] max-w-full overflow-hidden rounded-[2rem] border-2 border-white/10 bg-black shadow-[0_0_50px_rgba(16,185,129,0.1)] flex items-center justify-center ring-2 ring-black/20">
                 {isCameraReady ? (
                    <div className="relative w-full h-full">
                       <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!theme.preferredCameraId ? 'scale-x-[-1]' : ''}`} />
                       <div className="absolute inset-0 pointer-events-none opacity-100 z-10">
                         <img src={currentFrame.url} alt="" className="w-full h-full object-contain" />
                       </div>
                       {countdown !== null && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
                           <span className="text-[12rem] font-black text-white animate-ping drop-shadow-2xl">
                             {countdown}
                           </span>
                         </div>
                       )}
                    </div>
                 ) : (
                    <div className="text-center">
                       {cameraError ? <p className="text-white/60 font-bold px-10">{cameraError}</p> : <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />}
                    </div>
                 )}
            </div>
        </div>

        {/* FOOTER BUTTON */}
        <div className="w-full max-w-[320px] flex-shrink-0 px-4 mt-2 flex">
            <Button 
                variant="visual" 
                onClick={startCaptureSequence} 
                disabled={!isCameraReady || processingState !== 'idle' || countdown !== null} 
                className="w-full py-2.5 font-black rounded-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 text-base"
                style={{ fontSize: `${fonts.button * 0.9}px` }}
            >
                {countdown !== null ? `CHUẨN BỊ... ${countdown}` : (
                  <>
                    <Camera className="w-4 h-4" />
                    {theme.captureButtonText}
                  </>
                )}
            </Button>
        </div>
      </div>
    );
  }

  if (step === 'result' && finalImage) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center px-4 pb-6 pt-2 animate-fade-in overflow-hidden gap-3">
        
        <div className="w-full text-center flex-shrink-0">
            <h2 
                className="font-black text-white mb-0.5 uppercase tracking-tighter drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400"
                style={{ fontSize: `${fonts.resultTitle * 0.8}px` }}
            >
                {theme.congratsText}
            </h2>
            <p 
                className="text-slate-100 tracking-wide font-medium opacity-90"
                style={{ fontSize: `${fonts.resultSubtitle * 0.8}px` }}
            >
                {theme.resultInstructions}
            </p>
        </div>

        <div className="relative h-[68%] w-auto aspect-[4/5] rounded-[1.5rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border-2 border-white/10 bg-slate-900 shrink-0">
            <img src={finalImage} alt="Result" className="w-full h-full object-contain" />
        </div>

        <div className="w-full max-w-[320px] flex items-stretch gap-2 shrink-0 z-20 h-24">
            <div className="flex-[3] bg-white rounded-[1.5rem] p-2.5 flex items-center gap-3 shadow-2xl border-2 border-emerald-400/50">
                <div className="h-full aspect-square bg-slate-50 rounded-xl p-1.5 flex items-center justify-center border border-slate-100">
                    <QRCode value={cloudUrl || "https://google.com"} style={{ height: "100%", width: "100%" }} />
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0">
                     <p 
                        className="font-black leading-none text-slate-900 uppercase tracking-tighter whitespace-nowrap mb-1"
                        style={{ fontSize: `${fonts.qrTitle * 0.6}px` }}
                     >
                        {theme.qrScanText}
                     </p>
                     <div 
                        className="flex items-center gap-1.5 text-emerald-700 font-bold italic truncate"
                        style={{ fontSize: `${fonts.qrSubtitle * 0.75}px` }}
                     >
                        {cloudUrl ? <CloudUpload className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>{cloudUrl ? "Quét để tải ngay!" : "Đang tạo mã..."}</span>
                     </div>
                </div>
            </div>

            <Button 
                variant="secondary" 
                onClick={handleRetake} 
                isLoading={isDeleting} 
                disabled={isDeleting} 
                className="flex-1 rounded-[1.5rem] flex-col gap-1 !px-2 bg-slate-800/95 border-white/10 shadow-xl" 
                style={{ fontSize: `${fonts.button * 0.65}px` }}
            >
                <RefreshCw className="w-5 h-5 mb-0.5 text-emerald-400" /> 
                <span className="leading-none text-center font-bold uppercase">{theme.retakeButtonText}</span> 
                {autoHomeCountdown !== null && <span className="font-mono text-emerald-400/80 text-[10px]">({autoHomeCountdown}s)</span>}
            </Button>
        </div>
      </div>
    );
  }
  return null;
};