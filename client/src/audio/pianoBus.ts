/**
 * A tiny event bus: whenever the site plays a piano note, listeners (such as
 * the particle piano) are told which key and how hard. It carries no audio.
 */

type NoteListener = (midi: number, velocity: number) => void;

const listeners = new Set<NoteListener>();

export function onPianoNote(listener: NoteListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitPianoNote(midi: number, velocity: number) {
  listeners.forEach((listener) => listener(midi, velocity));
}

/**
 * Normally the computer-keyboard piano only answers while it is on screen. A
 * game can ask it to listen anywhere on the page for a while.
 */
let keyboardForced = false;

export const setKeyboardForced = (forced: boolean) => {
  keyboardForced = forced;
};

export const isKeyboardForced = () => keyboardForced;
