/**
 * Nature Particle System
 * Manages animated particle effects for nature overlays
 * Adapted from the PixiJS particle system in script.js
 */
class NatureParticleSystem {
    constructor(pixiApp, config = {}) {
        this.pixiApp = pixiApp;
        this.container = new PIXI.Container();
        this.particles = [];
        this.spawnAccumulator = 0;
        this.lastUpdate = performance.now() / 1000;
        this.active = false;

        // Default settings
        this.settings = {
            spawnRate: 4,           // particles per second
            maxParticles: 25,       // safety cap
            baseScale: 0.5,         // TEMPORARY: Larger scale for debugging
            scaleJitter: 0.35,      // random extra scale
            speedMin: 2,            // px/sec horizontal speed
            speedMax: 8,
            sineAmp: 6,             // vertical sine amplitude (px)
            sineFreq: 1.1,          // sine frequency multiplier
            lifetimeMin: 6.0,       // seconds
            lifetimeMax: 10.0,
            alphaStart: 1.0,        // TEMPORARY: Full opacity for debugging
            alphaEnd: 0.0,
            blendMode: (typeof PIXI !== 'undefined' && PIXI.BLEND_MODES) ? PIXI.BLEND_MODES.NORMAL : 'source-over',
            region: 'bottom_third', // 'bottom_third', 'full_screen', 'top_half'
            animationType: 'floating', // 'floating', 'flying', 'falling', 'rising'
            ...config
        };

        // Animation type specific settings
        this.applyAnimationTypeDefaults();

        // Region boundaries
        this.regionBounds = this.calculateRegionBounds();

        // Texture cache
        this.texture = null;
        this.textureLoaded = false;
    }

    applyAnimationTypeDefaults() {
        switch (this.settings.animationType) {
            case 'floating': // Water lilies
                this.settings.speedMin = 2;
                this.settings.speedMax = 8;
                this.settings.sineAmp = 6;
                this.settings.region = 'bottom_third';
                break;

            case 'flying': // Birds/Aras
                this.settings.speedMin = 15;
                this.settings.speedMax = 30;
                this.settings.sineAmp = 12;
                this.settings.region = 'full_screen';
                this.settings.lifetimeMin = 8.0;
                this.settings.lifetimeMax = 15.0;
                break;

            case 'falling': // Leaves
                this.settings.speedMin = 5;
                this.settings.speedMax = 15;
                this.settings.sineAmp = 8;
                this.settings.region = 'full_screen';
                this.settings.gravitySpeed = 20; // downward fall speed
                break;

            case 'rising': // Bubbles/Fireflies
                this.settings.speedMin = 1;
                this.settings.speedMax = 5;
                this.settings.sineAmp = 4;
                this.settings.region = 'bottom_third';
                this.settings.riseSpeed = 15; // upward rise speed
                break;
        }
    }

    calculateRegionBounds() {
        const w = this.pixiApp.renderer.width;
        const h = this.pixiApp.renderer.height;

        let bounds;
        switch (this.settings.region) {
            case 'bottom_third':
                const yTop = Math.floor(h * 0.67);
                bounds = { x: 0, y: yTop, width: w, height: h - yTop };
                break;

            case 'top_half':
                bounds = { x: 0, y: 0, width: w, height: Math.floor(h * 0.5) };
                break;

            case 'full_screen':
            default:
                bounds = { x: 0, y: 0, width: w, height: h };
                break;
        }

        console.log('🔍 Region bounds calculated:', {
            region: this.settings.region,
            canvasSize: `${w}x${h}`,
            bounds: bounds
        });

        return bounds;
    }

    async loadTexture(texturePath) {
        console.log('🔍 Loading texture from path:', texturePath);
        try {
            // Use PIXI.Assets if available, otherwise fall back to PIXI.Texture.from
            if (PIXI.Assets) {
                console.log('🔍 Using PIXI.Assets.load');
                this.texture = await PIXI.Assets.load(texturePath);
            } else {
                console.log('🔍 Using PIXI.Texture.from fallback');
                this.texture = PIXI.Texture.from(texturePath);
            }
            this.textureLoaded = true;
            console.log(`✅ Loaded particle texture: ${texturePath}`, {
                width: this.texture.width,
                height: this.texture.height,
                valid: this.texture.valid,
                source: this.texture.source
            });
        } catch (error) {
            console.error(`❌ Failed to load particle texture: ${texturePath}`, error);
            this.textureLoaded = false;
        }
    }

    start() {
        if (!this.textureLoaded) {
            console.warn('Cannot start particle system: texture not loaded');
            return;
        }

        this.active = true;
        this.lastUpdate = performance.now() / 1000;
        console.log(`✅ Started particle system: ${this.settings.animationType} with settings:`, {
            spawnRate: this.settings.spawnRate,
            maxParticles: this.settings.maxParticles,
            region: this.settings.region,
            regionBounds: this.regionBounds
        });
    }

    stop() {
        this.active = false;
        this.clearAllParticles();
        console.log(`✓ Stopped particle system`);
    }

    update() {
        if (!this.active || !this.textureLoaded) return;

        const now = performance.now() / 1000;
        const dt = Math.min(now - this.lastUpdate, 0.05); // Cap delta time
        this.lastUpdate = now;

        // Update region bounds in case canvas was resized
        this.regionBounds = this.calculateRegionBounds();

        // Spawn new particles
        this.spawnAccumulator += dt * this.settings.spawnRate;
        while (this.spawnAccumulator >= 1 && this.particles.length < this.settings.maxParticles) {
            this.spawnParticle();
            this.spawnAccumulator -= 1;
        }

        // Update existing particles
        this.updateParticles(dt);
    }

    spawnParticle() {
        if (!this.texture) {
            console.warn('🟡 Cannot spawn particle: texture not loaded');
            return;
        }

        console.log('🟢 Spawning particle at:', this.particles.length, '/', this.settings.maxParticles);
        const sprite = new PIXI.Sprite(this.texture);
        sprite.anchor.set(0.5);
        sprite.alpha = this.settings.alphaStart;

        console.log('🔍 Texture info:', {
            width: this.texture.width,
            height: this.texture.height,
            valid: this.texture.valid
        });
        // Set blend mode safely
        if (typeof this.settings.blendMode === 'number') {
            sprite.blendMode = this.settings.blendMode;
        } else if (typeof PIXI !== 'undefined' && PIXI.BLEND_MODES) {
            sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
        }

        // Random scale
        const scale = this.settings.baseScale * (1 + this.settings.scaleJitter * (Math.random() * 2 - 1));
        sprite.scale.set(scale);

        // Position based on animation type and region
        this.setInitialPosition(sprite);

        console.log('🔍 Particle positioned at:', {
            x: sprite.x,
            y: sprite.y,
            scale: sprite.scale.x,
            alpha: sprite.alpha,
            regionBounds: this.regionBounds
        });

        // Animation properties
        sprite.__particleData = this.createParticleData(sprite);

        this.container.addChild(sprite);
        this.particles.push(sprite);
    }

    setInitialPosition(sprite) {
        const bounds = this.regionBounds;

        switch (this.settings.animationType) {
            case 'floating':
                // Spawn horizontally across the region
                sprite.x = Math.random() * bounds.width + bounds.x;
                sprite.y = bounds.y + Math.random() * bounds.height;
                break;

            case 'flying':
                // TEMPORARY: Spawn birds in visible area for testing
                sprite.x = bounds.width * 0.2 + Math.random() * bounds.width * 0.6; // Middle 60% of screen
                sprite.y = bounds.y + Math.random() * bounds.height;
                console.log('🔍 Bird spawning in VISIBLE area at:', {
                    x: Math.round(sprite.x),
                    y: Math.round(sprite.y),
                    bounds: bounds
                });
                break;

            case 'falling':
                // Spawn from top
                sprite.x = Math.random() * bounds.width + bounds.x;
                sprite.y = bounds.y - sprite.height;
                break;

            case 'rising':
                // Spawn from bottom
                sprite.x = Math.random() * bounds.width + bounds.x;
                sprite.y = bounds.y + bounds.height + sprite.height;
                break;
        }
    }

    createParticleData(sprite) {
        const data = {
            age: 0,
            life: this.lerp(this.settings.lifetimeMin, this.settings.lifetimeMax, Math.random()),
            phase: Math.random() * Math.PI * 2,
            sineAmp: this.settings.sineAmp * (0.7 + Math.random() * 0.6),
            sineFreq: this.settings.sineFreq * (0.8 + Math.random() * 0.4),
            baseY: sprite.y
        };

        // Type-specific properties
        switch (this.settings.animationType) {
            case 'floating':
                const dir = Math.random() < 0.5 ? -1 : 1;
                data.speed = this.lerp(this.settings.speedMin, this.settings.speedMax, Math.random()) * dir;
                break;

            case 'flying':
                // Birds fly in consistent direction
                data.speed = this.lerp(this.settings.speedMin, this.settings.speedMax, Math.random());
                if (sprite.x < 0) data.speed = Math.abs(data.speed); // Flying right
                else data.speed = -Math.abs(data.speed); // Flying left
                data.verticalSpeed = (Math.random() - 0.5) * 10; // Slight vertical drift
                break;

            case 'falling':
                data.speed = (Math.random() - 0.5) * this.settings.speedMax; // Horizontal drift
                data.gravitySpeed = this.settings.gravitySpeed || 20;
                data.rotation = (Math.random() - 0.5) * 0.02; // Rotation while falling
                break;

            case 'rising':
                data.speed = (Math.random() - 0.5) * this.settings.speedMax; // Horizontal drift
                data.riseSpeed = this.settings.riseSpeed || 15;
                break;
        }

        return data;
    }

    updateParticles(dt) {
        const bounds = this.regionBounds;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const sprite = this.particles[i];
            const data = sprite.__particleData;

            data.age += dt;

            // Update position based on animation type
            this.updateParticlePosition(sprite, data, dt, bounds);

            // Update alpha (lifetime fade)
            const t = Math.min(data.age / data.life, 1);
            sprite.alpha = this.lerp(this.settings.alphaStart, this.settings.alphaEnd, t);

            // Remove expired particles
            if (data.age >= data.life || this.isParticleOutOfBounds(sprite, bounds)) {
                this.container.removeChild(sprite);
                this.particles.splice(i, 1);
            }
        }
    }

    updateParticlePosition(sprite, data, dt, bounds) {
        switch (this.settings.animationType) {
            case 'floating':
                // Horizontal movement with wrapping
                sprite.x += data.speed * dt;
                if (sprite.x < -sprite.width) sprite.x = bounds.width + sprite.width * 0.5;
                if (sprite.x > bounds.width + sprite.width) sprite.x = -sprite.width * 0.5;

                // Sine wave vertical motion
                data.phase += data.sineFreq * dt;
                sprite.y = data.baseY + Math.sin(data.phase) * data.sineAmp;
                break;

            case 'flying':
                // Horizontal flight with slight vertical drift
                const oldX = sprite.x;
                sprite.x += data.speed * dt;
                sprite.y += data.verticalSpeed * dt;

                if (this.particles.length <= 3) { // Only log for first few particles to avoid spam
                    console.log('🔍 Bird flying:', {
                        oldX: Math.round(oldX),
                        newX: Math.round(sprite.x),
                        y: Math.round(sprite.y),
                        speed: data.speed,
                        dt: dt.toFixed(3)
                    });
                }

                // Wing flap simulation (scale oscillation)
                data.phase += 8 * dt; // Faster flapping
                const wingFlap = 1 + Math.sin(data.phase) * 0.1;
                sprite.scale.x = Math.abs(sprite.scale.x) * wingFlap;
                break;

            case 'falling':
                // Gravity + horizontal drift + rotation
                sprite.x += data.speed * dt;
                sprite.y += data.gravitySpeed * dt;
                sprite.rotation += data.rotation * dt;

                // Wind effect (sine wave horizontal drift)
                data.phase += data.sineFreq * dt;
                sprite.x += Math.sin(data.phase) * data.sineAmp * 0.3 * dt;
                break;

            case 'rising':
                // Rising with horizontal drift
                sprite.x += data.speed * dt;
                sprite.y -= data.riseSpeed * dt;

                // Gentle horizontal sine motion
                data.phase += data.sineFreq * dt;
                sprite.x += Math.sin(data.phase) * data.sineAmp * 0.5 * dt;
                break;
        }
    }

    isParticleOutOfBounds(sprite, bounds) {
        const margin = Math.max(sprite.width, sprite.height);

        switch (this.settings.animationType) {
            case 'floating':
                return false; // Wrapping prevents out of bounds

            case 'flying':
                return sprite.x < -margin * 2 || sprite.x > bounds.width + margin * 2;

            case 'falling':
                return sprite.y > bounds.y + bounds.height + margin;

            case 'rising':
                return sprite.y < bounds.y - margin;

            default:
                return false;
        }
    }

    clearAllParticles() {
        this.particles.forEach(sprite => {
            if (sprite.parent) {
                sprite.parent.removeChild(sprite);
            }
        });
        this.particles = [];
        this.spawnAccumulator = 0;
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // Resize handler
    onResize() {
        this.regionBounds = this.calculateRegionBounds();
    }

    destroy() {
        this.stop();
        if (this.container.parent) {
            this.container.parent.removeChild(this.container);
        }
    }
}