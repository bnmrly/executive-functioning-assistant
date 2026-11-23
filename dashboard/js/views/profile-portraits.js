export const childPortraitKey = 'dashboard-profile-portrait-v1';
export const parentAvatarKey = 'dashboard-parent-avatar-v1';
export const defaultChildAvatar = '1F98B';
export const avatars = [
  ['Fox', '1F98A'], ['Cat', '1F431'], ['Panda', '1F43C'],
  ['Unicorn', '1F984'], ['Dinosaur', '1F996'], ['Butterfly', defaultChildAvatar],
];
export const avatarUrl = id => '/avatars/' + id + '.svg';

export function childPortrait() {
  const saved = JSON.parse(localStorage.getItem(childPortraitKey));
  const avatar = avatars.find(([, id]) => (saved?.avatar ?? (saved === null ? defaultChildAvatar : null)) === id);
  const photo = typeof saved?.photo === 'string' && saved.photo.startsWith('data:image/jpeg;base64,') ? saved.photo : null;
  return { avatar, photo };
}

export function paintNavPortrait(parent = false) {
  const target = document.querySelector('.rail-profile-avatar');
  const button = target.closest('button');
  target.textContent = parent ? 'D' : 'B';
  button.lastElementChild.textContent = parent ? 'Dad' : 'Profile';
  try {
    const portrait = parent
      ? { avatar: avatars.find(([, id]) => id === localStorage.getItem(parentAvatarKey)) }
      : childPortrait();
    const source = portrait.photo ?? (portrait.avatar && avatarUrl(portrait.avatar[1]));
    if (source) {
      const image = document.createElement('img');
      image.alt = '';
      image.src = source;
      target.replaceChildren(image);
    }
  } catch {
    // The profile initial still works without storage.
  }
}
