// --- Navigation: transparent → solid on scroll ---
const nav = document.getElementById('main-nav');
const heroHeight = window.innerHeight;

function updateNav() {
  if (window.scrollY > 80) {
    nav.classList.add('nav-solid');
  } else {
    nav.classList.remove('nav-solid');
  }
}
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

// --- Mobile hamburger ---
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
let menuOpen = false;

hamburger.addEventListener('click', () => {
  menuOpen = !menuOpen;
  hamburger.classList.toggle('active', menuOpen);
  mobileMenu.classList.toggle('open', menuOpen);
  document.body.style.overflow = menuOpen ? 'hidden' : '';
});

// Close on link click
mobileMenu.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    menuOpen = false;
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// --- Smooth scroll ---
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = nav.offsetHeight;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// --- GSAP ScrollTrigger animations ---
gsap.registerPlugin(ScrollTrigger);

// Fade-in-up for sections
gsap.utils.toArray('.gsap-reveal').forEach((el) => {
  gsap.from(el, {
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
    y: 40,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.out',
  });
});

// Staggered card reveals
gsap.utils.toArray('.gsap-stagger-container').forEach((container) => {
  const cards = container.querySelectorAll('.gsap-stagger-item');
  gsap.from(cards, {
    scrollTrigger: {
      trigger: container,
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
    y: 30,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power2.out',
  });
});

// Stats counter animation
gsap.utils.toArray('.stat-number').forEach((el) => {
  const target = parseInt(el.dataset.value, 10);
  const obj = { val: 0 };
  gsap.to(obj, {
    scrollTrigger: {
      trigger: el,
      start: 'top 90%',
      toggleActions: 'play none none none',
    },
    val: target,
    duration: 1.5,
    ease: 'power1.out',
    onUpdate: () => {
      el.textContent = Math.floor(obj.val);
    },
  });
});

// Hero rule line animation only — logo + subtitle handled by CSS decode + JS scramble
gsap.from('.hero-rule', {
  scaleX: 0,
  duration: 1,
  delay: 0.5,
  ease: 'power2.inOut',
});

// Scroll indicator fade out
gsap.to('.scroll-indicator', {
  scrollTrigger: {
    trigger: '.scroll-indicator',
    start: 'top 80%',
    end: 'top 40%',
    scrub: true,
  },
  opacity: 0,
});

// Capability columns stagger
gsap.utils.toArray('.cap-column').forEach((col, i) => {
  gsap.from(col, {
    scrollTrigger: {
      trigger: col,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
    y: 50,
    opacity: 0,
    duration: 0.8,
    delay: i * 0.15,
    ease: 'power2.out',
  });
});
