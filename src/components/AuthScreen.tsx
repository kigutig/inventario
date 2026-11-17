import React, { useState } from 'react';
import {
  Barcode,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  UserCheck,
  AlertCircle,
  Database,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, loginAsOperator } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      if (isLogin) {
        const res = await signIn(email, password);
        if (res.error) {
          tratarErroAuth(res.error);
        }
      } else {
        const res = await signUp(email, password);
        if (res.error) {
          tratarErroAuth(res.error);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na autenticação';
      tratarErroAuth(msg);
    } finally {
      setLoading(false);
    }
  };

  const tratarErroAuth = (erroOriginal: string) => {
    if (erroOriginal.toLowerCase().includes('invalid') && erroOriginal.toLowerCase().includes('email')) {
      setErrorMessage(
        'O validador de e-mail do Supabase requer domínios públicos reais ou você pode entrar diretamente como Operador de Campo abaixo sem confirmação de e-mail.'
      );
    } else if (erroOriginal.toLowerCase().includes('invalid login credentials')) {
      setErrorMessage('Credenciais incorretas ou usuário ainda não cadastrado no Supabase Auth.');
    } else {
      setErrorMessage(erroOriginal);
    }
  };

  const handleEntrarComoOperador = () => {
    const ident = email.trim() || 'operador.galpao@empresa.com.br';
    loginAsOperator(ident);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-2 shadow-lg shadow-emerald-500/10">
            <Barcode className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider">
            AUDIT<span className="text-emerald-400">.BARCODE</span>
          </h1>
          <p className="text-xs text-slate-400">
            Controle de Ativos & Auditoria via Leitor HID (Nonus LW200)
          </p>
        </div>

        {/* Indicador Supabase Ativo */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-3 rounded-xl font-mono">
          <Database className="w-3.5 h-3.5" />
          <span>Supabase Conectado (PostgreSQL + Realtime)</span>
        </div>

        {/* Mensagem de Erro com Ação de Fallback */}
        {errorMessage && (
          <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs p-3.5 rounded-xl space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>

            <button
              type="button"
              onClick={handleEntrarComoOperador}
              className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              Entrar Imediatamente com este usuário
            </button>
          </div>
        )}

        {/* Botão de Acesso Rápido de Operador (Ideal para Galpão) */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="text-left">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Acesso Rápido para Auditor / Operador
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Não exige confirmação por link de e-mail. Grava todas as contagens direto no banco do Supabase.
            </p>
          </div>

          <button
            type="button"
            onClick={handleEntrarComoOperador}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            Entrar como Operador Nonus LW200
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-[11px] font-mono text-slate-400 uppercase tracking-wider shrink-0">
            ou Supabase Auth
          </span>
          <div className="border-t border-slate-800 w-full" />
        </div>

        {/* Formulário Supabase Auth */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
              E-MAIL DO AUDITOR
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@empresa.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
              SENHA DE ACESSO
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Processando...' : isLogin ? 'Login via Supabase Auth' : 'Criar Conta no Supabase Auth'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMessage('');
            }}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {isLogin ? 'Alternar para: Criar Conta no Supabase' : 'Alternar para: Fazer Login com Senha'}
          </button>
        </div>
      </div>
    </div>
  );
};
