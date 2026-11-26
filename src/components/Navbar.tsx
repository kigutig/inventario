import React, { useState } from 'react';
import {
  Barcode,
  Database,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  Layers,
  LogOut,
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
  onOpenReportModal?: () => void;
  onOpenLabelsModal?: () => void;
  onOpenUnscannedModal?: () => void;
  onOpenShortcutsModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
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
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-gray-800 p-2 rounded-lg text-blue-400">
              <Barcode className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-white tracking-wide">
                Inventário<span className="text-blue-400">.PRO</span>
              </span>
              <p className="text-[11px] text-gray-500 hidden sm:block">
                Controle de Ativos & Auditoria
              </p>
            </div>
          </div>

          {/* Abas de Navegação */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-800/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('contagem')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'contagem'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              Contagem
            </button>

            <button
              onClick={() => setActiveTab('produtos')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'produtos'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Produtos
            </button>

            <button
              onClick={() => setActiveTab('sessoes')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'sessoes'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Sessões
            </button>
          </nav>

          {/* Ferramentas e Perfil */}
          <div className="flex items-center gap-2">
            {/* Status do Banco */}
            <div
              title={isConfigured ? 'Sincronização em nuvem ativa' : 'Modo offline/local'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                isConfigured
                  ? 'bg-green-900/20 border-green-700/40 text-green-400'
                  : 'bg-yellow-900/20 border-yellow-700/40 text-yellow-400'
              }`}
            >
              {isConfigured ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <Database className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-[11px]">Online</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-[11px]">Local</span>
                </>
              )}
            </div>

            {/* Ferramentas */}
            <div className="hidden lg:flex items-center gap-1">
              {onOpenReportModal && (
                <button
                  onClick={onOpenReportModal}
                  title="Relatório (F9)"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-medium transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Relatório</span>
                </button>
              )}

              {onOpenLabelsModal && (
                <button
                  onClick={onOpenLabelsModal}
                  title="Etiquetas (F8)"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-medium transition"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Etiquetas</span>
                </button>
              )}

              {onOpenUnscannedModal && (
                <button
                  onClick={onOpenUnscannedModal}
                  title="Cobertura (F7)"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-medium transition"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Cobertura</span>
                </button>
              )}
            </div>

            {/* Atalhos */}
            {onOpenShortcutsModal && (
              <button
                onClick={onOpenShortcutsModal}
                title="Atalhos (F2)"
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                <Keyboard className="w-4 h-4" />
              </button>
            )}

            {/* Som */}
            <button
              onClick={handleToggleSound}
              title={isMuted ? 'Ativar som' : 'Mutar som'}
              className={`p-1.5 rounded-lg transition ${
                isMuted
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  : 'text-blue-400 hover:bg-gray-800'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Perfil */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-200">
                  {userInitials}
                </div>
                <div className="hidden 2xl:flex flex-col items-start leading-tight">
                  <span className="text-xs font-medium text-gray-300 max-w-[120px] truncate">
                    {currentUserEmail.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Auditor
                  </span>
                </div>
              </div>

              <button
                onClick={() => signOut()}
                title="Sair"
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Abas mobile */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-gray-800 -mx-4 px-4">
          <button
            onClick={() => setActiveTab('contagem')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'contagem'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400'
            }`}
          >
            <Barcode className="w-3.5 h-3.5" />
            Contagem
          </button>
          <button
            onClick={() => setActiveTab('produtos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'produtos'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Produtos
          </button>
          <button
            onClick={() => setActiveTab('sessoes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'sessoes'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400'
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
