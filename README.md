# Mountain - Jesus! 🏔️✝️

An interactive pose detection game that uses AI to generate overlay images when you strike specific poses. Built with p5.js, ml5.js, and OpenAI's DALL-E API.

## Overview

Strike one of two poses and watch as AI-generated overlay images appear on your video feed:

- **Mountain Pose**: Both hands on top of your head, close together
- **Jesus Pose**: Arms extended horizontally to the sides (open arms)

## ✨ Features

- **Real-time Pose Detection**: Uses ml5.js for accurate body pose tracking
- **AI-Generated Overlays**: Creates unique images using OpenAI's DALL-E 3 API
- **Fullscreen Mode**: Immersive experience with ESC key to exit
- **Video Toggle**: Hide video feed to show only pose tracking
- **Responsive Design**: Works on different screen sizes
- **Image Caching**: Saves generated images locally for performance

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (p5.js, ml5.js)
- **Backend**: Node.js with Express
- **AI**: OpenAI DALL-E 3 API
- **Pose Detection**: ml5.js Body Pose model
- **Styling**: Bootstrap 5 with custom CSS

## 📋 Prerequisites

- Node.js (v14 or higher)
- Python 3 (for local web server)
- OpenAI API key
- Modern web browser with camera access

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd expolat
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Start the Servers

**Terminal 1 - Node.js API Server:**
```bash
npm start
```
This starts the overlay generation server on `http://localhost:8787`

**Terminal 2 - Python Web Server:**
```bash
python3 -m http.server 8000
```
This serves the web app on `http://localhost:8000`

### 5. Open the Application
Navigate to `http://localhost:8000` in your browser and allow camera access.

## 🎯 How to Play

1. **Allow Camera Access**: Grant permission when prompted
2. **Position Yourself**: Stand in front of the camera with good lighting
3. **Strike a Pose**:
   - **Mountain**: Place both hands on top of your head, close together
   - **Jesus**: Extend your arms horizontally to the sides
4. **Watch the Magic**: AI-generated overlay images will appear on your video feed
5. **Use Controls**:
   - **Fullscreen**: Click to enter immersive mode
   - **Hide Video**: Toggle to show only pose tracking
   - **ESC Key**: Exit fullscreen mode

## 🎨 Pose Detection Logic

### Mountain Pose
- Both wrists are above the nose level
- Wrists are horizontally close together (within 100 pixels)

### Jesus Pose
- Arms are extended (wrist further from shoulder than elbow)
- Arms are spread horizontally (wrists to the sides of shoulders)
- Arms are roughly horizontal (elbow and wrist at similar heights)

## 📁 Project Structure

```
expolat/
├── index.html          # Main HTML file
├── script.js           # p5.js and ml5.js logic
├── styles.css          # Custom styling
├── server.js           # Node.js API server
├── package.json        # Node.js dependencies
├── .env                # Environment variables (create this)
├── .gitignore          # Git ignore rules
├── generated/          # AI-generated images (auto-created)
├── jesus.svg           # Jesus pose icon
├── mountain.svg        # Mountain pose icon
└── favicon.png         # Website icon
```

## 🔧 Configuration

### API Settings
- **OpenAI Model**: DALL-E 3
- **Image Size**: 1024x1024 (DALL-E 3 standard)
- **Response Format**: Base64 JSON

### Pose Detection
- **Confidence Threshold**: 0.3 (30%)
- **Canvas Size**: 640x480 (original), scales in fullscreen
- **Keypoint Tracking**: Wrists, elbows, shoulders, nose

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

**API errors:**
- Verify OpenAI API key in `.env`
- Check API quota limits
- Ensure Node.js server is running

**CORS errors:**
- Both servers must be running
- Check port numbers (8000 for web, 8787 for API)

## 🔒 Security Notes

- Never commit your `.env` file
- Keep your OpenAI API key secure
- The app only works on localhost for security

## 🚀 Deployment

For production deployment:

1. Set up a proper web server (not Python's simple server)
2. Use environment variables for API keys
3. Enable HTTPS for camera access
4. Consider rate limiting for API calls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [p5.js](https://p5js.org/) - Creative coding library
- [ml5.js](https://ml5js.org/) - Machine learning for the web
- [OpenAI](https://openai.com/) - DALL-E 3 API
- [Bootstrap](https://getbootstrap.com/) - CSS framework

## 📞 Support

If you encounter any issues or have questions, please:
1. Check the troubleshooting section
2. Review the browser console for errors
3. Open an issue on GitHub

---

**Have fun striking poses and generating AI art! 🎨✨**
