import type { Sampler } from "tone";
import { noteToMidi } from "../audio/musicTheory";
import { emitPianoNote } from "../audio/pianoBus";
import { SAMPLE_BASE_URL, SAMPLE_URLS } from "../audio/pianoSamples";
import { secondsPerBeat, songSeconds, type QuizSong } from "./types";

type ToneModule = typeof import("tone");

export type PlayHooks = {
  /** 0 to 1 through the melody, about fifteen times a second. */
  onProgress?: (fraction: number) => void;
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
  /** The melody finished by itself, or was stopped. */
  onEnd?: (reason: "finished" | "stopped") => void;
  /** Repeat until stopped. */
  loop?: boolean;
};

/**
 * Plays Guess the Song melodies on the site's grand piano samples. It stands
 * on its own: it does not need the sound switch, the virtual piano or the
 * music player. Notes are scheduled on Tone's transport from their start beat
 * and length in beats, so stopping cancels everything that was still to come.
 */
export class QuizPlayer {
  private tone: ToneModule | null = null;
  private sampler: Sampler | null = null;
  private loading: Promise<void> | null = null;
  private generation = 0;
  private timer: number | undefined;
  private hooks: PlayHooks = {};
  private playing = false;

  get isPlaying() {
    return this.playing;
  }

  /** Loads Tone and the piano. Do this from a click, so the browser lets sound start. */
  load(): Promise<void> {
    if (!this.loading) {
      this.loading = (async () => {
        const Tone = await import("tone");
        await Tone.start();
        const sampler = await new Promise<Sampler>((resolve, reject) => {
          const s = new Tone.Sampler({
            urls: SAMPLE_URLS,
            baseUrl: SAMPLE_BASE_URL,
            release: 1,
            onload: () => resolve(s),
            onerror: (e) => reject(e),
          }).toDestination();
        });
        this.tone = Tone;
        this.sampler = sampler;
      })();
      this.loading.catch(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  async play(song: QuizSong, hooks: PlayHooks = {}): Promise<void> {
    await this.load();
    const Tone = this.tone!;
    const sampler = this.sampler!;

    // Any melody already playing is cut cleanly first, so two never overlap.
    this.stop();
    const generation = ++this.generation;
    this.hooks = hooks;
    this.playing = true;

    const beat = secondsPerBeat(song.music);
    const lead = song.music.startOffsetBeats * beat;
    const gap = song.playback.noteGap * beat;
    const total = songSeconds(song);
    sampler.volume.value = Tone.gainToDb(Math.max(0.001, song.playback.volume));

    const transport = Tone.getTransport();
    const draw = Tone.getDraw();
    transport.stop();
    transport.cancel(0);
    transport.seconds = 0;

    for (const note of song.notes) {
      if (note.pitch === "REST" || note.velocity <= 0) continue;
      const midi = noteToMidi(note.pitch);
      if (midi === null) continue;
      const start = lead + note.startBeat * beat;
      const length = Math.max(0.05, note.durationBeats * beat - gap);
      transport.schedule((time) => {
        if (generation !== this.generation) return;
        sampler.triggerAttackRelease(note.pitch, length, time, note.velocity);
        draw.schedule(() => {
          if (generation !== this.generation) return;
          hooks.onNoteOn?.(midi, note.velocity);
          // The site's 3D piano lights the key too.
          emitPianoNote(midi, note.velocity);
        }, time);
        draw.schedule(() => {
          if (generation === this.generation) hooks.onNoteOff?.(midi);
        }, time + length);
      }, start);
    }

    if (hooks.loop) {
      transport.loop = true;
      transport.loopStart = 0;
      transport.loopEnd = total + 0.5;
    } else {
      transport.loop = false;
      transport.schedule((time) => {
        draw.schedule(() => {
          if (generation === this.generation) this.finish();
        }, time + 0.35);
      }, total);
    }

    transport.start("+0.05");
    this.timer = window.setInterval(() => {
      if (generation !== this.generation) return;
      hooks.onProgress?.(Math.min(1, ((transport.seconds % (total + 0.5)) || 0) / total));
    }, 60);
  }

  /** The melody ran to its end. */
  private finish() {
    const hooks = this.hooks;
    this.halt();
    hooks.onProgress?.(1);
    hooks.onEnd?.("finished");
  }

  /** Stops the sound and cancels every note still to come. */
  stop() {
    if (!this.playing) return;
    const hooks = this.hooks;
    this.generation++;
    this.halt();
    hooks.onEnd?.("stopped");
  }

  private halt() {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.playing = false;
    if (this.tone) {
      const transport = this.tone.getTransport();
      transport.stop();
      transport.cancel(0);
      transport.loop = false;
    }
    this.sampler?.releaseAll();
  }

  /** Frees the audio. The player cannot be used again afterwards. */
  dispose() {
    this.stop();
    this.generation++;
    this.sampler?.dispose();
    this.sampler = null;
    this.tone = null;
    this.loading = null;
  }
}

export const createQuizPlayer = () => new QuizPlayer();
