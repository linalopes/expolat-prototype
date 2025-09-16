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