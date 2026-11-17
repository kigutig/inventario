import { describe, it, expect, beforeEach, vi } from 'vitest';
import { soundManager } from '../lib/sound';

describe('SoundFeedback (Web Audio API - Nonus LW200)', () => {
  beforeEach(() => {
    localStorage.clear();
    soundManager.setMuted(false);
  });

  it('deve inicializar com som ativado por padrão', () => {
    expect(soundManager.getMuted()).toBe(false);
  });

  it('deve permitir mutar e desmutar o som persistindo no localStorage', () => {
    soundManager.setMuted(true);
    expect(soundManager.getMuted()).toBe(true);
    expect(localStorage.getItem('inventory_sound_muted')).toBe('true');

    soundManager.toggleMute();
    expect(soundManager.getMuted()).toBe(false);
    expect(localStorage.getItem('inventory_sound_muted')).toBe('false');
  });

  it('deve disparar tom de sucesso sem erros quando não mutado', () => {
    expect(() => soundManager.playSuccess()).not.toThrow();
  });

  it('deve disparar tom duplo de alerta para código não cadastrado', () => {
    expect(() => soundManager.playWarning()).not.toThrow();
  });

  it('deve disparar tom de erro e tom de ajuste manual', () => {
    expect(() => soundManager.playError()).not.toThrow();
    expect(() => soundManager.playAdjust()).not.toThrow();
  });

  it('não deve emitir som quando estiver em mute', () => {
    soundManager.setMuted(true);
    const audioContextSpy = vi.spyOn(window, 'AudioContext');
    soundManager.playSuccess();
    soundManager.playWarning();
    expect(audioContextSpy).not.toHaveBeenCalled();
  });
});
