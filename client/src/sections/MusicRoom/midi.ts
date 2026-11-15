/**
 * A minimal Standard MIDI File writer, for exporting a recorded melody.
 * Format 0 (one track), 480 ticks per quarter note, 120 beats per minute.
 */

export type RecordedEvent = {
  /** Milliseconds since the recording started. */
  time: number;
  midi: number;
  on: boolean;
  /** 0..1 */
  velocity: number;
};

const TICKS_PER_QUARTER = 480;
const BEATS_PER_MINUTE = 120;
const TICKS_PER_MS = (TICKS_PER_QUARTER * BEATS_PER_MINUTE) / 60000;

/** MIDI's variable-length quantity encoding. */
function variableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  for (;;) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];

export function recordingToMidi(events: RecordedEvent[]): Uint8Array {
  const track: number[] = [];

  // Tempo: microseconds per quarter note.
  track.push(0x00, 0xff, 0x51, 0x03, ...u32(Math.round(60000000 / BEATS_PER_MINUTE)).slice(1));

  let previousTick = 0;
  const sorted = [...events].sort((a, b) => a.time - b.time);
  for (const event of sorted) {
    const tick = Math.max(previousTick, Math.round(event.time * TICKS_PER_MS));
    track.push(...variableLength(tick - previousTick));
    track.push(event.on ? 0x90 : 0x80, event.midi & 0x7f, event.on ? Math.max(1, Math.round(event.velocity * 127)) : 0);
    previousTick = tick;
  }

  track.push(0x00, 0xff, 0x2f, 0x00); // end of track

  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), ...u16(0), ...u16(1), ...u16(TICKS_PER_QUARTER)];
  const trackChunk = [0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track];
  return new Uint8Array([...header, ...trackChunk]);
}

/** Offers the recording as a .mid download. */
export function downloadMidi(events: RecordedEvent[], filename = "mithesh-melody.mid") {
  const bytes = recordingToMidi(events);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
