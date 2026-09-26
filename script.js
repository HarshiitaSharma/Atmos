(() => {
  const PRESET_KEY = 'atmos-presets';

  const CHANNELS = [
    { id: 'rain',  label: 'Rain',   icon: '🌧️', type: 'rain'  },
    { id: 'ocean', label: 'Ocean',  icon: '🌊', type: 'ocean' },
    { id: 'wind',  label: 'Wind',   icon: '🍃', type: 'wind'  },
    { id: 'fire',  label: 'Fire',   icon: '🔥', type: 'fire'  },
    { id: 'cafe',  label: 'Café',   icon: '☕', type: 'cafe'  },
    { id: 'white', label: 'White',  icon: '📻', type: 'white' },
  ];

  let ctx = null;
  let masterGain = null;
  let masterAnalyser = null;
  const channels = {}; // id -> { nodes, gainNode, analyser, active, level }

  // ---------- Audio engine ----------
  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = document.getElementById('masterFader').value / 100;
      masterAnalyser = ctx.createAnalyser();
      masterAnalyser.fftSize = 256;
      masterGain.connect(masterAnalyser);
      masterAnalyser.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function makeNoiseBuffer(context, seconds = 4) {
    const bufferSize = context.sampleRate * seconds;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function makePinkNoiseBuffer(context, seconds = 4) {
    const bufferSize = context.sampleRate * seconds;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }
    return buffer;
  }

  function makeBrownNoiseBuffer(context, seconds = 4) {
    const bufferSize = context.sampleRate * seconds;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  function loopedSource(context, buffer) {
    const src = context.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  function makeLFO(context, freq, depth, target, base) {
    const lfo = context.createOscillator();
    lfo.frequency.value = freq;
    const lfoGain = context.createGain();
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain);
    lfoGain.connect(target);
    target.value = base;
    lfo.start();
    return lfo;
  }

  function buildChannelGraph(context, type) {
    const out = context.createGain();
    out.gain.value = 1;
    const nodes = [];
    let crackleInterval = null;

    if (type === 'rain') {
      const src = loopedSource(context, makePinkNoiseBuffer(context));
      const hp = context.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = context.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const wobble = context.createGain();
      const lfo = makeLFO(context, 5, 0.08, wobble.gain, 0.9);
      src.connect(hp).connect(lp).connect(wobble).connect(out);
      src.start();
      nodes.push(src, lfo);
    }

    else if (type === 'ocean') {
      const src = loopedSource(context, makeBrownNoiseBuffer(context));
      const lp = context.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const swell = context.createGain();
      const lfo = makeLFO(context, 0.09, 0.5, swell.gain, 0.6);
      src.connect(lp).connect(swell).connect(out);
      src.start();
      nodes.push(src, lfo);
    }

    else if (type === 'wind') {
      const src = loopedSource(context, makePinkNoiseBuffer(context));
      const bp = context.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
      const lfo = makeLFO(context, 0.12, 350, bp.frequency, 500);
      src.connect(bp).connect(out);
      src.start();
      nodes.push(src, lfo);
    }

    else if (type === 'fire') {
      const src = loopedSource(context, makeBrownNoiseBuffer(context));
      const hp = context.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
      const lp = context.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      const bed = context.createGain(); bed.gain.value = 0.5;
      src.connect(hp).connect(lp).connect(bed).connect(out);
      src.start();
      nodes.push(src);

      // occasional crackle pops
      crackleInterval = setInterval(() => {
        if (Math.random() > 0.55) {
          const pop = context.createBufferSource();
          pop.buffer = makeNoiseBuffer(context, 0.05);
          const popFilter = context.createBiquadFilter();
          popFilter.type = 'bandpass';
          popFilter.frequency.value = 1200 + Math.random() * 2000;
          popFilter.Q.value = 4;
          const popGain = context.createGain();
          popGain.gain.value = 0.25 + Math.random() * 0.2;
          pop.connect(popFilter).connect(popGain).connect(out);
          pop.start();
          pop.stop(context.currentTime + 0.06);
        }
      }, 220);
    }

    else if (type === 'cafe') {
      const src = loopedSource(context, makePinkNoiseBuffer(context));
      const bp = context.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
      const murmur = context.createGain();
      const lfo = makeLFO(context, 0.35, 0.15, murmur.gain, 0.4);
      src.connect(bp).connect(murmur).connect(out);
      src.start();
      nodes.push(src, lfo);
    }

    else if (type === 'white') {
      const src = loopedSource(context, makeNoiseBuffer(context));
      const lp = context.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
      src.connect(lp).connect(out);
      src.start();
      nodes.push(src);
    }

    return { out, nodes, crackleInterval };
  }

  // ---------- Channel UI + control ----------
  function buildChannelStrips() {
    const rack = document.getElementById('channelRack');
    CHANNELS.forEach(cfg => {
      const strip = document.createElement('div');
      strip.className = 'channel';
      strip.innerHTML = `
        <span class="channel-icon">${cfg.icon}</span>
        <span class="channel-label">${cfg.label}</span>
        <div class="vu-meter"><div class="vu-fill" id="vu-${cfg.id}"></div></div>
        <div class="vertical-slider-wrap">
          <input type="range" min="0" max="100" value="60" id="fader-${cfg.id}">
        </div>
        <span class="fader-value" id="value-${cfg.id}">60</span>
        <button class="power-btn" id="power-${cfg.id}" aria-pressed="false" title="Toggle ${cfg.label}">⏻</button>
      `;
      rack.appendChild(strip);

      channels[cfg.id] = { type: cfg.type, active: false, level: 60, graph: null, analyser: null };

      const fader = strip.querySelector(`#fader-${cfg.id}`);
      const valueEl = strip.querySelector(`#value-${cfg.id}`);
      fader.addEventListener('input', () => {
        channels[cfg.id].level = +fader.value;
        valueEl.textContent = fader.value;
        if (channels[cfg.id].graph) {
          channels[cfg.id].graph.out.gain.setTargetAtTime(fader.value / 100, ctx.currentTime, 0.05);
        }
      });

      strip.querySelector(`#power-${cfg.id}`).addEventListener('click', () => toggleChannel(cfg.id));
    });
  }

  function toggleChannel(id, forceState) {
    const ch = channels[id];
    const shouldBeActive = forceState !== undefined ? forceState : !ch.active;
    if (shouldBeActive === ch.active) return;

    const btn = document.getElementById(`power-${id}`);

    if (shouldBeActive) {
      const context = ensureContext();
      const graph = buildChannelGraph(context, ch.type);
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      graph.out.gain.value = ch.level / 100;
      graph.out.connect(analyser);
      analyser.connect(masterGain);
      ch.graph = graph;
      ch.analyser = analyser;
      ch.active = true;
      btn.classList.add('is-on');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      stopChannel(id);
      btn.classList.remove('is-on');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function stopChannel(id) {
    const ch = channels[id];
    if (!ch.graph) { ch.active = false; return; }
    ch.graph.nodes.forEach(n => { try { n.stop && n.stop(); } catch { /* already stopped */ } });
    if (ch.graph.crackleInterval) clearInterval(ch.graph.crackleInterval);
    try { ch.graph.out.disconnect(); } catch { /* noop */ }
    ch.graph = null;
    ch.analyser = null;
    ch.active = false;
  }

  function setChannelLevel(id, level) {
    const ch = channels[id];
    ch.level = level;
    document.getElementById(`fader-${id}`).value = level;
    document.getElementById(`value-${id}`).textContent = level;
    if (ch.graph) ch.graph.out.gain.setTargetAtTime(level / 100, ctx.currentTime, 0.05);
  }

  // ---------- Master ----------
  const masterFader = document.getElementById('masterFader');
  const masterValue = document.getElementById('masterValue');
  masterFader.addEventListener('input', () => {
    masterValue.textContent = masterFader.value;
    if (masterGain) masterGain.gain.setTargetAtTime(masterFader.value / 100, ctx.currentTime, 0.05);
  });

  document.getElementById('allOffBtn').addEventListener('click', () => {
    CHANNELS.forEach(cfg => toggleChannel(cfg.id, false));
  });

  // ---------- VU meter animation ----------
  function animateMeters() {
    requestAnimationFrame(animateMeters);
    if (!ctx) return;

    CHANNELS.forEach(cfg => {
      const ch = channels[cfg.id];
      const el = document.getElementById(`vu-${cfg.id}`);
      if (ch.active && ch.analyser) {
        const data = new Uint8Array(ch.analyser.frequencyBinCount);
        ch.analyser.getByteTimeDomainData(data);
        const rms = rmsOf(data);
        el.style.height = `${Math.min(100, rms * 240)}%`;
      } else {
        el.style.height = '0%';
      }
    });

    if (masterAnalyser) {
      const data = new Uint8Array(masterAnalyser.frequencyBinCount);
      masterAnalyser.getByteTimeDomainData(data);
      const rms = rmsOf(data);
      document.getElementById('masterVu').style.height = `${Math.min(100, rms * 240)}%`;
    }
  }
  function rmsOf(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  // ---------- Sleep timer ----------
  let sleepTimeoutId = null;
  let sleepFadeIntervalId = null;
  let sleepEndsAt = null;
  const sleepReadout = document.getElementById('sleepReadout');

  document.getElementById('sleepChips').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-min]');
    if (!btn) return;
    document.querySelectorAll('#sleepChips .chip').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    const minutes = +btn.dataset.min;
    clearSleepTimer();
    if (minutes > 0) armSleepTimer(minutes);
  });

  function armSleepTimer(minutes) {
    ensureContext();
    sleepEndsAt = Date.now() + minutes * 60 * 1000;
    updateSleepReadout();
    sleepFadeIntervalId = setInterval(updateSleepReadout, 1000);

    const fadeStartDelay = Math.max(0, (minutes * 60 - 60) * 1000); // start fading 60s before end
    sleepTimeoutId = setTimeout(() => {
      if (masterGain) masterGain.gain.setTargetAtTime(0, ctx.currentTime, 20);
      setTimeout(() => {
        CHANNELS.forEach(cfg => toggleChannel(cfg.id, false));
        if (masterGain) masterGain.gain.setTargetAtTime(masterFader.value / 100, ctx.currentTime, 0.1);
        clearSleepTimer();
        document.querySelector('#sleepChips .chip[data-min="0"]').click();
      }, 60000);
    }, fadeStartDelay);
  }

  function clearSleepTimer() {
    clearTimeout(sleepTimeoutId);
    clearInterval(sleepFadeIntervalId);
    sleepTimeoutId = null;
    sleepFadeIntervalId = null;
    sleepEndsAt = null;
    sleepReadout.textContent = 'off';
  }

  function updateSleepReadout() {
    if (!sleepEndsAt) return;
    const remaining = Math.max(0, sleepEndsAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    sleepReadout.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  }

  // ---------- Presets ----------
  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY)) || {}; }
    catch { return {}; }
  }
  function savePresets(presets) {
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(presets)); } catch { /* unavailable */ }
  }

  function currentMix() {
    const mix = { master: +masterFader.value, channels: {} };
    CHANNELS.forEach(cfg => {
      mix.channels[cfg.id] = { active: channels[cfg.id].active, level: channels[cfg.id].level };
    });
    return mix;
  }

  function applyMix(mix) {
    masterFader.value = mix.master;
    masterValue.textContent = mix.master;
    if (masterGain) masterGain.gain.setTargetAtTime(mix.master / 100, ctx.currentTime, 0.05);

    CHANNELS.forEach(cfg => {
      const saved = mix.channels[cfg.id];
      if (!saved) return;
      setChannelLevel(cfg.id, saved.level);
      toggleChannel(cfg.id, saved.active);
    });
  }

  function renderPresetList() {
    const presets = loadPresets();
    const list = document.getElementById('presetList');
    const empty = document.getElementById('presetEmpty');
    const names = Object.keys(presets);

    list.querySelectorAll('.preset-chip').forEach(el => el.remove());
    empty.style.display = names.length ? 'none' : 'block';

    names.forEach(name => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      chip.innerHTML = `
        <button class="load">${escapeHtml(name)}</button>
        <button class="delete" aria-label="Delete ${escapeHtml(name)}">×</button>
      `;
      chip.querySelector('.load').addEventListener('click', () => applyMix(presets[name]));
      chip.querySelector('.delete').addEventListener('click', () => {
        const current = loadPresets();
        delete current[name];
        savePresets(current);
        renderPresetList();
      });
      list.appendChild(chip);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.getElementById('savePresetBtn').addEventListener('click', () => {
    const input = document.getElementById('presetName');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const presets = loadPresets();
    presets[name] = currentMix();
    savePresets(presets);
    input.value = '';
    renderPresetList();
  });

  // ---------- Init ----------
  buildChannelStrips();
  renderPresetList();
  requestAnimationFrame(animateMeters);
})();
