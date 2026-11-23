const pinKey = 'dashboard-parent-pin-v1';
const pinLength = 4;

async function pinHash(pin, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: Uint8Array.from(salt), iterations: 120000, hash: 'SHA-256',
  }, key, 256);
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function mountParentPin(dialog, onUnlock) {
  const fields = dialog.querySelector('.profile-review-fields');
  const error = dialog.querySelector('.profile-review-error');
  const submit = dialog.querySelector('[data-unlock-parent]');
  let attempt;
  dialog.querySelector('[data-close-review]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    attempt = null;
    fields.replaceChildren();
    error.textContent = '';
  });

  async function unlock() {
    const current = attempt;
    if (!dialog.open || !current || submit.disabled) return;
    const { credential } = current;
    const input = fields.querySelector('[name=pin]');
    const confirm = fields.querySelector('[name=confirm]');
    if (!input.reportValidity() || (confirm && !confirm.reportValidity())) return;
    const pin = input.value;
    if (!credential && pin !== fields.querySelector('[name=confirm]').value) {
      error.textContent = 'The PINs don’t match.';
      return;
    }
    submit.disabled = true;
    error.textContent = '';
    try {
      const salt = credential?.salt || Array.from(crypto.getRandomValues(new Uint8Array(16)));
      const hash = await pinHash(pin, salt);
      if (!dialog.open || attempt !== current) return;
      if (credential && credential.hash !== hash) {
        error.textContent = 'That PIN didn’t match. Try again.';
        fields.querySelector('[name=pin]').select();
        return;
      }
      if (!credential) localStorage.setItem(pinKey, JSON.stringify({ salt, hash }));
      dialog.close();
      onUnlock();
    } catch {
      if (dialog.open && attempt === current) error.textContent = 'Could not unlock Parent mode on this device.';
    } finally {
      if (dialog.open && attempt === current) submit.disabled = false;
    }
  }
  submit.addEventListener('click', () => void unlock());
  fields.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void unlock();
  });

  return {
    open() {
      if (dialog.open) return;
      error.textContent = '';
      submit.disabled = false;
      try {
        if (!crypto.subtle) throw new Error('Secure local PIN storage is unavailable.');
        const credential = JSON.parse(localStorage.getItem(pinKey));
        attempt = { credential };
        const rules = 'type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{' +
          pinLength + '}" maxlength="' + pinLength + '" required';
        fields.innerHTML = '<p>' + (credential ? 'Enter your parent PIN.' :
          'Set a four-digit PIN for Parent mode on this device.') + '</p>' +
          '<label>Parent PIN <input name="pin" ' + rules + '></label>' +
          (credential ? '' : '<label>Confirm PIN <input name="confirm" ' + rules + '></label>');
        submit.textContent = credential ? 'Unlock' : 'Set PIN and continue';
      } catch {
        attempt = null;
        fields.replaceChildren();
        submit.disabled = true;
        error.textContent = 'Parent mode is unavailable on this device.';
      }
      dialog.showModal();
      fields.querySelector('input')?.focus();
    },
    close() { if (dialog.open) dialog.close(); },
  };
}
