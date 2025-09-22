/**
 * Nature Layer
 * Handles nature overlays like bottom-third nature scenes with animated particles
 */
class NatureLayer extends BaseLayer {
    constructor(config = {}) {
        super('nature', {
            regions: [],
            currentOverlay: null,
            zIndex: 20, // Above building sprites
            alwaysRender: false, // Only render when overlay changes
            ...config
        });

        this.lastRenderedOverlay = null;
        this.overlayImages = new Map();
        this.regionRenderers = new Map();

        // PixiJS particle system integration
        this.pixiApp = null;
        this.pixiContainer = null;
        this.particleSystem = null;
        this.particlesEnabled = false;
        this.pixiInitializationPromise = null;

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

        // Initialize PixiJS for particle effects (async)
        this.pixiInitializationPromise = this.initializePixiParticles();
    }

    async initializePixiParticles() {
        // Check if PixiJS is available
        if (typeof PIXI === 'undefined' || !PIXI.Application) {
            console.error('PixiJS is not available. Make sure PixiJS script is loaded before this layer.');
            return;
        }

        console.log('PixiJS is available, checking components:', {
            pixiExists: typeof PIXI !== 'undefined',
            hasApplication: !!PIXI.Application,
            hasBlendModes: !!PIXI.BLEND_MODES,
            hasAssets: !!PIXI.Assets
        });

        try {
            console.log('PixiJS is ready, initializing particles...');

            // Create PixiJS application for particles
            this.pixiApp = new PIXI.Application();

            // Use the actual displayed canvas size (clientWidth/Height) instead of internal canvas size
            const displayWidth = this.canvas.clientWidth || this.canvas.width;
            const displayHeight = this.canvas.clientHeight || this.canvas.height;

            await this.pixiApp.init({
                width: displayWidth,
                height: displayHeight,
                backgroundColor: 0x000000,
                backgroundAlpha: 0, // Transparent background
                premultipliedAlpha: false,
                antialias: true
            });

            console.log('🔍 PixiJS app initialized with dimensions:', {
                pixiWidth: this.pixiApp.renderer.width,
                pixiHeight: this.pixiApp.renderer.height,
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height,
                canvasClientWidth: this.canvas.clientWidth,
                canvasClientHeight: this.canvas.clientHeight,
                displayWidth: displayWidth,
                displayHeight: displayHeight
            });

            // Create main container for nature particles
            this.pixiContainer = new PIXI.Container();
            this.pixiApp.stage.addChild(this.pixiContainer);

            // Position PixiJS canvas to overlay the main canvas exactly
            this.pixiApp.canvas.style.position = 'absolute';
            this.pixiApp.canvas.style.top = '0';
            this.pixiApp.canvas.style.left = '0';
            this.pixiApp.canvas.style.width = '100%';
            this.pixiApp.canvas.style.height = '100%';
            this.pixiApp.canvas.style.pointerEvents = 'none';
            this.pixiApp.canvas.style.zIndex = String(this.config.zIndex || 10); // Use configured zIndex

            // Find the canvas container and append PixiJS canvas
            const canvasContainer = this.canvas.parentElement;
            if (canvasContainer) {
                canvasContainer.appendChild(this.pixiApp.canvas);
                console.log('✅ PixiJS canvas added to container:', {
                    canvasSize: `${this.pixiApp.canvas.width}x${this.pixiApp.canvas.height}`,
                    canvasStyle: this.pixiApp.canvas.style.cssText,
                    containerChildren: canvasContainer.children.length
                });
            } else {
                console.error('❌ Canvas container not found - cannot add PixiJS canvas');
            }

            console.log('✓ NatureLayer PixiJS particles initialized');
        } catch (error) {
            console.error('Failed to initialize PixiJS particles for NatureLayer:', error);
        }
    }

    async ensurePixiReady() {
        if (this.pixiInitializationPromise) {
            console.log('Waiting for PixiJS initialization to complete...');
            await this.pixiInitializationPromise;
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

        // Check if particles are enabled for this overlay
        const hasParticles = this.config.currentOverlay?.particles?.enabled;

        if (hasParticles) {
            // If particles are enabled, skip static image rendering
            console.log('Particles enabled - skipping static image rendering');
            rendered = true; // Mark as rendered since particles handle the visual
        } else {
            // Render static images only when particles are disabled
            console.log('Particles disabled - rendering static images');
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
        }

        return rendered;
    }

    async renderBottomThird(region, overlay, timestamp) {
        const imageName = overlay.image || overlay.nature;
        if (!overlay || !imageName) {
            return false;
        }

        // Calculate region dimensions
        const startX = region.x * this.canvas.width;
        const startY = region.y * this.canvas.height;
        const width = region.width * this.canvas.width;
        const height = region.height * this.canvas.height;

        // Load overlay image
        const overlayImage = await this.loadOverlayImage(imageName);

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

        console.log(`✓ Nature overlay rendered: ${imageName} at region ${region.name}`);
        return true;
    }

    renderFallbackOverlay(x, y, width, height, overlay) {
        this.ctx.save();

        // Use a color based on overlay type or default
        let fallbackColor = 'rgba(135, 206, 235, 1.0)'; // Sky blue default

        if (overlay.fallbackColor) {
            fallbackColor = overlay.fallbackColor;
        } else {
            const imageName = overlay.image || overlay.nature;
            if (imageName) {
                // Generate color based on nature type
                if (imageName.includes('mountain') || imageName.includes('alpine') || imageName.includes('aletsch')) {
                    fallbackColor = 'rgba(135, 206, 235, 1.0)'; // Sky blue
                } else if (imageName.includes('forest') || imageName.includes('amazon')) {
                    fallbackColor = 'rgba(34, 139, 34, 1.0)'; // Forest green
                } else if (imageName.includes('water') || imageName.includes('iguazu')) {
                    fallbackColor = 'rgba(0, 150, 200, 1.0)'; // Water blue
                }
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
        if (!overlay) {
            return 'none';
        }

        // Include particle information in the key
        const particleKey = overlay.particles?.enabled ?
            `particles_${overlay.particles.animationType || 'none'}_${overlay.particles.texture || 'none'}` :
            'no_particles';

        const key = `${overlay.image || overlay.nature || 'none'}_${overlay.opacity || 1.0}_${overlay.blendMode || 'normal'}_${particleKey}`;
        return key;
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
        console.log('NatureLayer.setOverlay called with:', overlay);
        this.config.currentOverlay = overlay;
        this.lastRenderedOverlay = null; // Force re-render
        this.invalidate();

        // Handle particle effects (fire-and-forget)
        this.updateParticleSystem(overlay).catch(error => {
            console.error('Failed to update particle system:', error);
        });
    }

    async updateParticleSystem(overlay) {
        console.log('🟡 updateParticleSystem called with overlay:', overlay);

        // If PixiJS isn't ready yet, wait for it
        if (!this.pixiApp || !this.pixiContainer) {
            console.log('PixiJS not ready, waiting for initialization...');
            await this.ensurePixiReady();
            if (!this.pixiApp || !this.pixiContainer) {
                console.warn('PixiJS initialization failed, particles not available');
                return;
            }
        }

        // Stop current particle system
        if (this.particleSystem) {
            this.particleSystem.stop();
            this.particleSystem.destroy();
            this.particleSystem = null;
        }

        // Check if overlay has particle configuration
        if (overlay && overlay.particles && overlay.particles.enabled) {
            try {
                console.log('🟢 Starting particle system with config:', overlay.particles);

                // Ensure proper blendMode
                const particleConfig = { ...overlay.particles };
                if (!particleConfig.blendMode && PIXI.BLEND_MODES) {
                    particleConfig.blendMode = PIXI.BLEND_MODES.NORMAL;
                }

                // Create new particle system
                this.particleSystem = new NatureParticleSystem(this.pixiApp, particleConfig);
                this.pixiContainer.addChild(this.particleSystem.container);

                // Load texture and start particles
                await this.particleSystem.loadTexture(overlay.particles.texture);
                this.particleSystem.start();

                // Start update loop
                this.startParticleUpdateLoop();

                console.log('✅ Particle system started successfully');
            } catch (error) {
                console.error('❌ Failed to start particle system:', error);
            }
        } else {
            console.log('🔴 No particles configured for this overlay - overlay:', !!overlay, 'particles:', !!overlay?.particles, 'enabled:', overlay?.particles?.enabled);
        }
    }

    startParticleUpdateLoop() {
        if (this.particleUpdateLoop) {
            return; // Already running
        }

        this.particleUpdateLoop = () => {
            if (this.particleSystem && this.particleSystem.active) {
                this.particleSystem.update();
                requestAnimationFrame(this.particleUpdateLoop);
            } else {
                this.particleUpdateLoop = null;
            }
        };

        requestAnimationFrame(this.particleUpdateLoop);
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

    setEnabled(enabled) {
        super.setEnabled(enabled);
        if (!enabled && this.ctx) {
            // Clear the overlay canvas when disabled
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Stop particle system
            if (this.particleSystem) {
                this.particleSystem.stop();
            }

            // Hide PixiJS canvas
            if (this.pixiApp && this.pixiApp.canvas) {
                this.pixiApp.canvas.style.display = 'none';
            }
        } else if (enabled) {
            // Force re-render when re-enabled
            this.lastRenderedOverlay = null;

            // Show PixiJS canvas
            if (this.pixiApp && this.pixiApp.canvas) {
                this.pixiApp.canvas.style.display = 'block';
            }

            // Restart particle system if overlay has particles
            if (this.config.currentOverlay) {
                this.updateParticleSystem(this.config.currentOverlay);
            }
        }
    }

    onResize(width, height) {
        // Update PixiJS canvas size - use the actual display dimensions
        if (this.pixiApp) {
            const displayWidth = this.canvas.clientWidth || width;
            const displayHeight = this.canvas.clientHeight || height;

            console.log('🔍 Resizing PixiJS canvas:', {
                newWidth: displayWidth,
                newHeight: displayHeight,
                canvasClientWidth: this.canvas.clientWidth,
                canvasClientHeight: this.canvas.clientHeight
            });

            this.pixiApp.renderer.resize(displayWidth, displayHeight);
        }

        // Update particle system region bounds
        if (this.particleSystem) {
            this.particleSystem.onResize();
        }
    }

    destroy() {
        super.destroy();

        // Stop particle system
        if (this.particleSystem) {
            this.particleSystem.stop();
            this.particleSystem.destroy();
            this.particleSystem = null;
        }

        // Destroy PixiJS application
        if (this.pixiApp) {
            this.pixiApp.destroy(true);
            this.pixiApp = null;
        }

        this.overlayImages.clear();
        this.regionRenderers.clear();
        this.lastRenderedOverlay = null;
        this.pixiContainer = null;
        this.particleUpdateLoop = null;
    }
}