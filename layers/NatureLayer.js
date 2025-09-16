/**
 * Nature Layer
 * Handles nature overlays like bottom-third nature scenes
 */
class NatureLayer extends BaseLayer {
    constructor(config = {}) {
        super('nature', {
            regions: [],
            currentOverlay: null,
            zIndex: 10, // Highest z-index to render on top
            alwaysRender: false, // Only render when overlay changes
            ...config
        });

        this.lastRenderedOverlay = null;
        this.overlayImages = new Map();
        this.regionRenderers = new Map();

        this.initializeRegionRenderers();
    }

    onInit() {
        console.log('NatureLayer initialized');

        // Set up default regions if none provided
        if (this.config.regions.length === 0) {
            this.config.regions = [
                {
                    name: 'bottom_third',
                    x: 0,
                    y: 0.67, // Start at 67% down the screen
                    width: 1.0, // Full width
                    height: 0.33, // Bottom third
                    enabled: true
                }
            ];
        }
    }

    initializeRegionRenderers() {
        this.regionRenderers.set('bottom_third', this.renderBottomThird.bind(this));
        // Add more region renderers here as needed
    }

    async onRender(inputData, timestamp) {
        if (!this.config.currentOverlay) {
            return false;
        }

        // Only render if overlay has changed
        const currentOverlayKey = this.getOverlayKey(this.config.currentOverlay);
        if (this.lastRenderedOverlay === currentOverlayKey) {
            return false; // Already rendered this overlay
        }

        console.log(`Rendering new overlay: ${currentOverlayKey}`);
        this.lastRenderedOverlay = currentOverlayKey;

        // Clear the overlay canvas first
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let rendered = false;

        // Render each enabled region
        for (const region of this.config.regions) {
            if (!region.enabled) continue;

            const regionRenderer = this.regionRenderers.get(region.name);
            if (regionRenderer) {
                const regionRendered = await regionRenderer(region, this.config.currentOverlay, timestamp);
                rendered = rendered || regionRendered;
            } else {
                console.warn(`No renderer found for region: ${region.name}`);
            }
        }

        return rendered;
    }

    async renderBottomThird(region, overlay, timestamp) {
        if (!overlay || !overlay.nature) {
            return false;
        }

        // Calculate region dimensions
        const startX = region.x * this.canvas.width;
        const startY = region.y * this.canvas.height;
        const width = region.width * this.canvas.width;
        const height = region.height * this.canvas.height;

        // Load overlay image
        const overlayImage = await this.loadOverlayImage(overlay.nature);

        if (!overlayImage) {
            // Fallback: render solid color overlay
            this.renderFallbackOverlay(startX, startY, width, height, overlay);
            return true;
        }

        this.ctx.save();

        // Set blend mode and opacity
        this.ctx.globalCompositeOperation = overlay.blendMode || 'normal';
        this.ctx.globalAlpha = overlay.opacity || 1.0;

        // Draw the nature texture
        this.ctx.drawImage(
            overlayImage,
            startX, startY,
            width, height
        );

        this.ctx.restore();

        console.log(`✓ Nature overlay rendered: ${overlay.nature} at region ${region.name}`);
        return true;
    }

    renderFallbackOverlay(x, y, width, height, overlay) {
        this.ctx.save();

        // Use a color based on overlay type or default
        let fallbackColor = 'rgba(135, 206, 235, 1.0)'; // Sky blue default

        if (overlay.fallbackColor) {
            fallbackColor = overlay.fallbackColor;
        } else if (overlay.nature) {
            // Generate color based on nature type
            if (overlay.nature.includes('mountain') || overlay.nature.includes('alpine')) {
                fallbackColor = 'rgba(135, 206, 235, 1.0)'; // Sky blue
            } else if (overlay.nature.includes('forest') || overlay.nature.includes('amazon')) {
                fallbackColor = 'rgba(34, 139, 34, 1.0)'; // Forest green
            } else if (overlay.nature.includes('water') || overlay.nature.includes('iguazu')) {
                fallbackColor = 'rgba(0, 150, 200, 1.0)'; // Water blue
            }
        }

        this.ctx.fillStyle = fallbackColor;
        this.ctx.globalAlpha = overlay.opacity || 1.0;
        this.ctx.fillRect(x, y, width, height);

        this.ctx.restore();
        console.log('✓ Fallback color overlay rendered');
    }

    async loadOverlayImage(imagePath) {
        // Check cache first
        if (this.overlayImages.has(imagePath)) {
            return this.overlayImages.get(imagePath);
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                this.overlayImages.set(imagePath, img);
                resolve(img);
            };

            img.onerror = (e) => {
                console.error(`Failed to load overlay image: ${imagePath}`, e);
                this.overlayImages.set(imagePath, null); // Cache failure
                resolve(null);
            };

            img.src = `images/${imagePath}`;
        });
    }

    getOverlayKey(overlay) {
        if (!overlay) return 'none';
        return `${overlay.nature || 'none'}_${overlay.opacity || 1.0}_${overlay.blendMode || 'normal'}`;
    }

    shouldRender(inputData, timestamp) {
        // Only render when overlay changes, not every frame
        const currentOverlayKey = this.getOverlayKey(this.config.currentOverlay);
        return this.lastRenderedOverlay !== currentOverlayKey;
    }

    // Configuration methods
    setEnabled(enabled) {
        super.setEnabled(enabled);
        if (!enabled && this.ctx) {
            // Clear the overlay canvas when disabled
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (enabled) {
            // Force re-render when re-enabled
            this.lastRenderedOverlay = null;
        }
    }

    setOverlay(overlay) {
        this.config.currentOverlay = overlay;
        this.lastRenderedOverlay = null; // Force re-render
        this.invalidate();
    }

    addRegion(region) {
        this.config.regions.push(region);
        this.invalidate();
    }

    removeRegion(regionName) {
        this.config.regions = this.config.regions.filter(r => r.name !== regionName);
        this.invalidate();
    }

    setRegionEnabled(regionName, enabled) {
        const region = this.config.regions.find(r => r.name === regionName);
        if (region) {
            region.enabled = enabled;
            this.invalidate();
        }
    }

    // Force re-render of current overlay
    forceRender() {
        this.lastRenderedOverlay = null;
        this.invalidate();
    }

    destroy() {
        super.destroy();
        this.overlayImages.clear();
        this.regionRenderers.clear();
        this.lastRenderedOverlay = null;
    }
}