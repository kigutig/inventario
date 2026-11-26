import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Layers,
  FileSpreadsheet,
  Plus,
  Lock,
  Trash2,
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { ScannerInput } from './components/ScannerInput';
import { SessionKPIs } from './components/SessionKPIs';
import { InventoryTable } from './components/InventoryTable';
import { SessionsView } from './components/SessionsView';
import { ProductCatalogModal } from './components/ProductCatalogModal';
import { SqlInstructionsModal } from './components/SqlInstructionsModal';
import { AuditLogDrawer } from './components/AuditLogDrawer';
import { PrintReportModal } from './components/PrintReportModal';
import { BarcodeLabelModal } from './components/BarcodeLabelModal';
import { UnscannedItemsModal } from './components/UnscannedItemsModal';
import { CameraBarcodeScannerModal } from './components/CameraBarcodeScannerModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import {
  ajustarQuantidade,
  consolidarItensNaoBipados,
  criarSessao,
  excluirItemContagem,
  excluirProduto,
  excluirSessao,
  finalizarSessao,
  limparTodosProdutos,
  listarItensInventariados,
  listarLogs,
  listarProdutos,
  listarSessoes,
  reabrirSessao,
  registrarLeitura,
  renomearSessao,
  salvarProduto,
  salvarProdutosEmLote,
} from './services/inventoryService';
import type { ItemInventariado, LogLeitura, ProdutoCadastro, ResumoSessao, SessaoInventario } from './types/inventory';
import { getSupabase } from './lib/supabase';

const InventoryMain: React.FC = () => {
  const { user, demoUser, loading: authLoading, renewSession, signOut } = useAuth();

  // Estados principais
  const [activeTab, setActiveTab] = useState<'contagem' | 'produtos' | 'sessoes'>('contagem');
  const [sessoes, setSessoes] = useState<SessaoInventario[]>([]);
  const [sessaoAtivaId, setSessaoAtivaId] = useState<string>('');
  const [itens, setItens] = useState<ItemInventariado[]>([]);
  const [logs, setLogs] = useState<LogLeitura[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCadastro[]>([]);
  const [loadingDados, setLoadingDados] = useState<boolean>(true);

  // Modais
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showLabelsModal, setShowLabelsModal] = useState<boolean>(false);
  const [showUnscannedModal, setShowUnscannedModal] = useState<boolean>(false);
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [skuParaCadastrar, setSkuParaCadastrar] = useState<string | undefined>(undefined);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Atalhos Globais de Teclado (F2, F4, F7, F8, F9, Ctrl+P, Esc)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        setShowProductModal((prev) => !prev);
      } else if (e.key === 'F7') {
        e.preventDefault();
        setShowUnscannedModal(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowLabelsModal(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowReportModal(true);
      } else if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShowReportModal(true);
      } else if (e.key === 'Escape') {
        setShowSqlModal(false);
        setShowProductModal(false);
        setShowAuditLogs(false);
        setShowReportModal(false);
        setShowLabelsModal(false);
        setShowUnscannedModal(false);
        setShowCameraModal(false);
        setShowShortcutsModal(false);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // Mitigação CWE-613: Monitoramento de inatividade e expiração temporal de sessão
  useEffect(() => {
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos sem leitura no leitor
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
        signOut();
      }
    }, 60000);

    const recordUserActivity = () => {
      setLastActivity(Date.now());
      renewSession();
    };

    window.addEventListener('keydown', recordUserActivity);
    window.addEventListener('click', recordUserActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', recordUserActivity);
      window.removeEventListener('click', recordUserActivity);
    };
  }, [lastActivity, renewSession, signOut]);

  // Sessão ativa
  const sessaoAtiva = useMemo(() => {
    return sessoes.find((s) => s.id === sessaoAtivaId) || sessoes[0] || null;
  }, [sessoes, sessaoAtivaId]);

  // Carregar dados iniciais
  const carregarDados = async () => {
    setLoadingDados(true);
    try {
      const [sessoesRes, produtosRes] = await Promise.all([
        listarSessoes(),
        listarProdutos(),
      ]);

      setSessoes(sessoesRes);
      setProdutos(produtosRes);

      // Define a sessão ativa (preferencialmente a primeira em andamento)
      let ativa = sessoesRes.find((s) => s.status === 'em_andamento') || sessoesRes[0];

      // Se não existir nenhuma sessão, cria uma sessão padrão de boas-vindas
      if (!ativa) {
        ativa = await criarSessao('Inventário Geral - Setor Maquinários e Ativos');
        setSessoes([ativa]);
      }

      setSessaoAtivaId(ativa.id);

      // Carregar itens e logs da sessão ativa
      const [itensRes, logsRes] = await Promise.all([
        listarItensInventariados(ativa.id),
        listarLogs(ativa.id),
      ]);

      setItens(itensRes);
      setLogs(logsRes);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoadingDados(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Recarregar itens quando a sessão ativa mudar
  useEffect(() => {
    if (!sessaoAtivaId) return;

    const carregarItensSessao = async () => {
      try {
        const [itensRes, logsRes] = await Promise.all([
          listarItensInventariados(sessaoAtivaId),
          listarLogs(sessaoAtivaId),
        ]);
        setItens(itensRes);
        setLogs(logsRes);
      } catch (err) {
        console.error('Erro ao recarregar itens da sessão:', err);
      }
    };

    carregarItensSessao();
  }, [sessaoAtivaId]);

  // --------------------------------------------------------------------------
  // SUPABASE REALTIME (Sincronização ao vivo entre múltiplos operadores/leitores)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !sessaoAtivaId) return;

    const channel = supabase
      .channel(`sessao_${sessaoAtivaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itens_inventariados',
          filter: `sessao_id=eq.${sessaoAtivaId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const novo = payload.new as ItemInventariado;
            setItens((prev) => {
              if (prev.some((i) => i.id === novo.id)) return prev;
              return [novo, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const atualizado = payload.new as ItemInventariado;
            setItens((prev) =>
              prev.map((i) => (i.id === atualizado.id ? atualizado : i))
            );
          } else if (payload.eventType === 'DELETE') {
            const antigo = payload.old as { id: string };
            setItens((prev) => prev.filter((i) => i.id !== antigo.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs_leituras',
          filter: `sessao_id=eq.${sessaoAtivaId}`,
        },
        (payload) => {
          const novoLog = payload.new as LogLeitura;
          setLogs((prev) => [novoLog, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessaoAtivaId]);

  // --------------------------------------------------------------------------
  // CÁLCULO DE RESUMO E KPIS
  // --------------------------------------------------------------------------
  const resumoSessao: ResumoSessao = useMemo(() => {
    const totalPecasBipadas = itens.reduce((acc, i) => acc + i.quantidade_contada, 0);
    const totalSkusContados = itens.length;

    let totalItensCorretos = 0;
    let totalItensDivergentes = 0;
    let totalItensFaltando = 0;
    let totalItensSobrando = 0;
    let totalNaoCadastrados = 0;
    let impactoFinanceiroTotal = 0;

    itens.forEach((i) => {
      const divergencia = i.quantidade_contada - i.estoque_sistema_snapshot;
      impactoFinanceiroTotal += divergencia * i.custo_unitario_snapshot;

      if (!i.cadastrado_no_sistema) {
        totalNaoCadastrados++;
      }

      if (divergencia === 0) {
        if (i.cadastrado_no_sistema) totalItensCorretos++;
      } else {
        totalItensDivergentes++;
        if (divergencia < 0) totalItensFaltando++;
        else totalItensSobrando++;
      }
    });

    const acuraciaPercentual =
      totalSkusContados > 0
        ? ((totalItensCorretos / totalSkusContados) * 100)
        : 100;

    return {
      totalPecasBipadas,
      totalSkusContados,
      totalItensDivergentes,
      totalItensCorretos,
      totalItensFaltando,
      totalItensSobrando,
      totalNaoCadastrados,
      impactoFinanceiroTotal,
      acuraciaPercentual,
    };
  }, [itens]);

  // --------------------------------------------------------------------------
  // HANDLERS DE AÇÃO
  // --------------------------------------------------------------------------
  const handleScan = async (sku: string, multiplier: number = 1) => {
    if (!sessaoAtiva) throw new Error('Nenhuma sessão selecionada');
    renewSession();

    const userId = user?.id || demoUser?.email;
    let resultado = await registrarLeitura(sessaoAtiva.id, sku, userId);

    // Suporte a contagem em lote / multiplicador (ex: x5, x10 caixas)
    if (multiplier > 1 && resultado.item) {
      const delta = multiplier - 1;
      const itemAtualizado = await ajustarQuantidade(resultado.item.id, sessaoAtiva.id, delta, userId);
      resultado = {
        ...resultado,
        item: itemAtualizado,
      };
    }

    // Optimistic / Local update imediato para feedback instantâneo
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.codigo_sku.toLowerCase() === sku.toLowerCase());
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = resultado.item;
        return copy;
      }
      return [resultado.item, ...prev];
    });

    setLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        sessao_id: sessaoAtiva.id,
        codigo_sku: sku,
        usuario_email: user?.email || demoUser?.email,
        created_at: new Date().toISOString(),
      },
      ...prev.slice(0, 49),
    ]);

    return resultado;
  };

  const handleUndoLastScan = async (sku: string) => {
    if (!sessaoAtiva) return;
    const item = itens.find((i) => i.codigo_sku.toLowerCase() === sku.toLowerCase());
    if (item) {
      if (item.quantidade_contada <= 1) {
        await handleDeleteItem(item.id);
      } else {
        await handleAdjustQuantity(item.id, -1);
      }
    }
  };

  const handleBatchAddUnscannedAsZero = async (faltantes: ProdutoCadastro[]) => {
    if (!sessaoAtiva) return;
    const userId = user?.id || demoUser?.email;
    const itensAtualizados = await consolidarItensNaoBipados(sessaoAtiva.id, faltantes, userId);
    setItens(itensAtualizados);
  };

  const handleAdjustQuantity = async (itemId: string, delta: number) => {
    if (!sessaoAtiva) return;
    const userId = user?.id || demoUser?.email;
    const itemAtualizado = await ajustarQuantidade(itemId, sessaoAtiva.id, delta, userId);

    setItens((prev) =>
      prev.map((i) => (i.id === itemId ? itemAtualizado : i))
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!sessaoAtiva) return;
    await excluirItemContagem(itemId, sessaoAtiva.id);
    setItens((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleCreateSessao = async (nome: string) => {
    const userId = user?.id || demoUser?.email;
    const nova = await criarSessao(nome, userId);
    setSessoes((prev) => [nova, ...prev]);
    setSessaoAtivaId(nova.id);
    setActiveTab('contagem');
  };

  const handleFinalizeSessao = async (sessaoId: string) => {
    await finalizarSessao(sessaoId);
    setSessoes((prev) =>
      prev.map((s) => (s.id === sessaoId ? { ...s, status: 'finalizado', finalizado_at: new Date().toISOString() } : s))
    );
    // Efeito comemorativo de finalização
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleRenameSessao = async (sessaoId: string, novoNome: string) => {
    await renomearSessao(sessaoId, novoNome);
    setSessoes((prev) =>
      prev.map((s) => (s.id === sessaoId ? { ...s, nome: novoNome } : s))
    );
  };

  const handleReopenSessao = async (sessaoId: string) => {
    await reabrirSessao(sessaoId);
    setSessoes((prev) =>
      prev.map((s) => (s.id === sessaoId ? { ...s, status: 'em_andamento', finalizado_at: null } : s))
    );
  };

  const handleDeleteSessao = async (sessaoId: string) => {
    await excluirSessao(sessaoId);
    const restantes = sessoes.filter((s) => s.id !== sessaoId);
    setSessoes(restantes);
    if (sessaoAtivaId === sessaoId) {
      if (restantes.length > 0) {
        setSessaoAtivaId(restantes[0].id);
      } else {
        const nova = await criarSessao('Nova Sessão de Inventário');
        setSessoes([nova]);
        setSessaoAtivaId(nova.id);
      }
    }
  };

  const handleSaveProduto = async (prod: Partial<ProdutoCadastro>) => {
    const salvo = await salvarProduto(prod);
    setProdutos((prev) => {
      const idx = prev.findIndex((p) => p.codigo_sku.toLowerCase() === salvo.codigo_sku.toLowerCase());
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = salvo;
        return copy;
      }
      return [...prev, salvo];
    });

    // Se o item estava na sessão como "não cadastrado", atualiza seus dados
    if (sessaoAtiva) {
      const itensAtualizados = await listarItensInventariados(sessaoAtiva.id);
      setItens(itensAtualizados);
    }
  };

  const handleBatchSaveProdutos = async (novos: Omit<ProdutoCadastro, 'id'>[]) => {
    const res = await salvarProdutosEmLote(novos);
    const listaCompleta = await listarProdutos();
    setProdutos(listaCompleta);
    if (sessaoAtiva) {
      const itensAtualizados = await listarItensInventariados(sessaoAtiva.id);
      setItens(itensAtualizados);
    }
    return res;
  };

  const handleDeleteProduto = async (id: string) => {
    await excluirProduto(id);
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    if (sessaoAtiva) {
      const itensAtualizados = await listarItensInventariados(sessaoAtiva.id);
      setItens(itensAtualizados);
    }
  };

  const handleClearAllProdutos = async () => {
    await limparTodosProdutos();
    setProdutos([]);
    if (sessaoAtiva) {
      const itensAtualizados = await listarItensInventariados(sessaoAtiva.id);
      setItens(itensAtualizados);
    }
  };

  const handleQuickRegisterSku = (sku: string) => {
    setSkuParaCadastrar(sku);
    setShowProductModal(true);
  };

  // Se o usuário não estiver autenticado nem com demo, mostra AuthScreen
  if (!authLoading && !user && !demoUser) {
    return <AuthScreen />;
  }

  if (loadingDados) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col font-sans">
      {/* Topo / Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenReportModal={() => setShowReportModal(true)}
        onOpenLabelsModal={() => setShowLabelsModal(true)}
        onOpenUnscannedModal={() => setShowUnscannedModal(true)}
        onOpenShortcutsModal={() => setShowShortcutsModal(true)}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* TAB 1: CONTAGEM E BIPE */}
        {activeTab === 'contagem' && sessaoAtiva && (
          <div className="space-y-6">
            {/* Seletor Rápido de Sessão e Status */}
            <div className="bg-gray-800/40 border border-gray-700/50 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-900 text-blue-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Sessão:</span>
                    <strong className="text-sm font-bold text-white">{sessaoAtiva.nome}</strong>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        sessaoAtiva.status === 'finalizado'
                          ? 'bg-gray-700 text-gray-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}
                    >
                      {sessaoAtiva.status === 'finalizado' ? 'Finalizada' : 'Em Andamento'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {new Date(sessaoAtiva.created_at).toLocaleString('pt-BR')} · {sessaoAtiva.id.slice(0, 8)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('sessoes')}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700/50 text-gray-300 hover:text-white transition"
                >
                  Trocar Sessão
                </button>

                <button
                  onClick={() => setShowProductModal(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700/50 text-gray-300 hover:text-white transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Produtos ({produtos.length})
                </button>
              </div>
            </div>

            {/* Aviso se a sessão estiver finalizada */}
            {sessaoAtiva.status === 'finalizado' && (
              <div className="bg-yellow-900/15 border border-yellow-700/30 rounded-lg p-3 flex items-center gap-3 text-yellow-300 text-xs">
                <Lock className="w-4 h-4 shrink-0 text-yellow-400" />
                <div>
                  <p className="font-semibold text-sm text-white">Sessão finalizada.</p>
                  <p className="text-gray-400 mt-0.5">
                    Bipes bloqueados. Você ainda pode exportar relatórios.
                  </p>
                </div>
              </div>
            )}

            {/* INPUT DE BIPE EM DESTAQUE (UX CRÍTICA PARA NONUS LW200) */}
            <ScannerInput
              onScan={handleScan}
              disabled={sessaoAtiva.status === 'finalizado'}
              onQuickRegisterSku={handleQuickRegisterSku}
              onOpenMobileCamera={() => setShowCameraModal(true)}
              onUndoLastScan={handleUndoLastScan}
            />

            {/* CARDS DE RESUMO E KPIS */}
            <SessionKPIs resumo={resumoSessao} />

            {/* TABELA DE CONTROLE E AUDITORIA EM TEMPO REAL */}
            <InventoryTable
              sessao={sessaoAtiva}
              itens={itens}
              onAdjustQuantity={handleAdjustQuantity}
              onDeleteItem={handleDeleteItem}
              onQuickRegisterSku={handleQuickRegisterSku}
              onOpenAuditLogs={() => setShowAuditLogs(true)}
            />
          </div>
        )}

        {/* TAB 2: BASE DE PRODUTOS */}
        {activeTab === 'produtos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Cadastro de Produtos & Ativos</h2>
                <p className="text-xs text-gray-500">
                  Base teórica de estoque e custos
                </p>
              </div>
              <button
                onClick={() => {
                  setSkuParaCadastrar(undefined);
                  setShowProductModal(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
              >
                <Plus className="w-4 h-4" />
                Abrir Painel de Gestão & Importação
              </button>
            </div>

            {/* Tabela rápida de consulta */}
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden p-4">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-900 text-gray-500 text-[11px] uppercase border-b border-gray-700/50">
                  <tr>
                    <th className="py-3 px-4">Código SKU</th>
                    <th className="py-3 px-4">Descrição Oficial</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4 text-center">Saldo Teórico</th>
                    <th className="py-3 px-4 text-right">Custo Unitário</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {produtos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        Nenhum produto cadastrado. Abra o painel acima para importar.
                      </td>
                    </tr>
                  ) : (
                    produtos.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-800/40">
                        <td className="py-2.5 px-4 font-mono font-semibold text-blue-400">{p.codigo_sku}</td>
                        <td className="py-2.5 px-4 text-gray-200">{p.descricao}</td>
                        <td className="py-2.5 px-4 text-gray-500 text-xs">{p.codigo_fornecedor || '-'}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-gray-400">{p.estoque_sistema} un</td>
                        <td className="py-2.5 px-4 text-right font-mono text-gray-400">
                          {p.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleDeleteProduto(p.id)}
                            title="Excluir"
                            className="p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SESSÕES DE INVENTÁRIO */}
        {activeTab === 'sessoes' && (
          <SessionsView
            sessoes={sessoes}
            sessaoAtivaId={sessaoAtivaId}
            onSelectSessao={(id) => {
              setSessaoAtivaId(id);
              setActiveTab('contagem');
            }}
            onCreateSessao={handleCreateSessao}
            onFinalizeSessao={handleFinalizeSessao}
            onRenameSessao={handleRenameSessao}
            onReopenSessao={handleReopenSessao}
            onDeleteSessao={handleDeleteSessao}
          />
        )}
      </main>

      {/* MODAL DE BASE DE CADASTRO E IMPORTAÇÃO EXCEL */}
      {showProductModal && (
        <ProductCatalogModal
          produtos={produtos}
          onSaveProduto={handleSaveProduto}
          onDeleteProduto={handleDeleteProduto}
          onBatchSaveProdutos={handleBatchSaveProdutos}
          onClearAllProdutos={handleClearAllProdutos}
          onClose={() => {
            setShowProductModal(false);
            setSkuParaCadastrar(undefined);
          }}
          initialSkuToRegister={skuParaCadastrar}
        />
      )}

      {/* MODAL DE INSTRUÇÕES SQL E CONFIGURAÇÃO SUPABASE */}
      <SqlInstructionsModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
      />

      {/* PAINEL LATERAL DE TRILHA DE BIPES */}
      <AuditLogDrawer
        isOpen={showAuditLogs}
        onClose={() => setShowAuditLogs(false)}
        logs={logs}
        sessaoNome={sessaoAtiva?.nome || 'Sessão'}
      />

      {/* MODAL DE IMPRESSÃO DE RELATÓRIO FORMAL A4 */}
      <PrintReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        sessao={sessaoAtiva}
        itens={itens}
        resumo={resumoSessao}
        auditorEmail={user?.email || demoUser?.email}
      />

      {/* GERADOR DE ETIQUETAS CODE 128 */}
      <BarcodeLabelModal
        isOpen={showLabelsModal}
        onClose={() => setShowLabelsModal(false)}
        produtos={produtos}
        itensSessao={itens}
      />

      {/* COBERTURA DO ESTOQUE E ITENS NÃO LOCALIZADOS */}
      <UnscannedItemsModal
        isOpen={showUnscannedModal}
        onClose={() => setShowUnscannedModal(false)}
        produtos={produtos}
        itensSessao={itens}
        onAddUnscannedAsZero={handleBatchAddUnscannedAsZero}
      />

      {/* LEITOR DE CÓDIGO DE BARRAS POR CÂMERA (MOBILE/TABLET) */}
      <CameraBarcodeScannerModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onScan={async (scannedSku) => {
          await handleScan(scannedSku);
        }}
      />

      {/* GUIA DE ATALHOS DE TECLADO */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};

export default function App() {
  return <InventoryMain />;
}
