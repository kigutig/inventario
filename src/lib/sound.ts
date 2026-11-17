// ==============================================================================
// SISTEMA DE ÁUDIO VIA WEB AUDIO API (Feedback instantâneo sem arquivos externos)
// ==============================================================================

class SoundFeedback {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  constructor() {
    const savedMute = localStorage.getItem('inventory_sound_muted');
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('inventory_sound_muted', String(muted));
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Bipe de Sucesso (Item cadastrado e bipado com sucesso):
   * Dois tons harmônicos ascendentes rápidos e nítidos (1100Hz -> 1450Hz)
   */
  public playSuccess() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const now = ctx.currentTime;

      // Inicia em 1050Hz e sobe para 1400Hz rapidamente
      osc.frequency.setValueAtTime(1050, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

      // Envelope de amplitude rápido para evitar estalo ("click")
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28 * this.volume, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      console.warn('Falha ao reproduzir áudio de sucesso:', e);
    }
  }

  /**
   * Bipe de Alerta / Código NÃO Cadastrado:
   * Tom duplo pulsante de aviso (dois bips secos em 450Hz)
   */
  public playWarning() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Pulso 1
      this.playTone(ctx, 480, 'triangle', now, 0.11, 0.35);
      // Pulso 2
      this.playTone(ctx, 420, 'triangle', now + 0.14, 0.16, 0.35);
    } catch (e) {
      console.warn('Falha ao reproduzir áudio de alerta:', e);
    }
  }

  /**
   * Bipe de Erro / Falha de Conexão ou Sessão Finalizada:
   * Tom grave descendente tipo 'buzz'
   */
  public playError() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25 * this.volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.29);
    } catch (e) {
      console.warn('Falha ao reproduzir áudio de erro:', e);
    }
  }

  /**
   * Bipe sutil de ajuste (+ ou - manual)
   */
  public playAdjust() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      this.playTone(ctx, 880, 'sine', ctx.currentTime, 0.05, 0.15);
    } catch {
      // Ignorar
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    vol: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(vol * this.volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}

export const soundManager = new SoundFeedback();

