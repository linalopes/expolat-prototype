// Declare global variables for video capture, body pose detection, and poses
let video;
let bodyPose;
let poses = [];
let connections;
let canvas;
let showVideo = true;
let isFullscreen = false;
let generateImagesEnabled = true;
let originalWidth = 640;
let originalHeight = 480;

// Arrays to store local images for each pose
let jesusImages = []; // Will store Jesus_1.png, Jesus_2.png, Jesus_3.png
let primeImages = []; // Will store Prime_1.png, Prime_2.png
let currentOverlayImage = null; // Currently displayed overlay image

let currentState = "Neutral";
let lastState = "Neutral";

// Simple debounce to avoid flicker when pose toggles
let stableState = "Neutral";
let stableCounter = 0;
const STABLE_FRAMES = 12; // ~200ms at 60fps

// Function to select a random image from the appropriate array based on pose state
function selectRandomImage(state) {
  if (!generateImagesEnabled) {
    console.log("Image generation is disabled");
    return null;
  }

  let imageArray = [];
  let imageName = "";

  if (state === "Jesus") {
    imageArray = jesusImages;
    imageName = "Jesus";
  } else if (state === "Mountain") {
    imageArray = primeImages;
    imageName = "Prime";
  } else {
    return null;
  }

  // Check if we have images loaded for this pose
  if (imageArray.length === 0) {
    console.warn(`No ${imageName} images loaded`);
    return null;
  }

  // Select a random image from the array
  const randomIndex = Math.floor(Math.random() * imageArray.length);
  const selectedImage = imageArray[randomIndex];

  console.log(`Selected ${imageName} image ${randomIndex + 1} for ${state} pose`);
  return selectedImage;
}
/*
===========================================================
SETUP
This section initializes the video capture, canvas, and
starts the body pose detection for Mountain and Jesus pose
analysis.
===========================================================
*/

function preload() {
    // Preload the bodyPose model using ml5.js with horizontal flip for mirroring
    bodyPose = ml5.bodyPose({ flipHorizontal: true });

    // Load only Jesus_2.png for Jesus pose
    jesusImages.push(loadImage('generated/Jesus_1.png'));

    // Load only Prime_2.png for Mountain pose
    primeImages.push(loadImage('generated/Prime_1.png'));

    console.log("Loading local images: Jesus_2.png and Prime_2.png");
}


function setup() {
    // Dynamically create the canvas and attach it to the "video-wrapper" div in the HTML
    const videoWrapper = document.getElementById('video-wrapper');
    canvas = createCanvas(640, 480);
    canvas.parent(videoWrapper);

    // Initialize video capture and hide the video element (only show the canvas)
    video = createCapture(VIDEO);
    video.size(640, 480);
    video.hide();

    /// Start detecting body poses using the video feed
    bodyPose.detectStart(video, gotPoses);

    // Get skeleton connection information for drawing lines between keypoints
    connections = bodyPose.getSkeleton();

    // Setup control buttons
    setupControls();

    console.log("Setup complete - local images loaded and ready");
}

/*
===========================================================
DRAWING
This section is responsible for rendering the mirrored video
feed on the canvas, visualizing detected poses, and drawing
skeletons and keypoints for all participants. It also displays
the pose state ("Mountain", "Jesus", or "Neutral") for each person.
===========================================================
*/

function draw() {
    // Clear the canvas
    clear();

    // Calculate scaling factors for fullscreen
    let scaleX = width / originalWidth;
    let scaleY = height / originalHeight;

    // Draw the mirrored video feed on the canvas (only if showVideo is true)
    if (showVideo) {
        push();
        translate(width, 0);
        scale(-1, 1);
        image(video, 0, 0, width, height);
        pop();
    }

    // Debug: Check if poses are being detected
    console.log("Poses detected:", poses.length);

    // Loop through detected poses to draw skeletons and keypoints
    for (let i = 0; i < poses.length; i++) {
        let pose = poses[i];

        // Draw skeleton connections for the pose
        for (let j = 0; j < connections.length; j++) {
            let pointAIndex = connections[j][0];
            let pointBIndex = connections[j][1];
            let pointA = pose.keypoints[pointAIndex];
            let pointB = pose.keypoints[pointBIndex];

            if (pointA.confidence > 0.1 && pointB.confidence > 0.1) {
                stroke(255, 0, 0);
                strokeWeight(2 * min(scaleX, scaleY)); // Scale stroke weight
                line(pointA.x * scaleX, pointA.y * scaleY, pointB.x * scaleX, pointB.y * scaleY);
            }
        }

        // Analyze the pose state of each person (Mountain, Jesus, or Neutral) and display it
        analyzeState(pose, i + 1);

        // Draw keypoints for each person
        for (let j = 0; j < pose.keypoints.length; j++) {
            let keypoint = pose.keypoints[j];
            if (keypoint.confidence > 0.1) {
                fill(0, 255, 0); // Green color for keypoints
                noStroke();
                circle(keypoint.x * scaleX, keypoint.y * scaleY, 10 * min(scaleX, scaleY));
            }
        }

        if (currentState !== stableState) {
          stableCounter++;
          if (stableCounter >= STABLE_FRAMES) {
            stableState = currentState;
            stableCounter = 0;
          }
        } else {
          stableCounter = 0;
        }

        // If state changed to one of the overlays, select a random image
        if (stableState !== lastState && (stableState === "Mountain" || stableState === "Jesus")) {
          currentOverlayImage = selectRandomImage(stableState);
          lastState = stableState;
        }

        // Draw: if we have an overlay for the stable state, put it on top
        if (currentOverlayImage && (stableState === "Mountain" || stableState === "Jesus")) {
          // Display the selected random image as overlay
          image(currentOverlayImage, 0, 0, width, height);
        }

    }
}

/*
===========================================================
POSE ANALYSIS
This section analyzes the body pose data to determine whether
a participant is in "Mountain" pose (hands on head) or "Jesus" pose (open arms).
It uses keypoints like wrists, elbows, shoulders, and nose to calculate the posture
and displays the result on the canvas.
===========================================================
*/

// Analyze the player's pose to determine if they are "Mountain" (hands on head) or "Jesus" (open arms)
function analyzeState(pose, personNumber) {
    console.log(`Analyzing pose for Person ${personNumber}`);

    // Extract keypoints for hands, shoulders, and head
    let leftWrist = pose.keypoints.find((k) => k.name === "left_wrist");
    let rightWrist = pose.keypoints.find((k) => k.name === "right_wrist");
    let leftElbow = pose.keypoints.find((k) => k.name === "left_elbow");
    let rightElbow = pose.keypoints.find((k) => k.name === "right_elbow");
    let leftShoulder = pose.keypoints.find((k) => k.name === "left_shoulder");
    let rightShoulder = pose.keypoints.find((k) => k.name === "right_shoulder");
    let nose = pose.keypoints.find((k) => k.name === "nose");

    // Handle missing keypoints
    if (!leftWrist || !rightWrist || !leftElbow || !rightElbow || !leftShoulder || !rightShoulder || !nose) {
        console.warn(`Missing keypoints for Person ${personNumber}`);
        return;
    }

    // Check confidence levels
    if (leftWrist.confidence < 0.3 || rightWrist.confidence < 0.3 || nose.confidence < 0.3) {
        console.warn(`Low confidence keypoints for Person ${personNumber}`);
        return;
    }

    let state = "Neutral";

    // Check for Mountain pose: both hands on top of head and close together
    let handsAboveHead = leftWrist.y < nose.y - 20 && rightWrist.y < nose.y - 20;
    let handsCloseTogether = Math.abs(leftWrist.x - rightWrist.x) < 100; // Adjust threshold as needed

    if (handsAboveHead && handsCloseTogether) {
        state = "Mountain";
    }
    // Check for Jesus pose: arms extended horizontally (open arms)
    else {
        // Calculate distances for arm extension check
        let leftShoulderToWrist = Math.sqrt(Math.pow(leftWrist.x - leftShoulder.x, 2) + Math.pow(leftWrist.y - leftShoulder.y, 2));
        let leftShoulderToElbow = Math.sqrt(Math.pow(leftElbow.x - leftShoulder.x, 2) + Math.pow(leftElbow.y - leftShoulder.y, 2));
        let rightShoulderToWrist = Math.sqrt(Math.pow(rightWrist.x - rightShoulder.x, 2) + Math.pow(rightWrist.y - rightShoulder.y, 2));
        let rightShoulderToElbow = Math.sqrt(Math.pow(rightElbow.x - rightShoulder.x, 2) + Math.pow(rightElbow.y - rightShoulder.y, 2));

        // Arms are extended if wrist is further from shoulder than elbow
        let leftArmExtended = leftShoulderToWrist > leftShoulderToElbow + 20;
        let rightArmExtended = rightShoulderToWrist > rightShoulderToElbow + 20;

        // Check if arms are spread horizontally (wrist is to the side of shoulder)
        let leftArmSpread = leftWrist.x < leftShoulder.x - 30; // Left wrist is to the left of left shoulder
        let rightArmSpread = rightWrist.x > rightShoulder.x + 30; // Right wrist is to the right of right shoulder

        // Check if arms are roughly horizontal (elbow and wrist at similar height)
        let leftArmHorizontal = Math.abs(leftElbow.y - leftWrist.y) < 40;
        let rightArmHorizontal = Math.abs(rightElbow.y - rightWrist.y) < 40;

        if (leftArmExtended && rightArmExtended && leftArmSpread && rightArmSpread && leftArmHorizontal && rightArmHorizontal) {
            state = "Jesus";
        }
    }

    console.log(`Person ${personNumber} is ${state}`);

    currentState = state;

    // Display the state on the canvas
    fill(255);
    let scaleX = width / originalWidth;
    let scaleY = height / originalHeight;
    textSize(20 * min(scaleX, scaleY));
    textAlign(LEFT);
    text(`Person ${personNumber}: ${state}`, 10 * scaleX, height - 20 * personNumber * scaleY);
}

// Callback function to handle detected poses
function gotPoses(results) {
    console.log("Got poses:", results);
    poses = results;
}

/*
===========================================================
CONTROLS
This section handles the control buttons for fullscreen
and video toggle functionality.
===========================================================
*/

// Setup control button event listeners
function setupControls() {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const videoToggleBtn = document.getElementById('video-toggle-btn');
    const generateImagesBtn = document.getElementById('generate-images-btn');

    // Fullscreen functionality
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Video toggle functionality
    videoToggleBtn.addEventListener('click', toggleVideo);

    // Generate images toggle functionality
    generateImagesBtn.addEventListener('click', toggleImageGeneration);

    // Listen for ESC key to exit fullscreen
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && document.fullscreenElement) {
            exitFullscreen();
        }
    });

    // Listen for fullscreen change events to update our state
    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement) {
            // Exited fullscreen
            isFullscreen = false;
            resizeCanvas(originalWidth, originalHeight);
        }
    });
}

// Toggle fullscreen mode for the canvas
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Enter fullscreen
        canvas.elt.requestFullscreen().then(() => {
            isFullscreen = true;
            // Resize canvas to fill screen
            resizeCanvas(window.innerWidth, window.innerHeight);
        }).catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
        // Exit fullscreen
        exitFullscreen();
    }
}

// Exit fullscreen mode
function exitFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
            console.error('Error attempting to exit fullscreen:', err);
        });
    }
}

// Toggle video display
function toggleVideo() {
    const videoToggleBtn = document.getElementById('video-toggle-btn');

    showVideo = !showVideo;
    videoToggleBtn.textContent = showVideo ? 'Hide Video' : 'Show Video';
}

function toggleImageGeneration() {
    const generateImagesBtn = document.getElementById('generate-images-btn');

    generateImagesEnabled = !generateImagesEnabled;
    generateImagesBtn.textContent = generateImagesEnabled ? 'Generate Images' : 'Images Disabled';

    // Update button styling to show disabled state
    if (generateImagesEnabled) {
        generateImagesBtn.classList.remove('btn-disabled');
        generateImagesBtn.classList.add('btn-1');
    } else {
        generateImagesBtn.classList.remove('btn-1');
        generateImagesBtn.classList.add('btn-disabled');
    }
}
