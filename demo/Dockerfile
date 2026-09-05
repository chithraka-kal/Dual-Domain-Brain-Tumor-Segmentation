# Use PyTorch official lightweight CPU image
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV/Matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Expose port 8000
EXPOSE 8000

# Start FastAPI server
CMD ["python", "fastapi_server.py"]
