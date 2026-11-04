export const TRANSITIONS = { replacement: 3, transport: 0.2, volume: 0.02, loadTimeout: 15000 } as const;
export const level = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export const seconds = (value: number) => Number.isFinite(value) ? Math.max(0, value) : TRANSITIONS.replacement;

/** Track automation explicitly so interrupted fades restart at the audible gain. */
export class GainEnvelope {
  private from: number;
  private target: number;
  private start = 0;
  private duration = 0;
  private power = false;
  private param: AudioParam;
  private context: BaseAudioContext;

  constructor(context: BaseAudioContext, param: AudioParam, initial: number) {
    this.context = context;
    this.param = param;
    this.from = this.target = initial;
    param.value = initial;
  }

  get value() {
    const progress = this.duration ? Math.min(1, Math.max(0, (this.context.currentTime - this.start) / this.duration)) : 1;
    return this.interpolate(progress);
  }

  private interpolate(progress: number) {
    if (!this.power) return this.from + (this.target - this.from) * progress;
    const weight = Math.sin(progress * Math.PI / 2) ** 2;
    return Math.sqrt(this.from ** 2 * (1 - weight) + this.target ** 2 * weight);
  }

  fade(target: number, duration: number, power = false) {
    const now = this.context.currentTime;
    this.from = this.value;
    this.target = level(target);
    this.start = now;
    this.duration = seconds(duration);
    this.power = power;
    this.param.cancelScheduledValues(now);
    this.param.setValueAtTime(this.from, now);
    if (!this.duration) this.param.setValueAtTime(this.target, now);
    else {
      const curve = Float32Array.from({ length: 65 }, (_, index) => this.interpolate(index / 64));
      this.param.setValueCurveAtTime(curve, now, this.duration);
    }
  }
}
