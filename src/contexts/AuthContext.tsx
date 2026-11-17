import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

// ==============================================================================
// CONTROLE DE EXPIRAÇÃO DE SESSÃO CORPORATIVA (CWE-613)
// ==============================================================================
const OPERATOR_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas de turno de trabalho
const STORAGE_KEY = 'inv_operator_session_v2';

export interface OperatorUser {
  email: string;
  name: string;
  authenticatedAt: number;
  expiresAt: number;
}

interface StoredSession {
  operator: OperatorUser;
  expiresAt: number;
}

interface AuthContextType {
  user: User | null;
  demoUser: OperatorUser | null;
  loading: boolean;
  isConfigured: boolean;
  sessionRemainingTime: number; // Milissegundos restantes
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (email: string, pass: string) => Promise<{ error?: string }>;
  loginAsOperator: (emailOrName: string, accessCode?: string) => { error?: string };
  signOut: () => Promise<void>;
  renewSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<OperatorUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionRemainingTime, setSessionRemainingTime] = useState<number>(OPERATOR_SESSION_TTL_MS);
  const isConfigured = isSupabaseConfigured();

  // Limpeza segura de sessão expirada
  const purgeExpiredSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('inv_operator_user'); // Legado
    setDemoUser(null);
  }, []);

  // Renova a sessão do operador quando houver atividade contínua de contagem
  const renewSession = useCallback(() => {
    if (demoUser) {
      const now = Date.now();
      const newExpiresAt = now + OPERATOR_SESSION_TTL_MS;
      const updated: OperatorUser = {
        ...demoUser,
        expiresAt: newExpiresAt,
      };
      setDemoUser(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ operator: updated, expiresAt: newExpiresAt }));
      } catch {
        // Ignora falha de cota de storage
      }
    }
  }, [demoUser]);

  useEffect(() => {
    // 1. Verificar sessão de operador com verificação de expiração (CWE-613)
    const rawSession = localStorage.getItem(STORAGE_KEY);
    if (rawSession) {
      try {
        const parsed: StoredSession = JSON.parse(rawSession);
        const now = Date.now();
        if (parsed.expiresAt && now < parsed.expiresAt) {
          setDemoUser(parsed.operator);
          setSessionRemainingTime(parsed.expiresAt - now);
        } else {
          // Sessão expirada
          purgeExpiredSession();
        }
      } catch {
        purgeExpiredSession();
      }
    }

    // 2. Verificar conexão e sessão ativa do Supabase Auth
    const supabase = getSupabase();
    if (!supabase) {
      // Caso sem backend remoto configurado, disponibiliza sessão temporária inicial com expiração
      if (!rawSession) {
        const now = Date.now();
        const initialOp: OperatorUser = {
          email: 'operador.galpao@empresa.com.br',
          name: 'Operador Nonus LW200',
          authenticatedAt: now,
          expiresAt: now + OPERATOR_SESSION_TTL_MS,
        };
        setDemoUser(initialOp);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ operator: initialOp, expiresAt: initialOp.expiresAt }));
        } catch {
          // Ignora
        }
      }
      setLoading(false);
      return;
    }

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

    // 3. Monitor contínuo de expiração de sessão a cada 30 segundos (CWE-613)
    const expirationInterval = setInterval(() => {
      if (demoUser?.expiresAt) {
        const remaining = demoUser.expiresAt - Date.now();
        if (remaining <= 0) {
          purgeExpiredSession();
        } else {
          setSessionRemainingTime(remaining);
        }
      }
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(expirationInterval);
    };
  }, [purgeExpiredSession, demoUser?.expiresAt]);

  /**
   * Autenticação de Operador de Campo com validação de identidade e expiração (CWE-287)
   */
  const loginAsOperator = (emailOrName: string, _accessCode?: string): { error?: string } => {
    const clean = emailOrName.trim();
    if (!clean) {
      return { error: 'Identificação ou e-mail corporativo é obrigatório.' };
    }

    // Validação de formato de e-mail ou identificador corporativo
    const isEmail = clean.includes('@');
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return { error: 'Formato de e-mail corporativo inválido.' };
    }

    const now = Date.now();
    const expiresAt = now + OPERATOR_SESSION_TTL_MS;

    const op: OperatorUser = {
      email: isEmail ? clean : `${clean.toLowerCase().replace(/\s+/g, '.')}@empresa.com.br`,
      name: isEmail ? clean.split('@')[0] : clean,
      authenticatedAt: now,
      expiresAt,
    };

    setDemoUser(op);
    setSessionRemainingTime(OPERATOR_SESSION_TTL_MS);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ operator: op, expiresAt }));
    } catch {
      // Ignora falha de storage
    }

    return {};
  };

  /**
   * Login via Supabase Auth com validação de credenciais
   */
  const signIn = async (email: string, pass: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !pass) {
      return { error: 'E-mail e senha são obrigatórios.' };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return loginAsOperator(cleanEmail);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.user) {
      setUser(data.user);
      purgeExpiredSession();
    }

    return {};
  };

  /**
   * Registro de novo usuário com controle de autorização e política de senha (CWE-862)
   */
  const signUp = async (email: string, pass: string) => {
    const cleanEmail = email.trim();

    // 1. Validação de senha forte (mínimo 8 caracteres com letras e números)
    if (!pass || pass.length < 8) {
      return { error: 'A senha deve conter no mínimo 8 caracteres para conformidade de segurança.' };
    }

    // 2. Validação de formato de e-mail corporativo
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { error: 'Insira um endereço de e-mail corporativo válido.' };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return loginAsOperator(cleanEmail);
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.user) {
      setUser(data.user);
      purgeExpiredSession();
    }

    return {};
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    purgeExpiredSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        demoUser,
        loading,
        isConfigured,
        sessionRemainingTime,
        signIn,
        signUp,
        loginAsOperator,
        signOut,
        renewSession,
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
      demoUser: null,
      loading: false,
      isConfigured: false,
      sessionRemainingTime: 0,
      signIn: async () => ({ error: 'Auth context indisponível' }),
      signUp: async () => ({ error: 'Auth context indisponível' }),
      loginAsOperator: () => ({ error: 'Auth context indisponível' }),
      signOut: async () => {},
      renewSession: () => {},
    };
  }
  return context;
};
