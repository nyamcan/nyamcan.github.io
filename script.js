// Site name is provisional. See SITE_GUIDE.md for the places to update.
const galleries = {
  molecule: {
    title: 'Molecule Eraser',
    store: 'https://apps.apple.com/jp/app/id6458982516',
    images: [
      ['assets/images/molecule-1.jpg', '元素と周期表が並ぶスタート画面'],
      ['assets/images/molecule-2.jpg', '元素をつなぐ操作案内'],
      ['assets/images/molecule-3.jpg', '元素ボールをつないで物質を作るiPhoneゲーム画面'],
      ['assets/images/molecule-4.jpg', '作れる物質を確認できる分子一覧'],
    ],
  },
  tower: {
    title: '積み木タワー',
    store: 'https://apps.apple.com/jp/app/id6756600013',
    images: [
      ['assets/images/tower-play.jpg', '積み木を重ねて、自分だけのタワーへ'],
      ['assets/images/tower-mode.jpg', '積み木タワーのゲームモード'],
      ['assets/images/tower-mode2.jpg', '高さと数、2つの積み方に挑戦'],
    ],
  },
  memory: {
    title: 'Aural Memory / 超・神経衰弱',
    store: 'https://apps.apple.com/jp/app/id6757111228',
    images: [
      ['assets/images/memory-play.jpg', '動くカードを追いかけて、ペアを探そう'],
      ['assets/images/memory-sound.jpg', '音を手がかりに、記憶に挑戦'],
      ['assets/images/memory-chords.jpg', '和音を聴き分ける神経衰弱'],
    ],
  },
  fruit: {
    title: 'ふる〜ちゅうぶ',
    store: 'https://apps.apple.com/jp/app/id6758034995',
    images: [
      ['assets/images/fruit-title.jpg', '果物たちが出迎えるタイトル画面'],
      ['assets/images/fruit-play.jpg', '果物を合成して、次のフルーツへ'],
      ['assets/images/fruit-gallery.jpg', 'ふる〜ちゅうぶのゲーム画面'],
    ],
  },
};

const filters = document.querySelectorAll('[data-filter]');
const cards = document.querySelectorAll('[data-category]');
filters.forEach((button) => {
  button.addEventListener('click', () => {
    const category = button.dataset.filter;
    filters.forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    cards.forEach((card) => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
      if (!card.hidden) count++;
    });
    document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'GAME' : 'GAMES'}`;
  });
});

const dialog = document.querySelector('#gallery-dialog');
const galleryImage = document.querySelector('#gallery-image');
const videoDetails = document.querySelector('#video-details');
const video = videoDetails.querySelector('video');
let activeGallery;
let activeIndex = 0;
let trigger;

function showImage(index) {
  activeIndex = (index + activeGallery.images.length) % activeGallery.images.length;
  const [source, caption] = activeGallery.images[activeIndex];
  document.querySelector('#gallery-prev').hidden = activeGallery.images.length < 2;
  document.querySelector('#gallery-next').hidden = activeGallery.images.length < 2;
  galleryImage.src = source;
  galleryImage.alt = `${activeGallery.title}：${caption}`;
  document.querySelector('#gallery-caption').textContent = caption;
  document.querySelector('#gallery-counter').textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(activeGallery.images.length).padStart(2, '0')}`;
}

document.querySelectorAll('[data-gallery]').forEach((button) => {
  button.addEventListener('click', () => {
    activeGallery = galleries[button.dataset.gallery];
    trigger = button;
    document.querySelector('#gallery-title').textContent = activeGallery.title;
    const storeLink = document.querySelector('#gallery-store');
    storeLink.href = activeGallery.store;
    storeLink.setAttribute('aria-label', `${activeGallery.title}をApp Storeで見る（新しいタブ）`);
    videoDetails.hidden = button.dataset.gallery !== 'memory';
    videoDetails.open = false;
    showImage(0);
    dialog.showModal();
    document.body.classList.add('modal-open');
    syncMemoryVideo();
  });
});

document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#gallery-prev').addEventListener('click', () => showImage(activeIndex - 1));
document.querySelector('#gallery-next').addEventListener('click', () => showImage(activeIndex + 1));
dialog.addEventListener('keydown', (event) => {
  // Keep native video keyboard controls intact.
  if (event.target.closest('video, summary')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    showImage(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  video.pause();
  videoDetails.open = false;
  trigger?.focus({ preventScroll: true });
  syncMemoryVideo();
});
videoDetails.addEventListener('toggle', () => {
  if (!videoDetails.open) video.pause();
});
document.querySelector('#year').textContent = new Date().getFullYear();

// Native scroll drives the scenes. No wheel interception or forced snapping.
const chapters = [...document.querySelectorAll('[data-story]')];
const chapterLinks = [...document.querySelectorAll('[data-chapter-link]')];
const journeyNav = document.querySelector('.journey-nav');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value) => Math.min(1, Math.max(0, value));
const sceneData = chapters.map((section) => ({
  section,
  sticky: section.querySelector('.chapter-sticky'),
  lines: [...section.querySelectorAll('[data-line]')],
  pinned: false,
  lastBeat: -1,
}));
let scrollFrame = 0;
let activeChapterId = '';

const memoryStoryVideo = document.querySelector('#memory-story-video');
const memoryPlayButton = document.querySelector('#memory-video-play');
let memoryVideoActive = false;
let memoryWasChapter = false;
let memoryUserPaused = false;
let expectedVideoPauses = 0;
let memoryPlaybackAttempt = 0;

function pauseMemoryVideo() {
  memoryPlaybackAttempt++;
  if (!memoryStoryVideo.paused) {
    expectedVideoPauses++;
    memoryStoryVideo.pause();
  }
  memoryPlayButton.hidden = true;
}

async function playMemoryVideo() {
  const attempt = ++memoryPlaybackAttempt;
  memoryPlayButton.hidden = true;
  try {
    await memoryStoryVideo.play();
  } catch {
    // Autoplay policies and data-saving modes can require an explicit tap.
    if (attempt === memoryPlaybackAttempt && memoryVideoActive) {
      memoryPlayButton.hidden = false;
    }
  }
}

function syncMemoryVideo() {
  const inChapter = activeChapterId === 'memory';
  if (inChapter && !memoryWasChapter) {
    memoryUserPaused = false;
    if (memoryStoryVideo.readyState > 0) memoryStoryVideo.currentTime = 0;
  }
  memoryWasChapter = inChapter;
  const shouldPlay = inChapter && document.visibilityState !== 'hidden' && !dialog.open;
  if (shouldPlay === memoryVideoActive) return;
  memoryVideoActive = shouldPlay;
  if (!shouldPlay) {
    pauseMemoryVideo();
  } else if (!motionPreference.matches && !memoryUserPaused) {
    playMemoryVideo();
  }
}

// Preserve a visitor's manual pause until they start a new chapter visit.
memoryStoryVideo.muted = true;
memoryStoryVideo.addEventListener('pause', () => {
  if (expectedVideoPauses > 0) expectedVideoPauses--;
  else if (memoryVideoActive && !memoryStoryVideo.ended) memoryUserPaused = true;
});
memoryStoryVideo.addEventListener('play', () => {
  if (!memoryVideoActive) {
    pauseMemoryVideo();
    return;
  }
  memoryUserPaused = false;
  memoryPlayButton.hidden = true;
});
memoryPlayButton.addEventListener('click', () => {
  memoryUserPaused = false;
  playMemoryVideo();
});
document.addEventListener('visibilitychange', syncMemoryVideo);
window.addEventListener('pagehide', () => {
  memoryVideoActive = false;
  pauseMemoryVideo();
});
motionPreference.addEventListener('change', () => {
  memoryVideoActive = false;
  pauseMemoryVideo();
  syncMemoryVideo();
});

function renderStory() {
  scrollFrame = 0;
  const viewport = window.innerHeight;
  let current = null;
  let nearestDistance = Infinity;
  for (const scene of sceneData) {
    const bounds = scene.section.getBoundingClientRect();
    const progress = scene.pinned
      ? clamp(-bounds.top / Math.max(1, bounds.height - scene.sticky.offsetHeight))
      : clamp((viewport - bounds.top) / (bounds.height + viewport));
    // Offscreen chapters keep their endpoint, but don't consume animation frames.
    if (!motionPreference.matches) {
      scene.section.style.setProperty('--p', progress.toFixed(4));
      scene.section.style.setProperty('--gather', clamp(progress / .65).toFixed(4));
      scene.section.style.setProperty('--bloom', clamp((progress - .38) / .5).toFixed(4));
    }
    const beat = Math.min(2, Math.floor(progress * 3));
    if (beat !== scene.lastBeat) {
      scene.lines.forEach((line, index) => line.classList.toggle('is-current', index === beat));
      scene.lastBeat = beat;
    }
    if (bounds.top < viewport * .65 && bounds.bottom > viewport * .35) {
      const distance = Math.abs(bounds.top + bounds.height / 2 - viewport / 2);
      if (distance < nearestDistance) {
        current = scene.section.id;
        nearestDistance = distance;
      }
    }
  }
  const newId = current || '';
  if (newId !== activeChapterId) {
    activeChapterId = newId;
    chapterLinks.forEach((link) => {
      if (link.dataset.chapterLink === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  }
  journeyNav.hidden = !current;
  syncMemoryVideo();
}

function scheduleStory() {
  if (!scrollFrame) scrollFrame = window.requestAnimationFrame(renderStory);
}

function measureStory() {
  sceneData.forEach((scene) => {
    scene.pinned = window.getComputedStyle(scene.sticky).position === 'sticky';
  });
  scheduleStory();
}

// Progressive enhancement: content stays visible if animation APIs are unavailable.
if ('requestAnimationFrame' in window) {
  document.documentElement.classList.add('scroll-story');
  window.addEventListener('scroll', scheduleStory, { passive: true });
  window.addEventListener('resize', measureStory, { passive: true });
  window.addEventListener('pageshow', measureStory);
  motionPreference.addEventListener('change', measureStory);
  document.fonts?.ready.then(measureStory);
  measureStory();
}

if ('IntersectionObserver' in window && !motionPreference.matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .08 });
  document.querySelectorAll('.story-opening, .collection-intro, .game-card, .about').forEach((element) => {
    element.classList.add('reveal');
    observer.observe(element);
  });
}
