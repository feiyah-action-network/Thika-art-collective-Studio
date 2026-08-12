/**
 * Gallery filtering by material and by programme.
 * Without JavaScript the filter bar is hidden and every piece is shown, which
 * is a perfectly good gallery.
 */
export function initGallery() {
  const grid = document.querySelector('[data-gallery]');
  const bar = document.querySelector('[data-filters]');
  if (!grid || !bar) return;

  const items = Array.from(grid.querySelectorAll('[data-material]'));
  const status = document.querySelector('[data-gallery-status]');
  const empty = document.querySelector('[data-gallery-empty]');

  const state = { material: 'all', program: 'all' };

  /* Hide any chip nothing is tagged with, and drop a whole group when only its
     "all" chip would be left. That keeps the bar honest as pieces are added:
     the program filter reappears by itself once pieces carry program tags,
     with no code change. */
  function prune() {
    bar.querySelectorAll('.filters__group').forEach((group) => {
      let live = 0;

      group.querySelectorAll('[data-filter]').forEach((chip) => {
        const { filter, value } = chip.dataset;
        if (value === 'all') return;
        const used = items.some((item) => (item.dataset[filter] || '').split(' ').includes(value));
        chip.hidden = !used;
        if (used) live += 1;
      });

      group.hidden = live < 2;
    });

    bar.hidden = Array.from(bar.querySelectorAll('.filters__group')).every((g) => g.hidden);
  }

  prune();

  function apply() {
    let shown = 0;

    items.forEach((item) => {
      const materials = (item.dataset.material || '').split(' ');
      const programs = (item.dataset.program || '').split(' ');
      const match =
        (state.material === 'all' || materials.includes(state.material)) &&
        (state.program === 'all' || programs.includes(state.program));

      item.hidden = !match;
      if (match) shown += 1;
    });

    if (empty) empty.hidden = shown !== 0;
    if (status) status.textContent = `${shown} ${shown === 1 ? 'piece' : 'pieces'} shown`;

    window.dispatchEvent(new CustomEvent('layout:changed'));
  }

  bar.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;

    const group = chip.dataset.filter;
    state[group] = chip.dataset.value;

    bar.querySelectorAll(`[data-filter="${group}"]`).forEach((button) => {
      button.setAttribute('aria-pressed', String(button === chip));
    });

    apply();
  });

  apply();
}
