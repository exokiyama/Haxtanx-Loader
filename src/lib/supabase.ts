// Supabase client bridge that emulates the @supabase/supabase-js API standard 
// and proxies all database and authorization events to our secure node backend handlers.

export interface SupabaseUser {
  id: string;
  username: string;
  email: string;
  isAdmin?: boolean;
}

type AuthCallback = (event: string, session: { user: SupabaseUser | null } | null) => void;

class SupabaseAuthEmulation {
  private listeners = new Set<AuthCallback>();
  private currentUser: SupabaseUser | null = null;

  constructor() {
    // Sync credentials with local browser cache state on initialization
    const stored = localStorage.getItem('nexus_wa_user');
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch {
        this.currentUser = null;
      }
    }
  }

  public getSession() {
    if (this.currentUser) {
      return { user: this.currentUser };
    }
    return null;
  }

  public getUser() {
    return this.currentUser;
  }

  public async signInWithPassword({ emailOrUsername, password }: { emailOrUsername: string; password?: string }) {
    try {
      const res = await fetch('/api/supabase/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return { data: null, error: new Error(data.error || 'Authentication Failed') };
      }

      this.currentUser = data.user as SupabaseUser;
      localStorage.setItem('nexus_wa_user', JSON.stringify(this.currentUser));
      this.notifyListeners('SIGNED_IN');

      return { data: { user: this.currentUser }, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  public async signUp({ username, email, password }: { username: string; email: string; password?: string }) {
    try {
      const res = await fetch('/api/supabase/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return { data: null, error: new Error(data.error || 'Registration failed') };
      }

      // Auto login user after account creation
      this.currentUser = data.user as SupabaseUser;
      localStorage.setItem('nexus_wa_user', JSON.stringify(this.currentUser));
      this.notifyListeners('SIGNED_IN');

      return { data: { user: this.currentUser }, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  public async signInWithGoogle() {
    try {
      // Mock successful Google login sequence for the dashboard
      const randomId = 'gUser_' + Math.random().toString(36).substring(2, 9);
      const googleUser: SupabaseUser = {
        id: randomId,
        username: 'Google Partner',
        email: 'google_user@gmail.com',
        isAdmin: false
      };
      
      this.currentUser = googleUser;
      localStorage.setItem('nexus_wa_user', JSON.stringify(googleUser));
      this.notifyListeners('SIGNED_IN');
      return { data: { user: googleUser }, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  public onAuthStateChange(callback: AuthCallback) {
    this.listeners.add(callback);
    // Fire callback with initial state
    callback('INITIAL_SESSION', this.currentUser ? { user: this.currentUser } : null);
    
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(callback);
          }
        }
      }
    };
  }

  public async signOut() {
    this.currentUser = null;
    localStorage.removeItem('nexus_wa_user');
    this.notifyListeners('SIGNED_OUT');
    return { error: null };
  }

  private notifyListeners(event: string) {
    const session = this.currentUser ? { user: this.currentUser } : null;
    for (const listener of this.listeners) {
      try {
        listener(event, session);
      } catch (err) {
        console.error('[Supabase Auth Listener Error]:', err);
      }
    }
  }
}

class SupabaseClient {
  public auth = new SupabaseAuthEmulation();

  public from(table: string) {
    return {
      select: (columns = '*') => {
        return {
          eq: async (col: string, val: string) => {
            if (table === 'sessions') {
              try {
                const res = await fetch(`/api/supabase/sessions?ownerId=${encodeURIComponent(val)}`);
                const data = await res.json();
                if (!res.ok) {
                  return { data: null, error: new Error(data.error || 'Failed to select sessions') };
                }
                return { data: data.sessions || [], error: null };
              } catch (err: any) {
                return { data: null, error: err };
              }
            }
            return { data: [], error: null };
          }
        };
      },
      insert: async (payload: any) => {
        if (table === 'sessions') {
          try {
            const res = await fetch('/api/supabase/sessions/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session: payload })
            });
            const data = await res.json();
            if (!res.ok) {
              return { data: null, error: new Error(data.error || 'Failed to insert session') };
            }
            return { data: payload, error: null };
          } catch (err: any) {
            return { data: null, error: err };
          }
        }
        return { data: null, error: null };
      },
      update: (fields: any) => {
        return {
          eq: async (col: string, val: string) => {
            if (table === 'sessions' && col === 'id') {
              try {
                const res = await fetch('/api/supabase/sessions/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: val, fields })
                });
                const data = await res.json();
                if (!res.ok) {
                  return { data: null, error: new Error(data.error || 'Failed to update session') };
                }
                return { data: fields, error: null };
              } catch (err: any) {
                return { data: null, error: err };
              }
            }
            return { data: null, error: null };
          }
        };
      },
      delete: () => {
        return {
          eq: async (col: string, val: string) => {
            if (table === 'sessions' && col === 'id') {
              try {
                const res = await fetch('/api/supabase/sessions/delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: val })
                });
                const data = await res.json();
                if (!res.ok) {
                  return { error: new Error(data.error || 'Failed to delete session') };
                }
                return { error: null };
              } catch (err: any) {
                return { error: err };
              }
            }
            return { error: null };
          }
        };
      }
    };
  }
}

export const supabase = new SupabaseClient();
