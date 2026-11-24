'use strict';

const form = document.getElementById('login-form');
const password = document.getElementById('password');
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
