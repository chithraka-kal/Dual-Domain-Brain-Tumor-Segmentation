# Use Python 3.10 slim base image
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV/Matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch to keep image lightweight (~300MB instead of >2.5GB)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source files
COPY . .

# Expose FastAPI backend port
EXPOSE 8000

# Start FastAPI server
CMD ["python", "fastapi_server.py"]
