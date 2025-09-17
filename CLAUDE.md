Canvas Overlay Rendering Issues

  Root Cause Analysis:
  The nature overlay wasn't showing despite successful
  image loading due to three critical issues:

  1. Wrong Default Texture Source

  - Problem: Hardcoded default overlay used pantanal.webp
  instead of configured textures
  - Location: this.currentOverlay = { nature: 
  'pantanal.webp' } in constructor
  - Fix: Changed to use actual configured texture
  (iguazu.png)

  2. Continuous Canvas Clearing Anti-Pattern

  - Problem: renderTopLayerOverlay() was called every
  frame (~60fps) and cleared the canvas each time
  - Symptom: Image would load successfully but be
  immediately wiped by next frame
  - Console showed: "Image loaded successfully" + "✓
  Nature overlay rendered" but no visual
  - Fix: Added change detection with lastRenderedOverlay
  to only render when texture actually changes

  3. Render Performance Issue

  - Problem: Asynchronous image loading meant texture was
  drawn after canvas was already cleared again
  - Race condition: Canvas clear → Start image load →
  Clear again → Image loads → Draw (but already cleared)
  - Fix: Render only on change + persistence tracking

  Debugging Pattern That Worked:
  1. Visual Test: Added bright red rectangle first to
  prove canvas positioning works
  2. Detailed Logging: Console logs at each step
  (dimensions, loading, success)
  3. Format Testing: Switched from AVIF to JPG for
  compatibility
  4. Persistence Fix: Stop continuous clearing, render
  only on change

  Key Learning: When canvas content "loads successfully"
  but doesn't show, check for:
  - Continuous clearing/overwriting
  - Async timing issues
  - Wrong source data being used
  - Z-index/positioning problems

PixiJS 8 Wireframe/Graphics Rendering Issues

  Root Cause Analysis:
  Wireframe graphics weren't visible despite being created
  and added to stage due to multiple issues:

  1. Wrong API Version
  - Problem: Using PixiJS v7 syntax with v8 library
  - Old v7: graphics.lineStyle(4, 0x00ff00); graphics.drawRect(x, y, w, h);
  - New v8: graphics.rect(x, y, w, h).stroke({ color: 0x00ff00, width: 4 });
  - Fix: Updated all graphics drawing to use v8 chainable API

  2. Missing Render Loop
  - Problem: PixiJS 8 doesn't auto-render without ticker
  - Symptom: Graphics created but never displayed
  - Fix: Added app.ticker.add(() => {}) to enable continuous rendering

  3. Mesh Vertex Scale Issue
  - Problem: Mesh vertices were 1x1 pixel normalized coords
  - Raw vertices: [0, 0, 1, 0, 1, 1, 0, 1] instead of actual dimensions
  - Fix: Scale vertices by meshConfig.width/height when drawing wireframe

  4. Graphics Visibility Settings
  - Problem: Graphics might be culled or hidden
  - Fix: Set explicit properties:
    graphics.visible = true;
    graphics.renderable = true;
    graphics.cullable = false; // Prevent culling
    graphics.alpha = 1.0;

  5. Continuous Clearing Issue
  - Problem: drawWireframesQuiet() called every frame with clear()
  - Symptom: Wireframe flickers and disappears immediately
  - Fix: Throttle updates and ensure persistence

  Debugging Steps That Worked:
  1. Add test rectangles with bright colors to verify canvas visibility
  2. Check canvas has red tint (background color) to confirm it exists
  3. Log mesh positions to verify they're on-screen
  4. Check stage children count and graphics parent
  5. Use Chrome DevTools to verify window.personSegmentation.pixiMeshLayer exists

  Key PixiJS 8 API Changes:
  - Graphics: Use rect().fill() and rect().stroke() instead of beginFill/drawRect
  - Lines: Use moveTo().lineTo().stroke() instead of lineStyle/moveTo/lineTo
  - Must add ticker for rendering: app.ticker.add(() => {})
  - Container structure changes - sprites/meshes can't have children