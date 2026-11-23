import { mediaSettingsEvent, mediaSettingsKey, readMediaSettings, spotifyPlaylistUrl, youtubePlaylistUrl } from '../media-settings.js';

const music = document.querySelector('#view-music');
const video = document.querySelector('#view-video');
let renderedSpotify;
let renderedYouTube;

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

function showVideo() {
  if (App.current !== 'video' || video.firstElementChild) return;
  const { playlists } = readMediaSettings();
  renderedYouTube = JSON.stringify(playlists);
  while (playlists.length < 2) playlists.push(null);
  const grid = playlistGrid(playlists, (card, header, playlist) => {
    const url = new URL('https://www.youtube.com/embed');
    url.search = new URLSearchParams({ listType: 'playlist', list: playlist.id, rel: '0' });
    const player = document.createElement('iframe');
    player.className = 'video-player';
    player.title = playlist.title + ' · YouTube playlist';
    player.loading = 'lazy';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.allow = 'encrypted-media; fullscreen; picture-in-picture';
    player.allowFullscreen = true;
    player.src = url.href;

    const link = document.createElement('a');
    link.className = 'media-link';
    link.href = youtubePlaylistUrl(playlist.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View full playlist';
    link.setAttribute('aria-label', 'View full ' + playlist.title + ' playlist on YouTube');
    header.append(link);
    card.append(player);
  });
  video.append(grid);
}

App.register('music', { canOpen: () => readMediaSettings().music, show: showMusic, resume: showMusic });
App.register('video', {
  canOpen: () => readMediaSettings().video,
  show: showVideo,
  resume: showVideo,
  hide() { video.replaceChildren(); },
});

function syncMedia() {
  const settings = readMediaSettings();
  for (const name of ['music', 'video']) {
    document.querySelector('[data-go="' + name + '"]').hidden = !settings[name];
  }
  if ((App.current === 'music' || App.current === 'video') && !settings[App.current]) App.go('home');
  if (!settings.music || JSON.stringify(settings.spotifyPlaylists) !== renderedSpotify) {
    music.replaceChildren();
    if (settings.music) showMusic();
  }
  if (App.current === 'video' && JSON.stringify(settings.playlists) !== renderedYouTube) {
    video.replaceChildren();
    showVideo();
  }
}

syncMedia();
window.addEventListener(mediaSettingsEvent, syncMedia);
window.addEventListener('storage', event => {
  if (event.key === mediaSettingsKey || event.key === null) syncMedia();
});
