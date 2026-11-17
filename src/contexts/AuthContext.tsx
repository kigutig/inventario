import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

interface OperatorUser {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  demoUser: OperatorUser | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (email: string, pass: string) => Promise<{ error?: string }>;
  loginAsOperator: (emailOrName: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<OperatorUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    // 1. Verificar se há operador local salvo
    const savedOperator = localStorage.getItem('inv_operator_user');
    if (savedOperator) {
      try {
        setDemoUser(JSON.parse(savedOperator));
      } catch {
        // Ignorar
      }
    }

    const supabase = getSupabase();
    if (!supabase) {
      if (!savedOperator) {
        const defaultOp: OperatorUser = {
          email: 'operador.galpao@empresa.com.br',
          name: 'Operador Nonus LW200',
        };
        setDemoUser(defaultOp);
        localStorage.setItem('inv_operator_user', JSON.stringify(defaultOp));
      }
      setLoading(false);
      return;
    }

    // 2. Verificar sessão existente do Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginAsOperator = (emailOrName: string) => {
    const clean = emailOrName.trim() || 'operador.galpao@empresa.com.br';
    const op: OperatorUser = {
      email: clean.includes('@') ? clean : `${clean.toLowerCase().replace(/\s+/g, '.')}@inventario.local`,
      name: clean.includes('@') ? clean.split('@')[0] : clean,
    };
    setDemoUser(op);
    localStorage.setItem('inv_operator_user', JSON.stringify(op));
  };

  const signIn = async (email: string, pass: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      loginAsOperator(email);
      return {};
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.user) {
      setUser(data.user);
      // Limpa operador avulso caso entre com conta oficial do Supabase
      localStorage.removeItem('inv_operator_user');
      setDemoUser(null);
    }

    return {};
  };

  const signUp = async (email: string, pass: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      loginAsOperator(email);
      return {};
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.user) {
      setUser(data.user);
      localStorage.removeItem('inv_operator_user');
      setDemoUser(null);
    }

    return {};
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setDemoUser(null);
    localStorage.removeItem('inv_operator_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        demoUser,
        loading,
        isConfigured,
        signIn,
        signUp,
        loginAsOperator,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      demoUser: { email: 'operador.galpao@empresa.com.br', name: 'Operador Nonus LW200' },
      loading: false,
      isConfigured: isSupabaseConfigured(),
      signIn: async () => ({ error: 'Auth context ainda não inicializado' }),
      signUp: async () => ({ error: 'Auth context ainda não inicializado' }),
      loginAsOperator: () => {},
      signOut: async () => {},
    };
  }
  return context;
};
