import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ScannerInput } from '../components/ScannerInput';

describe('<ScannerInput /> (Leitor Nonus LW200 HID)', () => {
  it('deve processar o bipe com Enter do leitor Nonus LW200 e limpar o input imediatamente', async () => {
    const user = userEvent.setup();
    const onScanMock = vi.fn().mockResolvedValue({
      cadastrado: true,
      mensagem: 'Sucesso',
      item: {
        id: '1',
        sessao_id: 's1',
        codigo_sku: '205N51',
        descricao_snapshot: 'PUXADA ALTA CONVERGENTE',
        quantidade_contada: 5,
        estoque_sistema_snapshot: 5,
        custo_unitario_snapshot: 4850,
        cadastrado_no_sistema: true,
        ultima_leitura_at: new Date().toISOString(),
      },
    });

    render(<ScannerInput onScan={onScanMock} />);

    const input = screen.getByPlaceholderText(/Aguardando bipe do leitor/i);
    expect(input).toBeInTheDocument();

    // Simula o leitor digitando o SKU e pressionando Enter automaticamente
    await user.type(input, '205N51{enter}');

    expect(onScanMock).toHaveBeenCalledWith('205N51');

    // Valida Optimistic UI: campo limpo imediatamente para o próximo bipe
    expect(input).toHaveValue('');

    // Valida Banner HUD do último bipe
    await waitFor(() => {
      expect(screen.getByText('205N51')).toBeInTheDocument();
      expect(screen.getByText('PUXADA ALTA CONVERGENTE')).toBeInTheDocument();
      expect(screen.getByText(/Cadastrado Oficial/i)).toBeInTheDocument();
    });
  });

  it('deve exibir badge e botão de cadastro rápido quando o código não estiver cadastrado', async () => {
    const user = userEvent.setup();
    const onQuickRegisterMock = vi.fn();
    const onScanMock = vi.fn().mockResolvedValue({
      cadastrado: false,
      mensagem: 'Código não cadastrado',
      item: {
        id: '2',
        sessao_id: 's1',
        codigo_sku: 'NOVO99',
        descricao_snapshot: '[NÃO CADASTRADO] SKU NOVO99',
        quantidade_contada: 1,
        estoque_sistema_snapshot: 0,
        custo_unitario_snapshot: 0,
        cadastrado_no_sistema: false,
        ultima_leitura_at: new Date().toISOString(),
      },
    });

    render(
      <ScannerInput
        onScan={onScanMock}
        onQuickRegisterSku={onQuickRegisterMock}
      />
    );

    const input = screen.getByPlaceholderText(/Aguardando bipe do leitor/i);
    await user.type(input, 'NOVO99{enter}');

    await waitFor(() => {
      expect(screen.getByText(/NÃO CADASTRADO NO ERP/i)).toBeInTheDocument();
      expect(screen.getByText(/Cadastrar Este SKU Agora/i)).toBeInTheDocument();
    });

    const btnCadastrar = screen.getByText(/Cadastrar Este SKU Agora/i);
    await user.click(btnCadastrar);

    expect(onQuickRegisterMock).toHaveBeenCalledWith('NOVO99');
  });

  it('deve desabilitar o input quando a sessão de inventário estiver finalizada', () => {
    const onScanMock = vi.fn();
    render(<ScannerInput onScan={onScanMock} disabled={true} />);

    const input = screen.getByPlaceholderText(/Sessão finalizada/i);
    expect(input).toBeDisabled();
  });
});
