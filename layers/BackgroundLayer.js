/**
 * Background Layer
 * Handles background effects: blur, remove, replace, none
 */
class BackgroundLayer extends BaseLayer {
    constructor(config = {}) {
        super('background', {
            mode: 'blur', // 'blur', 'remove', 'replace', 'none'
            blurStrength: 15,
            backgroundImage: null,
            backgroundColor: '#000000',
            confidenceThreshold: 0.7,
            zIndex: 1,
            ...config
        });

        this.backgroundImage = new Image();
        this.blurCache = new Map();

        // Load default background image if provided
        if (this.config.backgroundImage) {
            this.setBackgroundImage(this.config.backgroundImage);
        }
    }

    onInit() {
        console.log('BackgroundLayer initialized');
    }

    async onRender(inputData, timestamp) {
        const { originalImage, mask, pixels } = inputData;

        if (!originalImage || !mask || !pixels) {
            return false;
        }

        switch (this.config.mode) {
            case 'blur':
                this.applyBackgroundBlur(pixels, mask, originalImage);
                break;
            case 'remove':
                this.removeBackground(pixels, mask);
                break;
            case 'replace':
                this.replaceBackground(pixels, mask);
                break;
            case 'none':
                // No background processing
                break;
            default:
                console.warn(`Unknown background mode: ${this.config.mode}`);
                return false;
        }

        return true;
    }

    shouldRender(inputData, timestamp) {
        // Always render when input data changes
        return true;
    }

    applyBackgroundBlur(pixels, mask, originalImage) {
        const cacheKey = `blur_${this.config.blurStrength}_${this.canvas.width}x${this.canvas.height}`;

        let blurCanvas = this.getCached(cacheKey, () => {
            const canvas = document.createElement('canvas');
            canvas.width = this.canvas.width;
            canvas.height = this.canvas.height;
            const ctx = canvas.getContext('2d');

            // Apply blur filter
            ctx.filter = `blur(${this.config.blurStrength}px)`;
            ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

            return canvas;
        });

        const blurCtx = blurCanvas.getContext('2d');
        const blurData = blurCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue < this.config.confidenceThreshold) {
                pixels[i] = blurData.data[i];
                pixels[i + 1] = blurData.data[i + 1];
                pixels[i + 2] = blurData.data[i + 2];
            }
        }
    }

    removeBackground(pixels, mask) {
        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue < this.config.confidenceThreshold) {
                pixels[i + 3] = 0; // Set alpha to 0 (transparent)
            }
        }
    }

    replaceBackground(pixels, mask) {
        // Parse the background color
        const color = this.hexToRgb(this.config.backgroundColor);

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue < this.config.confidenceThreshold) {
                const blend = 1 - maskValue;
                pixels[i] = pixels[i] * maskValue + color.r * blend;
                pixels[i + 1] = pixels[i + 1] * maskValue + color.g * blend;
                pixels[i + 2] = pixels[i + 2] * maskValue + color.b * blend;
            }
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    // Configuration methods
    setMode(mode) {
        this.config.mode = mode;
        this.invalidate();
    }

    setBackgroundColor(color) {
        this.config.backgroundColor = color;
        this.invalidate();
    }

    setBlurStrength(strength) {
        this.config.blurStrength = strength;
        this.blurCache.clear(); // Clear blur cache when strength changes
        this.invalidate();
    }

    setConfidenceThreshold(threshold) {
        this.config.confidenceThreshold = threshold;
        this.invalidate();
    }

    setBackgroundImage(imagePath) {
        this.backgroundImage.onload = () => {
            this.invalidate();
        };

        this.backgroundImage.onerror = (e) => {
            console.error('Failed to load background image:', imagePath, e);
        };

        this.backgroundImage.src = imagePath;
    }

    destroy() {
        super.destroy();
        this.blurCache.clear();
        this.backgroundImage = null;
    }
}