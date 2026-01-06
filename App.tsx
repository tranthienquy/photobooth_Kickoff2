
import React, { useState, useEffect } from 'react';
import { PhotoBooth } from './components/PhotoBooth';
import { AdminPanel } from './components/AdminPanel';
import { INITIAL_FRAMES, DEFAULT_THEME, STORAGE_KEYS, TRANSLATIONS } from './constants';
import { Frame, AdminStats, ThemeConfig, Language } from './types';
import { Settings, Languages } from 'lucide-react';
import { getSystemConfiguration, incrementPhotoCount } from './services/firebaseService';

const App: React.FC = () => {
  const [frames, setFrames] = useState<Frame[]>(INITIAL_FRAMES);
  const [selectedFrameId, setSelectedFrameId] = useState<string>(INITIAL_FRAMES[0].id);
  const [stats, setStats] = useState<AdminStats>({ totalPhotos: 0 });
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('vi');

  const t = TRANSLATIONS[language];

  useEffect(() => {
    // 1. Load from Local Storage first (Fast paint)
    const savedFrames = localStorage.getItem(STORAGE_KEYS.FRAMES);
    const savedStats = localStorage.getItem(STORAGE_KEYS.STATS);
    const savedThemeStr = localStorage.getItem(STORAGE_KEYS.THEME);
    const savedLang = localStorage.getItem(STORAGE_KEYS.LANG) as Language;

    if (savedFrames) {
      try { setFrames(JSON.parse(savedFrames)); } catch (e) { console.error("Error parsing frames"); }
    }
    if (savedStats) {
      try { setStats(JSON.parse(savedStats)); } catch(e) { console.error("Error parsing stats"); }
    }
    
    let activeTheme = DEFAULT_THEME;
    if (savedThemeStr) {
        try { 
            const parsedTheme = JSON.parse(savedThemeStr);
            setTheme(parsedTheme); 
            activeTheme = parsedTheme;
        } catch(e) { console.error("Error parsing theme"); }
    }

    if (savedLang && (savedLang === 'vi' || savedLang === 'en')) {
      setLanguage(savedLang);
    }

    // 2. Always attempt to sync from Cloud Database (Source of Truth)
    // This runs regardless of whether we have local storage, using the best available config.
    const fbConfig = activeTheme.firebaseConfig;
    if (fbConfig?.apiKey && fbConfig?.projectId) {
        getSystemConfiguration(fbConfig).then(cloudData => {
            if (cloudData) {
                console.log("Synced configuration from Cloud Database");
                
                // Update Frames
                if (cloudData.frames && cloudData.frames.length > 0) {
                    setFrames(cloudData.frames);
                    setSelectedFrameId(prevId => {
                        const exists = cloudData.frames.find(f => f.id === prevId);
                        return exists ? prevId : cloudData.frames[0].id;
                    });
                }
                
                // Update Theme (Branding, Logo, Texts)
                if (cloudData.theme) {
                    setTheme(prev => ({
                        ...prev,
                        ...cloudData.theme,
                        // Preserve config if missing in cloud (unlikely but safe)
                        firebaseConfig: cloudData.theme.firebaseConfig || prev.firebaseConfig
                    }));
                }

                // Update Stats
                if (cloudData.stats) {
                    setStats(cloudData.stats);
                }
            }
        }).catch(err => {
            console.error("Failed to sync with cloud database:", err);
        });
    }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.FRAMES, JSON.stringify(frames)); }, [frames]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats)); }, [stats]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(theme)); }, [theme]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.LANG, language); }, [language]);

  const handlePhotoTaken = async () => {
    // 1. Optimistic update local stats
    setStats(prev => ({ ...prev, totalPhotos: prev.totalPhotos + 1 }));

    // 2. Persist to Cloud if configured
    if (theme.firebaseConfig?.apiKey) {
        try {
            await incrementPhotoCount(theme.firebaseConfig);
        } catch (e) {
            console.error("Failed to increment cloud stats", e);
        }
    }
  };

  const handleAddFrame = (newFrame: Frame) => {
    setFrames(prev => [...prev, newFrame]);
    setSelectedFrameId(newFrame.id);
  };

  const handleDeleteFrame = (id: string) => {
    setFrames(prev => {
        const remaining = prev.filter(f => f.id !== id);
        if (selectedFrameId === id && remaining.length > 0) {
            setSelectedFrameId(remaining[0].id);
        }
        return remaining;
    });
  };

  const handleUpdateFrames = (newFrames: Frame[]) => {
      setFrames(newFrames);
      // Ensure selected frame is valid
      if (!newFrames.find(f => f.id === selectedFrameId) && newFrames.length > 0) {
          setSelectedFrameId(newFrames[0].id);
      }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'vi' ? 'en' : 'vi');
  };

  const appStyles = {
      backgroundColor: theme.backgroundColor,
      backgroundImage: theme.backgroundImageUrl ? `url(${theme.backgroundImageUrl})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      fontFamily: theme.fontFamily,
      '--primary-color': theme.primaryColor,
  } as React.CSSProperties & { [key: string]: any };
  
  // Use a sensible default if fontSizes is undefined (old config)
  const fonts = theme.fontSizes || { title: 60 };

  return (
    <div className="h-full w-full text-white selection:bg-cyan-500/30 flex flex-col overflow-hidden transition-colors duration-500" style={appStyles}>
      
      {/* Header Standee - Tăng padding và kích thước */}
      <header 
        className="flex-shrink-0 z-50 px-6 py-4 flex justify-between items-center relative border-b border-white/5"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <div className="select-none">
            {theme.logoUrl ? (
                <img src={theme.logoUrl} alt="Logo" className="h-12 sm:h-16 w-auto object-contain" />
            ) : (
                <h1 
                    className="font-black tracking-tighter uppercase" 
                    style={{ color: theme.primaryColor, fontSize: `${fonts.title * 0.5}px` }} // Scale down for header
                >
                    {theme.eventTitle}
                </h1>
            )}
        </div>
        
        <div className="flex items-center gap-6">
            <button 
                onClick={() => setIsAdminOpen(true)}
                className="p-2 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-colors"
            >
                <Settings className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full relative overflow-hidden z-10">
        <PhotoBooth 
            frames={frames}
            selectedFrameId={selectedFrameId}
            onPhotoTaken={handlePhotoTaken}
            theme={theme}
            language={language}
        />
      </main>

      {/* Admin Overlay */}
      {isAdminOpen && (
        <AdminPanel 
            frames={frames}
            stats={stats}
            theme={theme}
            selectedFrameId={selectedFrameId}
            onSelectFrame={setSelectedFrameId}
            onAddFrame={handleAddFrame}
            onDeleteFrame={handleDeleteFrame}
            onUpdateFrames={handleUpdateFrames}
            onUpdateTheme={setTheme}
            onClose={() => setIsAdminOpen(false)}
            language={language}
        />
      )}
    </div>
  );
};

export default App;
