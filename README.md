# Between Verses

An interactive installation where poses trigger body-anchored images that deform with your movement — blending Brazilian and Swiss landscapes in real time.

## 🎯 Overview

Two-person simultaneous pose detection with immediate visual feedback:

- **Prime Tower Pose**: Both hands on top of your head, close together → shows `Prime_1.png`
- **Jesus Pose**: Arms extended horizontally to the sides → shows `Jesus_1.png`

Each person gets their own PixiJS deformable mesh overlay anchored to their body. The mesh warps in real-time based on shoulder and hip movements, creating a dynamic visual experience.

- **Background layer** with configurable opacity, scaled to cover the canvas (e.g., mountain, arara landscapes).
- **Foreground particle layer** in the bottom 30% of the screen, using transparent PNG sprites (water lilies).

**Note**: Legacy p5.js stickers remain in the codebase (disabled via `USE_P5_STICKERS = false`) but PixiJS mesh overlays are the primary rendering path.

## ✨ Features

- **Two-Person Simultaneous Support**: Independent tracking and overlays per person
- **Real-Time Pose Detection**: ml5.js bodyPose with immediate response (no debouncing)
- **Background Layer**: Static background image (bgSprite) in PixiJS, scaled to cover the canvas, with configurable opacity (`BG_ALPHA`, default 0.5)
- **PixiJS Deformable Mesh**: 6×6 grid SimplePlane that warps with body movements and uses `MULTIPLY` blend mode for visual integration with the background
- **Body-Anchored Positioning**:
  - Centered horizontally between shoulders
  - Vertically positioned along shoulder→hip line via `TORSO_OFFSET_FACTOR`
  - Scaled by shoulder width (5.5× factor)
- **Mesh Warping**: 4 controlled vertices (indices 14,15,26,27) follow shoulders and hips
- **Jitter Reduction**: Smoothing and dead-zones for stable overlays when standing still
- **Interactive Controls**: Fullscreen, Hide Video, Hide Tracking
- **Local Assets**: Images from `/generated` folder (Prime_1.png, Jesus_1.png)
- **Foreground Particle Layer**: Animated lilies (PNG with alpha) drift horizontally in the bottom 30% band, masked by PixiJS. Parameters: spawn rate, lifetime, sine drift, alpha fade, blend mode.

## 🛠️ Tech Stack

- **p5.js**: Canvas rendering and video capture
- **ml5.js**: Real-time body pose detection
- **PixiJS**: Overlay rendering with deformable meshes, background image, and foreground particle layers
- **Bootstrap 5**: UI framework with custom CSS

## 🚀 Getting Started

### 1. Clone and Setup
```bash
git clone https://github.com/linalopes/expolat-prototype.git
cd expolat-prototype
```

### 2. Start Local Server
```bash
python3 -m http.server 8000
```

### 3. Open Application
Navigate to `http://localhost:8000` and allow camera access.

**Requirements**: Modern browser with camera support. HTTPS not required for localhost.

## 🎮 How It Works

### Pose Detection
- **Prime Tower**: Wrists above nose level, horizontally close together (within 100px)
- **Jesus**: Arms extended horizontally (wrist further from shoulder than elbow, spread to sides)

### Per-Person Pipeline
1. **Detect pose type** per person each frame
2. **Ensure Pixi plane visibility** with correct texture (Prime_1.png or Jesus_1.png)
3. **Calculate anchor position**:
   - Horizontal: midpoint between shoulders
   - Vertical: interpolated between shoulders and hips using `TORSO_OFFSET_FACTOR`
4. **Calculate scale**: width = shoulderWidth × 5.5
5. **Update mesh warp**: 4 vertices (14,15,26,27) follow shoulders/hips with smoothing

### Legacy p5.js Stickers
- Code preserved for reference and fallback
- Disabled by `USE_P5_STICKERS = false` flag
- Can be re-enabled by changing the flag to `true`

## 📁 Project Structure

```
between-verses/
├── index.html              # Main application
├── script.js               # p5.js + ml5.js + PixiJS logic
├── styles.css              # Custom styling
├── generated/              # Local overlay images
│   ├── Jesus_1.png        # Jesus pose texture
│   └── Prime_1.png        # Prime Tower pose texture
├── front-images/           # Assets for foreground lilies layer
│   └── water-lily.png     # Water lily particle texture
├── bg-images/             # Background images
│   ├── mountain.png       # Mountain landscape background
│   └── arara.png          # Arara landscape background
├── pixijs-test/           # Standalone mesh warp prototype
│   └── index.html         # Drag control points demo
├── jesus.svg              # Jesus pose instruction icon
├── prime.svg              # Prime Tower pose instruction icon
├── favicon.png            # Website icon
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

### `/pixijs-test` Folder
Standalone SimplePlane mesh warping prototype for testing and debugging:
- Static image with draggable control points
- Reset functionality
- Useful for understanding mesh behavior without camera complexity

## 🔧 Configuration

### Key Constants
- **`WIDTH_FACTOR`**: 5.5 (plane width = shoulderWidth × 5.5)
- **`TORSO_OFFSET_FACTOR`**: 0.5 (0 = shoulders, 1 = hips, 0.5 = midpoint)
- **`SMOOTHING_FACTOR`**: 0.25 (mesh vertex smoothing)
- **`ANCHOR_SMOOTH`**: 0.15 (position smoothing)
- **`SCALE_SMOOTH`**: 0.15 (scale smoothing)
- **`DEAD_ZONE_PX`**: 0.4 (pixel threshold for jitter reduction)
- **`SCALE_DEAD`**: 0.002 (scale change threshold)
- **Confidence threshold**: 0.3 (minimum keypoint confidence)

### Foreground Particle Settings
- **`FG_FRACTION`**: 0.30 (height fraction for the foreground band)
- **`FG_SETTINGS.spawnRate`**: 6 (particles per second)
- **`FG_SETTINGS.maxParticles`**: 40 (maximum particle count)
- **`FG_SETTINGS.sineAmp`**: 6 (vertical sine amplitude in pixels)
- **`FG_SETTINGS.sineFreq`**: 1.1 (sine frequency multiplier)
- **`FG_SETTINGS.alphaStart/End`**: 0.70 → 0.0 (alpha fade range)
- **`FG_SETTINGS.blendMode`**: PIXI.BLEND_MODES.NORMAL
- **Lily texture**: Loaded from `/front-images/water-lily.png`

### Background Settings
- **`BG_ALPHA`**: 0.5 (background sprite opacity)
- **Background texture**: Loaded from `/bg-images/` (e.g., mountain.png, arara.png)
- **Scaling**: Cover mode (maintains aspect ratio, fills canvas)
- **Blend mode**: NORMAL (background renders normally)

### Mesh Configuration
- **Grid size**: 6×6 vertices (36 total)
- **Controlled vertices**: 14, 15 (shoulders), 26, 27 (hips)
- **Texture mapping**: Local coordinates based on image dimensions
- **`MESH_BLEND_MODE`**: PIXI.BLEND_MODES.MULTIPLY (mesh blend mode for integration with background)

## 🎮 Controls

| Control | Function |
|---------|----------|
| **Fullscreen** | Expands video, tracking, background, meshes, and foreground to fill the screen |
| **Hide Video** | Toggle video feed visibility |
| **Hide Tracking** | Toggle skeleton lines and keypoints |
| **ESC Key** | Exit fullscreen mode |

## 🐛 Troubleshooting

### Overlay Alignment Issues
- Ensure p5.js and PixiJS canvases share same origin and pixel-perfect dimensions
- Check `#video-wrapper` positioning (should be `position: relative` with fixed pixel dimensions)
- Verify both canvases use absolute positioning with `top: 0; left: 0`
- If background image does not scale correctly on fullscreen, verify `updateFgMask()` and bgSprite scaling logic

### Jitter/Instability
- Increase smoothing factors (`ANCHOR_SMOOTH`, `SCALE_SMOOTH`, `SMOOTHING_FACTOR`)
- Increase dead-zone thresholds (`DEAD_ZONE_PX`, `SCALE_DEAD`)
- Improve lighting and camera positioning

### Camera Issues
- Use localhost or HTTPS for camera access
- Check browser permissions
- Ensure good lighting and full body visibility
- Stand 2-3 feet from camera

### Pose Detection Problems
- Verify both shoulders are visible with good confidence (>0.3)
- Check pose criteria: Prime (hands on head, close together) or Jesus (arms extended horizontally)
- Ensure stable pose holding (system responds immediately, no debouncing)

### Foreground Particle Issues
- If lilies appear outside the bottom 30% band, check the mask and clamp logic in `updateFgParticles()`
- Verify `FG_FRACTION` is set to 0.30 for correct band sizing
- Ensure `water-lily.png` exists in `/front-images/` folder
- Ensure background sprite has alpha set correctly if it appears too strong or hides video/tracking

## 🚀 Roadmap

- **Falloff-based global warping**: More vertices for smoother deformation
- **Enhanced vertex control**: Additional body landmarks for richer mesh warping
- **Better ID tracking**: Consistent person identification across frames
- **Video mapping integration**: Stage/projection mapping capabilities
- **Performance optimization**: WebGL optimizations for larger crowds
- **Foreground layer enhancements**: Experiment with other assets (stones, grass, sand, flowers)
- **ParticleContainer optimization**: If particle count increases significantly
- **Background experiments**: Test with dynamic backgrounds (clouds, sky, moving textures) and additional blend modes

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [p5.js](https://p5js.org/) - Creative coding library
- [ml5.js](https://ml5js.org/) - Machine learning for the web
- [PixiJS](https://pixijs.com/) - 2D WebGL renderer
- [Bootstrap](https://getbootstrap.com/) - CSS framework

---

**Experience the future of interactive pose tracking! 🎨✨👥**
