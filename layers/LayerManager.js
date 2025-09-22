/**
 * Layer Manager
 * Coordinates rendering between all visual layers and manages the compositing pipeline
 */
class LayerManager {
    constructor(mainCanvas, overlayCanvas) {
        this.mainCanvas = mainCanvas;
        this.mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });

        this.overlayCanvas = overlayCanvas;
        this.overlayCtx = overlayCanvas.getContext('2d');

        this.layers = new Map();
        this.renderOrder = [];
        this.lastRender = 0;
    }

    /**
     * Add a layer to the manager
     */
    addLayer(layer) {
        if (!layer || !layer.name) {
            throw new Error('Layer must have a name');
        }

        this.layers.set(layer.name, layer);
        this.updateRenderOrder();

        // Initialize layer with appropriate canvas
        if (layer.name === 'overlay' || layer.name === 'nature') {
            layer.init(this.overlayCanvas, this.overlayCtx);
        } else {
            layer.init(this.mainCanvas, this.mainCtx);
        }

        console.log(`Added layer: ${layer.name} (z-index: ${layer.config.zIndex})`);
    }

    /**
     * Remove a layer from the manager
     */
    removeLayer(layerName) {
        const layer = this.layers.get(layerName);
        if (layer) {
            layer.destroy();
            this.layers.delete(layerName);
            this.updateRenderOrder();
            console.log(`Removed layer: ${layerName}`);
        }
    }

    /**
     * Get a layer by name
     */
    getLayer(layerName) {
        return this.layers.get(layerName);
    }

    /**
     * Update the rendering order based on z-index
     */
    updateRenderOrder() {
        this.renderOrder = Array.from(this.layers.values())
            .sort((a, b) => a.config.zIndex - b.config.zIndex);
    }

    /**
     * Main render method - orchestrates all layer rendering
     */
    async render(inputData, timestamp = Date.now()) {
        try {
            // Prepare input data for layers
            const layerInputData = this.prepareInputData(inputData);

            // Render layers in z-index order
            for (const layer of this.renderOrder) {
                if (!layer.config.enabled) continue;

                try {
                    await layer.render(layerInputData, timestamp);
                } catch (error) {
                    console.error(`Error rendering ${layer.name} layer:`, error);
                }
            }

            this.lastRender = timestamp;
        } catch (error) {
            console.error('LayerManager render error:', error);
        }
    }

    /**
     * Prepare input data for layer consumption
     */
    prepareInputData(rawInputData) {
        // Add any common processing or data transformation here
        return {
            ...rawInputData,
            canvasWidth: this.mainCanvas.width,
            canvasHeight: this.mainCanvas.height,
            timestamp: Date.now()
        };
    }


    /**
     * Enable/disable a layer
     */
    setLayerEnabled(layerName, enabled) {
        const layer = this.layers.get(layerName);
        if (layer) {
            layer.setEnabled(enabled);
            console.log(`${enabled ? 'Enabled' : 'Disabled'} layer: ${layerName}`);
        }
    }

    /**
     * Set layer opacity
     */
    setLayerOpacity(layerName, opacity) {
        const layer = this.layers.get(layerName);
        if (layer) {
            layer.setOpacity(opacity);
        }
    }

    /**
     * Set layer blend mode
     */
    setLayerBlendMode(layerName, blendMode) {
        const layer = this.layers.get(layerName);
        if (layer) {
            layer.setBlendMode(blendMode);
        }
    }

    /**
     * Clear all layers
     */
    clear() {
        this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    /**
     * Invalidate all layers (force re-render)
     */
    invalidateAll() {
        for (const layer of this.layers.values()) {
            layer.invalidate();
        }
    }

    /**
     * Invalidate specific layer
     */
    invalidateLayer(layerName) {
        const layer = this.layers.get(layerName);
        if (layer) {
            layer.invalidate();
        }
    }

    /**
     * Get basic layer information
     */
    getStats() {
        return {
            layerCount: this.layers.size,
            enabledLayers: Array.from(this.layers.values()).filter(l => l.config.enabled).length
        };
    }

    /**
     * Get layer configuration
     */
    getLayerConfigs() {
        const configs = {};
        for (const [name, layer] of this.layers.entries()) {
            configs[name] = { ...layer.config };
        }
        return configs;
    }

    /**
     * Batch update multiple layer configurations
     */
    updateLayerConfigs(configs) {
        for (const [layerName, config] of Object.entries(configs)) {
            const layer = this.layers.get(layerName);
            if (layer) {
                layer.updateConfig(config);
            }
        }
        this.updateRenderOrder();
    }

    /**
     * Destroy all layers and clean up resources
     */
    destroy() {
        for (const layer of this.layers.values()) {
            layer.destroy();
        }

        this.layers.clear();
        this.renderOrder = [];

        console.log('LayerManager destroyed');
    }
}