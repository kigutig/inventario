import React, { useState } from 'react';
import {
  Barcode,
  Database,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  Layers,
  LogOut,
  Code2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { soundManager } from '../lib/sound';

interface NavbarProps {
  activeTab: 'contagem' | 'produtos' | 'sessoes';
  setActiveTab: (tab: 'contagem' | 'produtos' | 'sessoes') => void;
  onOpenSqlModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenSqlModal }) => {
  const { user, demoUser, isConfigured, signOut } = useAuth();
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  const handleToggleSound = () => {
    const nextState = soundManager.toggleMute();
    setIsMuted(nextState);
    if (!nextState) {
      soundManager.playSuccess();
    }
  };

  const currentUserEmail = user?.email || demoUser?.email || 'operador@inventario.com';

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Título */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Barcode className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-wider text-white">
                  AUDIT<span className="text-emerald-400">.BARCODE</span>
                </span>
                <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700">
                  v2.0 PRO
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle de Ativos & Auditoria com Leitor HID (Nonus LW200)
              </p>
            </div>
          </div>

          {/* Abas Centrais de Navegação */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('contagem')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'contagem'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Barcode className="w-4 h-4" />
              Contagem (Bipe)
            </button>

            <button
              onClick={() => setActiveTab('produtos')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'produtos'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Base de Produtos
            </button>

            <button
              onClick={() => setActiveTab('sessoes')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'sessoes'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              Sessões
            </button>
          </nav>

          {/* Ferramentas e Usuário */}
          <div className="flex items-center gap-3">
            {/* Status Supabase / Modo Local */}
            <button
              onClick={onOpenSqlModal}
              title="Configurações de Conexão e Script SQL"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                isConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {isConfigured ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Database className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Supabase Ativo</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Modo Local (Configurar Supabase)</span>
                </>
              )}
            </button>

            {/* Controle de Som / Bipe */}
            <button
              onClick={handleToggleSound}
              title={isMuted ? 'Áudio desativado (Clique para ativar)' : 'Áudio ativado (Clique para mutar)'}
              className={`p-2 rounded-lg border transition-colors ${
                isMuted
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Script SQL Button */}
            <button
              onClick={onOpenSqlModal}
              title="Ver Script SQL & Guia de Instalação"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <Code2 className="w-4 h-4" />
            </button>

            {/* Usuário e Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden lg:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-slate-200 max-w-[140px] truncate">
                  {currentUserEmail}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Operador Ativo</span>
              </div>
              <button
                onClick={() => signOut()}
                title="Desconectar"
                className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Abas mobile */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('contagem')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${
              activeTab === 'contagem' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
            }`}
          >
            <Barcode className="w-3.5 h-3.5" />
            Contagem
          </button>
          <button
            onClick={() => setActiveTab('produtos')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${
              activeTab === 'produtos' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Produtos
          </button>
          <button
            onClick={() => setActiveTab('sessoes')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${
              activeTab === 'sessoes' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Sessões
          </button>
        </div>
      </div>
    </header>
  );
};
