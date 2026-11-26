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
  Printer,
  Tag,
  PackageCheck,
  Keyboard,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { soundManager } from '../lib/sound';

interface NavbarProps {
  activeTab: 'contagem' | 'produtos' | 'sessoes';
  setActiveTab: (tab: 'contagem' | 'produtos' | 'sessoes') => void;
  onOpenSqlModal: () => void;
  onOpenReportModal?: () => void;
  onOpenLabelsModal?: () => void;
  onOpenUnscannedModal?: () => void;
  onOpenShortcutsModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSqlModal,
  onOpenReportModal,
  onOpenLabelsModal,
  onOpenUnscannedModal,
  onOpenShortcutsModal,
}) => {
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
  const userInitials = (currentUserEmail.split('@')[0] || 'OP').slice(0, 2).toUpperCase();

  return (
    <header className="bg-[#090d19]/90 border-b border-slate-800/80 backdrop-blur-xl sticky top-0 z-40 transition-all">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo e Branding Corporativo */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur opacity-35 group-hover:opacity-75 transition duration-300" />
              <div className="relative bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-emerald-400 flex items-center justify-center shadow-lg">
                <Barcode className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider text-white">
                  AUDIT<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">.BARCODE</span>
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold tracking-wide">
                  v2.0 PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Controle de Ativos & Auditoria com Leitor HID (Nonus LW200)
              </p>
            </div>
          </div>

          {/* Abas Centrais de Navegação Estilo Segmented Control */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-slate-800/80 shadow-inner">
            <button
              onClick={() => setActiveTab('contagem')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'contagem'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Contagem (Bipe)</span>
            </button>

            <button
              onClick={() => setActiveTab('produtos')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'produtos'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Base de Produtos</span>
            </button>

            <button
              onClick={() => setActiveTab('sessoes')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === 'sessoes'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Sessões</span>
            </button>
          </nav>

          {/* Ferramentas Rápidas e Perfil */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Status do Banco / Conexão */}
            <button
              onClick={onOpenSqlModal}
              title="Configurações de Conexão e Script SQL"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all ${
                isConfigured
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-500/50'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-300 hover:bg-amber-900/40 hover:border-amber-500/50'
              }`}
            >
              {isConfigured ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden xl:inline text-[11px]">Cloud Sync</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xl:inline text-[11px]">Modo Local</span>
                </>
              )}
            </button>

            {/* Ferramentas de Auditoria & Produção */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
              {onOpenReportModal && (
                <button
                  onClick={onOpenReportModal}
                  title="Relatório Formal de Auditoria (F9 / Ctrl+P)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Relatório</span>
                  <kbd className="px-1 py-0.2 bg-slate-800 text-[10px] text-slate-400 rounded font-mono">F9</kbd>
                </button>
              )}

              {onOpenLabelsModal && (
                <button
                  onClick={onOpenLabelsModal}
                  title="Gerador de Etiquetas Code 128 (F8)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition"
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Etiquetas</span>
                  <kbd className="px-1 py-0.2 bg-slate-800 text-[10px] text-slate-400 rounded font-mono">F8</kbd>
                </button>
              )}

              {onOpenUnscannedModal && (
                <button
                  onClick={onOpenUnscannedModal}
                  title="Cobertura de Estoque & Faltantes (F7)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition"
                >
                  <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cobertura</span>
                  <kbd className="px-1 py-0.2 bg-slate-800 text-[10px] text-slate-400 rounded font-mono">F7</kbd>
                </button>
              )}
            </div>

            {/* Atalhos Rápidos */}
            {onOpenShortcutsModal && (
              <button
                onClick={onOpenShortcutsModal}
                title="Atalhos Rápidos de Teclado (F2)"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
              >
                <Keyboard className="w-4 h-4 text-purple-400" />
              </button>
            )}

            {/* Controle de Som / Bipe */}
            <button
              onClick={handleToggleSound}
              title={isMuted ? 'Áudio desativado (Clique para ativar som do leitor)' : 'Áudio ativado (Clique para mutar)'}
              className={`p-2 rounded-xl border transition ${
                isMuted
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Script SQL & Config */}
            <button
              onClick={onOpenSqlModal}
              title="Ver Script SQL & Configurações"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
            >
              <Code2 className="w-4 h-4" />
            </button>

            {/* Perfil & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center text-xs font-black text-white shadow-sm font-mono">
                  {userInitials}
                </div>
                <div className="hidden 2xl:flex flex-col items-start leading-tight">
                  <span className="text-xs font-semibold text-slate-200 max-w-[130px] truncate">
                    {currentUserEmail.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Auditor Ativo
                  </span>
                </div>
              </div>

              <button
                onClick={() => signOut()}
                title="Desconectar da Sessão"
                className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Abas mobile com estilo moderno */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800/80 bg-slate-950/40 -mx-4 px-4">
          <button
            onClick={() => setActiveTab('contagem')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'contagem'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400'
            }`}
          >
            <Barcode className="w-3.5 h-3.5" />
            Contagem
          </button>
          <button
            onClick={() => setActiveTab('produtos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'produtos'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Produtos
          </button>
          <button
            onClick={() => setActiveTab('sessoes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'sessoes'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400'
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
