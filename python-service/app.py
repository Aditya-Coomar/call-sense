from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
import torchaudio
import librosa
import numpy as np
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
import requests
import tempfile
import os
from typing import Dict

app = FastAPI(title="AMD ML Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the Hugging Face model
MODEL_NAME = "jakeBland/wav2vec-vm-finetune"
feature_extractor = None
model = None

@app.on_event("startup")
async def startup_event():
    global feature_extractor, model
    try:
        print("Loading Hugging Face model...")
        feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)
        model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME)
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {e}")
        # Fallback: create a dummy model for testing
        print("Using dummy model for testing...")

@app.get("/")
async def root():
    return {"message": "AMD ML Service is running", "model": MODEL_NAME}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "model_loaded": model is not None,
        "feature_extractor_loaded": feature_extractor is not None
    }

@app.post("/predict")
async def predict_amd(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith(('.wav', '.mp3', '.m4a', '.flac')):
            raise HTTPException(status_code=400, detail="Unsupported audio format")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Load and preprocess audio
            audio, sample_rate = librosa.load(tmp_file_path, sr=16000)
            
            if model is None or feature_extractor is None:
                # Fallback: dummy prediction for testing
                result = predict_dummy(audio)
            else:
                # Real model prediction
                result = predict_with_model(audio, sample_rate)
            
            return result
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

def predict_with_model(audio: np.ndarray, sample_rate: int) -> Dict:
    try:
        # Preprocess audio for the model
        inputs = feature_extractor(
            audio, 
            sampling_rate=sample_rate, 
            return_tensors="pt",
            padding=True
        )
        
        # Make prediction
        with torch.no_grad():
            outputs = model(**inputs)
            predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
        # Get the predicted class and confidence
        predicted_class_id = predictions.argmax().item()
        confidence = predictions.max().item()
        
        # Map class ID to label (assuming 0=human, 1=machine)
        label = "machine" if predicted_class_id == 1 else "human"
        
        return {
            "label": label,
            "confidence": float(confidence),
            "raw_predictions": predictions.tolist()[0],
            "model": MODEL_NAME
        }
        
    except Exception as e:
        print(f"Model prediction error: {e}")
        return predict_dummy(audio)

def predict_dummy(audio: np.ndarray) -> Dict:
    # Dummy prediction based on audio characteristics
    # This is a fallback when the real model isn't available
    
    # Simple heuristics for demo purposes
    audio_energy = np.mean(np.abs(audio))
    audio_length = len(audio) / 16000  # seconds
    
    # Dummy logic: longer audio with consistent energy = machine
    if audio_length > 3.0 and audio_energy > 0.01:
        label = "machine"
        confidence = 0.75
    else:
        label = "human"  
        confidence = 0.65
        
    return {
        "label": label,
        "confidence": confidence,
        "raw_predictions": [0.35, 0.65] if label == "human" else [0.75, 0.25],
        "model": "dummy_model"
    }

@app.post("/predict_url")
async def predict_from_url(audio_url: str):
    try:
        # Download audio from URL
        response = requests.get(audio_url, timeout=30)
        response.raise_for_status()
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_file.write(response.content)
            tmp_file_path = tmp_file.name
        
        try:
            # Load and preprocess audio
            audio, sample_rate = librosa.load(tmp_file_path, sr=16000)
            
            if model is None or feature_extractor is None:
                result = predict_dummy(audio)
            else:
                result = predict_with_model(audio, sample_rate)
            
            return result
            
        finally:
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL prediction failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
