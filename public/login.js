'use strict';

const form = document.getElementById('login-form');
const password = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');
const errorEl = document.getElementById('login-error');
const submit = document.getElementById('login-submit');

function showError(message) {
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function setPasswordVisible(visible) {
  password.type = visible ? 'text' : 'password';
  togglePassword.setAttribute('aria-pressed', visible ? 'true' : 'false');
  togglePassword.setAttribute(
    'aria-label',
    visible ? 'Passwort verbergen' : 'Passwort anzeigen'
  );
  togglePassword.title = visible ? 'Passwort verbergen' : 'Passwort anzeigen';
  const eye = togglePassword.querySelector('.icon-eye');
  const eyeOff = togglePassword.querySelector('.icon-eye-off');
  if (eye) eye.hidden = visible;
  if (eyeOff) eyeOff.hidden = !visible;
}

if (togglePassword) {
  togglePassword.addEventListener('click', () => {
    setPasswordVisible(password.type === 'password');
    password.focus();
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  submit.disabled = true;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password.value }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok || !data?.success) {
      showError(data?.error || 'Anmeldung fehlgeschlagen.');
      password.focus();
      password.select();
      return;
    }

    window.location.href = '/';
  } catch {
    showError('Netzwerkfehler bei der Anmeldung.');
  } finally {
    submit.disabled = false;
  }
});
