class PersonSegmentation {
    constructor() {
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('outputCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Separate overlay canvas for bottom third nature overlay
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        // Layer System
        this.layerManager = new LayerManager(this.canvas, this.overlayCanvas);
        this.backgroundLayer = null;
        this.buildingLayer = null;
        this.natureLayer = null;

        this.segmenter = null;
        this.poseDetector = null;
        this.animationId = null;
        this.poses = [];
        this.lastPoseUpdate = 0;

        this.settings = {
            backgroundMode: 'remove',
            backgroundColor: '#ffffff',
            personEffect: 'texture',
            buildingOverlayEnabled: true,
            confidenceThreshold: 0.7,
            effectIntensity: 0.95
        };

        this.textures = [];
        this.textureConfig = null;
        this.poseMapping = null;
        this.currentTexture = null;
        this.currentCategory = 'nature';
        this.currentPose = 'neutral';
        this.currentOverlay = null;

        // Pose simulation state
        this.isSimulatingPose = false;
        this.currentSimulatedPose = null;
        this.poseDetectionEnabled = true;

        // Multi-person shoulder stickers
        this.shoulderStickersEnabled = true;
        this.personStates = []; // Current state for each person
        this.personStableStates = []; // Stable state for each person
        this.personStableCounters = []; // Counter for state stability
        this.personOverlayImages = []; // Overlay image for each person
        this.STABLE_FRAMES = 12; // Number of frames to wait before considering a state stable

        // Shoulder sticker images
        this.shoulderStickerImages = new Map();

        // Display controls
        this.videoVisible = true;
        this.skeletonVisible = false;

        // Initialize texture cache for better performance
        this.textureCache = new Map();
        this.textureImage = null;

        // Initialize default overlay to ensure bottom third is always visible
        this.currentOverlay = {
            image: 'aletsch.png',
            opacity: 1.0,
            blendMode: 'normal'
        };

        this.init();
    }

    async init() {
        try {
            await this.setupCamera();
            await this.loadMediaPipe();
            await this.loadTextureConfig();
            await this.loadPoseMapping();
            this.setupLayers();
            this.setupControls();
            this.loadShoulderStickerImages();
            this.startProcessing();

            document.getElementById('status').innerHTML = '<span>✓ Ready! AI pose detection and texture mapping active.</span>';

            // Set initial overlay
            const natureLayer = this.layerManager.getLayer('nature');
            if (natureLayer) {
                console.log('Setting initial nature overlay:', this.currentOverlay);
                natureLayer.setOverlay(this.currentOverlay);
                console.log('Nature layer enabled state:', natureLayer.config.enabled);
            }

            // Add fullscreen change event listeners
            document.addEventListener('fullscreenchange', () => {
                console.log('Fullscreen change event fired:', !!document.fullscreenElement);
                this.onFullscreenChange(!!document.fullscreenElement);
            });
            document.addEventListener('webkitfullscreenchange', () => {
                console.log('WebKit fullscreen change event fired:', !!document.webkitFullscreenElement);
                this.onFullscreenChange(!!document.webkitFullscreenElement);
            });
            document.addEventListener('mozfullscreenchange', () => {
                console.log('Mozilla fullscreen change event fired:', !!document.mozFullScreenElement);
                this.onFullscreenChange(!!document.mozFullScreenElement);
            });
        } catch (error) {
            console.error('Initialization error:', error);
            document.getElementById('status').innerHTML = '<span style="color: #ff6b6b;">Error: ' + error.message + '</span>';
        }
    }

    async setupCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });

        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;

                // Set overlay canvas to same size
                this.overlayCanvas.width = this.video.videoWidth;
                this.overlayCanvas.height = this.video.videoHeight;

                resolve();
            };
        });
    }

    setupLayers() {
        // Create and configure background layer (always replace with solid color)
        this.backgroundLayer = new BackgroundLayer({
            mode: 'replace',
            confidenceThreshold: this.settings.confidenceThreshold,
            backgroundColor: this.settings.backgroundColor
        });

        // Create and configure building layer
        this.buildingLayer = new BuildingLayer({
            effectIntensity: this.settings.effectIntensity,
            confidenceThreshold: this.settings.confidenceThreshold,
            backgroundColor: this.settings.defaultBackgroundColor,
            textureType: this.settings.buildingOverlayEnabled ? 'image' : 'none'
        });

        // Create and configure nature layer
        this.natureLayer = new NatureLayer({
            currentOverlay: this.currentOverlay
        });

        // Add layers to manager
        this.layerManager.addLayer(this.backgroundLayer);
        this.layerManager.addLayer(this.buildingLayer);
        this.layerManager.addLayer(this.natureLayer);

        console.log('Layer system initialized: Background, Building, Nature layers');
    }

    async loadMediaPipe() {
        // Load Selfie Segmentation
        const segScript = document.createElement('script');
        segScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
        segScript.crossOrigin = 'anonymous';
        document.head.appendChild(segScript);

        // Load Pose Detection
        const poseScript = document.createElement('script');
        poseScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
        poseScript.crossOrigin = 'anonymous';
        document.head.appendChild(poseScript);

        await Promise.all([
            new Promise((resolve) => { segScript.onload = resolve; }),
            new Promise((resolve) => { poseScript.onload = resolve; })
        ]);

        // Initialize Selfie Segmentation
        const segConfig = {
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
            }
        };

        this.segmenter = new window.SelfieSegmentation(segConfig);
        this.segmenter.setOptions({
            modelSelection: 1,
            selfieMode: true
        });

        this.segmenter.onResults(this.onSegmentationResults.bind(this));

        // Initialize Pose Detection
        const poseConfig = {
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        };

        this.poseDetector = new window.Pose(poseConfig);
        this.poseDetector.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            selfieMode: true
        });

        this.poseDetector.onResults(this.onPoseResults.bind(this));
    }

    onSegmentationResults(results) {
        this.segmentationResults = results;
        this.renderFrame().catch((error) => {
            console.warn('Render frame error:', error);
        });
    }

    onPoseResults(results) {
        this.poses = results.poseLandmarks ? [results] : [];
        this.detectPose();

        // Process multi-person shoulder stickers
        if (this.shoulderStickersEnabled && this.poses && this.poses.length > 0) {
            this.poses.forEach((pose, personIndex) => {
                const detectedPose = this.analyzePersonPose([pose], 0);
                this.processPersonStateChange(personIndex, detectedPose);
            });
        }

        // Nature layer is handled by LayerManager now
    }

    async renderFrame() {
        if (!this.segmentationResults) return;

        const results = this.segmentationResults;

        // Draw base image to canvas
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

        // Get image data for layer processing
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = imageData.data;

        // Prepare input data for layers
        let maskData = null;
        if (results.segmentationMask) {
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = this.canvas.width;
            maskCanvas.height = this.canvas.height;
            const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
            maskCtx.drawImage(results.segmentationMask, 0, 0, this.canvas.width, this.canvas.height);
            maskData = maskCtx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        }

        const layerInputData = {
            originalImage: results.image,
            pixels: pixels,
            mask: maskData,
            poses: this.poses,
            imageData: imageData
        };

        // Use layer system for rendering
        await this.layerManager.render(layerInputData);

        // Put processed image data back to canvas
        this.ctx.putImageData(imageData, 0, 0);

        // Draw shoulder stickers for each person
        if (this.shoulderStickersEnabled && this.poses && this.poses.length > 0) {
            this.poses.forEach((pose, personIndex) => {
                if (pose.poseLandmarks) {
                    this.drawPersonShoulderSticker({ keypoints: this.convertLandmarksToKeypoints(pose.poseLandmarks) }, personIndex);
                }
            });
        }

        // Draw pose keypoints if enabled
        if (this.textureConfig?.settings?.showPoseKeypoints) {
            this.drawPoseKeypoints();
        }

        this.ctx.restore();
    }

    detectPose() {
        // If pose detection is disabled or we're simulating a pose, don't run actual detection
        if (!this.poseDetectionEnabled || this.isSimulatingPose) {
            return;
        }

        if (!this.poses.length || !this.poses[0].poseLandmarks) {
            return;
        }

        const landmarks = this.poses[0].poseLandmarks;

        // Get key landmark positions (MediaPipe pose landmarks)
        const leftShoulder = landmarks[11];  // LEFT_SHOULDER
        const rightShoulder = landmarks[12]; // RIGHT_SHOULDER
        const leftElbow = landmarks[13];     // LEFT_ELBOW
        const rightElbow = landmarks[14];    // RIGHT_ELBOW
        const leftWrist = landmarks[15];     // LEFT_WRIST
        const rightWrist = landmarks[16];    // RIGHT_WRIST
        const leftHip = landmarks[23];       // LEFT_HIP
        const rightHip = landmarks[24];      // RIGHT_HIP
        const nose = landmarks[0];           // NOSE

        let detectedPose = 'neutral';

        // Check for Mountain pose: both hands above head, close together
        if (this.checkMountainPose(leftWrist, rightWrist, leftShoulder, rightShoulder, nose)) {
            detectedPose = 'mountain';
        }
        // Check for Jesus/T-pose: arms extended horizontally
        else if (this.checkJesusPose(leftWrist, rightWrist, leftShoulder, rightShoulder, leftElbow, rightElbow)) {
            detectedPose = 'jesus';
        }
        // Check for Tree pose: one leg raised, arms up
        else if (this.checkTreePose(leftWrist, rightWrist, leftShoulder, rightShoulder)) {
            detectedPose = 'tree';
        }
        // Check for Warrior pose: wide stance, arms extended
        else if (this.checkWarriorPose(leftWrist, rightWrist, leftShoulder, rightShoulder)) {
            detectedPose = 'warrior';
        }

        // Only update if pose has been stable for a bit
        const now = Date.now();
        if (detectedPose !== this.currentPose) {
            if (now - this.lastPoseUpdate > 1000) { // 1 second stability
                this.currentPose = detectedPose;
                this.updateTextureForPose(detectedPose);
                this.lastPoseUpdate = now;
            }
        } else {
            this.lastPoseUpdate = now;
        }
    }

    checkMountainPose(leftWrist, rightWrist, leftShoulder, rightShoulder, nose) {
        if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return false;

        // Both wrists above shoulders (arms lifted up)
        const leftArmUp = leftWrist.y < leftShoulder.y - 0.15;
        const rightArmUp = rightWrist.y < rightShoulder.y - 0.15;

        // Arms can be wider apart (more relaxed than mountain pose)
        const handsDistance = Math.abs(leftWrist.x - rightWrist.x);
        const armsReasonablyClose = handsDistance < 0.4;

        return leftArmUp && rightArmUp && armsReasonablyClose;
    }

    checkJesusPose(leftWrist, rightWrist, leftShoulder, rightShoulder, leftElbow, rightElbow) {
        if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return false;

        // Arms stretched horizontally to the sides (more tolerant)
        const leftArmHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 0.15;
        const rightArmHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 0.15;

        // Arms fully extended to sides
        const leftArmExtended = leftWrist.x < leftShoulder.x - 0.15;
        const rightArmExtended = rightWrist.x > rightShoulder.x + 0.15;

        // Good arm spread (Cristo Redentor pose)
        const armSpread = Math.abs(leftWrist.x - rightWrist.x);
        const goodSpread = armSpread > 0.4;

        return leftArmHorizontal && rightArmHorizontal && leftArmExtended && rightArmExtended && goodSpread;
    }

    checkTreePose(leftWrist, rightWrist, leftShoulder, rightShoulder) {
        if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return false;

        // Both arms raised (simplified tree pose detection)
        const armsRaised = (leftWrist.y < leftShoulder.y - 0.1) && (rightWrist.y < rightShoulder.y - 0.1);
        const armsWide = Math.abs(leftWrist.x - rightWrist.x) > 0.2;

        return armsRaised && armsWide;
    }

    checkWarriorPose(leftWrist, rightWrist, leftShoulder, rightShoulder) {
        if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return false;

        // One arm forward, one arm back (simplified)
        const armsSeparated = Math.abs(leftWrist.x - rightWrist.x) > 0.3;
        const armsAtShoulderLevel = Math.abs(leftWrist.y - leftShoulder.y) < 0.15 &&
                                   Math.abs(rightWrist.y - rightShoulder.y) < 0.15;

        return armsSeparated && armsAtShoulderLevel;
    }

    updateTextureForPose(poseName) {
        console.log(`Updating texture for pose: ${poseName}`);

        if (!this.poseMapping || !this.poseMapping.poses[poseName]) {
            console.warn(`Pose "${poseName}" not found in mapping`);
            // For unknown poses, ensure we still have an overlay
            if (!this.currentOverlay) {
                this.currentOverlay = {
                    image: 'aletsch.png',
                    opacity: 1.0,
                    blendMode: 'normal'
                };
                const natureLayer = this.layerManager.getLayer('nature');
                if (natureLayer) {
                    natureLayer.setOverlay(this.currentOverlay);
                }
            }
            return;
        }

        const pose = this.poseMapping.poses[poseName];
        console.log(`Pose data:`, pose);

        // Update building texture if building overlay is enabled
        if (pose.textures && pose.textures.building && this.settings.buildingOverlayEnabled) {
            const buildingTextures = pose.textures.building;
            let textureFile = null;

            // Handle both old and new format
            if (buildingTextures.variants && Array.isArray(buildingTextures.variants)) {
                // New variant format - randomly select from available options
                const randomIndex = Math.floor(Math.random() * buildingTextures.variants.length);
                textureFile = buildingTextures.variants[randomIndex];
                console.log(`Selected building texture variant ${randomIndex + 1}/${buildingTextures.variants.length}: ${textureFile}`);
            } else if (buildingTextures.primary) {
                // Legacy format support
                textureFile = buildingTextures.primary;
            }

            if (textureFile) {
                this.currentTexture = `images/${textureFile}`;
                this.buildingLayer.setTexture(this.currentTexture, 'image');
                console.log(`Building texture set to: ${textureFile}`);
            }
        } else if (!this.settings.buildingOverlayEnabled) {
            // Clear building textures if building overlay is disabled
            this.buildingLayer.updateConfig({ textureType: 'none' });
            this.currentTexture = null;
            console.log('Building overlay disabled, clearing textures');
        }

        // Update nature layer with variant support
        let selectedNatureOverlay = null;
        if (pose.textures?.nature) {
            const natureTextures = pose.textures.nature;

            // Handle both old and new format
            if (natureTextures.variants && Array.isArray(natureTextures.variants)) {
                // New variant format - randomly select from available options
                const randomIndex = Math.floor(Math.random() * natureTextures.variants.length);
                selectedNatureOverlay = natureTextures.variants[randomIndex];
                console.log(`Selected nature texture variant ${randomIndex + 1}/${natureTextures.variants.length}:`, selectedNatureOverlay);
            } else if (natureTextures.image) {
                // Legacy format support
                selectedNatureOverlay = natureTextures;
            }
        }

        this.currentOverlay = selectedNatureOverlay || {
            image: 'aletsch.png',
            opacity: 1.0,
            blendMode: 'normal'
        };

        const natureLayer = this.layerManager.getLayer('nature');
        if (natureLayer) {
            natureLayer.setOverlay(this.currentOverlay);
            // Force immediate render
            natureLayer.invalidate();
            console.log('Nature layer invalidated, forcing render...');
        }
        console.log(`Current overlay set to:`, this.currentOverlay);

        // Update status to show detected pose
        this.updateStatusForPose(pose, poseName);
    }



    /**
     * Update status display for current pose
     */
    updateStatusForPose(pose, poseName) {
        const statusEl = document.getElementById('status');
        if (!statusEl) return;

        const buildingInfo = pose.textures?.building?.primary || 'None';
        statusEl.innerHTML = `<span>✨ ${pose.name} detected | Building: ${buildingInfo} | Nature: ${this.currentOverlay?.image || 'Color'}</span>`;
    }

    drawPoseKeypoints() {
        if (!this.poses.length || !this.poses[0].poseLandmarks) return;

        const landmarks = this.poses[0].poseLandmarks;

        this.ctx.fillStyle = '#FF0000';
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 2;

        // Draw key landmarks for pose detection
        const keyPoints = [0, 11, 12, 13, 14, 15, 16, 23, 24]; // nose, shoulders, elbows, wrists, hips

        keyPoints.forEach(index => {
            const landmark = landmarks[index];
            if (landmark && landmark.visibility > 0.5) {
                const x = landmark.x * this.canvas.width;
                const y = landmark.y * this.canvas.height;

                this.ctx.beginPath();
                this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        });

        // Draw pose connections
        const connections = [
            [11, 13], [13, 15], // Left arm
            [12, 14], [14, 16], // Right arm
            [11, 12],           // Shoulders
            [11, 23], [12, 24], // Torso
            [23, 24]            // Hips
        ];

        connections.forEach(([start, end]) => {
            const startLandmark = landmarks[start];
            const endLandmark = landmarks[end];

            if (startLandmark && endLandmark &&
                startLandmark.visibility > 0.5 && endLandmark.visibility > 0.5) {

                const startX = startLandmark.x * this.canvas.width;
                const startY = startLandmark.y * this.canvas.height;
                const endX = endLandmark.x * this.canvas.width;
                const endY = endLandmark.y * this.canvas.height;

                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
            }
        });
    }

    renderTopLayerOverlay() {
        // Only render if overlay has changed or hasn't been rendered yet
        const currentOverlayKey = this.currentOverlay?.image || 'none';
        if (this.lastRenderedOverlay === currentOverlayKey) {
            return; // Already rendered this overlay
        }

        console.log(`Rendering new overlay: ${currentOverlayKey}`);
        this.lastRenderedOverlay = currentOverlayKey;

        // Clear the overlay canvas first
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        const overlayHeight = this.textureConfig?.settings?.overlayHeight || 0.33;
        const startY = this.overlayCanvas.height * (1 - overlayHeight);
        const overlayAreaHeight = this.overlayCanvas.height - startY;

        console.log(`Overlay canvas dimensions: ${this.overlayCanvas.width}x${this.overlayCanvas.height}`);
        console.log(`Overlay area: startY=${startY}, height=${overlayAreaHeight}`);

        // Ensure we have a current overlay, fallback to default
        if (!this.currentOverlay) {
            this.currentOverlay = {
                image: 'iguazu.png',
                opacity: 1.0,
                blendMode: 'normal'
            };
        }

        console.log(`Loading nature texture: ${this.currentOverlay.image}`);

        // Create and load the overlay image
        const overlayImg = new Image();
        overlayImg.crossOrigin = 'anonymous';

        overlayImg.onload = () => {
            console.log(`Image loaded successfully: ${overlayImg.width}x${overlayImg.height}`);

            // Clear and render the final overlay
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

            this.overlayCtx.save();
            this.overlayCtx.globalCompositeOperation = 'source-over';
            this.overlayCtx.globalAlpha = 1.0;

            // Draw the nature texture
            this.overlayCtx.drawImage(
                overlayImg,
                0, startY,                    // Start at left edge, at 2/3 height
                this.overlayCanvas.width,    // Cover FULL screen width
                overlayAreaHeight            // Cover bottom third height
            );

            this.overlayCtx.restore();
            console.log(`✓ Nature overlay rendered and persisted: ${this.currentOverlay.image}`);
        };

        overlayImg.onerror = (e) => {
            console.error(`Failed to load nature texture: images/${this.currentOverlay.image}`, e);

            // Fallback: render a solid color overlay
            this.overlayCtx.save();
            this.overlayCtx.fillStyle = 'rgba(135, 206, 235, 1.0)'; // Sky blue
            this.overlayCtx.fillRect(0, startY, this.overlayCanvas.width, overlayAreaHeight);
            this.overlayCtx.restore();
            console.log('✓ Fallback color overlay rendered');
        };

        // Try loading the image
        const imagePath = `images/${this.currentOverlay.image}`;
        console.log(`Loading image from: ${imagePath}`);
        overlayImg.src = imagePath;
    }

    renderFallbackOverlay(startY, overlayAreaHeight) {
        this.overlayCtx.save();

        // Use a semi-transparent color overlay as fallback
        // Choose color based on current pose or default to nature green
        let fallbackColor = 'rgba(34, 139, 34, 0.8)'; // Forest green

        if (this.currentPose === 'mountain') {
            fallbackColor = 'rgba(135, 206, 235, 0.8)'; // Sky blue
        } else if (this.currentPose === 'jesus') {
            fallbackColor = 'rgba(0, 150, 200, 0.8)'; // Ocean blue
        } else if (this.currentPose === 'warrior') {
            fallbackColor = 'rgba(255, 165, 0, 0.8)'; // Sunset orange
        }

        this.overlayCtx.fillStyle = fallbackColor;
        this.overlayCtx.globalCompositeOperation = 'normal';
        this.overlayCtx.globalAlpha = 1.0;

        // Fill the bottom third with the fallback color
        this.overlayCtx.fillRect(
            0, startY,                       // Start at left edge, at 2/3 height
            this.overlayCanvas.width,        // Cover FULL screen width
            overlayAreaHeight                // Cover bottom third height
        );

        this.overlayCtx.restore();
    }

    async applyEffects(pixels, mask, imageData, originalImage) {
        const width = this.canvas.width;
        const height = this.canvas.height;

        if (this.settings.backgroundMode === 'blur') {
            this.applyBackgroundBlur(pixels, mask, originalImage);
        } else if (this.settings.backgroundMode === 'remove') {
            this.removeBackground(pixels, mask);
        } else if (this.settings.backgroundMode === 'replace') {
            this.replaceBackground(pixels, mask);
        }

        if (this.settings.personEffect === 'texture' && this.currentTexture) {
            await this.applyTextureToForeground(pixels, mask);
        } else if (this.settings.personEffect === 'color') {
            this.applyColorOverlay(pixels, mask);
        } else if (this.settings.personEffect === 'edge') {
            this.applyEdgeGlow(pixels, mask, imageData);
        }
    }

    applyBackgroundBlur(pixels, mask, originalImage) {
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = this.canvas.width;
        blurCanvas.height = this.canvas.height;
        const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });

        blurCtx.filter = 'blur(15px)';
        blurCtx.drawImage(originalImage, 0, 0, this.canvas.width, this.canvas.height);

        // Add color overlay to blurred background
        blurCtx.globalCompositeOperation = 'multiply';
        blurCtx.fillStyle = 'rgba(100, 150, 200, 0.3)'; // Cool blue tint
        blurCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const blurData = blurCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue < this.settings.confidenceThreshold) {
                pixels[i] = blurData.data[i];
                pixels[i + 1] = blurData.data[i + 1];
                pixels[i + 2] = blurData.data[i + 2];
            }
        }
    }

    removeBackground(pixels, mask) {
        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue < this.settings.confidenceThreshold) {
                pixels[i + 3] = 0;
            }
        }
    }

    replaceBackground(pixels, mask) {
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = this.canvas.width;
        bgCanvas.height = this.canvas.height;
        const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });

        bgCtx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        const bgData = bgCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue < this.settings.confidenceThreshold) {
                const blend = 1 - maskValue;
                pixels[i] = pixels[i] * maskValue + bgData.data[i] * blend;
                pixels[i + 1] = pixels[i + 1] * maskValue + bgData.data[i + 1] * blend;
                pixels[i + 2] = pixels[i + 2] * maskValue + bgData.data[i + 2] * blend;
            }
        }
    }

    async applyTextureToForeground(pixels, mask) {
        await this.applyRegularTexture(pixels, mask);
    }


    async applyRegularTexture(pixels, mask) {
        if (!this.textureImage.complete) return;

        // Calculate the bounding box of the detected contour
        const boundingBox = this.calculateContourBoundingBox(mask);

        if (!boundingBox) {
            // No contour found, fallback to original pattern method
            const textureCanvas = document.createElement('canvas');
            textureCanvas.width = this.canvas.width;
            textureCanvas.height = this.canvas.height;
            const textureCtx = textureCanvas.getContext('2d', { willReadFrequently: true });

            const pattern = textureCtx.createPattern(this.textureImage, 'repeat');
            textureCtx.fillStyle = pattern;
            textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
            const textureData = textureCtx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);

            for (let i = 0; i < pixels.length; i += 4) {
                const maskValue = mask[i] / 255;
                if (maskValue > this.settings.confidenceThreshold) {
                    const blend = this.settings.effectIntensity;
                    pixels[i] = pixels[i] * (1 - blend) + textureData.data[i] * blend;
                    pixels[i + 1] = pixels[i + 1] * (1 - blend) + textureData.data[i + 1] * blend;
                    pixels[i + 2] = pixels[i + 2] * (1 - blend) + textureData.data[i + 2] * blend;
                }
            }
            return;
        }

        // Create texture canvas scaled to fit the bounding box
        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = this.canvas.width;
        textureCanvas.height = this.canvas.height;
        const textureCtx = textureCanvas.getContext('2d', { willReadFrequently: true });

        // Scale the texture to fit within the bounding box
        textureCtx.drawImage(
            this.textureImage,
            boundingBox.minX, boundingBox.minY,           // Destination position
            boundingBox.width, boundingBox.height         // Destination size (scaled)
        );

        const textureData = textureCtx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);

        // Apply the scaled texture only to the person contour
        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue > this.settings.confidenceThreshold) {
                const blend = this.settings.effectIntensity;
                pixels[i] = pixels[i] * (1 - blend) + textureData.data[i] * blend;
                pixels[i + 1] = pixels[i + 1] * (1 - blend) + textureData.data[i + 1] * blend;
                pixels[i + 2] = pixels[i + 2] * (1 - blend) + textureData.data[i + 2] * blend;
            }
        }
    }

    calculateContourBoundingBox(mask) {
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

                if (maskValue > this.settings.confidenceThreshold) {
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
    }

    applyColorOverlay(pixels, mask) {
        const hue = (Date.now() / 50) % 360;

        for (let i = 0; i < pixels.length; i += 4) {
            const maskValue = mask[i] / 255;
            if (maskValue > this.settings.confidenceThreshold) {
                const rgb = this.hslToRgb(hue / 360, 0.7, 0.5);
                const blend = this.settings.effectIntensity * 0.3;

                pixels[i] = pixels[i] * (1 - blend) + rgb[0] * blend;
                pixels[i + 1] = pixels[i + 1] * (1 - blend) + rgb[1] * blend;
                pixels[i + 2] = pixels[i + 2] * (1 - blend) + rgb[2] * blend;
            }
        }
    }

    applyEdgeGlow(pixels, mask, imageData) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const edgeStrength = this.settings.effectIntensity;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const maskValue = mask[idx] / 255;

                const neighbors = [
                    mask[((y - 1) * width + x) * 4] / 255,
                    mask[((y + 1) * width + x) * 4] / 255,
                    mask[(y * width + (x - 1)) * 4] / 255,
                    mask[(y * width + (x + 1)) * 4] / 255
                ];

                const isEdge = maskValue > this.settings.confidenceThreshold &&
                    neighbors.some(n => n < this.settings.confidenceThreshold);

                if (isEdge) {
                    pixels[idx] = Math.min(255, pixels[idx] + 100 * edgeStrength);
                    pixels[idx + 1] = Math.min(255, pixels[idx + 1] + 150 * edgeStrength);
                    pixels[idx + 2] = Math.min(255, pixels[idx + 2] + 200 * edgeStrength);
                }
            }
        }
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

    startProcessing() {
        const processFrame = async () => {
            if (this.video.readyState >= 2) {
                // Send frame to segmentation
                if (this.segmenter) {
                    await this.segmenter.send({ image: this.video });
                }
                // Only send to pose detector if detection is enabled
                if (this.poseDetector && this.poseDetectionEnabled) {
                    await this.poseDetector.send({ image: this.video });
                }
            }
            this.animationId = requestAnimationFrame(processFrame);
        };
        processFrame();
    }

    setupControls() {
        // Set background to white by default
        this.settings.backgroundColor = '#ffffff';
        this.backgroundLayer.setBackgroundColor(this.settings.backgroundColor);

        // Building overlay checkbox
        const buildingOverlayCheckbox = document.getElementById('buildingOverlay');
        if (buildingOverlayCheckbox) {
            // Set initial state
            buildingOverlayCheckbox.checked = this.settings.buildingOverlayEnabled;

            buildingOverlayCheckbox.addEventListener('change', () => {
                this.settings.buildingOverlayEnabled = buildingOverlayCheckbox.checked;

                if (this.settings.buildingOverlayEnabled) {
                    // Enable texture on building layer
                    this.buildingLayer.updateConfig({ textureType: 'image' });
                } else {
                    // Disable texture on building layer
                    this.buildingLayer.updateConfig({ textureType: 'none' });
                }
                console.log('Building overlay enabled:', this.settings.buildingOverlayEnabled);
            });
        }


        // Settings are now loaded from config, no sliders needed

        // Pose buttons are now directly in the Body Tracking section

        // Pose detection button
        const poseDetectionBtn = document.getElementById('poseDetection');
        if (poseDetectionBtn) {
            // Set initial state
            if (this.poseDetectionEnabled) {
                poseDetectionBtn.classList.add('active');
                poseDetectionBtn.innerHTML = '<span class="tracking-status">●</span> Auto Tracking ON';
            } else {
                poseDetectionBtn.classList.remove('active');
                poseDetectionBtn.innerHTML = '<span class="tracking-status">●</span> Auto Tracking OFF';
            }

            poseDetectionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Toggle the state
                this.poseDetectionEnabled = !this.poseDetectionEnabled;
                console.log('Button clicked! Pose detection enabled:', this.poseDetectionEnabled);

                if (this.poseDetectionEnabled) {
                    poseDetectionBtn.classList.add('active');
                    poseDetectionBtn.innerHTML = '<span class="tracking-status">●</span> Auto Tracking ON';
                    // Clear any simulated pose when re-enabling
                    this.isSimulatingPose = false;
                    this.currentSimulatedPose = null;
                    console.log('Auto tracking re-enabled, clearing simulated pose');
                } else {
                    poseDetectionBtn.classList.remove('active');
                    poseDetectionBtn.innerHTML = '<span class="tracking-status">●</span> Auto Tracking OFF';
                    // Clear poses and stop simulation when manually disabling
                    this.isSimulatingPose = false;
                    this.currentSimulatedPose = null;
                    this.poses = [];  // Clear detected poses
                    this.currentPose = 'neutral';  // Reset to neutral pose
                    console.log('Auto tracking disabled, poses cleared');
                }
            });
        }

        // Shoulder stickers checkbox
        const shoulderStickersCheckbox = document.getElementById('shoulderStickers');
        if (shoulderStickersCheckbox) {
            // Set initial state
            shoulderStickersCheckbox.checked = this.shoulderStickersEnabled;

            shoulderStickersCheckbox.addEventListener('change', () => {
                this.shoulderStickersEnabled = shoulderStickersCheckbox.checked;
                console.log('Shoulder stickers enabled:', this.shoulderStickersEnabled);

                // Clear person overlays when disabled
                if (!this.shoulderStickersEnabled) {
                    this.personOverlayImages.fill(null);
                }
            });
        }

        // Nature overlay checkbox
        const natureOverlayCheckbox = document.getElementById('natureOverlay');
        if (natureOverlayCheckbox) {
            // Set initial state
            natureOverlayCheckbox.checked = true;

            natureOverlayCheckbox.addEventListener('change', () => {
                const isEnabled = natureOverlayCheckbox.checked;
                console.log('Nature layer enabled:', isEnabled);

                // Force immediate re-render of nature layer
                const natureLayer = this.layerManager.getLayer('nature');
                if (natureLayer) {
                    if (isEnabled) {
                        // Ensure we have a valid overlay
                        if (!this.currentOverlay || !this.currentOverlay.image) {
                            this.currentOverlay = {
                                image: 'iguazu.png',
                                opacity: 1.0,
                                blendMode: 'normal'
                            };
                        }
                        console.log('Restoring nature overlay:', this.currentOverlay);
                        natureLayer.setOverlay(this.currentOverlay);
                        natureLayer.setEnabled(true);
                        // Force immediate render
                        natureLayer.invalidate();
                        this.layerManager.render({}, performance.now());
                    } else {
                        natureLayer.setEnabled(false);
                        // Clear the overlay canvas
                        if (this.overlayCanvas) {
                            const overlayCtx = this.overlayCanvas.getContext('2d');
                            overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                        }
                    }
                }
            });
        }

        // Pose test buttons
        const poseButtons = document.querySelectorAll('.pose-test-button');
        poseButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const poseType = button.getAttribute('data-pose');
                this.simulatePose(poseType);

                // Visual feedback
                poseButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Auto-deactivate after 2 seconds
                setTimeout(() => {
                    button.classList.remove('active');
                }, 2000);
            });
        });

        // Display controls
        this.setupDisplayControls();
    }

    setupDisplayControls() {
        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }


        // Skeleton/tracking toggle button
        const trackingToggleBtn = document.getElementById('trackingToggleBtn');
        if (trackingToggleBtn) {
            trackingToggleBtn.addEventListener('click', () => {
                this.toggleSkeletonVisibility();
            });
        }
    }

    async loadTextureConfig() {
        try {
            const response = await fetch('experience-config.json');
            const config = await response.json();
            this.textureConfig = config;
            this.poseMapping = config; // Same config file contains both

            // Load settings from config
            if (config.settings) {
                this.settings.confidenceThreshold = config.settings.segmentationQuality || 0.7;
                this.settings.effectIntensity = config.settings.effectIntensity || 0.95;
                this.settings.backgroundColor = config.settings.defaultBackgroundColor || '#1a1a2e';
            }
        } catch (error) {
            console.error('Failed to load experience config:', error);
            // Fallback to default configuration
            this.textureConfig = {
                textures: {
                    nature: [
                        { file: 'matterhorn.jpeg', name: 'Matterhorn', country: 'switzerland' },
                        { file: 'iguazu.png', name: 'Iguazu Falls', country: 'brazil' }
                    ],
                    buildings: []
                },
                poses: {},
                settings: {}
            };
            this.poseMapping = this.textureConfig;
        }
    }

    async loadPoseMapping() {
        // No longer needed as it's part of the unified config
        // This method is kept for compatibility but does nothing
    }

    simulatePose(poseType) {
        if (!this.poseMapping?.poses?.[poseType]) {
            console.warn(`Pose type "${poseType}" not found in configuration`);
            return;
        }

        // Store current pose state
        this.currentSimulatedPose = poseType;
        this.isSimulatingPose = true;

        // Disable automatic tracking when pose is manually selected
        this.poseDetectionEnabled = false;
        const poseDetectionBtn = document.getElementById('poseDetection');
        if (poseDetectionBtn) {
            poseDetectionBtn.classList.remove('active');
            poseDetectionBtn.innerHTML = '<span class="tracking-status">●</span> Auto Tracking OFF';
        }

        // Trigger texture mapping for this pose
        this.applyPoseTextures(poseType);

        console.log(`Simulating pose: ${poseType} - Auto tracking disabled`);
    }

    applyPoseTextures(poseType) {
        // Force update texture for the specified pose type
        this.currentPose = poseType;
        this.updateTextureForPose(poseType);

        // Immediately update nature layer
        const natureLayer = this.layerManager.getLayer('nature');
        if (natureLayer && this.currentOverlay) {
            natureLayer.setOverlay(this.currentOverlay);
            natureLayer.invalidate();
        }
    }

    // Multi-person shoulder sticker methods
    async loadShoulderStickerImages() {
        // Load all sticker image variants
        const allStickerImages = [
            'prime.svg', 'prime-tower.svg', 'tower-icon.svg',
            'cristo.svg', 'cristoredentor.svg'
        ];

        const imagePromises = allStickerImages.map(filename => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve({ filename, img });
                img.onerror = () => resolve({ filename, img: null });
                img.src = `images/${filename}`;
            });
        });

        const results = await Promise.all(imagePromises);
        let loadedCount = 0;

        results.forEach(({ filename, img }) => {
            if (img) {
                this.shoulderStickerImages.set(filename, img);
                loadedCount++;
                console.log(`✓ Loaded shoulder sticker variant: ${filename}`);
            } else {
                console.warn(`Failed to load shoulder sticker: ${filename}`);
            }
        });

        console.log(`✓ Loaded ${loadedCount}/${allStickerImages.length} shoulder sticker variants`);
    }

    analyzePersonPose(poses, personIndex) {
        if (!poses || poses.length <= personIndex) return 'unknown';

        const pose = poses[personIndex];
        if (!pose || !pose.keypoints) return 'unknown';

        // Get key landmarks for pose detection
        const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
        const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
        const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
        const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
        const nose = pose.keypoints.find(kp => kp.name === 'nose');

        if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || !nose) {
            return 'unknown';
        }

        // Check confidence levels
        const minConfidence = 0.3;
        if (leftShoulder.score < minConfidence || rightShoulder.score < minConfidence ||
            leftWrist.score < minConfidence || rightWrist.score < minConfidence ||
            nose.score < minConfidence) {
            return 'unknown';
        }

        // Cristo Redentor pose: arms extended horizontally
        const leftArmHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 50;
        const rightArmHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 50;
        const armsExtended = (leftWrist.x < leftShoulder.x - 80) && (rightWrist.x > rightShoulder.x + 80);

        if (leftArmHorizontal && rightArmHorizontal && armsExtended) {
            return 'cristo';
        }

        // Prime Tower pose: both hands on top of head
        const handsAboveHead = leftWrist.y < nose.y - 50 && rightWrist.y < nose.y - 50;
        const handsClose = Math.abs(leftWrist.x - rightWrist.x) < 100;
        const handsCentered = Math.abs((leftWrist.x + rightWrist.x) / 2 - nose.x) < 60;

        if (handsAboveHead && handsClose && handsCentered) {
            return 'prime';
        }

        return 'unknown';
    }

    resizePersonArrays(newSize) {
        while (this.personStates.length < newSize) {
            this.personStates.push('unknown');
            this.personStableStates.push('unknown');
            this.personStableCounters.push(0);
            this.personOverlayImages.push(null);
        }

        // Trim arrays if needed
        this.personStates.splice(newSize);
        this.personStableStates.splice(newSize);
        this.personStableCounters.splice(newSize);
        this.personOverlayImages.splice(newSize);
    }

    processPersonStateChange(personIndex, detectedPose) {
        // Initialize if needed
        this.resizePersonArrays(personIndex + 1);

        const currentState = this.personStates[personIndex];

        if (detectedPose === currentState) {
            this.personStableCounters[personIndex]++;
        } else {
            this.personStableCounters[personIndex] = 0;
            this.personStates[personIndex] = detectedPose;
        }

        // Check if pose is stable
        if (this.personStableCounters[personIndex] >= this.STABLE_FRAMES &&
            this.personStableStates[personIndex] !== detectedPose) {

            this.personStableStates[personIndex] = detectedPose;

            // Select new sticker image for this person
            if (detectedPose !== 'unknown') {
                this.selectStickerImageFor(personIndex, detectedPose);
                console.log(`Person ${personIndex + 1} stable pose: ${detectedPose}`);
            } else {
                this.personOverlayImages[personIndex] = null;
            }
        }
    }

    selectStickerImageFor(personIndex, poseType) {
        // Map pose types to image files with multiple variants
        const poseImageMap = {
            'prime': ['prime.svg', 'prime-tower.svg', 'tower-icon.svg'],
            'cristo': ['cristo.svg', 'cristoredentor.svg', 'cristoredentor.svg']
        };

        const availableImages = poseImageMap[poseType];
        if (!availableImages || availableImages.length === 0) {
            this.personOverlayImages[personIndex] = null;
            return;
        }

        // Select random image from available options
        const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
        const img = this.shoulderStickerImages.get(selectedImage);

        if (img) {
            this.personOverlayImages[personIndex] = img;
            console.log(`Person ${personIndex + 1} assigned sticker variant: ${selectedImage} (${availableImages.indexOf(selectedImage) + 1}/${availableImages.length})`);
        } else {
            this.personOverlayImages[personIndex] = null;
            console.warn(`Sticker image not found for person ${personIndex + 1}: ${selectedImage}`);
        }
    }

    drawPersonShoulderSticker(pose, personIndex) {
        if (!this.shoulderStickersEnabled || !this.personOverlayImages[personIndex]) {
            return;
        }

        const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
        const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');

        if (!leftShoulder || !rightShoulder ||
            leftShoulder.score < 0.3 || rightShoulder.score < 0.3) {
            return;
        }

        // Calculate shoulder center and sticker dimensions
        const centerX = (leftShoulder.x + rightShoulder.x) / 2;
        const centerY = (leftShoulder.y + rightShoulder.y) / 2;
        const shoulderDistance = Math.abs(rightShoulder.x - leftShoulder.x);
        const stickerSize = Math.max(shoulderDistance * 1.2, 60);

        // Draw the sticker
        this.ctx.save();
        this.ctx.globalAlpha = 0.9;
        this.ctx.drawImage(
            this.personOverlayImages[personIndex],
            centerX - stickerSize / 2,
            centerY - stickerSize / 2,
            stickerSize,
            stickerSize
        );
        this.ctx.restore();
    }

    convertLandmarksToKeypoints(landmarks) {
        // Convert MediaPipe landmarks to format expected by shoulder sticker function
        return [
            { name: 'nose', x: landmarks[0].x * this.canvas.width, y: landmarks[0].y * this.canvas.height, score: landmarks[0].visibility },
            { name: 'left_shoulder', x: landmarks[11].x * this.canvas.width, y: landmarks[11].y * this.canvas.height, score: landmarks[11].visibility },
            { name: 'right_shoulder', x: landmarks[12].x * this.canvas.width, y: landmarks[12].y * this.canvas.height, score: landmarks[12].visibility },
            { name: 'left_wrist', x: landmarks[15].x * this.canvas.width, y: landmarks[15].y * this.canvas.height, score: landmarks[15].visibility },
            { name: 'right_wrist', x: landmarks[16].x * this.canvas.width, y: landmarks[16].y * this.canvas.height, score: landmarks[16].visibility }
        ];
    }

    // Display control methods
    toggleFullscreen() {
        const sidebar = document.querySelector('.sidebar');

        console.log('Fullscreen toggle clicked');
        console.log('Current fullscreen element:', document.fullscreenElement);
        console.log('Fullscreen enabled:', document.fullscreenEnabled);

        if (!document.fullscreenElement) {
            // Enter fullscreen
            console.log('Attempting to enter fullscreen...');

            if (document.documentElement.requestFullscreen) {
                console.log('Using standard requestFullscreen');
                document.documentElement.requestFullscreen().then(() => {
                    console.log('Successfully entered fullscreen');
                    // Auto-hide sidebar in fullscreen
                    if (sidebar) {
                        sidebar.style.transform = 'translateX(-100%)';
                    }
                    this.onFullscreenChange(true);
                }).catch(err => {
                    console.error('Failed to enter fullscreen:', err);
                });
            } else if (document.documentElement.webkitRequestFullscreen) {
                console.log('Using webkit requestFullscreen');
                document.documentElement.webkitRequestFullscreen();
                setTimeout(() => {
                    if (sidebar) sidebar.style.transform = 'translateX(-100%)';
                    this.onFullscreenChange(true);
                }, 100);
            } else if (document.documentElement.mozRequestFullScreen) {
                console.log('Using moz requestFullScreen');
                document.documentElement.mozRequestFullScreen();
                setTimeout(() => {
                    if (sidebar) sidebar.style.transform = 'translateX(-100%)';
                    this.onFullscreenChange(true);
                }, 100);
            } else {
                console.warn('Fullscreen API not supported');
                alert('Fullscreen is not supported in this browser');
            }
        } else {
            // Exit fullscreen
            console.log('Attempting to exit fullscreen...');

            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => {
                    console.log('Successfully exited fullscreen');
                    this.onFullscreenChange(false);
                }).catch(err => {
                    console.error('Failed to exit fullscreen:', err);
                });
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
                setTimeout(() => this.onFullscreenChange(false), 100);
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
                setTimeout(() => this.onFullscreenChange(false), 100);
            }
        }
    }

    onFullscreenChange(isFullscreen) {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const sidebar = document.querySelector('.sidebar');

        if (isFullscreen) {
            // Update button text and hide sidebar
            if (fullscreenBtn) fullscreenBtn.innerHTML = '📱 Exit Fullscreen';
            if (sidebar) sidebar.style.transform = 'translateX(-100%)';

            // Scale canvas to fit screen
            this.scaleCanvasForFullscreen();
        } else {
            // Restore normal view
            if (fullscreenBtn) fullscreenBtn.innerHTML = '📺 Fullscreen';
            if (sidebar) sidebar.style.transform = 'translateX(0)';

            // Restore original canvas size
            this.restoreCanvasSize();
        }
    }

    scaleCanvasForFullscreen() {
        const canvas = this.canvas;
        const overlayCanvas = this.overlayCanvas;
        const videoContainer = document.querySelector('.video-container');

        // Store original styles
        this.originalCanvasStyles = {
            canvas: {
                width: canvas.style.width,
                height: canvas.style.height,
                position: canvas.style.position,
                top: canvas.style.top,
                left: canvas.style.left,
                transform: canvas.style.transform,
                zIndex: canvas.style.zIndex
            },
            overlay: {
                width: overlayCanvas.style.width,
                height: overlayCanvas.style.height,
                position: overlayCanvas.style.position,
                top: overlayCanvas.style.top,
                left: overlayCanvas.style.left,
                transform: overlayCanvas.style.transform,
                zIndex: overlayCanvas.style.zIndex
            },
            container: {
                position: videoContainer?.style.position,
                width: videoContainer?.style.width,
                height: videoContainer?.style.height,
                top: videoContainer?.style.top,
                left: videoContainer?.style.left,
                transform: videoContainer?.style.transform,
                zIndex: videoContainer?.style.zIndex
            }
        };

        // Scale to screen size while maintaining aspect ratio
        const scaleX = window.innerWidth / canvas.width;
        const scaleY = window.innerHeight / canvas.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = canvas.width * scale;
        const scaledHeight = canvas.height * scale;

        // Position video container for fullscreen
        if (videoContainer) {
            videoContainer.style.position = 'fixed';
            videoContainer.style.top = '50%';
            videoContainer.style.left = '50%';
            videoContainer.style.transform = 'translate(-50%, -50%)';
            videoContainer.style.width = `${scaledWidth}px`;
            videoContainer.style.height = `${scaledHeight}px`;
            videoContainer.style.zIndex = '1000';
        }

        // Scale canvases
        canvas.style.width = `${scaledWidth}px`;
        canvas.style.height = `${scaledHeight}px`;
        overlayCanvas.style.width = `${scaledWidth}px`;
        overlayCanvas.style.height = `${scaledHeight}px`;
    }

    restoreCanvasSize() {
        const canvas = this.canvas;
        const overlayCanvas = this.overlayCanvas;
        const videoContainer = document.querySelector('.video-container');

        // Restore original styles if they were stored
        if (this.originalCanvasStyles) {
            // Restore canvas styles
            Object.assign(canvas.style, this.originalCanvasStyles.canvas);
            Object.assign(overlayCanvas.style, this.originalCanvasStyles.overlay);

            // Restore container styles
            if (videoContainer && this.originalCanvasStyles.container) {
                Object.assign(videoContainer.style, this.originalCanvasStyles.container);
            }

            this.originalCanvasStyles = null;
        } else {
            // Fallback: clear inline styles
            canvas.style.width = '';
            canvas.style.height = '';
            canvas.style.position = '';
            canvas.style.top = '';
            canvas.style.left = '';
            canvas.style.transform = '';
            canvas.style.zIndex = '';

            overlayCanvas.style.width = '';
            overlayCanvas.style.height = '';
            overlayCanvas.style.position = '';
            overlayCanvas.style.top = '';
            overlayCanvas.style.left = '';
            overlayCanvas.style.transform = '';
            overlayCanvas.style.zIndex = '';

            if (videoContainer) {
                videoContainer.style.position = '';
                videoContainer.style.width = '';
                videoContainer.style.height = '';
                videoContainer.style.top = '';
                videoContainer.style.left = '';
                videoContainer.style.transform = '';
                videoContainer.style.zIndex = '';
            }
        }
    }


    toggleSkeletonVisibility() {
        const trackingToggleBtn = document.getElementById('trackingToggleBtn');

        // Toggle skeleton visibility in config
        if (this.textureConfig?.settings) {
            this.textureConfig.settings.showPoseKeypoints = !this.textureConfig.settings.showPoseKeypoints;
        } else {
            this.skeletonVisible = !this.skeletonVisible;
        }

        const isVisible = this.textureConfig?.settings?.showPoseKeypoints || this.skeletonVisible;

        if (trackingToggleBtn) {
            trackingToggleBtn.innerHTML = isVisible ? '🦴 Hide Skeleton' : '🦴 Show Skeleton';
        }
    }


    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PersonSegmentation();
});