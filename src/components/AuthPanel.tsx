import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { Bot, LogIn, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

interface AuthPanelProps {
  onAuthSuccess: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google Popup sign in failed:', err);
      // Inform users about popup blocking or configuration requirements
      if (err.code === 'auth/popup-blocked') {
        setErrorMsg('The sign-in popup was blocked by your browser. Please click "Open App in New Tab" in the top bar to authenticate or use Anonymous login below.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Google login is not enabled in your Firebase project Console yet. Please use the "Enter anonymously" bypass below to test the applet immediately.');
      } else {
        setErrorMsg(err.message || 'Authentication error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousBypass = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error('Anonymous sign in failed:', err);
      setErrorMsg(err.message || 'Anonymous fail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center p-6 select-none relative overflow-hidden">
      
      {/* Decorative gradient accents */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-[#141414] border border-[#262626] rounded-xl p-8 shadow-2xl relative z-10">
        
        {/* App Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl flex items-center justify-center mb-4">
            <Bot className="w-8 h-8 text-[#25D366]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5 font-sans">
            Haxtanx Wa Loader Bot Panel
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            Multi-tenant WhatsApp Bot Dashboard.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-xs text-red-400 mb-5 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication Notice</p>
              <p className="mt-1 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Main Google sign-in */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-11 bg-[#25D366] hover:bg-opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 text-black rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In with Google Account
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[#262626]" />
            <span className="flex-shrink mx-4 text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Demo Sandbox Bypass
            </span>
            <div className="flex-grow border-t border-[#262626]" />
          </div>

          {/* Fallback anonymous bypass for sandbox/iframe testing restrictions */}
          <button
            onClick={handleAnonymousBypass}
            disabled={loading}
            className="w-full h-10 bg-[#0A0A0A] border border-[#262626] hover:bg-[#262626] hover:text-white active:scale-[0.98] transition-all text-gray-300 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#25D366]" /> Enter Developer Sandbox Mode
          </button>
        </div>

        {/* Security / iframe warnings */}
        <div className="mt-8 pt-5 border-t border-[#262626] flex items-start gap-2.5 text-[10px] text-gray-500 leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 text-gray-600 mt-0.5" />
          <p>
            This applet is fully integrated with Firebase Firestore and Google Claims. For optimal Google login popups, always open the applet in a new browser tab.
          </p>
        </div>

      </div>
    </div>
  );
};
