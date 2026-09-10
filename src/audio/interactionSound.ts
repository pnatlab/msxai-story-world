const CLICK_FREQUENCY = 720;
const CLICK_HARMONIC_FREQUENCY = 1_440;
const CLICK_GAIN = 0.16;
const CLICK_HARMONIC_GAIN = 0.035;
const CLICK_ATTACK_SECONDS = 0.008;
const CLICK_DECAY_SECONDS = 0.16;
const CLICK_STOP_SECONDS = 0.2;

export interface InteractionSoundOptions {
  readonly createContext?: () => AudioContext | undefined;
}

interface TransientSound {
  readonly source: OscillatorNode;
  readonly harmonic: OscillatorNode;
  readonly gain: GainNode;
  readonly harmonicGain: GainNode;
}

/**
 * A small, local Web Audio interaction-feedback controller.
 * It creates no context or sound nodes until a visitor explicitly enables it.
 */
export class InteractionSound {
  private readonly createContext: () => AudioContext | undefined;
  private context?: AudioContext;
  private enabled = false;
  private readonly activeSounds = new Set<TransientSound>();

  public constructor(options: InteractionSoundOptions = {}) {
    this.createContext = options.createContext ?? createBrowserAudioContext;
  }

  public isSoundEnabled(): boolean {
    return this.enabled;
  }

  public async enableSound(): Promise<boolean> {
    if (this.enabled) return true;
    try {
      this.context ??= this.createContext();
      if (!this.context) return false;
      await this.context.resume();
      this.enabled = true;
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  public async disableSound(): Promise<void> {
    this.enabled = false;
    if (!this.context || this.context.state === "closed") return;
    try {
      await this.context.suspend();
    } catch {
      // Audio is supplementary; a failed suspend must not affect the Story World.
    }
  }

  public playInteractionSound(): boolean {
    const context = this.context;
    if (!this.enabled || !context || context.state !== "running") return false;
    try {
      const now = context.currentTime;
      const source = context.createOscillator();
      source.type = "sine";
      source.frequency.setValueAtTime(CLICK_FREQUENCY, now);
      source.frequency.exponentialRampToValueAtTime(560, now + CLICK_DECAY_SECONDS);

      const harmonic = context.createOscillator();
      harmonic.type = "triangle";
      harmonic.frequency.setValueAtTime(CLICK_HARMONIC_FREQUENCY, now);
      harmonic.frequency.exponentialRampToValueAtTime(1_150, now + CLICK_DECAY_SECONDS);

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(CLICK_GAIN, now + CLICK_ATTACK_SECONDS);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + CLICK_DECAY_SECONDS);

      const harmonicGain = context.createGain();
      harmonicGain.gain.setValueAtTime(0.0001, now);
      harmonicGain.gain.linearRampToValueAtTime(CLICK_HARMONIC_GAIN, now + CLICK_ATTACK_SECONDS);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + CLICK_DECAY_SECONDS);

      source.connect(gain).connect(context.destination);
      harmonic.connect(harmonicGain).connect(context.destination);
      const transient: TransientSound = { source, harmonic, gain, harmonicGain };
      this.activeSounds.add(transient);
      const cleanup = () => {
        source.disconnect();
        harmonic.disconnect();
        gain.disconnect();
        harmonicGain.disconnect();
        this.activeSounds.delete(transient);
      };
      source.addEventListener("ended", cleanup, { once: true });
      source.start(now);
      harmonic.start(now);
      source.stop(now + CLICK_STOP_SECONDS);
      harmonic.stop(now + CLICK_STOP_SECONDS);
      return true;
    } catch {
      return false;
    }
  }

  public setPageVisible(visible: boolean): void {
    if (!this.enabled || !this.context) return;
    if (!visible) void this.context.suspend().catch(() => undefined);
    else void this.context.resume().catch(() => undefined);
  }

  public dispose(): void {
    this.enabled = false;
    this.activeSounds.forEach(({ source, harmonic, gain, harmonicGain }) => {
      try { source.stop(); } catch { /* already ended */ }
      try { harmonic.stop(); } catch { /* already ended */ }
      source.disconnect();
      harmonic.disconnect();
      gain.disconnect();
      harmonicGain.disconnect();
    });
    this.activeSounds.clear();
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }
}

function createBrowserAudioContext(): AudioContext | undefined {
  const BrowserAudioContext = globalThis.AudioContext
    ?? (globalThis as typeof globalThis & { readonly webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return BrowserAudioContext ? new BrowserAudioContext() : undefined;
}
