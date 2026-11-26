import { mediaSettingsEvent, mediaSettingsKey, readMediaSettings, spotifyPlaylistUrl } from '../media-settings.js';

const music = document.querySelector('#view-music');
let renderedSpotify;

function playlistGrid(playlists, fillCard) {
  const grid = document.createElement('div');
  grid.className = 'media-grid';

  playlists.forEach((playlist, index) => {
    const card = document.createElement('section');
    card.className = 'media-card';
    const header = document.createElement('header');
    const heading = document.createElement('h2');
    heading.textContent = playlist?.title ?? 'Playlist ' + (index + 1);
    header.append(heading);
    card.append(header);
    if (playlist) {
      fillCard(card, header, playlist);
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'No playlist added yet.';
      card.append(empty);
    }
    grid.append(card);
  });
  return grid;
}

function showMusic() {
  if (App.current !== 'music' || music.firstElementChild) return;
  const { spotifyPlaylists } = readMediaSettings();
  const grid = playlistGrid(spotifyPlaylists, (card, header, playlist) => {
    const player = document.createElement('iframe');
    player.className = 'music-embed';
    player.title = playlist.title + ' · Spotify player';
    player.src = 'https://open.spotify.com/embed/playlist/' + playlist.id;
    player.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    player.allowFullscreen = true;

    const link = document.createElement('a');
    link.className = 'media-link';
    link.href = spotifyPlaylistUrl(playlist.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open in Spotify';
    link.setAttribute('aria-label', 'Open ' + playlist.title + ' in Spotify');
    header.append(link);
    card.append(player);
  });
  renderedSpotify = JSON.stringify(spotifyPlaylists);
  music.append(grid);
}

App.register('music', { canOpen: () => readMediaSettings().music, show: showMusic, resume: showMusic });

function syncMedia() {
  const settings = readMediaSettings();
  document.querySelector('[data-go="music"]').hidden = !settings.music;
  if (App.current === 'music' && !settings.music) App.go('home');
  if (!settings.music || JSON.stringify(settings.spotifyPlaylists) !== renderedSpotify) {
    music.replaceChildren();
    if (settings.music) showMusic();
  }
}

syncMedia();
window.addEventListener(mediaSettingsEvent, syncMedia);
window.addEventListener('storage', event => {
  if (event.key === mediaSettingsKey || event.key === null) syncMedia();
});
