
(() => {
  const root = document.querySelector('.cg');
  if (!root) return;
  const KEY = 'comite0511-fs';
  let size = 19;
  try { const s = parseInt(localStorage.getItem(KEY), 10); if (s >= 14 && s <= 30) size = s; } catch (e) {}
  const apply = () => { root.style.setProperty('--base', size + 'px'); try { localStorage.setItem(KEY, String(size)); } catch (e) {} };
  apply();
  const plus = document.getElementById('cg-fs-plus'), minus = document.getElementById('cg-fs-minus');
  if (plus) plus.addEventListener('click', () => { if (size < 30) { size += 1; apply(); } });
  if (minus) minus.addEventListener('click', () => { if (size > 14) { size -= 1; apply(); } });
  const setTop = () => { const t = document.querySelector('.top'); root.style.setProperty('--cg-top', ((t && t.offsetHeight) || 60) + 'px'); };
  setTop();
  window.addEventListener('resize', setTop);
  window.addEventListener('ov:show', (e) => { if (!e.detail || e.detail === 'comite') setTop(); });
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href^="#cg-"]');
    if (!a) return;
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    ev.preventDefault();
    el.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block: 'start'});
  });
  const links = Array.from(root.querySelectorAll('.cg-bar nav a'));
  const map = {};
  links.forEach((a) => { map[a.getAttribute('href').slice(1)] = a; });
  let current = null;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && map[en.target.id] && current !== en.target.id) {
          current = en.target.id;
          links.forEach((l) => l.classList.remove('cg-on'));
          const a = map[current]; a.classList.add('cg-on');
          const nav = a.parentNode, x = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
          if (Math.abs(nav.scrollLeft - x) > 4) nav.scrollLeft = x;
        }
      });
    }, {rootMargin: '-30% 0px -60% 0px'});
    Object.keys(map).forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
})();
