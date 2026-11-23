import { mediaSettingsKey, readMediaSettings, saveMediaSettings, spotifyPlaylistId, spotifyPlaylistUrl, youtubePlaylistId, youtubePlaylistUrl } from '../media-settings.js';

export function mountMediaEditor(panel) {
  panel.innerHTML =
    '<div class="parent-media-toggles">' +
    '<label><input type="checkbox" role="switch" data-media="music"> Allow music</label>' +
    '<label><input type="checkbox" role="switch" data-media="video"> Allow video</label></div>' +
    '<h2>Spotify playlists</h2>' +
    '<form class="parent-spotify-form" aria-label="Spotify playlists">' +
    '<div class="parent-spotify-slots">' + ['Grey card', 'Green card'].map(label =>
      '<fieldset data-spotify-slot><legend>' + label + '</legend>' +
      '<label>Playlist name <input data-spotify-title maxlength="80"></label>' +
      '<label>Spotify playlist link <input type="url" data-spotify-link placeholder="https://open.spotify.com/playlist/…"></label></fieldset>'
    ).join('') + '</div>' +
    '<p>Clear a link to empty that card.</p>' +
    '<div class="parent-actions"><button type="submit">Save Spotify playlists</button></div>' +
    '<p class="parent-status" data-spotify-status role="status"></p></form>' +
    '<h2>YouTube playlists</h2><ul class="parent-playlists"></ul>' +
    '<form class="parent-media-form">' +
    '<label>Playlist name <input name="title" maxlength="80" required></label>' +
    '<label>YouTube playlist link <input type="url" name="link" required></label>' +
    '<button type="submit">Add playlist</button></form>' +
    '<p class="parent-status" data-media-status role="status"></p>';

  const form = panel.querySelector('.parent-media-form');
  const status = panel.querySelector('[data-media-status]');
  const spotifyForm = panel.querySelector('.parent-spotify-form');
  const spotifyStatus = panel.querySelector('[data-spotify-status]');
  const spotifySlots = [...spotifyForm.querySelectorAll('[data-spotify-slot]')].map(slot => ({
    title: slot.querySelector('[data-spotify-title]'),
    link: slot.querySelector('[data-spotify-link]'),
  }));
  const list = panel.querySelector('.parent-playlists');
  const toggles = [...panel.querySelectorAll('[data-media]')];

  function render() {
    const settings = readMediaSettings();
    for (const toggle of toggles) toggle.checked = settings[toggle.dataset.media];
    list.replaceChildren();
    for (const { id, title } of settings.playlists) {
      const item = document.createElement('li');
      const name = document.createElement('a');
      name.textContent = title;
      name.href = youtubePlaylistUrl(id);
      name.target = '_blank';
      name.rel = 'noopener noreferrer';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.removePlaylist = id;
      remove.setAttribute('aria-label', 'Remove ' + title);
      remove.textContent = 'Remove';
      item.append(name, remove);
      list.append(item);
    }
  }

  function save(changes, message, feedback = status) {
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

  form.addEventListener('input', () => { status.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const id = youtubePlaylistId(form.elements.link.value);
    const title = form.elements.title.value.trim();
    if (!id || !title) {
      status.textContent = 'Enter a name and a YouTube link with a playlist.';
      return;
    }
    const { playlists } = readMediaSettings();
    const existing = playlists.find(playlist => playlist.id === id);
    if (existing) {
      render();
      status.textContent = 'This link is already saved as “' + existing.title + '”.';
      return;
    }
    if (save({ playlists: [...playlists, { id, title }] }, 'Playlist added.')) form.reset();
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-playlist]');
    if (!button) return;
    const playlists = readMediaSettings().playlists.filter(entry => entry.id !== button.dataset.removePlaylist);
    if (save({ playlists }, 'Playlist removed.')) (list.querySelector('button') || form.elements.title).focus();
  });

  render();
  renderSpotify();

  function syncSavedList(event) {
    if (event.key !== mediaSettingsKey && event.key !== null) return;
    render();
    status.textContent = '';
  }
  window.addEventListener('storage', syncSavedList);
  return () => window.removeEventListener('storage', syncSavedList);
}
