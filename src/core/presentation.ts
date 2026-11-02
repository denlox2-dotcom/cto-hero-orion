import type { RoomResult } from './types';

/** Active presentation time; user pause never consumes these intervals. */
export const ROOM_RESULT_SECONDS = 5;
/** A failed room waits for an explicit retry instead of advancing underneath it. */
export function resultCountdown(reason: RoomResult['reason']): number | null {
  return reason === 'success' ? ROOM_RESULT_SECONDS : null;
}
export const VICTORY_HOLD_SECONDS = 2;
/** Scene coordinate below the existing DOM HUD overlay; no HUD layout change. */
export const PAK_ENTRY_Y = 200;
