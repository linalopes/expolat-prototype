# Between Verses

An interactive installation where poses trigger body-anchored images that deform with your movement — blending Brazilian and Swiss landscapes in real time.

## 🎯 Overview

Two-person simultaneous pose detection with immediate visual feedback:

- **Prime Tower Pose**: Both hands on top of your head, close together → shows `Prime_1.png`
- **Jesus Pose**: Arms extended horizontally to the sides → shows `Jesus_1.png`

Each person gets their own PixiJS deformable mesh overlay anchored to their body. The mesh warps in real-time based on shoulder and hip movements, creating a dynamic visual experience.

**Note**: Legacy p5.js stickers remain in the codebase (disabled via `USE_P5_STICKERS = false`) but PixiJS mesh overlays are the primary rendering path.

## ✨ Features

- **Two-Person Simultaneous Support**: Independent tracking and overlays per person
- **Real-Time Pose Detection**: ml5.js bodyPose with immediate response (no debouncing)
- **PixiJS Deformable Mesh**: 6×6 grid SimplePlane that warps with body movements
- **Body-Anchored Positioning**:
  - Centered horizontally between shoulders
  - Vertically positioned along shoulder→hip line via `TORSO_OFFSET_FACTOR`
  - Scaled by shoulder width (5.5× factor)
- **Mesh Warping**: 4 controlled vertices (indices 14,15,26,27) follow shoulders and hips
- **Jitter Reduction**: Smoothing and dead-zones for stable overlays when standing still
- **Interactive Controls**: Fullscreen, Hide Video, Hide Tracking
- **Local Assets**: Images from `/generated` folder (Prime_1.png, Jesus_1.png)

## 🛠️ Tech Stack

- **p5.js**: Canvas rendering and video capture
- **ml5.js**: Real-time body pose detection
- **PixiJS**: Overlay rendering with deformable mesh (SimplePlane)
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

### Mesh Configuration
- **Grid size**: 6×6 vertices (36 total)
- **Controlled vertices**: 14, 15 (shoulders), 26, 27 (hips)
- **Texture mapping**: Local coordinates based on image dimensions

## 🎮 Controls

| Control | Function |
|---------|----------|
| **Fullscreen** | Enter/exit fullscreen mode |
| **Hide Video** | Toggle video feed visibility |
| **Hide Tracking** | Toggle skeleton lines and keypoints |
| **ESC Key** | Exit fullscreen mode |

## 🐛 Troubleshooting

### Overlay Alignment Issues
- Ensure p5.js and PixiJS canvases share same origin and pixel-perfect dimensions
- Check `#video-wrapper` positioning (should be `position: relative` with fixed pixel dimensions)
- Verify both canvases use absolute positioning with `top: 0; left: 0`

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

## 🚀 Roadmap

- **Falloff-based global warping**: More vertices for smoother deformation
- **Enhanced vertex control**: Additional body landmarks for richer mesh warping
- **Better ID tracking**: Consistent person identification across frames
- **Video mapping integration**: Stage/projection mapping capabilities
- **Performance optimization**: WebGL optimizations for larger crowds

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [p5.js](https://p5js.org/) - Creative coding library
- [ml5.js](https://ml5js.org/) - Machine learning for the web
- [PixiJS](https://pixijs.com/) - 2D WebGL renderer
- [Bootstrap](https://getbootstrap.com/) - CSS framework

---

**Experience the future of interactive pose tracking! 🎨✨👥**
