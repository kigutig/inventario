import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock robusto de LocalStorage (Compatível com Node 22/25 e jsdom)
// ---------------------------------------------------------------------------
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

const storageMock = createStorageMock();

Object.defineProperty(window, 'localStorage', {
  value: storageMock,
  writable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// ISOLAMENTO DE TESTES: MOCK DO SUPABASE
// Garante que a execução de testes automatizados NUNCA altere ou limpe o banco real
// ---------------------------------------------------------------------------
vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(() => null),
  isSupabaseConfigured: vi.fn(() => false),
  getSupabaseCredentials: vi.fn(() => ({ url: '', anonKey: '' })),
  saveSupabaseCredentials: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock do Web Audio API (Para testes de áudio com leitor Nonus LW200)
// ---------------------------------------------------------------------------
class MockGainNode {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

class MockOscillatorNode {
  type = 'sine';
  frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createGain = vi.fn(() => new MockGainNode());
  resume = vi.fn().mockResolvedValue(undefined);
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: MockAudioContext,
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: MockAudioContext,
});

// ---------------------------------------------------------------------------
// Mock do Canvas Confetti
// ---------------------------------------------------------------------------
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Limpar mocks e storage antes de cada teste
beforeEach(() => {
  storageMock.clear();
  vi.clearAllMocks();
});
