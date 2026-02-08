# ML/AI Integration Future Opportunities for LaundryEase

This document outlines potential machine learning and artificial intelligence integrations for the LaundryEase platform. These features can enhance user experience, improve operational efficiency, and provide competitive advantages.

## Table of Contents

- [Overview](#overview)
- [High-Impact Opportunities](#high-impact-opportunities)
  - [1. Demand Forecasting](#1-demand-forecasting)
  - [2. Fraud Detection](#2-fraud-detection)
  - [3. Smart Provider Matching](#3-smart-provider-matching)
  - [4. Image-Based Garment Classification](#4-image-based-garment-classification)
  - [5. Sentiment Analysis](#5-sentiment-analysis)
  - [6. Delivery Time Prediction](#6-delivery-time-prediction)
- [Quick Wins](#quick-wins)
  - [AI-Powered Chatbot](#ai-powered-chatbot)
  - [Review Summarization](#review-summarization)
  - [Complaint Priority Scoring](#complaint-priority-scoring)
- [Architecture Approaches](#architecture-approaches)
- [Data Requirements](#data-requirements)
- [Implementation Roadmap](#implementation-roadmap)
- [Technology Stack Options](#technology-stack-options)
- [PyTorch vs TensorFlow](#pytorch-vs-tensorflow)

---

## Overview

LaundryEase's escrow-backed workflow system generates rich transactional data that can power intelligent features. The platform's existing data on bookings, orders, locations, payments, reviews, and disputes provides a strong foundation for ML/AI integration.

### Current Data Assets

| Data Type       | Source                            | ML Potential                           |
| --------------- | --------------------------------- | -------------------------------------- |
| Booking history | `bookings` collection             | Demand forecasting, pattern analysis   |
| Order lifecycle | `orders` collection               | Delivery prediction, anomaly detection |
| Location data   | Provider radius, seeker addresses | Geospatial optimization                |
| Payment records | Razorpay transactions             | Fraud detection                        |
| Chat messages   | Booking/complaint chat            | Sentiment analysis                     |
| Reviews         | Post-delivery feedback            | NLP, recommendation                    |
| Complaints      | Dispute records                   | Priority scoring, pattern detection    |

---

## High-Impact Opportunities

### 1. Demand Forecasting

Predict booking volume and help providers manage capacity effectively.

#### Use Cases

- **Provider capacity planning**: Alert providers about expected busy periods
- **Dynamic availability**: Suggest optimal working hours based on demand
- **Platform-level insights**: Identify underserved areas for expansion

#### Technical Approach

```
Input Features:
- Day of week, time of day
- Historical booking counts (same day last week/month/year)
- Weather data (optional API integration)
- Local events/holidays
- Provider location cluster

Output:
- Predicted booking count for next 24/48/72 hours
- Confidence intervals
```

#### Recommended Stack

| Option                    | Pros                             | Cons                             |
| ------------------------- | -------------------------------- | -------------------------------- |
| **TensorFlow/Keras LSTM** | Handles sequential patterns      | Requires training infrastructure |
| **Prophet (Meta)**        | Easy to use, handles seasonality | Less customizable                |
| **AWS Forecast**          | Managed service, no infra        | Cost, vendor lock-in             |

#### Data Requirements

- Minimum 6 months of booking history
- At least 1000 bookings for meaningful patterns
- Location and timestamp granularity

---

### 2. Fraud Detection

Identify and prevent fraudulent activities before financial loss occurs.

#### Fraud Patterns to Detect

| Pattern                  | Description                                             | Risk Level |
| ------------------------ | ------------------------------------------------------- | ---------- |
| **Complaint abuse**      | Seekers repeatedly raising false complaints for refunds | High       |
| **Booking manipulation** | Providers canceling selectively to game ratings         | Medium     |
| **Payment anomalies**    | Unusual payment patterns, failed verification attempts  | High       |
| **Account takeover**     | Sudden behavior changes indicating compromised accounts | Critical   |
| **Collusion**            | Fake bookings between related accounts                  | Medium     |

#### Technical Approach

```python
# Feature engineering for fraud detection
features = {
    'user_features': [
        'account_age_days',
        'total_bookings',
        'cancellation_rate',
        'complaint_rate',
        'avg_order_value',
        'payment_failure_rate'
    ],
    'transaction_features': [
        'time_since_last_booking',
        'distance_from_usual_location',
        'price_deviation_from_avg',
        'rush_booking_flag'  # booked < 1 hour before pickup
    ],
    'behavioral_features': [
        'session_duration',
        'pages_before_booking',
        'device_fingerprint_changes'
    ]
}
```

#### Model Options

1. **Isolation Forest**: Good for anomaly detection with limited labeled data
2. **XGBoost Classifier**: If you have labeled fraud cases
3. **Autoencoder**: Detect anomalies by reconstruction error

#### Integration Points

- Pre-booking: Block suspicious booking attempts
- Pre-escrow-release: Flag orders for manual review
- Post-delivery: Detect complaint pattern abuse

---

### 3. Smart Provider Matching

Enhance the radius-based discovery with intelligent matching.

#### Current Limitation

LaundryEase currently matches providers based solely on service radius. This misses opportunities for better matches based on:

- Provider specialization (delicates, bulk orders, express service)
- Historical success rate with similar order types
- Seeker preferences and past behavior
- Provider current workload and response time

#### Recommendation Algorithm

```
Matching Score = w1 * distance_score
              + w2 * specialization_match
              + w3 * historical_success_rate
              + w4 * response_time_score
              + w5 * price_competitiveness
              + w6 * availability_score

Where weights (w1-w6) are learned from:
- Booking completion rates
- Review scores
- Repeat booking patterns
```

#### Implementation Options

| Approach                           | Complexity | Effectiveness |
| ---------------------------------- | ---------- | ------------- |
| **Rule-based scoring**             | Low        | Moderate      |
| **Collaborative filtering**        | Medium     | Good          |
| **Neural collaborative filtering** | High       | Best          |
| **Hybrid (rules + ML)**            | Medium     | Good          |

#### Data Requirements

- User-provider interaction history
- Booking outcomes (completed, cancelled, disputed)
- Review scores and text
- Provider service attributes

---

### 4. Image-Based Garment Classification

Automate garment categorization during invoice creation.

#### Use Cases

- **Auto-fill invoice items**: Provider takes photo, system suggests categories
- **Price suggestions**: Recommend pricing based on detected garment types
- **Inventory verification**: Match pickup items with delivered items
- **Damage detection**: Flag potential damage for dispute prevention

#### Classification Categories

```
garment_categories = {
    'tops': ['shirt', 'tshirt', 'blouse', 'sweater', 'jacket'],
    'bottoms': ['pants', 'jeans', 'shorts', 'skirt'],
    'dresses': ['dress', 'gown', 'saree', 'kurta'],
    'household': ['bedsheet', 'curtain', 'towel', 'blanket'],
    'delicates': ['silk', 'wool', 'cashmere', 'embroidered'],
    'heavy': ['coat', 'comforter', 'carpet']
}
```

#### Technical Approach

**Option 1: TensorFlow.js (Client-side)**

```javascript
// Run in browser - no server costs
import * as tf from "@tensorflow/tfjs";
import { load } from "@tensorflow-models/mobilenet";

async function classifyGarment(imageElement) {
  const model = await load();
  const predictions = await model.classify(imageElement);
  return mapToGarmentCategory(predictions);
}
```

**Option 2: Cloud Vision API**

```typescript
// Server-side with Google Cloud Vision
import vision from "@google-cloud/vision";

async function classifyGarment(imagePath: string) {
  const client = new vision.ImageAnnotatorClient();
  const [result] = await client.labelDetection(imagePath);
  return mapLabelsToGarmentCategory(result.labelAnnotations);
}
```

**Option 3: Custom Model (Best accuracy)**

Train a custom model on laundry-specific images for highest accuracy.

#### Integration Point

Add to the invoice creation flow in `components/providers/invoice-form.tsx`:

1. Provider uploads item photo
2. Model classifies garment type
3. Auto-suggests category and price
4. Provider confirms or adjusts

---

### 5. Sentiment Analysis

Extract insights from text data across the platform.

#### Applications

| Source             | Analysis                             | Action                       |
| ------------------ | ------------------------------------ | ---------------------------- |
| Booking chat       | Detect frustration/conflict early    | Alert admin for intervention |
| Reviews            | Extract themes, satisfaction drivers | Improve service guidelines   |
| Complaint messages | Assess severity and urgency          | Priority queue routing       |
| Provider responses | Monitor professionalism              | Training recommendations     |

#### Technical Approach

**Option 1: Pre-built APIs (Recommended for start)**

```typescript
// Using OpenAI for sentiment analysis
import OpenAI from "openai";

const openai = new OpenAI();

async function analyzeSentiment(message: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Analyze the sentiment and urgency of this customer message. Return JSON with: sentiment (positive/neutral/negative), urgency (low/medium/high), key_issues (array of identified problems).",
      },
      {
        role: "user",
        content: message,
      },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(response.choices[0].message.content);
}
```

**Option 2: Local Model (Cost-effective at scale)**

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis",
                      model="cardiffnlp/twitter-roberta-base-sentiment")

def analyze_message(text):
    result = classifier(text)[0]
    return {
        'sentiment': result['label'],
        'confidence': result['score']
    }
```

#### Integration Points

1. **Real-time chat monitoring**: Flag negative sentiment in active bookings
2. **Complaint triage**: Auto-prioritize based on severity
3. **Review insights dashboard**: Aggregate sentiment trends for admin

---

### 6. Delivery Time Prediction

Provide accurate delivery estimates based on historical data.

#### Features for Prediction

```python
prediction_features = {
    'provider_metrics': [
        'avg_completion_time',
        'current_active_orders',
        'historical_on_time_rate'
    ],
    'order_characteristics': [
        'item_count',
        'service_type',  # wash, iron, dry-clean
        'special_instructions_flag'
    ],
    'temporal_features': [
        'day_of_week',
        'is_weekend',
        'is_holiday',
        'time_of_day'
    ],
    'external_factors': [
        'weather_condition',
        'distance_km'
    ]
}
```

#### Model Architecture

```
Simple approach: Gradient Boosting (XGBoost/LightGBM)
- Input: Feature vector
- Output: Predicted hours to completion
- Metric: MAE (Mean Absolute Error)

Advanced approach: Neural Network with uncertainty
- Output: Mean prediction + confidence interval
- Display: "Estimated delivery: 24-28 hours"
```

#### User Experience

```typescript
// Display in seeker dashboard
interface DeliveryPrediction {
  estimatedHours: number;
  confidenceInterval: [number, number];
  factors: string[]; // "Provider typically completes in 24h"
}
```

---

## Quick Wins

### AI-Powered Chatbot

Implement a conversational assistant for common queries.

#### Capabilities

- Answer FAQs (pricing, service areas, policies)
- Guide new users through booking process
- Handle simple support requests
- Escalate complex issues to human support

#### Implementation

```typescript
// Using Vercel AI SDK with OpenAI
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system: `You are LaundryEase support assistant. Help users with:
            - Booking process questions
            - Order status inquiries
            - Pricing information
            - Service coverage questions
            - Dispute resolution guidance

            Be concise and helpful. If you can't help, offer to connect with human support.`,
    messages,
  });

  return result.toDataStreamResponse();
}
```

#### Effort: Low | Impact: High

---

### Review Summarization

Generate digestible summaries from provider reviews.

#### Use Case

Instead of reading 50+ reviews, seekers see:

```
Provider Summary (based on 47 reviews):
✓ Praised for: Quick turnaround, careful handling of delicates
⚠ Noted concerns: Occasional pickup delays
★ 4.6 average | 94% recommend
```

#### Implementation

```typescript
async function summarizeReviews(reviews: Review[]) {
  const reviewTexts = reviews.map((r) => r.text).join("\n---\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Summarize these laundry service reviews. Extract: top 3 praised aspects, top 2 concerns, overall recommendation rate.",
      },
      {
        role: "user",
        content: reviewTexts,
      },
    ],
  });

  return response.choices[0].message.content;
}
```

#### Effort: Low | Impact: Medium

---

### Complaint Priority Scoring

Automatically prioritize complaints for admin attention.

#### Scoring Factors

| Factor                | Weight | Description                             |
| --------------------- | ------ | --------------------------------------- |
| Order value           | 0.2    | Higher value = higher priority          |
| Seeker history        | 0.15   | First-time complainers get attention    |
| Sentiment severity    | 0.25   | Angry messages escalate faster          |
| Provider track record | 0.15   | Repeat offender complaints prioritized  |
| Time sensitivity      | 0.15   | Approaching deadlines increase priority |
| Evidence quality      | 0.1    | Photos/documentation boost priority     |

#### Implementation

```typescript
interface ComplaintPriority {
  score: number; // 0-100
  level: "low" | "medium" | "high" | "critical";
  factors: string[]; // Explanation for admin
  suggestedAction: string;
}

async function scoreComplaint(
  complaint: Complaint,
): Promise<ComplaintPriority> {
  const features = await extractFeatures(complaint);
  const score = await model.predict(features);

  return {
    score,
    level: scoreToLevel(score),
    factors: explainScore(features),
    suggestedAction: recommendAction(score, features),
  };
}
```

#### Effort: Medium | Impact: High

---

## Architecture Approaches

### Option 1: API-Based (Recommended for Start)

Use third-party ML APIs for quick implementation.

```
┌─────────────────┐     ┌──────────────────┐
│   Next.js App   │────▶│   OpenAI API     │ Text Analysis
└─────────────────┘     └──────────────────┘
         │              ┌──────────────────┐
         └─────────────▶│ Google Cloud     │ Vision, Maps
                        │ Vision API       │
                        └──────────────────┘
```

**Pros**: Fast to implement, no ML expertise needed, auto-scaling
**Cons**: Per-request costs, data privacy considerations, vendor dependency

### Option 2: Hybrid (Recommended for Growth)

Combine APIs with lightweight local models.

```
┌─────────────────┐     ┌──────────────────┐
│   Next.js App   │────▶│  TensorFlow.js   │ Client-side inference
└─────────────────┘     │  (Browser)       │
         │              └──────────────────┘
         │              ┌──────────────────┐
         └─────────────▶│  Python Service  │ Complex ML models
                        │  (FastAPI)       │
                        └──────────────────┘
                                 │
                        ┌──────────────────┐
                        │  Model Registry  │ MLflow / Weights & Biases
                        └──────────────────┘
```

### Option 3: Full ML Platform (Enterprise Scale)

Complete ML infrastructure for advanced use cases.

```
┌─────────────────────────────────────────────────────────┐
│                    ML Platform                          │
├─────────────────┬─────────────────┬────────────────────┤
│  Feature Store  │  Model Serving  │  Experiment Track  │
│  (Feast)        │  (TF Serving)   │  (MLflow)          │
├─────────────────┴─────────────────┴────────────────────┤
│              Training Pipeline (Kubeflow)               │
├─────────────────────────────────────────────────────────┤
│              Data Lake (MongoDB + S3)                   │
└─────────────────────────────────────────────────────────┘
```

---

## Data Requirements

### Minimum Viable Data

| Feature                | Required Records         | Current Status    |
| ---------------------- | ------------------------ | ----------------- |
| Demand forecasting     | 1,000+ bookings          | Check DB          |
| Fraud detection        | 100+ labeled fraud cases | Need labeling     |
| Provider matching      | 500+ completed bookings  | Check DB          |
| Sentiment analysis     | No training needed       | Ready (API-based) |
| Garment classification | 1,000+ labeled images    | Need collection   |

### Data Collection Strategy

1. **Implicit collection**: Log all user interactions
2. **Explicit labeling**: Admin marks fraud cases during review
3. **User feedback**: Ask seekers to confirm garment categories
4. **Synthetic augmentation**: Generate edge cases for training

### Data Pipeline

```typescript
// Example: Logging for ML features
interface MLEventLog {
  eventType: "booking_created" | "order_completed" | "complaint_raised";
  timestamp: Date;
  userId: string;
  sessionId: string;
  features: Record<string, any>;
  outcome?: "success" | "cancelled" | "disputed";
}

async function logMLEvent(event: MLEventLog) {
  await db.collection("ml_events").insertOne({
    ...event,
    createdAt: new Date(),
  });
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

- [ ] Set up ML event logging infrastructure
- [ ] Implement AI chatbot with OpenAI
- [ ] Add review summarization to provider profiles
- [ ] Create admin dashboard for ML metrics

### Phase 2: Quick Wins (Weeks 5-8)

- [ ] Deploy sentiment analysis for chat monitoring
- [ ] Implement complaint priority scoring
- [ ] Add basic price suggestions based on historical data
- [ ] A/B test chatbot with subset of users

### Phase 3: Core ML Features (Weeks 9-16)

- [ ] Build demand forecasting model
- [ ] Train garment classification model
- [ ] Implement smart provider matching
- [ ] Deploy fraud detection (rule-based first)

### Phase 4: Advanced Features (Weeks 17-24)

- [ ] Delivery time prediction with confidence intervals
- [ ] ML-based fraud detection model
- [ ] Provider performance prediction
- [ ] Automated dispute resolution suggestions

---

## Technology Stack Options

### Recommended Stack (Balanced)

| Layer                   | Technology                    | Reason                             |
| ----------------------- | ----------------------------- | ---------------------------------- |
| **Text AI**             | OpenAI API / Google Gemini    | Best quality, easy integration     |
| **Vision**              | TensorFlow.js + Cloud Vision  | Client-side + server fallback      |
| **Tabular ML**          | Python + scikit-learn/XGBoost | Industry standard, well-documented |
| **Model Serving**       | FastAPI + Docker              | Lightweight, easy deployment       |
| **Experiment Tracking** | Weights & Biases (free tier)  | Easy setup, good visualization     |

### Budget-Conscious Stack

| Layer          | Technology                     | Monthly Cost      |
| -------------- | ------------------------------ | ----------------- |
| **Text AI**    | Ollama + Llama 3 (self-hosted) | $0 (compute only) |
| **Vision**     | TensorFlow.js (client-side)    | $0                |
| **ML Backend** | Python on Vercel Functions     | ~$20              |
| **Tracking**   | MLflow (self-hosted)           | $0                |

### Enterprise Stack

| Layer              | Technology                    |
| ------------------ | ----------------------------- |
| **Platform**       | AWS SageMaker / GCP Vertex AI |
| **Feature Store**  | Feast / Tecton                |
| **Model Registry** | MLflow / SageMaker Registry   |
| **Monitoring**     | Evidently AI / WhyLabs        |

---

## PyTorch vs TensorFlow

Both frameworks are excellent choices. Here's a comparison to help you decide:

### Quick Comparison

| Aspect                | PyTorch                 | TensorFlow                  |
| --------------------- | ----------------------- | --------------------------- |
| **Learning curve**    | Easier, Pythonic        | Steeper, more concepts      |
| **Debugging**         | Native Python debugging | TF-specific debugging tools |
| **Community**         | Research-focused        | Production-focused          |
| **Deployment**        | TorchServe, ONNX        | TF Serving, TF Lite, TF.js  |
| **Mobile/Browser**    | Limited (ONNX.js)       | Excellent (TF.js, TF Lite)  |
| **Industry adoption** | Growing rapidly         | Widely established          |
| **Dynamic graphs**    | Native                  | Eager mode available        |

### When to Choose PyTorch

- **Research & experimentation**: Faster iteration cycles
- **Custom model architectures**: More intuitive to build
- **NLP tasks**: Hugging Face Transformers uses PyTorch by default
- **Team familiarity**: If your team knows PyTorch better
- **Rapid prototyping**: Debug like regular Python code

### When to Choose TensorFlow

- **Browser deployment**: TensorFlow.js is more mature
- **Mobile apps**: TensorFlow Lite is production-ready
- **Production pipelines**: TF Extended (TFX) for MLOps
- **Edge devices**: Better optimization for low-power devices
- **Existing infrastructure**: If you already use GCP/Vertex AI

### PyTorch Implementation Examples

#### Fraud Detection with PyTorch

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

class FraudDetector(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.network(x)

# Training
model = FraudDetector(input_dim=15)
criterion = nn.BCELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

for epoch in range(100):
    for batch_x, batch_y in train_loader:
        optimizer.zero_grad()
        outputs = model(batch_x)
        loss = criterion(outputs.squeeze(), batch_y)
        loss.backward()
        optimizer.step()

# Save model
torch.save(model.state_dict(), 'fraud_detector.pth')
```

#### Garment Classification with PyTorch

```python
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

class GarmentClassifier(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        # Use pretrained ResNet as backbone
        self.backbone = models.resnet18(pretrained=True)
        # Freeze early layers
        for param in list(self.backbone.parameters())[:-10]:
            param.requires_grad = False
        # Replace final layer
        self.backbone.fc = nn.Linear(512, num_classes)

    def forward(self, x):
        return self.backbone(x)

# Inference
model = GarmentClassifier(num_classes=10)
model.load_state_dict(torch.load('garment_classifier.pth'))
model.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225])
])

def classify_garment(image_path: str) -> dict:
    image = Image.open(image_path).convert('RGB')
    tensor = transform(image).unsqueeze(0)

    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.softmax(outputs, dim=1)
        predicted_class = torch.argmax(probabilities, dim=1).item()

    categories = ['shirt', 'pants', 'dress', 'jacket', 'skirt',
                  'sweater', 'tshirt', 'jeans', 'shorts', 'towel']

    return {
        'category': categories[predicted_class],
        'confidence': probabilities[0][predicted_class].item()
    }
```

#### Demand Forecasting with PyTorch LSTM

```python
import torch
import torch.nn as nn

class DemandForecaster(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        # Take the last time step
        last_output = lstm_out[:, -1, :]
        return self.fc(last_output)

# Example usage
model = DemandForecaster(input_size=7)  # 7 features

# Features: day_of_week, hour, is_weekend, is_holiday,
#           prev_day_bookings, prev_week_bookings, weather_score
sequence_length = 14  # 2 weeks of history
batch_size = 32

# Input shape: (batch_size, sequence_length, num_features)
sample_input = torch.randn(batch_size, sequence_length, 7)
prediction = model(sample_input)  # Shape: (batch_size, 1)
```

#### Sentiment Analysis with PyTorch + Transformers

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

class SentimentAnalyzer:
    def __init__(self):
        self.model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self.model.eval()

    def analyze(self, text: str) -> dict:
        inputs = self.tokenizer(text, return_tensors="pt",
                               truncation=True, max_length=512)

        with torch.no_grad():
            outputs = self.model(**inputs)
            scores = torch.softmax(outputs.logits, dim=1)

        labels = ['negative', 'neutral', 'positive']
        scores_dict = {label: score.item()
                      for label, score in zip(labels, scores[0])}

        predicted_label = labels[torch.argmax(scores).item()]

        return {
            'sentiment': predicted_label,
            'confidence': scores_dict[predicted_label],
            'scores': scores_dict
        }

# Usage
analyzer = SentimentAnalyzer()
result = analyzer.analyze("The laundry service was excellent! Very fast delivery.")
# {'sentiment': 'positive', 'confidence': 0.94, 'scores': {...}}
```

### PyTorch Model Serving Options

#### Option 1: FastAPI + PyTorch

```python
from fastapi import FastAPI, File, UploadFile
import torch
from PIL import Image
import io

app = FastAPI()

# Load model at startup
model = GarmentClassifier()
model.load_state_dict(torch.load('model.pth'))
model.eval()

@app.post("/classify")
async def classify(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    result = classify_garment(image)
    return result

@app.post("/analyze-sentiment")
async def analyze_sentiment(text: str):
    result = analyzer.analyze(text)
    return result
```

#### Option 2: TorchServe (Production)

```bash
# Package model
torch-model-archiver --model-name garment_classifier \
    --version 1.0 \
    --model-file model.py \
    --serialized-file garment_classifier.pth \
    --handler image_classifier

# Start server
torchserve --start --model-store model_store --models garment_classifier.mar
```

#### Option 3: ONNX Export (Cross-platform)

```python
import torch.onnx

# Export PyTorch model to ONNX
dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    model,
    dummy_input,
    "garment_classifier.onnx",
    export_params=True,
    opset_version=11,
    input_names=['image'],
    output_names=['category'],
    dynamic_axes={'image': {0: 'batch_size'}}
)

# Now can run with ONNX Runtime in Node.js
```

```typescript
// Using ONNX Runtime in Next.js API route
import * as ort from "onnxruntime-node";

const session = await ort.InferenceSession.create("garment_classifier.onnx");

export async function classifyGarment(imageData: Float32Array) {
  const tensor = new ort.Tensor("float32", imageData, [1, 3, 224, 224]);
  const results = await session.run({ image: tensor });
  return results.category.data;
}
```

### Recommended Approach for LaundryEase

Given your Next.js stack, here's the recommended PyTorch integration:

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
│   - Chatbot (OpenAI/Gemini API)                             │
│   - Simple inference (ONNX Runtime)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Python ML Microservice (FastAPI)                │
│   - Fraud detection (PyTorch)                                │
│   - Garment classification (PyTorch + torchvision)           │
│   - Demand forecasting (PyTorch LSTM)                        │
│   - Sentiment analysis (Transformers/PyTorch)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Model Storage                             │
│   - MLflow Model Registry                                    │
│   - S3/GCS for model artifacts                               │
└─────────────────────────────────────────────────────────────┘
```

### PyTorch-Focused Stack

| Component                | Technology                          |
| ------------------------ | ----------------------------------- |
| **Training**             | PyTorch + PyTorch Lightning         |
| **NLP Models**           | Hugging Face Transformers (PyTorch) |
| **Vision Models**        | torchvision                         |
| **Serving**              | TorchServe or FastAPI + Uvicorn     |
| **Export**               | ONNX for cross-platform deployment  |
| **Experiment Tracking**  | Weights & Biases or MLflow          |
| **Distributed Training** | PyTorch DDP or Ray                  |

---

## Next Steps

1. **Audit current data**: Run queries to assess data volume and quality
2. **Choose first feature**: Start with AI chatbot (lowest effort, immediate value)
3. **Set up logging**: Implement ML event logging for future model training
4. **Prototype**: Build a proof-of-concept for one high-impact feature

---

## Resources

### Libraries & Frameworks

- [PyTorch](https://pytorch.org/) - Dynamic neural networks, research-friendly
- [PyTorch Lightning](https://lightning.ai/) - High-level PyTorch wrapper
- [Hugging Face Transformers](https://huggingface.co/transformers/) - Pre-trained NLP models (PyTorch-first)
- [torchvision](https://pytorch.org/vision/) - Computer vision with PyTorch
- [TensorFlow.js](https://www.tensorflow.org/js) - ML in the browser
- [ONNX Runtime](https://onnxruntime.ai/) - Cross-platform model inference
- [Vercel AI SDK](https://sdk.vercel.ai/) - Streaming AI responses in Next.js
- [LangChain](https://langchain.com/) - Building LLM applications
- [scikit-learn](https://scikit-learn.org/) - Classical ML algorithms
- [XGBoost](https://xgboost.readthedocs.io/) - Gradient boosting

### Tutorials

- [PyTorch Official Tutorials](https://pytorch.org/tutorials/)
- [PyTorch Lightning Getting Started](https://lightning.ai/docs/pytorch/stable/starter/introduction.html)
- [Hugging Face Course](https://huggingface.co/learn/nlp-course)
- [Next.js + OpenAI Chatbot](https://vercel.com/templates/next.js/nextjs-ai-chatbot)
- [TensorFlow.js Image Classification](https://www.tensorflow.org/js/tutorials)
- [Building Recommendation Systems](https://developers.google.com/machine-learning/recommendation)

### Papers & Articles

- [Fraud Detection in E-commerce](https://arxiv.org/abs/2107.01979)
- [Time Series Forecasting with Prophet](https://facebook.github.io/prophet/)
- [Neural Collaborative Filtering](https://arxiv.org/abs/1708.05031)
