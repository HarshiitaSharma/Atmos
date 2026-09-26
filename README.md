# Atmos. 🎛️

A focus soundscape mixer styled like an old studio console — six channels
(rain, ocean, wind, fire, café murmur, white noise), each with a vertical
fader and a live VU meter, plus a master strip, a sleep timer, and
saveable presets.

Every sound is **synthesized live in the browser with the Web Audio API** —
there are no audio files to download, license, or bundle. That also means
the whole repo is three small text files.

## Features

- 6 ambient channels, each independently toggled and faded
- Real-time VU meters driven by an `AnalyserNode` per channel
- A master fader and an "all off" kill switch
- **Sleep timer** — 15/30/45/60 minutes, fades out over the last minute
  and then stops everything automatically
- **Presets** — save the current mix (which channels are on, and at what
  levels) under a name, reload it anytime; stored in `localStorage`

## How the sounds are made

No samples — each channel is a small signal-processing chain:

| Channel | Approach |
|---|---|
| Rain | Pink noise → high-pass → low-pass, subtle flutter |
| Ocean | Brown noise → low-pass, slow LFO-driven swell |
| Wind | Pink noise → band-pass filter swept by a slow LFO |
| Fire | Brown noise bed + randomly scheduled short noise "pops" for crackle |
| Café | Pink noise → band-pass, gentle amplitude wobble |
| White noise | Raw white noise → low-pass |

All of it lives in `script.js`, built from `OscillatorNode`,
`BiquadFilterNode`, `GainNode`, and `AnalyserNode` — no libraries.

## Running it

Open `index.html` in a browser. Click a channel's power button to start
that sound (browsers require a user gesture before audio can play).

To serve it locally instead:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Putting it on GitHub

```bash
git init
git add .
git commit -m "Atmos: a synthesized soundscape mixer"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### Hosting it for free with GitHub Pages

1. Push the repo (above).
2. On GitHub: **Settings → Pages → Source → Deploy from a branch**, pick
   `main` and `/ (root)`.
3. Live at `https://<your-username>.github.io/<repo-name>/` shortly after.

## File structure

```
atmos-mixer/
├── index.html    # markup
├── styles.css    # studio-console theme
├── script.js     # Web Audio synthesis engine + mixer UI + presets
└── README.md
```

## Ideas to extend it

- More channels (birdsong via granular noise bursts, thunder, train)
- Drag to reorder channels, or a "solo" button per channel
- Export/import presets as JSON for sharing
- A visualizer (frequency bars) using the master analyser data already
  wired up
