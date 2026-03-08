/**
 * SWARM.JS — AI Particle Consciousness Visualization
 * Boid flocking + neural firing arcs
 * Color-aware: reads --swarm-r --swarm-g --swarm-b from :root
 * IMMACULATE CONSTELLATION · EGEX Network · Information Control Center
 */
(function() {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────────────────────────
  var CFG = {
    count:        320,
    speed:        0.55,
    sep_radius:   28,
    align_radius: 70,
    cohese_radius: 90,
    sep_force:    0.18,
    align_force:  0.06,
    cohese_force: 0.04,
    attractor:    0.008,
    edge_margin:  80,
    edge_force:   0.12,
    link_dist:    88,
    link_max:     3,        // max links per particle
    link_alpha:   0.12,
    particle_min: 1.0,
    particle_max: 2.4,
    fire_interval: 140,    // ms between neural fires
    fire_speed:    0.028,  // arc travel speed (0-1 per frame)
    fire_alpha:    0.55,
    noise_scale:   0.0008,
    noise_speed:   0.00018,
  };

  // ── STATE ───────────────────────────────────────────────────────────────────
  var canvas, ctx, W, H, DPR;
  var px, py, vx, vy, sz; // typed arrays
  var N = CFG.count;
  var ax = W/2, ay = H/2;  // attractor
  var at = 0;              // noise time
  var arcs = [];           // neural firing arcs
  var frameId;
  var lastFire = 0;
  var r = 184, g = 144, b = 64; // default gold — overridden from CSS

  // ── INIT ────────────────────────────────────────────────────────────────────
  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'swarm-canvas';
    canvas.style.cssText = [
      'position:fixed', 'inset:0', 'width:100%', 'height:100%',
      'pointer-events:none', 'z-index:2', 'opacity:1'
    ].join(';');
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');

    // Read color from CSS variables
    var rootStyle = getComputedStyle(document.documentElement);
    var sr = rootStyle.getPropertyValue('--swarm-r').trim();
    var sg = rootStyle.getPropertyValue('--swarm-g').trim();
    var sb = rootStyle.getPropertyValue('--swarm-b').trim();
    if (sr) r = parseInt(sr);
    if (sg) g = parseInt(sg);
    if (sb) b = parseInt(sb);

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) { cancelAnimationFrame(frameId); }
      else { frameId = requestAnimationFrame(tick); }
    });

    frameId = requestAnimationFrame(tick);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    ctx.scale(DPR, DPR);
    spawnParticles();
  }

  function spawnParticles() {
    px = new Float32Array(N);
    py = new Float32Array(N);
    vx = new Float32Array(N);
    vy = new Float32Array(N);
    sz = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      px[i] = Math.random() * W;
      py[i] = Math.random() * H;
      var a = Math.random() * Math.PI * 2;
      var s = (0.3 + Math.random() * 0.7) * CFG.speed;
      vx[i] = Math.cos(a) * s;
      vy[i] = Math.sin(a) * s;
      sz[i] = CFG.particle_min + Math.random() * (CFG.particle_max - CFG.particle_min);
    }
  }

  // ── SIMPLEX-LIKE NOISE (lightweight) ────────────────────────────────────────
  function noise2(x, y) {
    // cheap smooth noise using sin/cos
    return (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  }
  function smoothNoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    var a = noise2(ix,   iy),   b2 = noise2(ix+1, iy);
    var c = noise2(ix,   iy+1), d  = noise2(ix+1, iy+1);
    return a + (b2-a)*fx + (c-a)*fy + (a-b2-c+d)*fx*fy;
  }

  // ── NEURAL ARC ──────────────────────────────────────────────────────────────
  function spawnArc() {
    // pick random particle as source
    var src = Math.floor(Math.random() * N);
    // find nearest neighbors
    var best = -1, bestD = 99999;
    for (var i = 0; i < N; i++) {
      if (i === src) continue;
      var dx = px[i] - px[src], dy = py[i] - py[src];
      var d = dx*dx + dy*dy;
      if (d < bestD && d < CFG.link_dist*CFG.link_dist*2) { bestD = d; best = i; }
    }
    if (best >= 0) {
      arcs.push({ src: src, dst: best, t: 0, alpha: CFG.fire_alpha });
    }
  }

  // ── TICK ─────────────────────────────────────────────────────────────────────
  function tick(ts) {
    frameId = requestAnimationFrame(tick);
    ctx.clearRect(0, 0, W, H);

    at += CFG.noise_speed;

    // drift attractor via smooth noise
    ax = W  * (0.2 + 0.6 * smoothNoise(at * 1.3, 0));
    ay = H  * (0.2 + 0.6 * smoothNoise(0, at * 0.9));

    // neural fire
    if (ts - lastFire > CFG.fire_interval) {
      spawnArc();
      lastFire = ts;
    }

    // ── UPDATE PARTICLES ──
    for (var i = 0; i < N; i++) {
      var sx2 = 0, sy2 = 0, cnt_sep = 0;
      var ax2 = 0, ay2 = 0, cnt_ali = 0;
      var cx2 = 0, cy2 = 0, cnt_coh = 0;

      for (var j = 0; j < N; j++) {
        if (i === j) continue;
        var dx = px[j] - px[i], dy = py[j] - py[i];
        var d2 = dx*dx + dy*dy;

        if (d2 < CFG.sep_radius * CFG.sep_radius) {
          sx2 -= dx; sy2 -= dy; cnt_sep++;
        }
        if (d2 < CFG.align_radius * CFG.align_radius) {
          ax2 += vx[j]; ay2 += vy[j]; cnt_ali++;
        }
        if (d2 < CFG.cohese_radius * CFG.cohese_radius) {
          cx2 += px[j]; cy2 += py[j]; cnt_coh++;
        }
      }

      if (cnt_sep > 0) { vx[i] += (sx2/cnt_sep) * CFG.sep_force;    vy[i] += (sy2/cnt_sep) * CFG.sep_force; }
      if (cnt_ali > 0) { vx[i] += (ax2/cnt_ali - vx[i]) * CFG.align_force; vy[i] += (ay2/cnt_ali - vy[i]) * CFG.align_force; }
      if (cnt_coh > 0) { vx[i] += (cx2/cnt_coh - px[i]) * CFG.cohese_force; vy[i] += (cy2/cnt_coh - py[i]) * CFG.cohese_force; }

      // attractor pull
      vx[i] += (ax - px[i]) * CFG.attractor;
      vy[i] += (ay - py[i]) * CFG.attractor;

      // edge repulsion
      if (px[i] < CFG.edge_margin)     vx[i] += CFG.edge_force;
      if (px[i] > W - CFG.edge_margin) vx[i] -= CFG.edge_force;
      if (py[i] < CFG.edge_margin)     vy[i] += CFG.edge_force;
      if (py[i] > H - CFG.edge_margin) vy[i] -= CFG.edge_force;

      // speed limit
      var spd = Math.sqrt(vx[i]*vx[i] + vy[i]*vy[i]);
      if (spd > CFG.speed * 2) { vx[i] = (vx[i]/spd)*CFG.speed*2; vy[i] = (vy[i]/spd)*CFG.speed*2; }
      if (spd < 0.05) { vx[i] += (Math.random()-0.5)*0.1; vy[i] += (Math.random()-0.5)*0.1; }

      px[i] += vx[i];
      py[i] += vy[i];
    }

    // ── DRAW LINKS ──
    for (var i = 0; i < N; i++) {
      var links = 0;
      for (var j = i+1; j < N && links < CFG.link_max; j++) {
        var dx = px[j] - px[i], dy = py[j] - py[i];
        var d = Math.sqrt(dx*dx + dy*dy);
        if (d < CFG.link_dist) {
          var alpha = CFG.link_alpha * (1 - d / CFG.link_dist);
          ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(px[i], py[i]);
          ctx.lineTo(px[j], py[j]);
          ctx.stroke();
          links++;
        }
      }
    }

    // ── DRAW PARTICLES ──
    for (var i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.arc(px[i], py[i], sz[i], 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.45)';
      ctx.fill();
    }

    // ── DRAW NEURAL ARCS ──
    for (var k = arcs.length - 1; k >= 0; k--) {
      var arc = arcs[k];
      arc.t += CFG.fire_speed;
      if (arc.t >= 1) { arcs.splice(k, 1); continue; }

      var ex = px[arc.src] + (px[arc.dst] - px[arc.src]) * arc.t;
      var ey = py[arc.src] + (py[arc.dst] - py[arc.src]) * arc.t;
      var fade = arc.alpha * Math.sin(arc.t * Math.PI);

      // arc trail
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + fade + ')';
      ctx.fill();

      // trail line
      ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (fade * 0.5) + ')';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px[arc.src], py[arc.src]);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  // ── BOOT ────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
