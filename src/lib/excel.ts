import * as XLSX from 'xlsx';
import type { ItemInventariado, ProdutoCadastro, SessaoInventario } from '../types/inventory';

// Limpeza e normalização de strings numéricas com moeda e separadores pt-BR
function parseNumberPtBr(val: unknown): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // Remove R$, espaços
  str = str.replace(/^R\$\s*/i, '').trim();

  // Se tiver formato brasileiro como 1.250,50
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export interface ResultadoImportacao {
  produtos: Omit<ProdutoCadastro, 'id'>[];
  totalLidos: number;
  totalValidos: number;
  erros: string[];
}

export async function importarPlanilhaProdutos(file: File): Promise<ResultadoImportacao> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, {
          type: 'binary',
          raw: true, // Mantém strings cruas para preservar zeros à esquerda
        });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          throw new Error('Nenhuma planilha encontrada no arquivo.');
        }

        // Converte para matriz de objetos preservando strings
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          raw: true,
          defval: '',
        });

        const produtos: Omit<ProdutoCadastro, 'id'>[] = [];
        const erros: string[] = [];

        rows.forEach((row, index) => {
          // Busca case-insensitive e flexível de colunas
          const keys = Object.keys(row);

          const findKey = (patterns: string[]): string | undefined => {
            return keys.find((k) => {
              const clean = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              return patterns.some((p) => clean === p || clean.includes(p));
            });
          };

          const skuKey = findKey(['codigo', 'sku', 'cod', 'item', 'ref', 'codigo_sku', 'ativo', 'patrimonio']);
          const descKey = findKey(['descricao', 'produto', 'nome', 'especificacao', 'maquina', 'equipamento']);
          const fornKey = findKey(['fornecedor', 'cod_fornecedor', 'marca', 'fabricante']);
          const estKey = findKey(['estoque', 'saldo', 'qtd', 'quantidade', 'estoque_sistema', 'atual']);
          const custoKey = findKey(['custo', 'preco', 'valor', 'unitario', 'custo_unitario']);

          // Código SKU como string (se não tiver código, gera SKU sequencial para NÃO ignorar o item)
          const rawSku = skuKey ? String(row[skuKey]).trim() : '';
          const rawDesc = descKey ? String(row[descKey]).trim() : '';

          // Verifica se a linha possui qualquer conteúdo útil
          const hasAnyContent = keys.some((k) => String(row[k] || '').trim() !== '');
          if (!hasAnyContent) {
            return; // Linha 100% em branco (final da planilha)
          }

          // Se não tiver código na planilha, gera um código automático (ex: AUTO_0001) para incluir obrigatoriamente
          const finalSku = rawSku || `AUTO_${String(index + 1).padStart(4, '0')}`;
          const finalDesc = rawDesc || (rawSku ? `Item ${rawSku}` : `Item sem descrição (Linha ${index + 2})`);

          if (!rawSku) {
            erros.push(`Linha ${index + 2}: Produto sem código original — gerado SKU automático "${finalSku}".`);
          }

          const rawForn = fornKey ? String(row[fornKey]).trim() : null;
          const estoque = estKey ? Math.round(parseNumberPtBr(row[estKey])) : 0;
          const custo = custoKey ? parseNumberPtBr(row[custoKey]) : 0;

          produtos.push({
            codigo_sku: finalSku,
            descricao: finalDesc,
            codigo_fornecedor: rawForn || undefined,
            estoque_sistema: estoque,
            custo_unitario: Number(custo.toFixed(2)),
          });
        });

        resolve({
          produtos,
          totalLidos: rows.length,
          totalValidos: produtos.length,
          erros,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao processar o arquivo';
        reject(new Error(msg));
      }
    };

    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.readAsBinaryString(file);
  });
}

export function exportarRelatorioInventario(
  sessao: SessaoInventario,
  itens: ItemInventariado[],
  formato: 'xlsx' | 'csv'
) {
  // Preparar dados tabulares
  const dadosExportacao = itens.map((item) => {
    const divergencia = item.quantidade_contada - item.estoque_sistema_snapshot;
    const impacto = divergencia * item.custo_unitario_snapshot;

    let situacao = 'CORRETO';
    if (!item.cadastrado_no_sistema) situacao = 'NÃO CADASTRADO';
    else if (divergencia > 0) situacao = 'SOBRA (+)';
    else if (divergencia < 0) situacao = 'FALTA (-)';

    return {
      'Código SKU': item.codigo_sku,
      'Descrição do Produto': item.descricao_snapshot,
      'Estoque Teórico (Sistema)': item.estoque_sistema_snapshot,
      'Qtd. Contada (Físico)': item.quantidade_contada,
      'Divergência': divergencia,
      'Situação': situacao,
      'Custo Unitário (R$)': item.custo_unitario_snapshot.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      'Impacto Financeiro (R$)': impacto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      'Cadastrado': item.cadastrado_no_sistema ? 'SIM' : 'NÃO',
      'Última Leitura': item.ultima_leitura_at ? new Date(item.ultima_leitura_at).toLocaleString('pt-BR') : '-',
    };
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const nomeArquivoSanitizado = sessao.nome.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (formato === 'csv') {
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    // Adiciona BOM UTF-8 para abrir perfeitamente no Excel sem estragar acentuação
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${nomeArquivoSanitizado}_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Exportação XLSX com aba de dados e aba de resumo executivo
  const wb = XLSX.utils.book_new();

  // Aba 1: Itens Auditados
  const wsItens = XLSX.utils.json_to_sheet(dadosExportacao);
  wsItens['!cols'] = [
    { wch: 16 }, // SKU
    { wch: 45 }, // Descricao
    { wch: 22 }, // Estoque Sistema
    { wch: 22 }, // Contada
    { wch: 14 }, // Divergencia
    { wch: 18 }, // Situacao
    { wch: 18 }, // Custo
    { wch: 22 }, // Impacto
    { wch: 12 }, // Cadastrado
    { wch: 20 }, // Ultima leitura
  ];
  XLSX.utils.book_append_sheet(wb, wsItens, 'Itens Auditados');

  // Aba 2: Resumo Executivo
  const totalBipadas = itens.reduce((acc, i) => acc + i.quantidade_contada, 0);
  const totalDivergentes = itens.filter((i) => i.quantidade_contada !== i.estoque_sistema_snapshot).length;
  const impactoTotal = itens.reduce(
    (acc, i) => acc + (i.quantidade_contada - i.estoque_sistema_snapshot) * i.custo_unitario_snapshot,
    0
  );
  const acuracia = itens.length > 0 ? (((itens.length - totalDivergentes) / itens.length) * 100).toFixed(1) : '100';

  const resumoData = [
    { Indicador: 'Nome da Sessão de Inventário', Valor: sessao.nome },
    { Indicador: 'Status da Sessão', Valor: sessao.status.toUpperCase() },
    { Indicador: 'Data de Abertura', Valor: new Date(sessao.created_at).toLocaleString('pt-BR') },
    { Indicador: 'Data de Finalização', Valor: sessao.finalizado_at ? new Date(sessao.finalizado_at).toLocaleString('pt-BR') : 'Em Aberto' },
    { Indicador: 'Total de Peças Físicas Bipadas', Valor: totalBipadas },
    { Indicador: 'Total de SKUs Únicos Auditados', Valor: itens.length },
    { Indicador: 'Total de SKUs com Divergência (Falta/Sobra)', Valor: totalDivergentes },
    { Indicador: 'Acurácia de Inventário (%)', Valor: `${acuracia}%` },
    { Indicador: 'Balanço Financeiro da Divergência (R$)', Valor: impactoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
  ];

  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch: 38 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

  XLSX.writeFile(wb, `inventario_${nomeArquivoSanitizado}_${timestamp}.xlsx`);
}

export function baixarModeloPlanilha() {
  const modeloExemplo = [
    {
      'Código': '205N51',
      'Descrição': 'PUXADA ALTA CONVERGENTE - ALL FIT IRON',
      'Código Fornecedor': 'XVD038',
      'Estoque': 12,
      'Custo': 4850.00,
    },
    {
      'Código': '002NA01AC',
      'Descrição': 'LEG PRESS 45 GRAUS ARTICULADO - LINHA PRO',
      'Código Fornecedor': 'ALP902',
      'Estoque': 8,
      'Custo': 7200.00,
    },
    {
      'Código': '010KB88',
      'Descrição': 'ESTEIRA ERGOMÉTRICA PROFISSIONAL ELETRÔNICA T9',
      'Código Fornecedor': 'EST441',
      'Estoque': 15,
      'Custo': 12900.00,
    },
    {
      'Código': '440M22',
      'Descrição': 'SUPINO RETO OLÍMPICO REFORÇADO COM TRAVA',
      'Código Fornecedor': 'SUP110',
      'Estoque': 6,
      'Custo': 2600.00,
    },
    {
      'Código': '771X09',
      'Descrição': 'CROSSOVER ANGULAR COM REGULAGEM DE CABO DUPLO',
      'Código Fornecedor': 'CAB882',
      'Estoque': 4,
      'Custo': 11400.00,
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(modeloExemplo);
  ws['!cols'] = [{ wch: 18 }, { wch: 48 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo Importação');
  XLSX.writeFile(wb, 'modelo_cadastro_produtos_inventario.xlsx');
}
