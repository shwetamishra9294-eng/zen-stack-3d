# Zen Stack 3D 🏰✨

A sleek, modern 3D ASMR tower stacker built with HTML5, JavaScript, and Three.js.

## 🌟 Key Features
- **3D Mesh Slicing Math**: Overhanging block sections are sliced off dynamically and drop with gravity physics.
- **Soft Failure Mechanics**: 5–10 second chances before game over. Achieving 3 consecutive "Perfect!" hits expands the stack width back!
- **ASMR Synthesizer Audio**: Web Audio API kalimba/marimba notes climbing the musical scale on consecutive perfect hits.
- **Dynamic HSL Color Shifting**: Smooth background & block gradient hue shifts every 5 points.
- **Monetization Built-In**: Rewarded Ad Revive modal ("Watch Ad to Save Tower") and high score tracking.

## 📂 Project Structure
```text
zen-stack-3d/
├── index.html        # Main game entry point
├── style.css         # Glassmorphism UI & HSL background styling
├── js/
│   ├── audio.js      # ASMR Web Audio API synthesizer
│   ├── storage.js    # Persistent high score save manager
│   └── game.js       # Core Three.js slicing & physics engine
├── README.md         # Documentation
└── .gitignore        # Git ignore rules
```

## 🎮 How to Play
Open `index.html` in any web browser. Tap screen or press Spacebar to place moving blocks!
