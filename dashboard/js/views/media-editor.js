import { mediaSettingsKey, readMediaSettings, saveMediaSettings, spotifyPlaylistId, spotifyPlaylistUrl } from '../media-settings.js';

export function mountMediaEditor(panel) {
  panel.innerHTML =
    '<div class="parent-media-toggles">' +
    '<label><input type="checkbox" role="switch" data-media="music"> Allow music</label></div>' +
    '<h2>Spotify playlists</h2>' +
    '<form class="parent-spotify-form" aria-label="Spotify playlists">' +
    '<div class="parent-spotify-slots">' + ['Grey card', 'Green card'].map(label =>
      '<fieldset data-spotify-slot><legend>' + label + '</legend>' +
      '<label>Playlist name <input data-spotify-title maxlength="80"></label>' +
      '<label>Spotify playlist link <input type="url" data-spotify-link placeholder="https://open.spotify.com/playlist/…"></label></fieldset>'
    ).join('') + '</div>' +
    '<p>Clear a link to empty that card.</p>' +
    '<div class="parent-actions"><button type="submit">Save Spotify playlists</button></div>' +
    '<p class="parent-status" data-spotify-status role="status"></p></form>';

  const spotifyForm = panel.querySelector('.parent-spotify-form');
  const spotifyStatus = panel.querySelector('[data-spotify-status]');
  const spotifySlots = [...spotifyForm.querySelectorAll('[data-spotify-slot]')].map(slot => ({
    title: slot.querySelector('[data-spotify-title]'),
    link: slot.querySelector('[data-spotify-link]'),
  }));
  const toggles = [...panel.querySelectorAll('[data-media]')];

  function render() {
    const settings = readMediaSettings();
    for (const toggle of toggles) toggle.checked = settings[toggle.dataset.media];
  }

  function save(changes, message, feedback = spotifyStatus) {
    try {
      saveMediaSettings(changes);
      feedback.textContent = message;
      render();
      return true;
    } catch {
      render();
      feedback.textContent = 'Could not save media settings on this device.';
      return false;
    }
  }

  function renderSpotify() {
    const { spotifyPlaylists } = readMediaSettings();
    spotifySlots.forEach(({ title, link }, index) => {
      const playlist = spotifyPlaylists[index];
      title.value = playlist?.title ?? '';
      link.value = playlist ? spotifyPlaylistUrl(playlist.id) : '';
    });
  }

  spotifyForm.addEventListener('submit', event => {
    event.preventDefault();
    const playlists = [];
    for (const [index, { title, link }] of spotifySlots.entries()) {
      const value = link.value.trim();
      const id = spotifyPlaylistId(value);
      if (value && !id) {
        spotifyStatus.textContent = 'Paste a Spotify playlist link for the ' + (index === 0 ? 'grey' : 'green') + ' card.';
        link.focus();
        return;
      }
      playlists.push(id ? { id, title: title.value.trim() } : null);
    }
    if (save({ spotifyPlaylists: playlists }, 'Spotify playlists saved.', spotifyStatus)) renderSpotify();
  });

  for (const toggle of toggles) {
    toggle.addEventListener('change', () => {
      const name = toggle.dataset.media;
      const allowed = toggle.checked;
      save({ [name]: allowed }, toggle.parentElement.textContent.trim().replace('Allow ', '') +
        (allowed ? ' is now available.' : ' is now hidden.'));
    });
  }

  render();
  renderSpotify();

  function syncSavedList(event) {
    if (event.key !== mediaSettingsKey && event.key !== null) return;
    render();
    spotifyStatus.textContent = '';
  }
  window.addEventListener('storage', syncSavedList);
  return () => window.removeEventListener('storage', syncSavedList);
}
