import { describe, expect, it, vi } from "vitest";
import { InteractionSound } from "../src/audio/interactionSound";
import { UI_COPY } from "../src/i18n";
import { LocaleController } from "../src/story/localeState";
import { StoryController } from "../src/story/StoryController";
import { STORY_WORLD_V0_1 } from "../src/world/world.v0.1";

class FakeAudioParam {
  public value = 0;
  public setValueAtTime = vi.fn((value: number) => { this.value = value; });
  public linearRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
  public exponentialRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
}

class FakeAudioNode {
  public connect = vi.fn((destination: FakeAudioNode) => destination);
  public disconnect = vi.fn();
}

class FakeGainNode extends FakeAudioNode {
  public readonly gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  public type: OscillatorType = "sine";
  public readonly frequency = new FakeAudioParam();
  public onended?: () => void;
  public readonly start = vi.fn();
  public readonly stop = vi.fn();
  public readonly addEventListener = vi.fn((_event: string, listener: () => void) => { this.onended = listener; });
}

class FakeAudioContext {
  public state: AudioContextState = "suspended";
  public currentTime = 0;
  public readonly destination = new FakeAudioNode();
  public readonly oscillators: FakeOscillatorNode[] = [];
  public readonly resume = vi.fn(async () => { this.state = "running"; });
  public readonly suspend = vi.fn(async () => { this.state = "suspended"; });
  public readonly close = vi.fn(async () => { this.state = "closed"; });

  public createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  public createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

function createHarness(context = new FakeAudioContext()): { readonly sound: InteractionSound; readonly context: FakeAudioContext } {
  return {
    context,
    sound: new InteractionSound({ createContext: () => context as unknown as AudioContext }),
  };
}

describe("Procedural UI interaction sound", () => {
  it("defaults off and creates no AudioContext on page load", () => {
    const factory = vi.fn(() => new FakeAudioContext() as unknown as AudioContext);
    const sound = new InteractionSound({ createContext: factory });
    expect(sound.isSoundEnabled()).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });

  it("enables after an explicit action and produces one short tonal pair", async () => {
    const { sound, context } = createHarness();
    await expect(sound.enableSound()).resolves.toBe(true);
    expect(sound.playInteractionSound()).toBe(true);
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1)).toBe(true);
    expect(context.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(720, 0);
    context.oscillators[0].onended?.();
    expect(context.oscillators[0].disconnect).toHaveBeenCalled();
  });

  it("reuses one AudioContext and creates no sources while idle", async () => {
    const context = new FakeAudioContext();
    const factory = vi.fn(() => context as unknown as AudioContext);
    const sound = new InteractionSound({ createContext: factory });
    await sound.enableSound();
    await sound.enableSound();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.oscillators).toHaveLength(0);
  });

  it("disables subsequent interaction sounds", async () => {
    const { sound, context } = createHarness();
    await sound.enableSound();
    await sound.disableSound();
    expect(sound.isSoundEnabled()).toBe(false);
    expect(sound.playInteractionSound()).toBe(false);
    expect(context.suspend).toHaveBeenCalledTimes(1);
  });

  it("keeps sound independent from StoryState and locale state", async () => {
    const { sound } = createHarness();
    const story = new StoryController(STORY_WORLD_V0_1);
    const locale = new LocaleController();
    story.beginStory();
    story.next();
    locale.setLocale("th");
    const storyBefore = story.getState();
    const localeBefore = locale.getLocale();
    await sound.enableSound();
    sound.playInteractionSound();
    await sound.disableSound();
    expect(story.getState()).toEqual(storyBefore);
    expect(locale.getLocale()).toBe(localeBefore);
  });

  it("suspends while hidden and resumes only while still enabled", async () => {
    const { sound, context } = createHarness();
    await sound.enableSound();
    sound.setPageVisible(false);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    sound.setPageVisible(true);
    expect(context.resume).toHaveBeenCalledTimes(2);
    await sound.disableSound();
    sound.setPageVisible(true);
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it("fails safely when Web Audio is unavailable", async () => {
    const sound = new InteractionSound({ createContext: () => undefined });
    await expect(sound.enableSound()).resolves.toBe(false);
    expect(sound.playInteractionSound()).toBe(false);
  });

  it("provides local EN and TH labels", () => {
    expect(UI_COPY.en).toMatchObject({
      soundOnState: "Sound On",
      soundOffState: "Sound Off",
      turnSoundOn: "Turn interaction sound on",
      turnSoundOff: "Turn interaction sound off",
    });
    expect(UI_COPY.th).toMatchObject({
      soundOnState: "เปิดเสียงอยู่",
      soundOffState: "ปิดเสียงอยู่",
      turnSoundOn: "เปิดเสียงตอบสนอง",
      turnSoundOff: "ปิดเสียงตอบสนอง",
    });
  });
});
