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
