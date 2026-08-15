/**
 * Contact form: inline validation plus a background submit.
 *
 * The markup is a plain POST form carrying Netlify Forms attributes, so on the
 * production host it works with JavaScript switched off. This module upgrades
 * it to submit without a page reload, and if the endpoint is not reachable it
 * says so and points the visitor at the studio email address instead of
 * swallowing the message.
 */
export function initForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[type="submit"]');

  function errorSlot(field) {
    return form.querySelector(`[data-error-for="${field.name}"]`);
  }

  function validate(field) {
    const slot = errorSlot(field);
    const valid = field.checkValidity();
    if (slot) slot.textContent = valid ? '' : field.dataset.message || 'Please check this field.';
    field.setAttribute('aria-invalid', String(!valid));
    return valid;
  }

  form.querySelectorAll('input, textarea, select').forEach((field) => {
    if (field.type === 'hidden') return;
    field.addEventListener('blur', () => validate(field));
    field.addEventListener('input', () => {
      const slot = errorSlot(field);
      if (slot && slot.textContent) validate(field);
    });
  });

  function show(message, tone) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.style.borderColor = tone === 'error' ? 'var(--rust)' : 'var(--patina)';
  }

  form.addEventListener('submit', async (event) => {
    const fields = Array.from(form.querySelectorAll('input, textarea, select')).filter(
      (field) => field.type !== 'hidden'
    );
    const firstInvalid = fields.find((field) => !validate(field));

    if (firstInvalid) {
      event.preventDefault();
      firstInvalid.focus();
      return;
    }

    event.preventDefault();
    if (submit) {
      submit.disabled = true;
      submit.dataset.label = submit.textContent;
      submit.textContent = 'Sending';
    }

    try {
      const response = await fetch(form.getAttribute('action') || '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      });

      if (!response.ok) throw new Error(String(response.status));

      form.reset();
      show('Thank you. Your message is with the studio and someone will reply soon.', 'ok');
    } catch (error) {
      show(
        'The form could not be sent from this device. Please email hello@thikaartcollective.co.ke and we will pick it up from there.',
        'error'
      );
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = submit.dataset.label || 'Send message';
      }
    }
  });
}
