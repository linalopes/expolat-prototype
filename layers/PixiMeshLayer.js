/**
 * PixiJS Mesh Layer
 * Handles real-time mesh animation based on pose landmarks
 */
class PixiMeshLayer extends BaseLayer {
    constructor(config = {}) {
        console.log('PixiMeshLayer constructor called');
        super('pixiMesh', {
            zIndex: 15, // Above nature layer but below UI
            pixiContainer: null,
            debugMode: true, // Debug mode matches default checkbox state
            ...config
        });

        this.pixiApp = null;
        this.meshes = new Map(); // Store meshes for each person
        this.debugGraphics = null;
        this.landmarkMappings = new Map(); // Store landmark-to-vertex mappings

        // Animation settings
        this.smoothingFactor = 0.8;
        this.minConfidence = 0.5;
        this.maxFPS = 30; // Limit animation FPS for performance
        this.lastUpdateTime = 0;

        // Mesh configuration
        this.meshConfig = {
            rows: 4,    // Number of vertex rows
            cols: 4,    // Number of vertex columns
            width: 300, // Larger mesh width for better visibility
            height: 400 // Larger mesh height for better visibility
        };

        // Disable wireframe to see textures clearly
        this.config = this.config || {};
        this.config.wireframeMode = false;

        // Initialize PixiJS when layer is created
        console.log('About to call initPixiJS');
        this.initPixiJS();
        console.log('initPixiJS completed');
    }

    onInit() {
        console.log('PixiMeshLayer onInit() called');

        // Set up PixiJS application
        console.log('About to call setupPixiApp from onInit');
        this.setupPixiApp();
        console.log('setupPixiApp call completed from onInit');
    }

    initPixiJS() {
        // This will be called during construction
        console.log('Initializing PixiJS application...');
    }

    async setupPixiApp() {
        console.log('setupPixiApp called');
        try {
            // Check if PIXI is available
            if (typeof PIXI === 'undefined') {
                console.error('PixiJS library not loaded');
                return;
            }
            console.log('✓ PixiJS library available');

            const container = document.getElementById('pixiContainer');
            if (!container) {
                console.error('PixiJS container not found');
                return;
            }
            console.log('✓ PixiJS container found');

            // Initialize PixiJS application (async for v8.x)
            this.pixiApp = new PIXI.Application();

            await this.pixiApp.init({
                width: 800,
                height: 600,
                backgroundColor: 0x000000, // Transparent background
                backgroundAlpha: 0,
                premultipliedAlpha: false, // Fix black transparency issue
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            // Append PixiJS canvas to container
            container.appendChild(this.pixiApp.canvas);

            // Make sure the canvas is visible and positioned correctly
            this.pixiApp.canvas.style.position = 'absolute';
            this.pixiApp.canvas.style.top = '0';
            this.pixiApp.canvas.style.left = '0';
            this.pixiApp.canvas.style.zIndex = '100'; // Even higher z-index
            this.pixiApp.canvas.style.pointerEvents = 'none';
            this.pixiApp.canvas.style.opacity = '1.0'; // Ensure full opacity
            // Remove background color for production

            console.log('✅ PixiJS canvas positioned and styled');

            // DEBUG: Check if canvas is actually in the DOM
            const canvasInDom = document.querySelector('#pixiContainer canvas');
            console.log('🔍 Canvas in DOM:', !!canvasInDom);
            console.log('🔍 Canvas element:', this.pixiApp.canvas);
            console.log('🔍 Canvas parent:', this.pixiApp.canvas.parentElement);
            console.log('🔍 Canvas computed style:', window.getComputedStyle(this.pixiApp.canvas));

            // Set up debug graphics for development
            if (this.config.debugMode) {
                this.debugGraphics = new PIXI.Graphics();
                this.pixiApp.stage.addChild(this.debugGraphics);
            }

            // Create test mesh with PNG texture
            console.log('About to create test mesh...');
            this.createTestMesh().catch(error => {
                console.error('Failed to create test mesh:', error);
            });
            console.log('Test mesh creation initiated');

            console.log('✓ PixiJS application created successfully');

            // Start render loop for continuous rendering
            this.pixiApp.ticker.add(() => {
                // This ensures the stage is rendered every frame
                // Without this, graphics won't be visible
            });
            console.log('✓ PixiJS render loop started');

        } catch (error) {
            console.error('Failed to create PixiJS application:', error);
            this.pixiApp = null; // Reset to null on failure
        }
    }

    async onRender(inputData, timestamp) {
        // Use the pose already detected by segmentation.js
        if (inputData.currentPose) {
            const poseType = inputData.currentPose;

            // Only log pose changes
            if (this.lastLoggedPoseType !== poseType) {
                const ts = new Date().toLocaleTimeString();
                console.log(`📍 [${ts}] PixiMeshLayer received pose: "${this.lastLoggedPoseType}" → "${poseType}"`);
                this.lastLoggedPoseType = poseType;
            }

            // Apply pose effects and texture switching
            this.applyPoseEffects('test', poseType, timestamp);
        }

        // Only log setup attempts, not every render call
        if (!this.pixiApp) {
            console.log('PixiJS app not ready, attempting setup...');
            // Try to set up PixiJS if it's not ready yet
            await this.setupPixiApp();
            if (!this.pixiApp) {
                console.log('PixiJS setup failed');
                return false; // Setup failed
            }
            console.log('PixiJS setup completed successfully');
        }

        // If meshes are empty, try to create test mesh (only log once)
        if (this.meshes.size === 0) {
            console.log('No meshes found, creating test mesh...');
            this.createTestMesh().catch(error => {
                console.error('Failed to create test mesh:', error);
            });
        }

        // Update PixiJS application size to match canvas if needed
        this.updatePixiSize();

        // Process pose data for mesh animation
        if (inputData.poses && inputData.poses.length > 0) {
            this.updateMeshesFromPoses(inputData.poses, timestamp);
        }

        // Clear debug graphics and redraw
        if (this.debugGraphics && this.config.debugMode) {
            this.debugGraphics.clear();
            this.drawDebugInfo(inputData.poses);
        }

        return true;
    }

    updatePixiSize() {
        if (!this.pixiApp || !this.pixiApp.canvas) return;

        // Get dimensions from the video canvas or fallback to window size
        const videoCanvas = document.getElementById('outputCanvas');
        let canvasWidth = 800;
        let canvasHeight = 600;

        if (videoCanvas) {
            canvasWidth = videoCanvas.width || 800;
            canvasHeight = videoCanvas.height || 600;
        } else {
            // Fallback to window dimensions
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
        }

        // Update PixiJS renderer size if it doesn't match
        if (this.pixiApp.renderer.width !== canvasWidth ||
            this.pixiApp.renderer.height !== canvasHeight) {

            this.pixiApp.renderer.resize(canvasWidth, canvasHeight);
            console.log(`PixiJS resized to ${canvasWidth}x${canvasHeight}`);
        }
    }

    updateMeshesFromPoses(poses, timestamp) {
        if (!poses || poses.length === 0) {
            console.log('No poses detected');
            return;
        }

        // Check if PixiJS is set up, if not try to set it up
        if (!this.pixiApp) {
            console.log('PixiJS app not ready in updateMeshesFromPoses, attempting setup...');
            this.setupPixiApp();
            return; // Skip this frame, setup is async
        }

        // Check if meshes exist, if not create them
        if (this.meshes.size === 0) {
            console.log('No meshes found in updateMeshesFromPoses, creating test mesh...');
            this.createTestMesh().catch(error => {
                console.error('Failed to create test mesh:', error);
            });
            return; // Skip this frame, let mesh creation complete
        }

        // Performance optimization: limit update frequency
        const timeSinceLastUpdate = timestamp - this.lastUpdateTime;
        const minUpdateInterval = 1000 / this.maxFPS; // ms between updates

        if (timeSinceLastUpdate < minUpdateInterval) {
            return; // Skip this frame to maintain target FPS
        }

        this.lastUpdateTime = timestamp;

        // Update test mesh based on first person's pose
        const pose = poses[0];
        if (pose && pose.poseLandmarks) {
            // Update mesh vertices based on landmarks
            this.updateMeshFromLandmarks('test', pose.poseLandmarks);
        }
    }

    detectPoseType(landmarks) {
        // Simple pose detection based on landmark positions (matching segmentation.js)
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        const nose = landmarks[0];

        // Check for Jesus/Warrior pose (arms extended horizontally)
        const leftArmHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 0.1;
        const rightArmHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 0.1;
        const armsExtended = (leftWrist.x < leftShoulder.x - 0.1) && (rightWrist.x > rightShoulder.x + 0.1);

        if (leftArmHorizontal && rightArmHorizontal && armsExtended) {
            return 'warrior'; // Match segmentation.js naming
        }

        // Check for Mountain pose (hands above head)
        const handsAboveHead = leftWrist.y < nose.y - 0.1 && rightWrist.y < nose.y - 0.1;
        const handsClose = Math.abs(leftWrist.x - rightWrist.x) < 0.2;

        if (handsAboveHead && handsClose) {
            return 'mountain';
        }

        return 'neutral';
    }

    applyPoseEffects(meshId, poseType, timestamp) {
        const mesh = this.meshes.get(meshId);
        if (!mesh) return;

        // Check if we need to change texture based on pose
        this.updateMeshTextureForPose(meshId, poseType);

        // Apply pose-responsive scaling and positioning
        this.updateMeshSizeAndPosition(mesh, poseType, timestamp);
    }

    updateMeshSizeAndPosition(mesh, poseType, timestamp) {
        // Base scaling factors for different poses (matching segmentation.js pose names)
        let scaleX = 1.0;
        let scaleY = 1.0;

        switch (poseType) {
            case 'jesus':
            case 'warrior':
                // Arms extended: wider mesh for outstretched arms
                scaleX = 1.4;
                scaleY = 1.1;
                // Subtle breathing animation
                const extendedBreath = 1.0 + Math.sin(timestamp * 0.003) * 0.02;
                scaleY *= extendedBreath;
                break;

            case 'mountain':
            case 'tree':
                // Arms up: taller mesh for raised arms
                scaleX = 0.9;
                scaleY = 1.3;
                // Slight upward stretch animation
                const upwardStretch = 1.0 + Math.sin(timestamp * 0.004) * 0.03;
                scaleY *= upwardStretch;
                break;

            default:
                // Neutral pose: natural proportions
                scaleX = 1.0;
                scaleY = 1.0;
                // Gentle breathing
                const neutralBreath = 1.0 + Math.sin(timestamp * 0.002) * 0.015;
                scaleY *= neutralBreath;
                break;
        }

        // Apply scaling
        mesh.scale.set(scaleX, scaleY);
    }

    updateMeshTextureForPose(meshId, poseType) {
        const timestamp = new Date().toLocaleTimeString();

        // Initialize tracking objects if needed
        if (!this.currentMeshTextures) this.currentMeshTextures = new Map();
        if (!this.lastTextureChange) this.lastTextureChange = new Map();
        if (!this.lastPoseType) this.lastPoseType = new Map();

        const now = Date.now();
        const lastChange = this.lastTextureChange.get(meshId) || 0;
        const timeSinceLastChange = now - lastChange;

        // If pose changed, start stability timer
        if (this.lastPoseType.get(meshId) !== poseType) {
            console.log(`⏱️ [${timestamp}] Pose change detected: "${this.lastPoseType.get(meshId)}" → "${poseType}" - Starting 1000ms stability timer`);
            this.lastPoseType.set(meshId, poseType);
            this.poseChangeTime = now;
            return; // Wait for pose to stabilize
        }

        // Check if pose has been stable for at least 1000ms (1 second)
        const poseStableTime = now - (this.poseChangeTime || 0);
        if (poseStableTime < 1000) {
            // Log every 200ms to show progress
            if (Math.floor(poseStableTime / 200) !== Math.floor((poseStableTime - 16) / 200)) {
                console.log(`⏳ [${timestamp}] Pose "${poseType}" stable for ${Math.floor(poseStableTime)}ms / 1000ms`);
            }
            return; // Pose not stable yet
        }

        // Prevent too rapid switching
        if (timeSinceLastChange < 2000) {
            console.log(`🚫 [${timestamp}] Too soon to switch again (${timeSinceLastChange}ms < 2000ms)`);
            return; // Don't switch too frequently
        }

        // Map pose types to texture files (matching actual segmentation.js pose names)
        const poseTextures = {
            'mountain': 'images/prime.png',        // Arms up -> Prime Tower
            'jesus': 'images/cristoredentor.png',  // Arms out -> Cristo Redentor
            'tree': 'images/prime.png',           // Tree pose -> Prime Tower
            'warrior': 'images/cristoredentor.png', // Warrior -> Cristo Redentor
            'Warrior': 'images/cristoredentor.png', // Capitalized Warrior -> Cristo Redentor
            'neutral': 'images/neutral.png'       // Default pose
        };

        const targetTexture = poseTextures[poseType] || poseTextures['neutral'];
        const mesh = this.meshes.get(meshId);

        // Only update if texture actually changed for this mesh
        if (this.currentMeshTextures.get(meshId) !== targetTexture) {
            console.log(`🔄 Switching mesh texture: ${poseType} -> ${targetTexture}`);
            this.currentMeshTextures.set(meshId, targetTexture);
            this.lastTextureChange.set(meshId, now);

            // Don't await to avoid blocking the render loop
            this.setMeshTexture(meshId, targetTexture).catch(error => {
                console.error('Failed to set mesh texture:', error);
            });
        }
    }

    updateMeshFromLandmarks(meshId, landmarks) {
        const mesh = this.meshes.get(meshId);
        const landmarkMapping = this.landmarkMappings.get(meshId);

        if (!mesh || !landmarkMapping) {
            // Only log once when mesh is missing
            if (!this.meshMissingLogged) {
                console.log('Mesh or landmark mapping not found for', meshId);
                console.log('Available meshes:', Array.from(this.meshes.keys()));
                console.log('Available landmark mappings:', Array.from(this.landmarkMappings.keys()));
                this.meshMissingLogged = true;
            }
            return;
        }

        // Reset the missing log flag since we found the mesh
        this.meshMissingLogged = false;

        const geometry = mesh.geometry;

        // Check if geometry and buffer exist
        if (!geometry) {
            console.error('Mesh geometry not found');
            return;
        }

        // Try simple mesh deformation approach for PixiJS 8.x
        try {
            // Apply simple scaling and rotation effects based on landmarks
            const nose = this.landmarkToPixi(landmarks[0]);
            const leftShoulder = this.landmarkToPixi(landmarks[11]);
            const rightShoulder = this.landmarkToPixi(landmarks[12]);

            // Calculate head tilt
            const shoulderDiff = leftShoulder.y - rightShoulder.y;
            const headTilt = Math.atan2(shoulderDiff, Math.abs(leftShoulder.x - rightShoulder.x));

            // Apply rotation to mesh
            mesh.rotation = headTilt * 0.5; // Gentle tilt following head

            // Scale based on shoulder width (don't override pose-based scaling)
            // This is handled by updateMeshSizeAndPosition instead

            // Position mesh to follow torso center (between shoulders and hips)
            const torsoX = (leftShoulder.x + rightShoulder.x) / 2;
            const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;

            // Center mesh on torso for clothing effect
            mesh.x = torsoX - this.meshConfig.width / 2;
            mesh.y = shoulderY - this.meshConfig.height * 0.3; // Offset upward to cover torso properly

            // Removed debug spam

        } catch (error) {
            console.log('🔴 MESH: Transform error:', error.message);
        }

        // Re-enable vertex deformation for clothing-like behavior
        this.applyVertexDeformation(mesh, landmarks);
    }

    applyVertexDeformation(mesh, landmarks) {
        const landmarkMapping = this.landmarkMappings.get('test');
        if (!landmarkMapping) return;

        const geometry = mesh.geometry;

        try {
            // Get vertex buffer
            const vertexBuffer = geometry.getBuffer('aPosition');
            if (!vertexBuffer || !vertexBuffer.data) return;

            // Apply controlled deformation to mapped vertices
            landmarkMapping.forEach((mapping, vertexIndex) => {
                // Calculate target position from landmarks
                let targetX = 0, targetY = 0, weightSum = 0;

                mapping.landmarks.forEach(landmarkIndex => {
                    if (landmarks[landmarkIndex] && landmarks[landmarkIndex].visibility > 0.5) {
                        const landmark = this.landmarkToPixi(landmarks[landmarkIndex]);
                        targetX += landmark.x;
                        targetY += landmark.y;
                        weightSum += 1;
                    }
                });

                if (weightSum > 0) {
                    // Average landmark positions
                    targetX /= weightSum;
                    targetY /= weightSum;

                    // Apply offset and convert to mesh-local coordinates
                    const meshLocalX = (targetX - mesh.x) + mapping.offset.x;
                    const meshLocalY = (targetY - mesh.y) + mapping.offset.y;

                    // Apply influence (how much this vertex follows the landmark)
                    const currentX = vertexBuffer.data[vertexIndex * 2];
                    const currentY = vertexBuffer.data[vertexIndex * 2 + 1];

                    vertexBuffer.data[vertexIndex * 2] = currentX + (meshLocalX - currentX) * mapping.influence * 0.3; // Gentle influence
                    vertexBuffer.data[vertexIndex * 2 + 1] = currentY + (meshLocalY - currentY) * mapping.influence * 0.3;
                }
            });

            // Update the vertex buffer
            vertexBuffer.update();

        } catch (error) {
            console.log('Vertex deformation error:', error.message);
        }
    }

    // Utility method to convert MediaPipe landmarks to PixiJS coordinates
    landmarkToPixi(landmark) {
        return {
            x: landmark.x * this.pixiApp.renderer.width,
            y: landmark.y * this.pixiApp.renderer.height
        };
    }

    drawDebugInfo(poses) {
        if (!this.debugGraphics || !poses) return;

        // Draw debug landmarks as dots
        poses.forEach((pose, personIndex) => {
            if (pose.poseLandmarks) {
                // Detect pose type for debug display
                const poseType = this.detectPoseType(pose.poseLandmarks);

                // Pose type is now displayed in the debug panel instead of overlay

                pose.poseLandmarks.forEach((landmark, index) => {
                    if (landmark.visibility > this.minConfidence) {
                        const x = landmark.x * this.pixiApp.renderer.width;
                        const y = landmark.y * this.pixiApp.renderer.height;

                        // Different colors for different landmark types
                        let color = 0xFFFFFF; // White default
                        if ([11, 12].includes(index)) color = 0xFF0000; // Red for shoulders
                        if ([15, 16].includes(index)) color = 0x00FF00; // Green for wrists
                        if (index === 0) color = 0x0000FF; // Blue for nose

                        this.debugGraphics.beginFill(color, 0.8);
                        this.debugGraphics.drawCircle(x, y, 5);
                        this.debugGraphics.endFill();

                        // Draw connecting lines for key joints
                        if (index === 11 && pose.poseLandmarks[15].visibility > this.minConfidence) {
                            // Left shoulder to left wrist
                            const wristX = pose.poseLandmarks[15].x * this.pixiApp.renderer.width;
                            const wristY = pose.poseLandmarks[15].y * this.pixiApp.renderer.height;
                            this.debugGraphics.lineStyle(2, 0xFF0000, 0.6);
                            this.debugGraphics.moveTo(x, y);
                            this.debugGraphics.lineTo(wristX, wristY);
                        }

                        if (index === 12 && pose.poseLandmarks[16].visibility > this.minConfidence) {
                            // Right shoulder to right wrist
                            const wristX = pose.poseLandmarks[16].x * this.pixiApp.renderer.width;
                            const wristY = pose.poseLandmarks[16].y * this.pixiApp.renderer.height;
                            this.debugGraphics.lineStyle(2, 0xFF0000, 0.6);
                            this.debugGraphics.moveTo(x, y);
                            this.debugGraphics.lineTo(wristX, wristY);
                        }
                    }
                });
            }
        });
    }

    shouldRender(inputData, timestamp) {
        // Always render for now to test animation
        return true;
    }

    setEnabled(enabled) {
        super.setEnabled(enabled);
        if (this.pixiApp) {
            this.pixiApp.stage.visible = enabled;
        }
    }

    setOpacity(opacity) {
        super.setOpacity(opacity);
        if (this.pixiApp && this.pixiApp.stage) {
            this.pixiApp.stage.alpha = opacity;
        }
    }

    destroy() {
        super.destroy();

        // Clean up PixiJS resources
        if (this.pixiApp) {
            this.pixiApp.destroy(true, true);
            this.pixiApp = null;
        }

        this.meshes.clear();
        this.landmarkMappings.clear();

        console.log('PixiMeshLayer destroyed');
    }

    // Utility method to convert MediaPipe landmarks to PixiJS coordinates
    landmarkToPixi(landmark) {
        return {
            x: landmark.x * this.pixiApp.renderer.width,
            y: landmark.y * this.pixiApp.renderer.height,
            confidence: landmark.visibility
        };
    }

    // Method to enable/disable debug mode
    setDebugMode(enabled) {
        this.config.debugMode = enabled;
        if (this.debugGraphics) {
            this.debugGraphics.visible = enabled;
        }
    }

    // Method to enable/disable wireframe mode
    setWireframeMode(enabled) {
        console.log('🔧 setWireframeMode called with:', enabled);
        console.log('🔧 PixiJS app exists:', !!this.pixiApp);
        console.log('🔧 Meshes count:', this.meshes.size);
        console.log('🔧 Combined condition:', enabled && this.pixiApp && this.meshes.size > 0);

        this.config.wireframeMode = enabled;

        // Clear existing wireframe graphics
        if (this.wireframeGraphics) {
            this.pixiApp.stage.removeChild(this.wireframeGraphics);
            this.wireframeGraphics = null;
        }

        if (enabled && this.pixiApp && this.meshes.size > 0) {
            console.log('✅ Creating wireframe graphics...');
            // Create wireframe graphics
            this.wireframeGraphics = new PIXI.Graphics();
            this.wireframeGraphics.zIndex = 1000; // High z-index to ensure it's on top
            this.wireframeGraphics.visible = true;
            this.wireframeGraphics.renderable = true;
            this.wireframeGraphics.cullable = false; // Prevent culling issues
            this.wireframeGraphics.alpha = 1.0;

            // Draw initial wireframe
            this.drawWireframes();

            // Add to stage
            this.pixiApp.stage.addChild(this.wireframeGraphics);

            // Force renderer to update
            this.pixiApp.renderer.render(this.pixiApp.stage);

            // Debug: Check stage and canvas visibility
            console.log('✅ Wireframes added to stage');
            console.log('🔧 Stage children count:', this.pixiApp.stage.children.length);
            console.log('🔧 Wireframe graphics parent:', this.wireframeGraphics.parent?.constructor.name);
            console.log('🔧 Wireframe graphics visible:', this.wireframeGraphics.visible);
            console.log('🔧 Wireframe graphics alpha:', this.wireframeGraphics.alpha);
            console.log('🔧 Canvas display style:', this.pixiApp.canvas.style.display);
            console.log('🔧 Canvas z-index:', this.pixiApp.canvas.style.zIndex);
            console.log('🔧 Canvas dimensions:', this.pixiApp.canvas.width, 'x', this.pixiApp.canvas.height);
        } else if (enabled) {
            console.log('🔴 WIREFRAME: Cannot create - PixiJS app:', !!this.pixiApp, 'Meshes:', this.meshes.size);
        }

        // Keep mesh fully visible even with wireframe
        // (Wireframe is just an overlay, shouldn't affect mesh visibility)
        this.meshes.forEach((mesh) => {
            if (mesh && mesh.texture) {
                mesh.alpha = 1.0; // Always full opacity
                mesh.visible = true; // Always visible
            }
        });
    }

    drawWireframes() {
        console.log('🔧 drawWireframes called');
        console.log('🔧 wireframeGraphics exists:', !!this.wireframeGraphics);
        console.log('🔧 meshes count:', this.meshes.size);

        if (!this.wireframeGraphics) {
            console.log('❌ No wireframeGraphics - wireframe cannot be drawn');
            return;
        }

        this.wireframeGraphics.clear();

        // PixiJS 8 syntax: Use rect().stroke() instead of lineStyle/drawRect
        // TEST: Draw a visible test rectangle to confirm rendering works
        this.wireframeGraphics.rect(50, 50, 100, 150).stroke({ color: 0xff0000, width: 4 });
        console.log('🔧 Test rectangle drawn at (50,50) with v8 API');

        // Draw actual mesh wireframe
        this.meshes.forEach((mesh, meshId) => {
            console.log('🔧 Processing mesh:', meshId);
            console.log('🔧 Mesh exists:', !!mesh);
            console.log('🔧 Mesh geometry exists:', !!mesh?.geometry);

            if (!mesh || !mesh.geometry) return;

            try {
                // Get vertex buffer from geometry
                const vertexBuffer = mesh.geometry.getBuffer('aPosition');
                console.log('🔧 Vertex buffer exists:', !!vertexBuffer);
                console.log('🔧 Vertex buffer data exists:', !!vertexBuffer?.data);

                if (!vertexBuffer || !vertexBuffer.data) return;

                const vertices = vertexBuffer.data;
                const indices = mesh.geometry.getIndex()?.data;
                console.log('🔧 Vertices count:', vertices.length);
                console.log('🔧 Indices exist:', !!indices);
                console.log('🔧 Indices count:', indices?.length);

                if (!indices) {
                    console.log('🔧 Using fallback grid method');
                    // Fallback: draw grid based on mesh position
                    const x = mesh.x || 0;
                    const y = mesh.y || 0;
                    const w = this.meshConfig.width;
                    const h = this.meshConfig.height;
                    console.log('🔧 Grid position:', {x, y, w, h});

                    // Draw a 4x4 grid (no fill)
                    for (let i = 0; i <= 4; i++) {
                        // Vertical lines
                        this.wireframeGraphics.moveTo(x + (i * w / 4), y);
                        this.wireframeGraphics.lineTo(x + (i * w / 4), y + h);
                        // Horizontal lines
                        this.wireframeGraphics.moveTo(x, y + (i * h / 4));
                        this.wireframeGraphics.lineTo(x + w, y + (i * h / 4));
                    }
                    console.log('✅ Fallback grid drawn');
                    return;
                }

                console.log('🔧 Drawing triangles from indices...');
                console.log('🔧 Mesh position:', {x: mesh.x, y: mesh.y});
                console.log('🔧 Raw vertices:', Array.from(vertices));

                // Draw triangles from indices
                // Scale up the tiny 1x1 vertices to actual mesh size
                const scaleX = this.meshConfig.width;
                const scaleY = this.meshConfig.height;
                console.log('🔧 Scaling vertices by:', scaleX, 'x', scaleY);

                for (let i = 0; i < indices.length; i += 3) {
                    const idx1 = indices[i] * 2;
                    const idx2 = indices[i + 1] * 2;
                    const idx3 = indices[i + 2] * 2;

                    const x1 = vertices[idx1] * scaleX + mesh.x;
                    const y1 = vertices[idx1 + 1] * scaleY + mesh.y;
                    const x2 = vertices[idx2] * scaleX + mesh.x;
                    const y2 = vertices[idx2 + 1] * scaleY + mesh.y;
                    const x3 = vertices[idx3] * scaleX + mesh.x;
                    const y3 = vertices[idx3 + 1] * scaleY + mesh.y;

                    console.log(`🔧 Triangle ${i/3 + 1}: (${x1},${y1}) (${x2},${y2}) (${x3},${y3})`);

                    // Draw triangle edges
                    this.wireframeGraphics.moveTo(x1, y1);
                    this.wireframeGraphics.lineTo(x2, y2);
                    this.wireframeGraphics.lineTo(x3, y3);
                    this.wireframeGraphics.lineTo(x1, y1);
                }
                console.log('✅ Triangles drawn');

            } catch (error) {
                console.log('🔴 Wireframe error:', error.message);
            }
        });
    }

    drawWireframesQuiet() {
        if (!this.wireframeGraphics) return;

        // Clear and redraw
        this.wireframeGraphics.clear();

        this.meshes.forEach((mesh, meshId) => {
            if (!mesh || !mesh.geometry) return;

            try {
                const vertexBuffer = mesh.geometry.getBuffer('aPosition');
                if (!vertexBuffer || !vertexBuffer.data) return;

                const vertices = vertexBuffer.data;
                const indices = mesh.geometry.getIndex()?.data;

                if (!indices) {
                    // Fallback grid
                    const x = mesh.x || 0;
                    const y = mesh.y || 0;
                    const w = this.meshConfig.width;
                    const h = this.meshConfig.height;

                    for (let i = 0; i <= 4; i++) {
                        this.wireframeGraphics.moveTo(x + (i * w / 4), y);
                        this.wireframeGraphics.lineTo(x + (i * w / 4), y + h);
                        this.wireframeGraphics.moveTo(x, y + (i * h / 4));
                        this.wireframeGraphics.lineTo(x + w, y + (i * h / 4));
                    }
                    return;
                }

                // For a simple quad, just draw a rectangle grid
                // The mesh only has 8 vertices (4 corners x 2 coords)
                const x = mesh.x || 0;
                const y = mesh.y || 0;
                const w = this.meshConfig.width;
                const h = this.meshConfig.height;

                // Log every 10th frame to avoid spam
                if (!this.frameCounter) this.frameCounter = 0;
                this.frameCounter++;
                if (this.frameCounter % 10 === 0) {
                    console.log('🔧 Wireframe mesh position:', {x, y, w, h});
                }

                // PixiJS 8: Draw outer rectangle with new API
                this.wireframeGraphics.rect(x, y, w, h).stroke({ color: 0x00ff00, width: 3 });

                // Draw a 4x4 grid using PixiJS 8 API
                for (let i = 1; i < 4; i++) {
                    // Vertical lines
                    this.wireframeGraphics.moveTo(x + (i * w / 4), y)
                        .lineTo(x + (i * w / 4), y + h)
                        .stroke({ color: 0x00ff00, width: 2 });
                    // Horizontal lines
                    this.wireframeGraphics.moveTo(x, y + (i * h / 4))
                        .lineTo(x + w, y + (i * h / 4))
                        .stroke({ color: 0x00ff00, width: 2 });
                }

            } catch (error) {
                // Silent error handling for quiet mode
            }
        });

        // Force the renderer to update after drawing wireframes
        if (this.pixiApp && this.pixiApp.renderer) {
            this.pixiApp.renderer.render(this.pixiApp.stage);
        }
    }

    // Method to change mesh texture dynamically
    async setMeshTexture(meshId, texturePath) {
        const mesh = this.meshes.get(meshId);
        if (!mesh) {
            console.warn(`Mesh ${meshId} not found`);
            return;
        }

        try {
            // Use the exact same pattern that worked in our test
            console.log(`Loading texture: ${texturePath}`);

            // Texture switching now working properly
            const texture = await PIXI.Assets.load(texturePath);

            console.log(`✓ Texture loaded successfully: ${texturePath}`, {
                valid: texture.valid,
                width: texture.width,
                height: texture.height
            });

            // Apply texture regardless of valid flag - trust that it loaded
            mesh.texture = texture;
            console.log(`✓ Mesh ${meshId} texture applied: ${texturePath}`);

            // FORCE: Render immediately after texture change
            this.pixiApp.renderer.render(this.pixiApp.stage);
            console.log('🔧 Forced render after texture update');

        } catch (error) {
            console.error(`Error loading mesh texture for ${texturePath}:`, error);
            // Keep mesh visible with white texture for deformation visualization
            mesh.texture = PIXI.Texture.WHITE;
            console.log(`✓ Mesh ${meshId} using white texture for deformation`);
        }
    }

    // Create test mesh for Phase 2 development
    async createTestMesh() {
        try {
            // Use simple quad that works, with controlled mappings
            const vertices = new Float32Array([
                0, 0,                              // top-left
                this.meshConfig.width, 0,          // top-right
                this.meshConfig.width, this.meshConfig.height,  // bottom-right
                0, this.meshConfig.height         // bottom-left
            ]);

            const uvs = new Float32Array([
                0, 0,  // top-left UV
                1, 0,  // top-right UV
                1, 1,  // bottom-right UV
                0, 1   // bottom-left UV
            ]);

            const indices = new Uint16Array([
                0, 1, 2,  // first triangle: top-left, top-right, bottom-right
                0, 2, 3   // second triangle: top-left, bottom-right, bottom-left
            ]);

            const geometry = new PIXI.MeshGeometry(vertices, uvs, indices);
            console.log('🔧 Using working QUAD geometry with controlled mappings');

            // DEBUG: Check initial geometry vertices
            const initialVertices = geometry.getBuffer('aPosition').data;
            console.log('🔧 Simple quad vertices:', Array.from(initialVertices));
            console.log('🔧 Simple quad created successfully');

            // Start with a very obvious colored texture for visibility testing
            const graphics = new PIXI.Graphics();
            // Use PixiJS 8 API
            graphics.rect(0, 0, this.meshConfig.width, this.meshConfig.height).fill(0xff0000); // BRIGHT RED

            // FIX: Use a different method to create texture - add graphics to stage first
            this.pixiApp.stage.addChild(graphics);
            const initialTexture = this.pixiApp.renderer.generateTexture(graphics);
            this.pixiApp.stage.removeChild(graphics); // Remove after generating texture

            console.log('🔧 Created red initial texture for mesh:', initialTexture);
            console.log('🔧 Texture valid:', initialTexture.valid, 'width:', initialTexture.width, 'height:', initialTexture.height);

            // Use the exact syntax that worked in test-mesh-proper.html
            const mesh = new PIXI.Mesh({
                geometry: geometry,
                texture: initialTexture
            });
            console.log('🔧 Created mesh with working PixiJS 8 syntax from test');

            // Position mesh prominently - FORCE IT TO BE VISIBLE
            mesh.x = 50; // Fixed position, top-left area
            mesh.y = 50;

            // Make mesh VERY visible for debugging
            mesh.visible = true;
            mesh.renderable = true;
            mesh.cullable = false; // Prevent culling
            mesh.alpha = 1.0; // Full opacity
            mesh.scale.set(1.0); // Normal scale for proper clothing fit

            console.log('🟢 MESH: Created and positioned:', {
                x: mesh.x,
                y: mesh.y,
                width: this.meshConfig.width,
                height: this.meshConfig.height,
                visible: mesh.visible,
                alpha: mesh.alpha,
                canvasSize: `${this.pixiApp.renderer.width}x${this.pixiApp.renderer.height}`
            });

            // Debug elements no longer needed - mesh is working!

            // Add to stage
            this.pixiApp.stage.addChild(mesh);
            console.log('🔧 Mesh added to stage, stage children:', this.pixiApp.stage.children.length);

            // DEBUG: Force render immediately after adding mesh
            this.pixiApp.renderer.render(this.pixiApp.stage);
            console.log('🔧 Forced immediate render after adding mesh');

            // Store mesh for future manipulation
            this.meshes.set('test', mesh);
            console.log('Mesh stored in meshes map:', this.meshes.has('test'));

            // DEBUG: Check mesh properties after adding to stage
            console.log('🔧 Final mesh debug:', {
                visible: mesh.visible,
                alpha: mesh.alpha,
                x: mesh.x,
                y: mesh.y,
                width: mesh.width,
                height: mesh.height,
                scaleX: mesh.scale.x,
                scaleY: mesh.scale.y,
                texture: !!mesh.texture,
                parent: !!mesh.parent,
                canvasWidth: this.pixiApp.renderer.width,
                canvasHeight: this.pixiApp.renderer.height
            });

            // Additional bounds checking
            console.log('🔧 MESH BOUNDS CHECK:', {
                meshRight: mesh.x + mesh.width,
                meshBottom: mesh.y + mesh.height,
                canvasWidth: this.pixiApp.renderer.width,
                canvasHeight: this.pixiApp.renderer.height,
                isInBounds: mesh.x < this.pixiApp.renderer.width && mesh.y < this.pixiApp.renderer.height
            });

            // Create controlled landmark-to-vertex mappings for clothing deformation
            const landmarkMapping = this.createControlledLandmarkMapping();
            this.landmarkMappings.set('test', landmarkMapping);
            console.log('✅ Controlled landmark mapping created:', landmarkMapping.size, 'mappings');

            // TEST: Load cristoredentor.png directly to test if file works
            console.log('🧪 Testing cristoredentor.png texture loading...');
            this.setMeshTexture('test', 'images/cristoredentor.png').then(() => {
                console.log('✅ Cristoredentor.png texture loaded successfully on mesh');

                // After 3 seconds, test switching back to prime.png
                setTimeout(() => {
                    console.log('🔄 Testing switch back to prime.png...');
                    this.setMeshTexture('test', 'images/prime.png').then(() => {
                        console.log('✅ Prime.png texture loaded successfully on mesh');
                    });
                }, 3000);
            }).catch(error => {
                console.error('❌ Failed to load cristoredentor.png texture:', error);
            });

            console.log('✓ Test mesh created, loading prime.png texture...');
            console.log('🔍 MESH DEBUG: Mesh added to stage, should be visible now!');

        } catch (error) {
            console.error('Failed to create test mesh:', error);
            // No fallback rectangle - BuildingLayer handles texture rendering
        }
    }

    // Create controlled landmark-to-vertex mappings for precise distortion
    createControlledLandmarkMapping() {
        const mappings = new Map();

        // For simple quad (4 vertices), create basic mappings
        // Vertex layout:
        //  0---1
        //  |   |
        //  3---2

        mappings.set(0, { // Top-left
            landmarks: [11], // Left shoulder
            influence: 0.6,
            offset: { x: -30, y: -80 }
        });

        mappings.set(1, { // Top-right
            landmarks: [12], // Right shoulder
            influence: 0.6,
            offset: { x: 30, y: -80 }
        });

        mappings.set(2, { // Bottom-right
            landmarks: [24], // Right hip
            influence: 0.8,
            offset: { x: 20, y: 60 }
        });

        mappings.set(3, { // Bottom-left
            landmarks: [23], // Left hip
            influence: 0.8,
            offset: { x: -20, y: 60 }
        });

        console.log('🎯 Created simple quad mappings for vertices:', Array.from(mappings.keys()));
        return mappings;
    }

    // Create mesh geometry with specified grid dimensions
    createMeshGeometry(cols, rows, width, height) {
        const vertices = [];
        const uvs = [];
        const indices = [];

        // Generate vertices and UV coordinates
        for (let row = 0; row <= rows; row++) {
            for (let col = 0; col <= cols; col++) {
                // Vertex position (x, y)
                const x = (col / cols) * width;
                const y = (row / rows) * height;
                vertices.push(x, y);

                // UV coordinates (texture mapping)
                const u = col / cols;
                const v = row / rows;
                uvs.push(u, v);
            }
        }

        // Generate triangle indices
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const topLeft = row * (cols + 1) + col;
                const topRight = topLeft + 1;
                const bottomLeft = (row + 1) * (cols + 1) + col;
                const bottomRight = bottomLeft + 1;

                // First triangle (counter-clockwise winding)
                indices.push(topLeft, topRight, bottomLeft);
                // Second triangle (counter-clockwise winding)
                indices.push(topRight, bottomRight, bottomLeft);
            }
        }

        // Create PixiJS geometry
        const geometry = new PIXI.MeshGeometry(vertices, uvs, indices);

        console.log(`Created mesh geometry: ${cols+1}x${rows+1} vertices, ${indices.length/3} triangles`);

        return geometry;
    }

    // Create anatomical landmark to vertex mapping for clothing-like deformation
    createLandmarkMapping(meshGeometry) {
        const mapping = new Map();

        const cols = this.meshConfig.cols;
        const rows = this.meshConfig.rows;

        // Enhanced anatomical mapping for digital clothing effect
        // Map landmarks to vertex indices (row * (cols+1) + col)

        // Head/neck area - top row vertices
        mapping.set('nose', 2); // Top center vertex
        mapping.set('left_eye', 1); // Top left-center
        mapping.set('right_eye', 3); // Top right-center

        // Shoulder area - upper torso vertices
        mapping.set('left_shoulder', Math.floor(rows * 0.25) * (cols + 1) + 0); // Left edge, upper quarter
        mapping.set('right_shoulder', Math.floor(rows * 0.25) * (cols + 1) + cols); // Right edge, upper quarter

        // Arm area - middle vertices
        mapping.set('left_elbow', Math.floor(rows * 0.5) * (cols + 1) + 0); // Left edge, middle
        mapping.set('right_elbow', Math.floor(rows * 0.5) * (cols + 1) + cols); // Right edge, middle
        mapping.set('left_wrist', Math.floor(rows * 0.75) * (cols + 1) + 0); // Left edge, lower
        mapping.set('right_wrist', Math.floor(rows * 0.75) * (cols + 1) + cols); // Right edge, lower

        // Hip/core area - bottom vertices
        mapping.set('left_hip', rows * (cols + 1) + 1); // Bottom left-center
        mapping.set('right_hip', rows * (cols + 1) + cols - 1); // Bottom right-center

        console.log('Created enhanced anatomical mapping:', mapping);

        return mapping;
    }
}