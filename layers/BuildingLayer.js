/**
 * Building Layer
 * Handles building texture mapping and building-specific effects
 */
class BuildingLayer extends BaseLayer {
    constructor(config = {}) {
        super('building', {
            effectIntensity: 0.5,
            confidenceThreshold: 0.7,
            currentTexture: null,
            textureType: 'image', // 'image', 'color', 'none'
            backgroundColor: '#1a1a2e', // Default background color
            zIndex: 2,
            ...config
        });

        this.textureImage = new Image();
        this.boundingBoxCache = new Map();
    }

    onInit() {
        console.log('BuildingLayer initialized');
    }

    async onRender(inputData, timestamp) {
        const { pixels, mask, poses } = inputData;

        if (!pixels || !mask) {
            return false;
        }

        // Always render ghost effect within contour
        this.applyGhostEffect(pixels, mask);
        return true;
    }

    applyGhostEffect(pixels, mask) {
        // Create translucent ghost effect showing camera feed within contour
        const ghostOpacity = 0.15; // Very faint ghost effect

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue > this.config.confidenceThreshold) {
                // Keep original camera pixels but make them very faint
                pixels[i] = pixels[i] * ghostOpacity + 255 * (1 - ghostOpacity);     // R
                pixels[i + 1] = pixels[i + 1] * ghostOpacity + 255 * (1 - ghostOpacity); // G
                pixels[i + 2] = pixels[i + 2] * ghostOpacity + 255 * (1 - ghostOpacity); // B
                // Alpha stays the same
            }
        }
    }

    shouldRender(inputData, timestamp) {
        // Always render when input data changes or texture is animated
        return true;
    }

    async applyImageTexture(pixels, mask) {
        // Check if texture image is valid and properly loaded
        // Remove excessive debug logging

        if (!this.textureImage ||
            !this.textureImage.complete ||
            !this.config.currentTexture ||
            this.textureImage.naturalWidth === 0 ||
            this.textureImage.naturalHeight === 0) {
            return; // Skip texture application silently
        }

        // Calculate the bounding box of the detected contour
        const boundingBox = this.calculateContourBoundingBox(mask);

        if (!boundingBox) {
            // Fallback to pattern method
            await this.applyPatternTexture(pixels, mask);
            return;
        }

        // Create texture canvas scaled to fit the bounding box
        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = this.canvas.width;
        textureCanvas.height = this.canvas.height;
        const textureCtx = textureCanvas.getContext('2d');

        // Scale the texture to fit within the bounding box
        try {
            textureCtx.drawImage(
                this.textureImage,
                boundingBox.minX, boundingBox.minY,
                boundingBox.width, boundingBox.height
            );
        } catch (error) {
            console.error('Failed to draw texture image:', error);
            return;
        }

        const textureData = textureCtx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);

        // Apply the scaled texture only to the person contour
        this.blendTextureWithMask(pixels, textureData.data, mask);
    }

    async applyPatternTexture(pixels, mask) {
        // Check if texture image is valid before creating pattern
        if (!this.textureImage ||
            !this.textureImage.complete ||
            this.textureImage.naturalWidth === 0 ||
            this.textureImage.naturalHeight === 0) {
            // Skip pattern application silently
            return;
        }

        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = this.canvas.width;
        textureCanvas.height = this.canvas.height;
        const textureCtx = textureCanvas.getContext('2d');

        try {
            const pattern = textureCtx.createPattern(this.textureImage, 'repeat');
            if (!pattern) {
                console.warn('Failed to create pattern from texture image');
                return;
            }
            textureCtx.fillStyle = pattern;
            textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
        } catch (error) {
            console.error('Failed to create or apply pattern texture:', error);
            return;
        }

        const textureData = textureCtx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
        this.blendTextureWithMask(pixels, textureData.data, mask);
    }


    applyColorOverlay(pixels, mask, timestamp) {
        const hue = (timestamp / 50) % 360;

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue > this.config.confidenceThreshold) {
                const rgb = this.hslToRgb(hue / 360, 0.7, 0.5);
                const blend = this.config.effectIntensity * 0.3;

                pixels[i] = pixels[i] * (1 - blend) + rgb[0] * blend;
                pixels[i + 1] = pixels[i + 1] * (1 - blend) + rgb[1] * blend;
                pixels[i + 2] = pixels[i + 2] * (1 - blend) + rgb[2] * blend;
            }
        }
    }

    blendTextureWithMask(pixels, textureData, mask, backgroundColor = null) {
        // Extract background color if not provided
        if (!backgroundColor && this.config.backgroundColor) {
            backgroundColor = this.hexToRgb(this.config.backgroundColor);
        }

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue > this.config.confidenceThreshold) {
                const blend = this.config.effectIntensity;

                // Handle transparency properly - transparent areas should be white/background color
                const textureAlpha = textureData[i + 3] / 255;
                let finalR = textureData[i];
                let finalG = textureData[i + 1];
                let finalB = textureData[i + 2];

                // If pixel is transparent or semi-transparent, render as white/background
                if (textureAlpha < 0.95) {
                    // Use white as default for transparent areas in architectural drawings
                    const whiteR = 255;
                    const whiteG = 255;
                    const whiteB = 255;

                    // Blend transparent areas with white background
                    finalR = finalR * textureAlpha + whiteR * (1 - textureAlpha);
                    finalG = finalG * textureAlpha + whiteG * (1 - textureAlpha);
                    finalB = finalB * textureAlpha + whiteB * (1 - textureAlpha);
                }

                // Also handle near-white areas
                if (this.isNearWhite(finalR, finalG, finalB)) {
                    finalR = 255;
                    finalG = 255;
                    finalB = 255;
                }

                pixels[i] = pixels[i] * (1 - blend) + finalR * blend;
                pixels[i + 1] = pixels[i + 1] * (1 - blend) + finalG * blend;
                pixels[i + 2] = pixels[i + 2] * (1 - blend) + finalB * blend;
            }
        }
    }

    isNearWhite(r, g, b, threshold = 200) {
        return r > threshold && g > threshold && b > threshold;
    }

    isNearBlack(r, g, b, threshold = 50) {
        return r < threshold && g < threshold && b < threshold;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 26, g: 26, b: 46 }; // Default to #1a1a2e
    }

    calculateContourBoundingBox(mask) {
        const cacheKey = `bbox_${mask.length}_${this.config.confidenceThreshold}`;

        return this.getCached(cacheKey, () => {
            const width = this.canvas.width;
            const height = this.canvas.height;

            let minX = width, minY = height;
            let maxX = 0, maxY = 0;
            let hasContour = false;

            // Scan the mask to find the bounding box of all foreground pixels
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const maskValue = mask[idx] / 255;

                    if (maskValue > this.config.confidenceThreshold) {
                        hasContour = true;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            if (!hasContour) {
                return null; // No contour found
            }

            // Add some padding to prevent edge clipping
            const padding = 5;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(width - 1, maxX + padding);
            maxY = Math.min(height - 1, maxY + padding);

            return {
                minX,
                minY,
                maxX,
                maxY,
                width: maxX - minX,
                height: maxY - minY
            };
        });
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    // Configuration methods
    setTexture(texturePath, textureType = 'image') {
        console.log(`PersonLayer.setTexture called: ${texturePath}, type: ${textureType}`);
        this.config.currentTexture = texturePath;
        this.config.textureType = textureType;

        if (textureType === 'image') {
            this.textureImage.onload = () => {
                console.log(`✓ Texture loaded successfully: ${texturePath}`, {
                    naturalWidth: this.textureImage.naturalWidth,
                    naturalHeight: this.textureImage.naturalHeight,
                    complete: this.textureImage.complete
                });
                this.invalidate();
            };

            this.textureImage.onerror = (e) => {
                console.error('Failed to load texture:', texturePath, e);
                // Clear the current texture to prevent broken image errors
                this.config.currentTexture = null;
                // Fallback to color mode
                this.config.textureType = 'color';
                console.log('Falling back to color texture mode due to image load failure');
                this.invalidate();
            };

            console.log(`Setting textureImage.src to: ${texturePath}`);
            this.textureImage.src = texturePath;
        } else {
            console.log(`Non-image texture type (${textureType}), invalidating layer`);
            this.invalidate();
        }
    }

    setEffectIntensity(intensity) {
        this.config.effectIntensity = Math.max(0, Math.min(1, intensity));
        this.invalidate();
    }

    setConfidenceThreshold(threshold) {
        this.config.confidenceThreshold = threshold;
        this.boundingBoxCache.clear(); // Clear bbox cache when threshold changes
        this.invalidate();
    }


    setBackgroundColor(color) {
        this.config.backgroundColor = color;
        this.invalidate();
    }

    destroy() {
        super.destroy();
        this.boundingBoxCache.clear();
        this.textureImage = null;
    }
}