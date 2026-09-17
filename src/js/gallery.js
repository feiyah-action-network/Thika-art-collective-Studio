/**
 * Gallery filtering. The groups are whatever the markup declares, so adding a
 * filter is a markup change and needs nothing here: a new group of chips with
 * a data-filter name, and a matching data-<name> attribute on the pieces.
 *
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

  const groups = [...new Set(Array.from(bar.querySelectorAll('[data-filter]'), (c) => c.dataset.filter))];
  const state = Object.fromEntries(groups.map((name) => [name, 'all']));

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
      const match = groups.every(
        (name) =>
          state[name] === 'all' || (item.dataset[name] || '').split(' ').includes(state[name])
      );

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
