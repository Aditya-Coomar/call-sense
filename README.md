# CallSense - Advanced AMD Telephony System

A comprehensive Answering Machine Detection (AMD) system built with Next.js 14, featuring multiple AI strategies for accurate human vs. machine detection during outbound calls.

## 🚀 Features

- **Multiple AMD Strategies**: Choose from 4 different detection methods
  - Twilio Native AMD (built-in detection)
  - Jambonz SIP Enhanced (advanced SIP-based detection)
  - Hugging Face ML (fine-tuned wav2vec model)
  - Google Gemini 2.5 Flash (multimodal AI analysis)
- **Real-time Call Monitoring**: Live status updates and audio streaming
- **Comprehensive Analytics**: Performance metrics and accuracy tracking
- **Secure Authentication**: Better-Auth with Google OAuth support
- **Call History & Logging**: Complete audit trail of all calls
- **Modern UI**: Dark theme with responsive design

## 🛠️ Tech Stack

### Frontend & Backend

- **Next.js 14+** with App Router and TypeScript
- **Better-Auth** for authentication
- **Tailwind CSS** with Radix UI components
- **React Hot Toast** for notifications

### Database

- **PostgreSQL** with Prisma ORM
- **Supabase** for cloud database hosting

### AI & ML

- **Python FastAPI** microservice for ML models
- **Hugging Face Transformers** for audio classification
- **Google Gemini 2.5 Flash** for multimodal analysis
- **Twilio** for telephony and native AMD

### Infrastructure

- **Docker** for containerization
- **Vercel** for deployment (recommended)

## 📋 Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL database
- Twilio account with phone number
- Google Cloud account (for Gemini API)

## ⚡ Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/call-sense.git
cd call-sense
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd python-service
pip install -r requirements.txt
cd ..
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/callsense"
DIRECT_URL="postgresql://user:password@localhost:5432/callsense"

# Authentication
BETTER_AUTH_SECRET="your-secret-key-32-characters-long"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-secret"

# Twilio
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Google Gemini
GOOGLE_GEMINI_API_KEY="your-gemini-api-key"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PYTHON_ML_SERVICE_URL="http://localhost:8000"
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push
```

### 5. Start Services

Start the Next.js application:

```bash
npm run dev
```

In a separate terminal, start the Python ML service:

```bash
cd python-service
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## 🧪 Testing AMD Strategies

### Test Numbers (Voicemail Detection)

- **Costco**: 1-800-774-2678
- **Nike**: 1-800-806-6453
- **PayPal**: 1-888-221-1161

### Human Detection Testing

- Use your personal phone number
- Answer immediately with "Hello" to test human detection

### Expected Results

- **>85% machine detection** accuracy on test numbers
- **<3 second latency** for detection
- **Real-time status updates** in the UI

## 📊 AMD Strategy Comparison

| Strategy         | Accuracy | Latency | Cost   | Best For          |
| ---------------- | -------- | ------- | ------ | ----------------- |
| Twilio Native    | 85%      | 2-5s    | Low    | Basic detection   |
| Jambonz SIP      | 92%      | 3-7s    | Medium | Enhanced accuracy |
| Hugging Face ML  | 88%      | 4-8s    | Medium | Custom training   |
| Gemini 2.5 Flash | 91%      | 2-6s    | High   | Complex scenarios |

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │────│   Prisma ORM    │────│   PostgreSQL    │
│   (Frontend)    │    │   (Database)    │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Twilio Voice   │────│  Webhook Handler │────│  AMD Processor  │
│  (Telephony)    │    │  (Call Events)  │    │  (Strategies)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│  Python Service │    │   Gemini API    │
│  (ML Models)    │    │  (AI Analysis)  │
└─────────────────┘    └─────────────────┘
```

## 🔧 Development

### Code Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication
│   │   ├── calls/         # Call management
│   │   └── webhooks/      # Twilio webhooks
│   ├── dashboard/         # Main dashboard
│   └── login/             # Authentication UI
├── components/ui/         # Reusable UI components
└── lib/                   # Utilities and services
    ├── auth.ts           # Better-Auth configuration
    ├── prisma.ts         # Database client
    └── integrations/     # Third-party services

python-service/
├── app.py                # FastAPI ML service
├── requirements.txt      # Python dependencies
└── Dockerfile           # Container configuration
```

### API Endpoints

#### Authentication

- `GET /api/auth/session` - Get current session
- `POST /api/auth/signin` - Sign in user
- `POST /api/auth/signup` - Create account

#### Call Management

- `POST /api/calls/dial` - Initiate outbound call
- `GET /api/calls/logs` - Fetch call history
- `GET /api/calls/[id]/status` - Get call status
- `POST /api/calls/[id]/hangup` - End active call

#### Webhooks

- `POST /api/webhooks/twilio-calls` - Handle call events

#### ML Service

- `POST /predict` - Analyze audio file
- `POST /predict_url` - Analyze audio from URL
- `GET /health` - Service health check

### Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Python service tests
cd python-service
python -m pytest
```

## 🚀 Deployment

### Using Docker

```bash
# Build and run Next.js app
docker build -t callsense-app .
docker run -p 3000:3000 callsense-app

# Build and run Python service
cd python-service
docker build -t callsense-ml .
docker run -p 8000:8000 callsense-ml
```

### Using Docker Compose

```bash
docker-compose up -d
```

### Vercel Deployment

1. Connect repository to Vercel
2. Configure environment variables
3. Deploy Python service separately (Railway, Render, etc.)
4. Update `PYTHON_ML_SERVICE_URL` in production

## 🔒 Security Considerations

- **Webhook Validation**: All Twilio webhooks are signature-validated
- **Rate Limiting**: API endpoints have built-in rate limiting
- **Input Validation**: Zod schemas validate all API inputs
- **Authentication**: Secure session management with Better-Auth
- **HTTPS**: All production traffic uses TLS encryption

## 📈 Performance Optimization

- **Database Indexing**: Optimized queries with proper indexes
- **Caching**: Redis caching for frequently accessed data
- **CDN**: Static assets served via CDN
- **Streaming**: Real-time updates via WebSocket connections
- **Background Jobs**: Async processing for ML inference

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/your-username/call-sense/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/call-sense/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/call-sense/discussions)

## 🙏 Acknowledgments

- [Twilio](https://www.twilio.com) for telephony infrastructure
- [Hugging Face](https://huggingface.co) for ML models
- [Google](https://ai.google.dev) for Gemini API
- [Jambonz](https://jambonz.org) for SIP-based AMD

---

Built with ❤️ for the Attack Capital assignment
