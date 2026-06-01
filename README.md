# Interview AI 🎯

An AI-powered mock interview platform with real-time biometric analysis, emotion recognition, and personalized coaching feedback. Built for job seekers to practice interviews, improve presentation skills, and get detailed performance analytics.

## 🌟 Features

### Core Capabilities
- **Mock Interviews**: AI-generated interview questions for different job domains (Software Engineer, Product Manager, Data Scientist, etc.)
- **Real-time Computer Vision**: Webcam-based biometric analysis including:
  - Facial emotion detection (CNN-based)
  - Gaze tracking and focus metrics
  - Posture analysis
  - Lighting & background quality assessment
  - Smile intensity and head nodding frequency
  - Blink rate monitoring
- **Stress Level Prediction**: XGBoost model to predict real-time stress levels based on behavioral metrics
- **Resume Review**: Upload and get AI-powered resume analysis with actionable feedback
- **Performance Analytics**: Comprehensive dashboards showing interview history, trends, and improvement areas
- **AI Coaching**: Personalized feedback and coaching tips using Google Gemini AI
- **Multi-language Support**: TTS (Text-to-Speech) and STT (Speech-to-Text) via Sarvam AI API
- **Real-time Telemetry**: WebSocket-based real-time data streaming for live metrics

## 🏗️ Architecture

### Tech Stack

**Frontend**
- React 19 + TypeScript
- Vite (Fast build tool)
- Socket.IO (Real-time communication)
- Recharts (Data visualization)
- Tesseract.js (OCR for PDF analysis)
- pdfjs-dist (PDF rendering)
- Lucide React (UI Icons)

**Backend**
- Node.js + Express.js
- TypeScript
- Prisma ORM (Database management)
- PostgreSQL (Neon database)
- JWT Authentication
- Socket.IO (Real-time telemetry)
- Google Generative AI (Gemini API for coaching)
- Sarvam AI (Speech recognition & TTS)

**ML Service**
- Python + FastAPI
- PyTorch (Emotion CNN model on FER2013 dataset)
- XGBoost (Stress prediction)
- Pillow + NumPy + Scikit-learn (Image processing)
- TorchVision (Computer vision utilities)

### System Architecture

```mermaid
graph TB
    subgraph CLIENT["🖥️ CLIENT LAYER"]
        ResumeUI["📄 Resume UI<br/>PDF + OCR parsing"]
        InterviewUI["🎤 Interview UI<br/>Audio + webcam capture"]
        AnalyticsUI["📊 Analytics UI<br/>Heatmaps + dashboard"]
    end

    subgraph CV["🎥 BROWSER CV TELEMETRY"]
        CVMetrics["Computer Vision Metrics<br/>• Gaze position & direction<br/>• Blink rate<br/>• Motion intensity<br/>• Face luminance<br/>• Smile intensity<br/>• Head nod frequency<br/>• Posture score"]
    end

    subgraph BACKEND["⚙️ BACKEND LAYER - Express.js"]
        Auth["🔐 Auth Service<br/>JWT + Refresh Tokens<br/>User Management"]
        RestAPI["🔗 REST API Routes<br/>• /auth/* (Register/Login)<br/>• /interview/* (CRUD)<br/>• /resume/* (Review)<br/>• /analytics/* (History)"]
        SocketIO["📡 Socket.IO Handler<br/>Real-time telemetry<br/>Live metrics broadcast"]
        Aggregator["📦 Session Aggregator<br/>• Compute scores<br/>• Build timeline<br/>• Coaching component"]
    end

    subgraph DB["🗄️ DATABASE - PostgreSQL"]
        Prisma["Prisma ORM<br/>• Users<br/>• Sessions<br/>• Refresh Tokens<br/>• Interview History"]
    end

    subgraph ML["🤖 ML SERVICE LAYER - FastAPI"]
        EmotionCNN["😊 Emotion CNN<br/>FER2013 7-class<br/>Real-time prediction"]
        StressModel["😰 Stress Regression<br/>XGBoost<br/>Telemetry → Stress"]
        PatternAnalysis["📈 Behavior Patterns<br/>Clustering analysis<br/>Historical insights"]
    end

    subgraph EXTERNAL["🌐 EXTERNAL AI APIs"]
        Gemini["✨ Google Gemini 2.5 Flash<br/>• Question generation<br/>• Resume review<br/>• Coaching feedback"]
        Sarvam["🗣️ Sarvam AI<br/>• Speech-to-Text<br/>• Text-to-Speech<br/>• Multi-language support"]
    end

    ResumeUI -->|HTTP/REST| RestAPI
    InterviewUI -->|HTTP/REST| RestAPI
    InterviewUI -->|WebSocket| CVMetrics
    AnalyticsUI -->|HTTP/REST| RestAPI
    
    CVMetrics -->|WS Telemetry| SocketIO
    
    RestAPI -->|Query/Mutate| Prisma
    SocketIO -->|Store Results| Aggregator
    Aggregator -->|Save to DB| Prisma
    
    SocketIO -->|Verify Stress| ML
    CVMetrics -->|Image Base64| EmotionCNN
    CVMetrics -->|Metrics Features| StressModel
    
    RestAPI -->|Domain + Context| Gemini
    Aggregator -->|Answers + Scores| Gemini
    InterviewUI -->|Speech Audio| Sarvam
    InterviewUI -->|Text to Speech| Sarvam
    
    RestAPI -->|Pattern Data| PatternAnalysis
    Prisma -->|Historical Sessions| PatternAnalysis

    classDef frontend fill:#6366f1,stroke:#4f46e5,color:#fff
    classDef backend fill:#0891b2,stroke:#0e7490,color:#fff
    classDef database fill:#7c3aed,stroke:#6d28d9,color:#fff
    classDef ml fill:#059669,stroke:#047857,color:#fff
    classDef external fill:#dc2626,stroke:#b91c1c,color:#fff
    classDef cv fill:#14b8a6,stroke:#0d9488,color:#fff

    class ResumeUI,InterviewUI,AnalyticsUI frontend
    class Auth,RestAPI,SocketIO,Aggregator backend
    class Prisma database
    class EmotionCNN,StressModel,PatternAnalysis ml
    class Gemini,Sarvam external
    class CVMetrics cv
```

**Key Data Flows:**

1. **Interview Session Flow**
   - Frontend captures webcam → Extracts CV metrics
   - Metrics sent via WebSocket → Backend processes
   - Backend calls ML Service → Predictions returned
   - Results aggregated → Saved to PostgreSQL
   - UI updates in real-time via Socket.IO

2. **AI Coaching Flow**
   - Interview scores + answers → Backend
   - Gemini API generates feedback
   - Coaching stored with session
   - User views in analytics dashboard

3. **Resume Review Flow**
   - PDF uploaded → OCR extraction (Tesseract.js)
   - Text sent to Gemini → Analysis generated
   - Feedback cached in session
   - Real-time UI update

## 📁 Project Structure

```
interview-ai/
├── backend/                          # Express.js API server
│   ├── src/
│   │   ├── index.ts                 # Main server entry
│   │   ├── prisma.ts                # Prisma client
│   │   ├── middleware/
│   │   │   └── auth.ts              # JWT authentication
│   │   └── services/
│   │       ├── mlService.ts         # ML service API calls
│   │       └── coachingService.ts   # Gemini AI coaching
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   └── migrations/              # DB migrations (PostgreSQL)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         # React.js + Vite app
│   ├── src/
│   │   ├── main.tsx                 # Entry point
│   │   ├── App.tsx                  # Main app component
│   │   ├── components/              # Reusable UI components
│   │   │   ├── AuthPanel.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MockInterview.tsx
│   │   │   ├── ResumeReview.tsx
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── TelemetryDashboard.tsx
│   │   │   ├── WebcamFeed.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useWebcamCV.ts       # Custom CV hook
│   │   ├── services/
│   │   │   └── api.ts               # API client
│   │   ├── assets/
│   │   └── styles/
│   ├── vite.config.js
│   ├── index.html
│   └── package.json
│
├── ml-service/                      # FastAPI ML service
│   ├── main.py                      # FastAPI app entry
│   ├── model.py                     # PyTorch Emotion CNN
│   ├── train.py                     # Model training script
│   ├── requirements.txt             # Python dependencies
│   ├── models/                      # Trained ML models
│   │   └── emotion_cnn.pth
│   ├── data/                        # FER2013 dataset
│   │   └── fer2013/
│   └── archive/                     # Legacy/test data
│
├── .gitignore                       # Git ignore rules
└── README.md                        # This file
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)
- **PostgreSQL** (Neon cloud database account)
- **Git**
- API Keys:
  - Google Gemini API key
  - Sarvam AI API key

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/vineetj12/interview-ai.git
cd interview-ai
```

#### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file with your credentials
cp .env.example .env
# Edit .env with your PostgreSQL URL and API keys

# Run Prisma migrations
npx prisma migrate dev

# Optional: Seed database
npx prisma db seed
```

#### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:3001" > .env.local
```

#### 4. ML Service Setup
```bash
cd ../ml-service
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Optional: Download FER2013 dataset and train models
python train.py
```

### Environment Variables

**Backend (.env)**
```env
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require

# Server
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173

# Authentication
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# ML Service
ML_SERVICE_URL=http://localhost:8000

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# Sarvam AI (Speech & TTS)
SARVAM_API_KEY=your-sarvam-api-key
SARVAM_MODEL=saaras:v3
SARVAM_SPEECH_URL=https://api.sarvam.ai/speech-to-text
SARVAM_TTS_URL=https://api.sarvam.ai/text-to-speech
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_TTS_SPEAKER=shubh
SARVAM_TTS_LANG=hi-IN
```

**Frontend (.env.local)**
```env
VITE_API_URL=http://localhost:3001
```

## 🏃 Running the Project

### Development Mode (All Services)

**Terminal 1: Backend**
```bash
cd backend
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

**Terminal 3: ML Service**
```bash
cd ml-service
source venv/bin/activate  # or venv\Scripts\activate on Windows
python main.py
# Service runs on http://localhost:8000
```

### Production Build

**Backend**
```bash
cd backend
npm run build
npm run start
```

**Frontend**
```bash
cd frontend
npm run build
npm run preview
```

## 📡 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh JWT token

### Resume Review
- `POST /resume/review` - Analyze uploaded resume

### Mock Interviews
- `POST /interview/start` - Start new interview session
- `POST /interview/evaluate` - Evaluate interview answers
- `POST /interview/save` - Save interview session results
- `GET /interview/history` - Get past interview sessions

### Telemetry (WebSocket)
- `session:start` - Initialize real-time session
- `telemetry:send` - Send live biometric metrics
- `telemetry:update` - Broadcast metrics to connected clients

### ML Service (FastAPI)
- `POST /predict-emotion` - Predict emotion from image
- `POST /predict-stress` - Predict stress from telemetry
- `POST /analyze-patterns` - Analyze interview patterns

## 🤖 ML Models

### Emotion CNN
- **Architecture**: Convolutional Neural Network
- **Dataset**: FER2013 (7 emotions)
- **Classes**: Angry, Disgust, Fear, Happy, Neutral, Sad, Surprise
- **Fallback**: Heuristic prediction if model not available

### Stress Prediction
- **Model**: XGBoost Regressor
- **Input Features**:
  - Blink rate
  - Gaze away ratio
  - Motion intensity
  - Face luminance
  - Smile intensity
  - Head nod frequency
  - Posture score
- **Fallback**: Heuristic formula if model not available

## 📊 Database Schema

### User
- `id` - Unique identifier
- `email` - User email (unique)
- `passwordHash` - Encrypted password
- `createdAt` - Account creation timestamp

### InterviewSession
- `id` - Session identifier
- `userId` - Foreign key to User
- `domain` - Job domain (e.g., "Software Engineer")
- `overallScore` - 0-100 interview score
- `gazeScore` - Eye contact score
- `postureScore` - Body posture score
- `calmScore` - Calmness/stress level score
- `engagementScore` - Audience engagement score
- `bodyLanguageScore` - Overall body language score
- `stressTimeline` - JSON array of stress metrics over time
- `metricsDetail` - Detailed CV metrics
- `feedback` - AI-generated coaching feedback
- `createdAt` - Session timestamp

### RefreshToken
- `id` - Token identifier
- `token` - JWT refresh token
- `userId` - Foreign key to User
- `expiresAt` - Token expiration time

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# ML Service tests
cd ml-service
pytest
```

## 📝 Development Notes

### Real-time Telemetry Flow
1. Frontend captures webcam frame every 300ms
2. Computer vision hook extracts biometric metrics
3. Metrics sent via WebSocket to backend
4. Backend calls ML service for stress/emotion prediction
5. Results broadcast back to frontend in real-time

### Resume Analysis
- Supports PDF and image formats
- Uses OCR (Tesseract.js) for text extraction
- Gemini AI analyzes skills, experience, and formatting

### Interview Flow
1. User selects domain and question count
2. Backend generates interview questions (Gemini)
3. Frontend captures audio response
4. Sarvam AI converts speech to text
5. Backend evaluates answer and calculates scores
6. Gemini generates coaching feedback
7. Results saved to database

## 🚢 Deployment

### Recommended Platforms
- **Frontend**: Vercel, Netlify, or AWS CloudFront
- **Backend**: Render, Railway, AWS Elastic Beanstalk
- **Database**: Neon PostgreSQL
- **ML Service**: AWS SageMaker, Google Cloud Run, or Hugging Face Spaces

### Docker Deployment (Optional)
```bash
# Build Docker images
docker-compose build

# Run services
docker-compose up
```

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Google Generative AI API](https://ai.google.dev/)
- [Sarvam AI API](https://www.sarvam.ai/)

## 🐛 Troubleshooting

### ML Service Connection Error
- Ensure ML service is running on port 8000
- Check `ML_SERVICE_URL` in backend `.env`
- Verify CORS settings in FastAPI

### Webcam Not Working
- Check browser permissions for camera access
- Ensure HTTPS in production (required for webcam)
- Verify WebcamCV hook compatibility

### Database Connection Failed
- Verify PostgreSQL connection string in `.env`
- Ensure Neon database is active
- Run `npx prisma db push` to sync schema

### Missing API Keys
- Generate Google Gemini API key from [ai.google.dev](https://ai.google.dev/)
- Get Sarvam AI credentials from [sarvam.ai](https://www.sarvam.ai/)

## 📄 License

This project is private. All rights reserved.

## 👨‍💻 Author

**Vineet Jain**
- GitHub: [@vineetj12](https://github.com/vineetj12)
- Repository: [interview-ai](https://github.com/vineetj12/interview-ai)

## 🤝 Contributing

This is a private project. For contributions or inquiries, please reach out to the author.

---

**Last Updated**: June 2026  
**Version**: 0.1.0
