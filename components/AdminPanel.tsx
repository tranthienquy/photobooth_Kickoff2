
import React, { useState, useRef, useEffect } from 'react';
import { Frame, AdminStats, ThemeConfig, Language, InfoBadge, FirebaseConfig } from '../types';
import { TRANSLATIONS } from '../constants';
import { generateAiFrame } from '../services/geminiService';
import { saveSystemConfiguration } from '../services/firebaseService';
import { Button } from './Button';
import { Sparkles, Trash2, Plus, Image as ImageIcon, Type, Palette, LayoutTemplate, XCircle, Upload, Camera, Monitor, Cloud, Save, Wallpaper, Loader } from 'lucide-react';

interface AdminPanelProps {
  frames: Frame[];
  stats: AdminStats;
  theme: ThemeConfig;
  selectedFrameId: string;
  onSelectFrame: (id: string) => void;
  onAddFrame: (frame: Frame) => void;
  onDeleteFrame: (id: string) => void;
  onUpdateFrames: (frames: Frame[]) => void;
  onUpdateTheme: (theme: ThemeConfig) => void;
  onClose: () => void;
  language: Language;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  frames,
  stats,
  theme,
  selectedFrameId,
  onSelectFrame,
  onAddFrame,
  onDeleteFrame,
  onUpdateFrames,
  onUpdateTheme,
  onClose,
  language
}) => {
  const [activeTab, setActiveTab] = useState<'frames' | 'branding' | 'devices' | 'storage'>('branding');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const loadingIconInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[language];
  // Safe defaults for all fonts
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
    refreshCameras();
  }, []);

  useEffect(() => {
    if (saveStatus === 'success' || saveStatus === 'error') {
      const timer = setTimeout(() => setSaveStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const refreshCameras = async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices);
    } catch (err) {
        console.error("Could not list cameras", err);
    }
  };

  const handleUpdateFirebase = (key: keyof FirebaseConfig, value: string) => {
    onUpdateTheme({
      ...theme,
      firebaseConfig: {
        ...(theme.firebaseConfig || { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" }),
        [key]: value
      }
    });
  };

  const handleUpdateFontSize = (key: keyof typeof fonts, value: number) => {
      onUpdateTheme({
          ...theme,
          fontSizes: {
              ...fonts,
              [key]: value
          }
      });
  };

  const handleSaveToCloud = async () => {
    if (!theme.firebaseConfig?.apiKey) {
      setActiveTab('storage');
      return;
    }
    
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const { frames: savedFrames, theme: savedTheme } = await saveSystemConfiguration(frames, theme, stats, theme.firebaseConfig);
      
      // Update local state with Cloud URLs
      onUpdateFrames(savedFrames);
      onUpdateTheme(savedTheme);
      
      setSaveStatus('success');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const imageUrl = await generateAiFrame(prompt);
      const newFrame: Frame = {
        id: `ai-${Date.now()}`,
        name: `AI: ${prompt.slice(0, 15)}...`,
        url: imageUrl,
        isAiGenerated: true
      };
      onAddFrame(newFrame);
      setPrompt('');
    } catch (e: any) {
      setError(t.aiRemixError);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onUpdateTheme({ ...theme, logoUrl: evt.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleLoadingIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onUpdateTheme({ ...theme, loadingIconUrl: evt.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onUpdateTheme({ ...theme, backgroundImageUrl: evt.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
         const reader = new FileReader();
         reader.onload = (evt) => {
             if(evt.target?.result) {
                 const newFrame: Frame = {
                    id: `custom-${Date.now()}`,
                    name: file.name,
                    url: evt.target.result as string,
                    isAiGenerated: false
                 }
                 onAddFrame(newFrame);
             }
         }
         reader.readAsDataURL(file);
     }
  };

  const fb = theme.firebaseConfig || { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-slide-up">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900">
        <div className="flex items-center gap-4">
            <div>
                <h2 className="font-size-200 font-black text-white uppercase tracking-tighter">{t.adminTitle}</h2>
                <p className="text-slate-200 text-xs">{t.totalPhotos}: <span className="text-emerald-400 font-mono font-bold">{stats.totalPhotos}</span></p>
            </div>
            
            <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

            <Button 
                variant={saveStatus === 'error' ? 'danger' : 'primary'} 
                className={`!py-2 !px-4 !text-xs gap-2 ${saveStatus === 'success' ? '!bg-green-600 !text-white' : ''}`}
                onClick={handleSaveToCloud}
                isLoading={isSaving}
                disabled={isSaving}
            >
                {saveStatus === 'success' ? (
                    <span className="flex items-center gap-2">✓ {t.saveConfigSuccess}</span>
                ) : saveStatus === 'error' ? (
                    <span className="flex items-center gap-2">✕ {t.saveConfigError}</span>
                ) : (
                    <span className="flex items-center gap-2"><Save className="w-4 h-4"/> {t.saveConfig}</span>
                )}
            </Button>
        </div>
        <Button variant="ghost" onClick={onClose}>{t.close}</Button>
      </div>

      <div className="flex border-b border-white/5 bg-slate-900/50">
        <button onClick={() => setActiveTab('branding')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${activeTab === 'branding' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-slate-500'}`}>
            <Palette className="w-4 h-4" /> {t.branding}
        </button>
        <button onClick={() => setActiveTab('frames')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${activeTab === 'frames' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-slate-500'}`}>
            <LayoutTemplate className="w-4 h-4" /> {t.frames}
        </button>
        <button onClick={() => setActiveTab('devices')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${activeTab === 'devices' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-slate-500'}`}>
            <Monitor className="w-4 h-4" /> {t.devices}
        </button>
        <button onClick={() => setActiveTab('storage')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${activeTab === 'storage' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-slate-500'}`}>
            <Cloud className="w-4 h-4" /> {t.storage}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar bg-[#050a09] bg-grid relative pb-32">
        {activeTab === 'storage' && (
            <div className="max-w-3xl mx-auto space-y-10">
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Cloud className="w-5 h-5 text-emerald-400"/> {t.firebaseSettings}</h3>
                    <p className="text-slate-400 text-xs">{t.firebaseHint}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">API Key</label>
                            <input type="password" value={fb.apiKey} onChange={(e) => handleUpdateFirebase('apiKey', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">Project ID</label>
                            <input type="text" value={fb.projectId} onChange={(e) => handleUpdateFirebase('projectId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">Storage Bucket</label>
                            <input type="text" value={fb.storageBucket} onChange={(e) => handleUpdateFirebase('storageBucket', e.target.value)} placeholder="your-project.appspot.com" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">App ID</label>
                            <input type="text" value={fb.appId} onChange={(e) => handleUpdateFirebase('appId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">Auth Domain</label>
                            <input type="text" value={fb.authDomain} onChange={(e) => handleUpdateFirebase('authDomain', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">Messaging Sender ID</label>
                            <input type="text" value={fb.messagingSenderId} onChange={(e) => handleUpdateFirebase('messagingSenderId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">Measurement ID</label>
                            <input type="text" value={fb.measurementId || ''} onChange={(e) => handleUpdateFirebase('measurementId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                        </div>
                    </div>
                </section>
            </div>
        )}
        
        {activeTab === 'devices' && (
            <div className="max-w-3xl mx-auto space-y-10">
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Camera className="w-5 h-5 text-emerald-400"/> {t.cameraSettings}</h3>
                        <button onClick={refreshCameras} className="text-[10px] font-black uppercase text-emerald-400 hover:underline">{t.refreshDevices}</button>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <label className="block text-[10px] text-slate-500 mb-2 uppercase font-black">{t.selectCamera}</label>
                            <div className="grid gap-3">
                                <button onClick={() => onUpdateTheme({ ...theme, preferredCameraId: undefined })} className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${!theme.preferredCameraId ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'}`}>
                                    <span className="font-bold text-sm">{t.defaultCamera}</span>
                                    {!theme.preferredCameraId && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                </button>
                                {cameras.map(device => (
                                    <button key={device.deviceId} onClick={() => onUpdateTheme({ ...theme, preferredCameraId: device.deviceId })} className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${theme.preferredCameraId === device.deviceId ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'}`}>
                                        <div className="text-left"><p className="font-bold text-sm truncate max-w-[200px]">{device.label || `Camera ${device.deviceId.slice(0,5)}`}</p></div>
                                        {theme.preferredCameraId === device.deviceId && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        )}

        {activeTab === 'branding' && (
            <div className="max-w-3xl mx-auto space-y-10">
                 {/* Logo Settings */}
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><ImageIcon className="w-5 h-5 text-emerald-400"/> {t.logoSettings}</h3>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                            {theme.logoUrl ? <img src={theme.logoUrl} className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-white/20 uppercase font-black">No Logo</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button variant="secondary" className="py-2 px-6 text-xs" onClick={() => logoInputRef.current?.click()}>
                                <Upload className="w-3 h-3" /> {t.uploadLogo}
                            </Button>
                            {theme.logoUrl && <button onClick={() => onUpdateTheme({...theme, logoUrl: ""})} className="text-red-400 text-[10px] font-bold uppercase hover:underline">{t.removeLogo}</button>}
                        </div>
                        <input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={handleLogoUpload} />
                    </div>
                </section>

                {/* Loading Icon Settings */}
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Loader className="w-5 h-5 text-pink-400"/> {t.loadingIconSettings}</h3>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                            {theme.loadingIconUrl ? <img src={theme.loadingIconUrl} className="max-w-full max-h-full object-contain animate-pulse" /> : <span className="text-[10px] text-white/20 uppercase font-black">Default</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button variant="secondary" className="py-2 px-6 text-xs" onClick={() => loadingIconInputRef.current?.click()}>
                                <Upload className="w-3 h-3" /> {t.uploadLoadingIcon}
                            </Button>
                            {theme.loadingIconUrl && <button onClick={() => onUpdateTheme({...theme, loadingIconUrl: ""})} className="text-red-400 text-[10px] font-bold uppercase hover:underline">{t.removeLoadingIcon}</button>}
                        </div>
                        <input type="file" accept="image/*" ref={loadingIconInputRef} className="hidden" onChange={handleLoadingIconUpload} />
                    </div>
                </section>

                {/* Background Settings */}
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Wallpaper className="w-5 h-5 text-blue-400"/> {t.backgroundSettings}</h3>
                    <div className="flex items-center gap-6">
                        <div className="w-32 h-20 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden relative group">
                            {theme.backgroundImageUrl ? (
                                <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${theme.backgroundImageUrl})` }} />
                            ) : (
                                <span className="text-[10px] text-white/20 uppercase font-black">No BG</span>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button variant="secondary" className="py-2 px-6 text-xs" onClick={() => bgInputRef.current?.click()}>
                                <Upload className="w-3 h-3" /> {t.uploadBackground}
                            </Button>
                            {theme.backgroundImageUrl && <button onClick={() => onUpdateTheme({...theme, backgroundImageUrl: ""})} className="text-red-400 text-[10px] font-bold uppercase hover:underline">{t.removeBackground}</button>}
                        </div>
                        <input type="file" accept="image/*" ref={bgInputRef} className="hidden" onChange={handleBackgroundUpload} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.bgColor}</label><input type="color" value={theme.backgroundColor} onChange={(e) => onUpdateTheme({...theme, backgroundColor: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl h-10 cursor-pointer" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.primaryColor}</label><input type="color" value={theme.primaryColor} onChange={(e) => onUpdateTheme({...theme, primaryColor: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl h-10 cursor-pointer" /></div>
                    </div>
                </section>
                
                {/* Text Content */}
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Type className="w-5 h-5 text-orange-400"/> {t.eventInfo}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.eventTitle}</label><input type="text" value={theme.eventTitle} onChange={(e) => onUpdateTheme({...theme, eventTitle: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.eventSubtitle}</label><input type="text" value={theme.eventSubtitle} onChange={(e) => onUpdateTheme({...theme, eventSubtitle: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                    </div>
                </section>

                {/* Typography Sizes */}
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Type className="w-5 h-5 text-cyan-400"/> {t.typography}</h3>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.titleSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.title}px</span>
                            </div>
                            <input type="range" min="20" max="150" value={fonts.title} onChange={(e) => handleUpdateFontSize('title', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.subtitleSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.subtitle}px</span>
                            </div>
                            <input type="range" min="12" max="60" value={fonts.subtitle} onChange={(e) => handleUpdateFontSize('subtitle', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.badgeSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.badge}px</span>
                            </div>
                            <input type="range" min="10" max="40" value={fonts.badge} onChange={(e) => handleUpdateFontSize('badge', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.buttonSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.button}px</span>
                            </div>
                            <input type="range" min="12" max="40" value={fonts.button} onChange={(e) => handleUpdateFontSize('button', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.resultTitleSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.resultTitle}px</span>
                            </div>
                            <input type="range" min="20" max="100" value={fonts.resultTitle} onChange={(e) => handleUpdateFontSize('resultTitle', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.resultSubtitleSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.resultSubtitle}px</span>
                            </div>
                            <input type="range" min="12" max="40" value={fonts.resultSubtitle} onChange={(e) => handleUpdateFontSize('resultSubtitle', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.loadingTextSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.loadingText}px</span>
                            </div>
                            <input type="range" min="16" max="60" value={fonts.loadingText} onChange={(e) => handleUpdateFontSize('loadingText', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.qrTitleSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.qrTitle}px</span>
                            </div>
                            <input type="range" min="16" max="60" value={fonts.qrTitle} onChange={(e) => handleUpdateFontSize('qrTitle', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[10px] text-slate-500 uppercase font-black">{t.qrSubtitleSize}</label>
                                <span className="text-xs font-mono text-emerald-400">{fonts.qrSubtitle}px</span>
                            </div>
                            <input type="range" min="10" max="30" value={fonts.qrSubtitle} onChange={(e) => handleUpdateFontSize('qrSubtitle', parseInt(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>
                </section>
                
                {/* Screen Labels */}
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><LayoutTemplate className="w-5 h-5 text-blue-400"/> {t.homeLabels}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.topBadgeLabel}</label><input type="text" value={theme.topBadgeText} onChange={(e) => onUpdateTheme({...theme, topBadgeText: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.captureButtonLabel}</label><input type="text" value={theme.captureButtonText} onChange={(e) => onUpdateTheme({...theme, captureButtonText: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                    </div>
                </section>
                <section className="space-y-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400"/> {t.resultLabels}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.congratsLabel}</label><input type="text" value={theme.congratsText} onChange={(e) => onUpdateTheme({...theme, congratsText: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.instrLabel}</label><input type="text" value={theme.resultInstructions} onChange={(e) => onUpdateTheme({...theme, resultInstructions: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.qrLabel}</label><input type="text" value={theme.qrScanText} onChange={(e) => onUpdateTheme({...theme, qrScanText: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.downloadBtnLabel}</label><input type="text" value={theme.downloadButtonText} onChange={(e) => onUpdateTheme({...theme, downloadButtonText: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                        <div><label className="block text-[10px] text-slate-500 mb-1 uppercase font-black">{t.retakeBtnLabel}</label><input type="text" value={theme.retakeButtonText} onChange={(e) => onUpdateTheme({...theme, retakeButtonText: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" /></div>
                    </div>
                </section>
            </div>
        )}

        {activeTab === 'frames' && (
             <div className="max-w-4xl mx-auto space-y-10">
                <section>
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter"><ImageIcon className="text-emerald-400" /> {t.frameList}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {frames.map((frame) => (
                        <div key={frame.id} onClick={() => onSelectFrame(frame.id)} className={`relative group rounded-[2rem] overflow-hidden border-4 cursor-pointer transition-all ${selectedFrameId === frame.id ? 'border-emerald-400 ring-4 ring-emerald-400/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-white/5 hover:border-white/20'}`}>
                            <div className="aspect-square bg-slate-800 p-2 flex items-center justify-center"><img src={frame.url} alt={frame.name} className="max-w-full max-h-full object-contain" /></div>
                            <div className="p-3 bg-slate-900 flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 truncate uppercase">{frame.name}</span><button onClick={(e) => { e.stopPropagation(); onDeleteFrame(frame.id); }} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 className="w-4 h-4" /></button></div>
                        </div>
                        ))}
                        <label className="flex flex-col items-center justify-center aspect-square rounded-[2rem] border-4 border-dashed border-white/10 hover:border-emerald-400/50 hover:bg-white/5 cursor-pointer transition-all group">
                            <input type="file" accept="image/*" className="hidden" onChange={handleCustomUpload} />
                            <Plus className="w-8 h-8 text-slate-700 group-hover:text-emerald-400 mb-2" />
                            <span className="text-[10px] font-black text-slate-600 uppercase">{t.addPngFrame}</span>
                        </label>
                    </div>
                </section>
                <section className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-[3rem] p-10 border border-white/5 shadow-2xl">
                    <h3 className="text-3xl font-black text-white mb-2 flex items-center gap-2 uppercase tracking-tighter"><Sparkles className="text-purple-400" /> {t.aiGenTitle}</h3>
                    <div className="flex gap-4 flex-col md:flex-row"><input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t.aiGenPlaceholder} className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-purple-500" /><Button onClick={handleGenerate} isLoading={isGenerating} disabled={!prompt} className="bg-gradient-to-r from-purple-600 to-blue-600 px-12 text-lg">{t.aiGenButton}</Button></div>
                </section>
             </div>
        )}
      </div>
    </div>
  );
};
