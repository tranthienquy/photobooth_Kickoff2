
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'visual';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading,
  disabled,
  ...props 
}) => {
  const baseStyles = "px-8 py-4 rounded-full font-extrabold transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider shadow-lg";
  
  const variants = {
    primary: "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20",
    secondary: "bg-white/10 text-white backdrop-blur-md border border-white/10 hover:bg-white/20",
    danger: "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30",
    ghost: "bg-transparent text-slate-400 hover:text-white",
    visual: "bg-gradient-to-r from-[#f59e0b] to-[#10b981] text-white hover:brightness-110 shadow-[0_10px_30px_rgba(245,158,11,0.3)] border-t border-white/20"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <span className="w-3 h-3 border-3 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
};
