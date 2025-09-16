# Expolat Prototype

An interactive multi-person pose detection game that displays overlay stickers when players strike specific poses. Built with p5.js and ml5.js for real-time body tracking.

## Overview

Strike one of two poses and watch as overlay stickers appear anchored to your shoulders:

- **Prime Tower Pose**: Both hands on top of your head, close together
- **Jesus Pose**: Arms extended horizontally to the sides (open arms)

The system supports **multiple people simultaneously**, with each person getting their own individual sticker overlay.

## ✨ Features

- **Multi-Person Support**: Track and overlay stickers for multiple people at once
- **Real-time Pose Detection**: Uses ml5.js for accurate body pose tracking
- **Local Image Overlays**: Uses pre-generated images from the `generated/` folder
- **Shoulder-Anchored Stickers**: Stickers are positioned and scaled relative to shoulder width
- **Fullscreen Mode**: Immersive experience with ESC key to exit
- **Video Toggle**: Hide video feed to show only pose tracking
- **Tracking Toggle**: Hide/show skeleton lines and keypoints for clean interface
- **Responsive Design**: Works on different screen sizes
- **Per-Person State Management**: Individual pose tracking and debouncing for each person

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (p5.js, ml5.js)
- **Pose Detection**: ml5.js Body Pose model
- **Styling**: Bootstrap 5 with custom CSS
- **Local Images**: PNG files stored in `generated/` folder

## 📋 Prerequisites

- Python 3 (for local web server)
- Modern web browser with camera access
- No external API keys required

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/linalopes/expolat-prototype.git
cd expolat-prototype
```

### 2. Start the Web Server
```bash
python3 -m http.server 8000
```

### 3. Open the Application
Navigate to `http://localhost:8000` in your browser and allow camera access.

## 🎯 How to Play

1. **Allow Camera Access**: Grant permission when prompted
2. **Position Yourself**: Stand in front of the camera with good lighting
3. **Strike a Pose**:
   - **Prime Tower**: Place both hands on top of your head, close together
   - **Jesus**: Extend your arms horizontally to the sides
4. **Watch the Magic**: Overlay stickers will appear anchored to your shoulders
5. **Multiple People**: The system supports multiple people with individual stickers
6. **Use Controls**:
   - **Fullscreen**: Click to enter immersive mode
   - **Hide Video**: Toggle to show only pose tracking
   - **Hide Tracking**: Toggle skeleton lines and keypoints for clean interface
   - **ESC Key**: Exit fullscreen mode

## 🎨 Pose Detection Logic

### Prime Tower Pose
- Both wrists are above the nose level
- Wrists are horizontally close together (within 100 pixels)

### Jesus Pose
- Arms are extended (wrist further from shoulder than elbow)
- Arms are spread horizontally (wrists to the sides of shoulders)
- Arms are roughly horizontal (elbow and wrist at similar heights)

## 🏗️ Multi-Person Architecture

### Per-Person State Management
- **Individual Arrays**: Each person has their own state tracking
- **Debouncing**: 12-frame stability check per person
- **Independent Stickers**: Each person gets their own overlay image
- **Dynamic Scaling**: Arrays resize automatically based on detected people

### Sticker Placement System
- **Shoulder Anchoring**: Stickers positioned at midpoint between shoulders
- **Proportional Scaling**: Sticker size = 1.8 × shoulder width
- **Confidence Checking**: Only draws when shoulder keypoints are reliable (>0.3)
- **Individual Layers**: Each person's sticker is drawn independently

## 📁 Project Structure

```
expolat/
├── index.html              # Main HTML file
├── script.js               # p5.js and ml5.js logic
├── styles.css              # Custom styling
├── generated/              # Local overlay images
│   ├── Jesus_1.png         # Jesus pose sticker
│   └── Prime_1.png         # Prime Tower pose sticker
├── jesus.svg               # Jesus pose instruction icon
├── prime.svg               # Prime Tower pose instruction icon
├── favicon.png             # Website icon
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## 🔧 Configuration

### Pose Detection
- **Confidence Threshold**: 0.3 (30%)
- **Canvas Size**: 640x480 (original), scales in fullscreen
- **Keypoint Tracking**: Wrists, elbows, shoulders, nose
- **Stability Frames**: 12 frames for pose confirmation

### Sticker System
- **Scale Factor**: 1.8 × shoulder width
- **Anchor Point**: Midpoint between left and right shoulders
- **Image Format**: PNG with transparency support

## 🐛 Troubleshooting

### Common Issues

**Camera not working:**
- Ensure HTTPS or localhost
- Check browser permissions
- Try refreshing the page

**Pose detection not accurate:**
- Improve lighting conditions
- Ensure full body is visible
- Stand 2-3 feet from camera
- Make sure both shoulders are visible

**Stickers not appearing:**
- Check that images exist in `generated/` folder
- Ensure pose is held steady for 12 frames
- Verify shoulder keypoints have good confidence (>0.3)

**Multiple people not working:**
- Ensure each person is fully visible in frame
- Check that people don't overlap too much
- Try adjusting camera distance

## 🎮 Controls Reference

| Button | Function |
|--------|----------|
| **Fullscreen** | Enter/exit fullscreen mode |
| **Hide Video** | Toggle video feed visibility |
| **Hide Tracking** | Toggle skeleton lines and keypoints |
| **ESC Key** | Exit fullscreen mode |

## 🔒 Security Notes

- No external API calls or data transmission
- All images are stored locally
- Camera access only used for pose detection
- No personal data is collected or stored

## 🚀 Deployment

For production deployment:

1. Set up a proper web server (not Python's simple server)
2. Enable HTTPS for camera access
3. Ensure all image files are properly served
4. Test with multiple people simultaneously

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with multiple people
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [p5.js](https://p5js.org/) - Creative coding library
- [ml5.js](https://ml5js.org/) - Machine learning for the web
- [Bootstrap](https://getbootstrap.com/) - CSS framework

## 📞 Support

If you encounter any issues or have questions, please:
1. Check the troubleshooting section
2. Review the browser console for errors
3. Open an issue on GitHub

---

**Have fun striking poses with friends! 🎨✨👥**
