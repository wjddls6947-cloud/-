class QuizSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.getContext();
  }

  private playTone(
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.14
  ): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * 즐거운 정답 팡파르 효과음 (경쾌한 상승 메이저 아르페지오 + 상쾌한 마무리 화음)
   */
  public playCorrect(): void {
    if (!this.enabled) return;
    // C5 -> E5 -> G5 -> C6 bright cheerful arpeggio
    this.playTone(523.25, 0, 0.14, 'triangle', 0.15);
    this.playTone(659.25, 0.075, 0.14, 'triangle', 0.16);
    this.playTone(783.99, 0.15, 0.16, 'triangle', 0.17);
    this.playTone(1046.5, 0.225, 0.34, 'sine', 0.18);
    // Subtle shimmer harmony on top
    this.playTone(1318.51, 0.25, 0.28, 'sine', 0.07);
  }

  /**
   * 오답 효과음 (부드럽지만 분명하게 구분되는 하강 2음)
   */
  public playIncorrect(): void {
    if (!this.enabled) return;
    this.playTone(311.13, 0, 0.16, 'sawtooth', 0.075);
    this.playTone(233.08, 0.13, 0.28, 'sawtooth', 0.08);
  }

  /**
   * 시간 초과 효과음
   */
  public playTimeout(): void {
    if (!this.enabled) return;
    this.playTone(392.0, 0, 0.14, 'square', 0.055);
    this.playTone(261.63, 0.14, 0.3, 'triangle', 0.11);
  }

  /**
   * 마지막 3초 카운트다운 틱
   */
  public playTick(): void {
    if (!this.enabled) return;
    this.playTone(880, 0, 0.045, 'sine', 0.055);
  }

  /**
   * 선택/버튼 클릭 피드백
   */
  public playClick(): void {
    if (!this.enabled) return;
    this.playTone(640, 0, 0.035, 'sine', 0.045);
  }

  /**
   * 게임 완료 축하 멜로디
   */
  public playVictory(): void {
    if (!this.enabled) return;
    const notes: Array<[number, number, number]> = [
      [523.25, 0, 0.12],
      [659.25, 0.1, 0.12],
      [783.99, 0.2, 0.12],
      [1046.5, 0.31, 0.26],
      [783.99, 0.48, 0.12],
      [1046.5, 0.6, 0.45],
    ];
    for (const [freq, offset, dur] of notes) {
      this.playTone(freq, offset, dur, 'triangle', 0.15);
    }
  }
}

export const soundEngine = new QuizSoundEngine();
