/**
 * Features that are built but switched off. To turn one on, set its variable to "1"
 * when building the site (for example VITE_GUESS_THE_SONG=1 in client/.env) and, for
 * Guess the Song, GUESS_THE_SONG=1 for the API too. Off, the feature is not in the
 * page, not in the admin, and its code is never downloaded.
 */
export const GUESS_THE_SONG_ENABLED = import.meta.env.VITE_GUESS_THE_SONG === "1";
