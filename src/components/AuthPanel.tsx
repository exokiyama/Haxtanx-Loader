import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Bot, LogIn, ShieldAlert, Sparkles, AlertCircle, UserPlus, KeyRound, Mail } from 'lucide-react';

interface AuthPanelProps {
  onAuthSuccess: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Custom interactive tab controls
  const [isRegister, setIsRegister] = useState(false);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithGoogle();
      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err: any) {
      console.error('Google Sign in failed:', err);
      setErrorMsg(err.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousBypass = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Create a guest account on-the-fly
      const guestId = 'guest_' + Math.random().toString(36).substring(2, 7);
      const { error } = await supabase.auth.signUp({
        username: `Sandbox Guest`,
        email: `${guestId}@nexuswa.com`,
        password: `password_guest`
      });
      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err: any) {
      console.error('Demo sandbox login failed:', err);
      setErrorMsg(err.message || 'Demo bypass failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setErrorMsg('Please populate all inputs.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    const inputVal = usernameOrEmail.trim();

    try {
      if (isRegister) {
        // We require username, email and password for custom account creation
        let emailAddress = inputVal;
        let displayName = inputVal;
        
        if (!emailAddress.includes('@')) {
          emailAddress = `${inputVal.toLowerCase()}@nexuswa.com`;
        } else {
          displayName = emailAddress.split('@')[0];
        }

        const { error } = await supabase.auth.signUp({
          username: displayName,
          email: emailAddress,
          password
        });
        if (error) {
          setErrorMsg(error.message);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          emailOrUsername: inputVal,
          password
        });
        if (error) {
          setErrorMsg(error.message || 'Incorrect credentials. Hint: administrator login password is papa%hamza.');
        }
      }
    } catch (err: any) {
      console.error('Custom Auth Process failed:', err);
      setErrorMsg(err.message || 'Authentication error occurred.');
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
            NexusWA Loader Bot Panel
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            Scalable multi-tenant WhatsApp Bot Management. Developed by Daddy hamza.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 bg-[#0A0A0A] border border-[#262626] p-1 rounded-lg mb-6 font-sans">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMsg(null); }}
            className={`py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              !isRegister ? 'bg-[#25D366] text-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMsg(null); }}
            className={`py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              isRegister ? 'bg-[#25D366] text-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-xs text-red-400 mb-5 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Authentication Notice</p>
              <p className="mt-1 leading-relaxed text-[11px]">{errorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleEmailPasswordSubmit} className="space-y-4 mb-6">
          <div>
            <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 font-sans">
              Username or Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={isRegister ? "New Username or Email Address" : "haxtanx or your email"}
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                disabled={loading}
                className="w-full h-10 pl-10 pr-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-xs text-white focus:border-[#25D366] focus:outline-none transition-all placeholder:text-gray-600 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 font-sans">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                placeholder={isRegister ? "Minimum 6 characters" : "papa%hamza or password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full h-10 pl-10 pr-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-xs text-white focus:border-[#25D366] focus:outline-none transition-all placeholder:text-gray-600 disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#25D366] hover:bg-opacity-90 text-black font-bold text-xs rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4 text-black" /> Create Account
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-black" /> Secure Sign-In
              </>
            )}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-[#262626]" />
          <span className="flex-shrink mx-4 text-[9px] text-gray-500 uppercase tracking-widest font-semibold">
            Social & Dev Integrations
          </span>
          <div className="flex-grow border-t border-[#262626]" />
        </div>

        <div className="space-y-3 mt-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-10 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            Sign In with Google Account
          </button>

          <button
            onClick={handleAnonymousBypass}
            disabled={loading}
            className="w-full h-10 bg-[#0A0A0A] border border-[#262626] hover:bg-[#262626] hover:text-white active:scale-[0.98] transition-all text-gray-300 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#25D366]" /> Enter Developer Sandbox Mode
          </button>
        </div>

        {/* Security / iframe warnings */}
        <div className="mt-8 pt-5 border-t border-[#262626] flex items-start gap-2.5 text-[10px] text-gray-500 leading-relaxed font-sans">
          <ShieldAlert className="w-4 h-4 shrink-0 text-gray-600 mt-0.5" />
          <p>
            This applet is fully integrated with Supabase PostgreSQL and Google Claims. Authorized access only. Developed with excellence by Daddy hamza.
          </p>
        </div>

      </div>
    </div>
  );
};
