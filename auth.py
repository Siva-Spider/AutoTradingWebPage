# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import logging

from .routes import broker_routes
# from .core.auth import get_current_user # Temporarily commented out as it's not yet implemented

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Astya Broker Integration API",
    description="API for connecting to various brokerage platforms.",
    version="0.1.0",
)

# Configure CORS to allow your frontend to communicate with the backend
origins = [
    "http://localhost:3000",  # React app default port
    # Add other frontend origins if deployed elsewhere
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include your API routers
app.include_router(broker_routes.router, prefix="/api/brokers", tags=["Brokers"])

@app.get("/")
async def root():
    return {"message": "Astya Backend is running!"}

