import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Package,
  Trash2,
  AlertOctagon,
} from 'lucide-react';
import type { ProdutoCadastro } from '../types/inventory';
import { baixarModeloPlanilha, importarPlanilhaProdutos, type ResultadoImportacao } from '../lib/excel';

interface ProductCatalogModalProps {
  produtos: ProdutoCadastro[];
  onSaveProduto: (prod: Partial<ProdutoCadastro>) => Promise<void>;
  onDeleteProduto: (id: string) => Promise<void>;
  onBatchSaveProdutos: (produtos: Omit<ProdutoCadastro, 'id'>[]) => Promise<{ inseridos: number; atualizados: number }>;
  onClearAllProdutos?: () => Promise<void>;
  onClose: () => void;
  initialSkuToRegister?: string;
}

export const ProductCatalogModal: React.FC<ProductCatalogModalProps> = ({
  produtos,
  onSaveProduto,
  onDeleteProduto,
  onBatchSaveProdutos,
  onClearAllProdutos,
  onClose,
  initialSkuToRegister,
}) => {
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState<'lista' | 'manual' | 'importar'>(
    initialSkuToRegister ? 'manual' : 'lista'
  );

  // Form manual
  const [sku, setSku] = useState(initialSkuToRegister || '');
  const [descricao, setDescricao] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [estoque, setEstoque] = useState(0);
  const [custo, setCusto] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Exclusão
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<ProdutoCadastro | null>(null);
  const [confirmarLimparTudo, setConfirmarLimparTudo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Importador
  const [resultadoPreview, setResultadoPreview] = useState<ResultadoImportacao | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const produtosFiltrados = produtos.filter((p) => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return true;
    return (
      p.codigo_sku.toLowerCase().includes(termo) ||
      p.descricao.toLowerCase().includes(termo) ||
      (p.codigo_fornecedor && p.codigo_fornecedor.toLowerCase().includes(termo))
    );
  });

  const handleEditClick = (p: ProdutoCadastro) => {
    setEditId(p.id);
    setSku(p.codigo_sku);
    setDescricao(p.descricao);
    setFornecedor(p.codigo_fornecedor || '');
    setEstoque(p.estoque_sistema);
    setCusto(p.custo_unitario);
    setModo('manual');
    setFeedbackMsg(null);
  };

  const handleNovoManual = () => {
    setEditId(null);
    setSku('');
    setDescricao('');
    setFornecedor('');
    setEstoque(0);
    setCusto(0);
    setModo('manual');
    setFeedbackMsg(null);
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      setFeedbackMsg({ tipo: 'erro', texto: 'Código SKU é obrigatório.' });
      return;
    }
    if (!descricao.trim()) {
      setFeedbackMsg({ tipo: 'erro', texto: 'Descrição é obrigatória.' });
      return;
    }

    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      await onSaveProduto({
        id: editId || undefined,
        codigo_sku: sku.trim(),
        descricao: descricao.trim(),
        codigo_fornecedor: fornecedor.trim() || undefined,
        estoque_sistema: Number(estoque) || 0,
        custo_unitario: Number(custo) || 0,
      });

      setFeedbackMsg({ tipo: 'ok', texto: 'Produto salvo com sucesso no cadastro oficial!' });
      setTimeout(() => {
        setModo('lista');
        setFeedbackMsg(null);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar produto';
      setFeedbackMsg({ tipo: 'erro', texto: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteProduto = async () => {
    if (!produtoParaExcluir) return;
    setIsDeleting(true);
    try {
      await onDeleteProduto(produtoParaExcluir.id);
      setFeedbackMsg({ tipo: 'ok', texto: `Produto "${produtoParaExcluir.codigo_sku}" excluído com sucesso.` });
      setProdutoParaExcluir(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir produto';
      setFeedbackMsg({ tipo: 'erro', texto: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmClearAll = async () => {
    if (!onClearAllProdutos) return;
    setIsDeleting(true);
    try {
      await onClearAllProdutos();
      setFeedbackMsg({ tipo: 'ok', texto: 'Todos os produtos foram removidos do cadastro.' });
      setConfirmarLimparTudo(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar produtos';
      setFeedbackMsg({ tipo: 'erro', texto: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await importarPlanilhaProdutos(file);
      setResultadoPreview(res);
      setFeedbackMsg(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo';
      setFeedbackMsg({ tipo: 'erro', texto: msg });
    }
  };

  const handleConfirmImport = async () => {
    if (!resultadoPreview || resultadoPreview.produtos.length === 0) return;
    setIsImporting(true);
    setFeedbackMsg(null);

    try {
      const res = await onBatchSaveProdutos(resultadoPreview.produtos);
      setFeedbackMsg({
        tipo: 'ok',
        texto: `Importação concluída! ${res.inseridos + res.atualizados} produtos adicionados/atualizados no cadastro.`,
      });
      setResultadoPreview(null);
      setTimeout(() => {
        setModo('lista');
        setFeedbackMsg(null);
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar importação no banco';
      setFeedbackMsg({ tipo: 'erro', texto: msg });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Base de Cadastro de Produtos & Ativos (ERP)
              </h2>
              <p className="text-xs text-slate-400">
                {produtos.length} produtos cadastrados para auditoria com leitor de código de barras
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback visual */}
        {feedbackMsg && (
          <div
            className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 ${feedbackMsg.tipo === 'ok'
              ? 'bg-emerald-500/15 text-emerald-400 border-b border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-b border-rose-500/30'
              }`}
          >
            {feedbackMsg.tipo === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMsg.texto}</span>
          </div>
        )}

        {/* Navegação Interna */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModo('lista')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${modo === 'lista'
                ? 'bg-slate-200 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              Lista de Produtos ({produtos.length})
            </button>

            <button
              onClick={handleNovoManual}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${modo === 'manual'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {editId ? 'Editar Produto' : 'Cadastrar Manual'}
            </button>

            <button
              onClick={() => setModo('importar')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${modo === 'importar'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Planilha (Todos os Itens)
            </button>
          </div>

          <div className="flex items-center gap-2">
            {produtos.length > 0 && onClearAllProdutos && modo === 'lista' && (
              <button
                onClick={() => setConfirmarLimparTudo(true)}
                title="Excluir todos os produtos do cadastro"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-medium border border-slate-700 hover:border-rose-500/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Base
              </button>
            )}

            <button
              onClick={baixarModeloPlanilha}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Baixar Modelo Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* MODO LISTA */}
          {modo === 'lista' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por SKU (ex: 205N51, AUTO_0001), descrição ou fornecedor..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-mono border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Código SKU</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Fornecedor</th>
                      <th className="py-3 px-4 text-center">Saldo Sistema</th>
                      <th className="py-3 px-4 text-right">Custo Unitário</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {produtosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Nenhum produto cadastrado corresponde à busca.
                        </td>
                      </tr>
                    ) : (
                      produtosFiltrados.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                            {p.codigo_sku}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-200">
                            {p.descricao}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-mono text-slate-400">
                            {p.codigo_fornecedor || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-slate-300">
                            {p.estoque_sistema} un
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                            {p.custo_unitario.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleEditClick(p)}
                                title="Editar Produto"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setProdutoParaExcluir(p)}
                                title="Excluir Produto do Cadastro"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODO FORMULÁRIO MANUAL */}
          {modo === 'manual' && (
            <form onSubmit={handleSaveManual} className="max-w-2xl mx-auto space-y-4 py-2">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-white text-base">
                  {editId ? 'Editar Produto Cadastrado' : 'Cadastrar Novo Produto / Ativo'}
                </h3>

                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                    CÓDIGO SKU (Ex: 205N51, 002NA01AC) *
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="Ex: 205N51"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Código lido pelo leitor de código de barras Nonus LW200. Zeros à esquerda são preservados.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                    DESCRIÇÃO DO ATIVO / MÁQUINA *
                  </label>
                  <input
                    type="text"
                    required
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: PUXADA ALTA CONVERGENTE - ALL FIT IRON"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                      CÓD. FORNECEDOR
                    </label>
                    <input
                      type="text"
                      value={fornecedor}
                      onChange={(e) => setFornecedor(e.target.value)}
                      placeholder="Ex: XVD038"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                      SALDO SISTEMA (ERP)
                    </label>
                    <input
                      type="number"
                      value={estoque}
                      onChange={(e) => setEstoque(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                      CUSTO UNITÁRIO (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={custo}
                      onChange={(e) => setCusto(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModo('lista')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Voltar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar no Cadastro'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* MODO IMPORTAÇÃO EXCEL / CSV */}
          {modo === 'importar' && (
            <div className="max-w-3xl mx-auto space-y-4 py-2">
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="font-bold text-white text-lg">Importar Planilha Oficial (Sem Perdas)</h3>
                  <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1">
                    Faça o upload do arquivo <strong>.xlsx</strong> ou <strong>.csv</strong>. 
                    <strong className="text-emerald-400 block mt-1">
                      ✓ Todos os itens são adicionados! Mesmo itens sem código na planilha receberão um SKU automático (ex: AUTO_0001).
                    </strong>
                  </p>
                </div>

                {/* Dropzone / File input */}
                <label className="block border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-8 cursor-pointer transition-colors bg-slate-900/60">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">
                    Clique para selecionar a planilha do seu computador
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Formatos suportados: .xlsx, .xls, .csv</p>
                </label>
              </div>

              {/* Preview da Importação */}
              {resultadoPreview && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Prévia dos Dados Detectados ({resultadoPreview.totalValidos} itens detectados)
                      </h4>
                      <p className="text-xs text-slate-400">
                        {resultadoPreview.totalValidos} produtos prontos para serem salvos no Supabase.
                      </p>
                    </div>

                    <button
                      onClick={handleConfirmImport}
                      disabled={isImporting}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                    >
                      {isImporting ? 'Salvando no Banco...' : 'Confirmar e Importar Todos'}
                    </button>
                  </div>

                  {resultadoPreview.erros.length > 0 && (
                    <div className="bg-sky-950/30 border border-sky-500/30 rounded-xl p-3 text-xs text-sky-300 space-y-1">
                      <p className="font-bold">Avisos automáticos de SKU gerado:</p>
                      {resultadoPreview.erros.slice(0, 4).map((e, i) => (
                        <p key={i}>• {e}</p>
                      ))}
                      {resultadoPreview.erros.length > 4 && (
                        <p className="text-[11px] text-slate-400">
                          ... e mais {resultadoPreview.erros.length - 4} códigos gerados automaticamente.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tabela de amostra */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-mono">
                        <tr>
                          <th className="py-2 px-3">Código SKU</th>
                          <th className="py-2 px-3">Descrição</th>
                          <th className="py-2 px-3">Fornecedor</th>
                          <th className="py-2 px-3 text-center">Saldo</th>
                          <th className="py-2 px-3 text-right">Custo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {resultadoPreview.produtos.slice(0, 10).map((p, i) => (
                          <tr key={i} className="hover:bg-slate-900/50">
                            <td className="py-1.5 px-3 font-mono font-bold text-emerald-400">
                              {p.codigo_sku}
                            </td>
                            <td className="py-1.5 px-3 text-slate-200">{p.descricao}</td>
                            <td className="py-1.5 px-3 text-slate-400 font-mono">{p.codigo_fornecedor || '-'}</td>
                            <td className="py-1.5 px-3 text-center font-mono">{p.estoque_sistema}</td>
                            <td className="py-1.5 px-3 text-right font-mono">
                              {p.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {resultadoPreview.produtos.length > 10 && (
                    <p className="text-[11px] text-slate-400 text-center">
                      ... e mais {resultadoPreview.produtos.length - 10} produtos a serem adicionados.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Confirmação de Exclusão Individual */}
      {produtoParaExcluir && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Excluir Produto do Cadastro?</h3>
                <p className="text-xs text-slate-400">Esta ação remove o produto do cadastro oficial do ERP.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm">
              <p className="text-emerald-400 font-bold">{produtoParaExcluir.codigo_sku}</p>
              <p className="text-slate-300 font-sans mt-0.5">{produtoParaExcluir.descricao}</p>
              <p className="text-xs text-slate-400 mt-2">
                Saldo: <strong>{produtoParaExcluir.estoque_sistema} un</strong> | Custo: <strong>{produtoParaExcluir.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setProdutoParaExcluir(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteProduto}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Limpar Base Completa */}
      {confirmarLimparTudo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Limpar Toda a Base de Cadastro?</h3>
                <p className="text-xs text-slate-400">Todos os {produtos.length} produtos cadastrados serão removidos.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
              Utilize esta opção se você deseja resetar todos os produtos para importar uma nova planilha completa do zero.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmarLimparTudo(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClearAll}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Limpando...' : 'Sim, Limpar Toda a Base'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
