export const mediaSettingsKey = 'dashboard-media-v1';
export const mediaSettingsEvent = 'dashboard-media-change';

const spotifyIdPattern = /^[A-Za-z0-9]{22}$/;
const defaultSpotifyPlaylists = [{ id: '4Q6ORWOWhVMXXuLRhDNCVd', title: 'Beth time' }, null];
export const spotifyPlaylistUrl = id => 'https://open.spotify.com/playlist/' + id;

export function spotifyPlaylistId(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'open.spotify.com') {
      return url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/([A-Za-z0-9]{22})\/?$/i)?.[1] ?? null;
    }
  } catch {
    // Invalid or incomplete links have no playlist ID.
  }
  return null;
}

export function readMediaSettings() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(mediaSettingsKey)); }
  catch { /* Use the defaults when storage is unavailable. */ }
  const spotify = Array.isArray(saved?.spotifyPlaylists) ? saved.spotifyPlaylists : defaultSpotifyPlaylists;
  return {
    music: saved?.music !== false,
    spotifyPlaylists: [0, 1].map(index => {
      const entry = spotify[index];
      if (typeof entry?.id !== 'string' || !spotifyIdPattern.test(entry.id)) return null;
      const title = typeof entry.title === 'string' && entry.title.trim() || 'Playlist ' + (index + 1);
      return { id: entry.id, title };
    }),
  };
}

export function saveMediaSettings(changes) {
  localStorage.setItem(mediaSettingsKey, JSON.stringify({ ...readMediaSettings(), ...changes }));
  window.dispatchEvent(new Event(mediaSettingsEvent));
}
