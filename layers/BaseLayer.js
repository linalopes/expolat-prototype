/**
 * Base Layer Class
 * Provides common interface and functionality for all visual layers
 */
class BaseLayer {
    constructor(name, config = {}) {
        this.name = name;
        this.config = {
            enabled: true,
            opacity: 1.0,
            blendMode: 'normal',
            zIndex: 0,
            ...config
        };

        this.canvas = null;
        this.ctx = null;
        this.lastRender = 0;
        this.needsUpdate = true;
        this.cache = new Map();
    }

    /**
     * Initialize the layer with canvas context
     */
    init(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.onInit();
    }

    /**
     * Override this method for layer-specific initialization
     */
    onInit() {
        // Base implementation - can be overridden
    }

    /**
     * Main render method - calls layer-specific rendering
     */
    async render(inputData, timestamp) {
        if (!this.config.enabled || !this.canvas || !this.ctx) {
            return false;
        }

        // Check if render is needed
        if (!this.shouldRender(inputData, timestamp)) {
            return false;
        }

        try {
            this.ctx.save();

            // Set global rendering properties
            this.ctx.globalAlpha = this.config.opacity;
            this.ctx.globalCompositeOperation = this.config.blendMode;

            // Call layer-specific rendering
            const rendered = await this.onRender(inputData, timestamp);

            this.ctx.restore();

            if (rendered) {
                this.lastRender = timestamp;
                this.needsUpdate = false;
            }

            return rendered;
        } catch (error) {
            console.error(`Error rendering ${this.name} layer:`, error);
            this.ctx.restore();
            return false;
        }
    }

    /**
     * Override this method for layer-specific rendering logic
     */
    async onRender(inputData, timestamp) {
        throw new Error(`Layer ${this.name} must implement onRender method`);
    }

    /**
     * Determine if the layer needs to be re-rendered
     */
    shouldRender(inputData, timestamp) {
        return this.needsUpdate || this.config.alwaysRender;
    }

    /**
     * Update layer configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.needsUpdate = true;
    }

    /**
     * Enable/disable the layer
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        this.needsUpdate = true;
    }

    /**
     * Set layer opacity
     */
    setOpacity(opacity) {
        this.config.opacity = Math.max(0, Math.min(1, opacity));
        this.needsUpdate = true;
    }

    /**
     * Set blend mode
     */
    setBlendMode(blendMode) {
        this.config.blendMode = blendMode;
        this.needsUpdate = true;
    }

    /**
     * Mark layer as needing update
     */
    invalidate() {
        this.needsUpdate = true;
    }

    /**
     * Clear layer cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cached item or create if not exists
     */
    getCached(key, createFn) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const value = createFn();
        this.cache.set(key, value);

        // Limit cache size
        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        return value;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.clearCache();
        this.canvas = null;
        this.ctx = null;
    }
}