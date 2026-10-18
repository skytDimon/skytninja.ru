import './style.css'

// ============================================
// Preloader — show loading screen while assets load
// ============================================
const preloader = document.getElementById('preloader');
const preloaderBar = document.getElementById('preloader-bar');
const preloaderPercent = document.getElementById('preloader-percent');
let loadProgress = 0;

function updateProgress(progress) {
  loadProgress = Math.max(loadProgress, progress);
  if (preloaderBar) preloaderBar.style.width = loadProgress + '%';
  if (preloaderPercent) preloaderPercent.textContent = Math.round(loadProgress) + '%';
}

function hidePreloader() {
  updateProgress(100);
  setTimeout(() => {
    if (preloader) {
      preloader.classList.add('preloader-hidden');
      // Remove from DOM after transition
      setTimeout(() => preloader.remove(), 800);
    }
  }, 400);
}

// Fake progress until window loads
let fakeProgressInterval = setInterval(() => {
  if (loadProgress < 90) {
    updateProgress(loadProgress + 5);
  }
}, 50);

window.addEventListener('load', () => {
  clearInterval(fakeProgressInterval);
  hidePreloader();
});

// Safety timeout — force-hide preloader after 5 seconds in case resources fail
setTimeout(() => {
  clearInterval(fakeProgressInterval);
  hidePreloader();
}, 5000);

// ============================================
// Lazy load videos — only when visible
// ============================================
function initLazyVideos() {
  const videos = document.querySelectorAll('video[data-src]');
  if (!videos.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const video = entry.target;
        video.src = video.dataset.src;
        video.load();
        observer.unobserve(video);
      }
    });
  }, { rootMargin: '200px' });

  videos.forEach(v => observer.observe(v));
}

initLazyVideos();

// ============================================
// Video Hover Logic (cases section)
// ============================================
document.querySelectorAll('.case-card').forEach(card => {
  const video = card.querySelector('video');
  if (video) {
    card.addEventListener('mouseenter', () => video.pause());
    card.addEventListener('mouseleave', () => video.play());
  }
});

// ============================================
// Mobile navigation
// ============================================
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');

function setMobileNav(open) {
  hamburger.classList.toggle('active', open);
  mobileNav.classList.toggle('active', open);
  hamburger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

if (hamburger && mobileNav) {
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-controls', 'mobile-nav');
  hamburger.addEventListener('click', () => setMobileNav(!mobileNav.classList.contains('active')));
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMobileNav(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setMobileNav(false);
  });
}

// ============================================
// Scroll reveal + count-up stats
// ============================================
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el) {
  const target = Number(el.dataset.count);
  if (reducedMotion || target === 0) return;
  const duration = 1200;
  const start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.15 });

document.querySelectorAll('[data-reveal]').forEach((el, i) => {
  el.style.setProperty('--reveal-delay', `${(i % 3) * 80}ms`);
  revealObserver.observe(el);
});

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('[data-count]').forEach(countUp);
    statObserver.unobserve(entry.target);
  });
}, { threshold: 0.6 });

document.querySelectorAll('.about-stats').forEach(el => statObserver.observe(el));

// ============================================
// Reduced motion — no autoplaying video
// ============================================
if (reducedMotion) {
  document.querySelectorAll('video').forEach(v => {
    v.removeAttribute('autoplay');
    v.pause();
  });
  document.querySelectorAll('.case-card video').forEach(v =>
    v.addEventListener('loadeddata', () => v.pause(), { once: true }));
}
