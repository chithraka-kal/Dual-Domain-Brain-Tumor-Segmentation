#!/bin/bash
# Startup script for the Dual-Domain Brain Tumor Segmentation FastAPI Backend

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$DEMO_DIR/venv/bin/python"

if [ -f "$VENV_PYTHON" ]; then
    PYTHON_CMD="$VENV_PYTHON"
else
    PYTHON_CMD="python3"
fi

echo "🧠 Starting Dual-Domain Brain Tumor Segmentation API Backend..."
echo "📍 Server URL: http://localhost:8000"
echo "🌐 API Endpoints: http://localhost:8000/api/health & http://localhost:8000/api/inference"
echo "🎨 Interactive Gradio UI: http://localhost:8000/gradio"
echo "--------------------------------------------------------"

cd "$DEMO_DIR"
exec "$PYTHON_CMD" fastapi_server.py
