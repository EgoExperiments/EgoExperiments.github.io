/* EGEX Division Pages — shared JS */
(function() {
    'use strict';

    // Stats in-view trigger
    function initStats() {
        var stats = document.querySelectorAll('.div-stat');
        if (!stats.length) return;
        var io = new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
                if (e.isIntersecting) e.target.classList.add('in-view');
            });
        }, { threshold: 0.3 });
        stats.forEach(function(s) { io.observe(s); });
    }

    // Title scramble (reuse main-site engine if loaded)
    function initTitle() {
        var el = document.querySelector('.div-title');
        if (!el) return;
        // store data-text for glitch CSS
        el.setAttribute('data-text', el.textContent.trim());

        // scramble on load if engine available
        if (typeof scrambleEl === 'function') {
            el.style.opacity = '0';
            setTimeout(function() {
                el.style.opacity = '1';
                scrambleEl(el, 200, 18, 5);
            }, 300);
        }
    }

    // Cred-line stagger for terminal block
    function initTerminals() {
        var lines = document.querySelectorAll('.div-terminal-wrap .cred-line');
        lines.forEach(function(line, i) {
            line.style.opacity = '0';
            line.style.transform = 'translateX(-8px)';
            setTimeout(function() {
                line.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                line.style.opacity = '1';
                line.style.transform = 'none';
            }, 600 + i * 80);
        });
    }

    // Nav solid on scroll
    function initNav() {
        var nav = document.getElementById('main-nav');
        if (!nav) return;
        window.addEventListener('scroll', function() {
            nav.classList.toggle('nav-solid', window.scrollY > 40);
        }, { passive: true });
    }

    document.addEventListener('DOMContentLoaded', function() {
        initStats();
        initTitle();
        initTerminals();
        initNav();
    });
})();
