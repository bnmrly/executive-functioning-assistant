export const mediaSettingsKey = 'dashboard-media-v1';
export const mediaSettingsEvent = 'dashboard-media-change';

const playlistIdPattern = /^[A-Za-z0-9_-]{2,100}$/;
const youtubeHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'];
const spotifyIdPattern = /^[A-Za-z0-9]{22}$/;
const defaultSpotifyPlaylists = [{ id: '4Q6ORWOWhVMXXuLRhDNCVd', title: 'Beth time' }, null];
export const spotifyPlaylistUrl = id => 'https://open.spotify.com/playlist/' + id;
export const youtubePlaylistUrl = id => 'https://www.youtube.com/playlist?' + new URLSearchParams({ list: id });

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

export function youtubePlaylistId(value) {
  try {
    const url = new URL(value);
    const id = url.searchParams.get('list');
    if (url.protocol === 'https:' && youtubeHosts.includes(url.hostname) && playlistIdPattern.test(id ?? '')) return id;
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
    video: saved?.video === true,
    spotifyPlaylists: [0, 1].map(index => {
      const entry = spotify[index];
      if (typeof entry?.id !== 'string' || !spotifyIdPattern.test(entry.id)) return null;
      const title = typeof entry.title === 'string' && entry.title.trim() || 'Playlist ' + (index + 1);
      return { id: entry.id, title };
    }),
    playlists: Array.isArray(saved?.playlists) ? saved.playlists.filter(playlist =>
      typeof playlist?.id === 'string' && playlistIdPattern.test(playlist.id) &&
      typeof playlist.title === 'string' && playlist.title.trim()
    ) : [],
  };
}

export function saveMediaSettings(changes) {
  localStorage.setItem(mediaSettingsKey, JSON.stringify({ ...readMediaSettings(), ...changes }));
  window.dispatchEvent(new Event(mediaSettingsEvent));
}
