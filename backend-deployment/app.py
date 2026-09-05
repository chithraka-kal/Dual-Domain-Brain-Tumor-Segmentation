"""
backend-deployment/app.py
Modal entry point for the Dual-Domain Brain Tumor Segmentation REST API.

Deploy with:
    modal deploy app.py          # production (persistent URL)
    modal serve app.py           # dev mode (live-reloads)
"""

import os
import modal

# ── Paths (relative to this file) ─────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DEMO_DIR    = os.path.join(BACKEND_DIR, "..", "demo")

# ── Docker image with all Python dependencies + model weights baked in ─────────
# Checkpoints are baked into the image layer and cached by Modal.
# They are only re-uploaded if the .pt files change.
image = (
    modal.Image.debian_slim(python_version="3.11")
    # PyTorch CPU-only (~190MB) — sufficient for inference
    .pip_install(
        "torch==2.3.1",
        "torchvision==0.18.1",
        extra_index_url="https://download.pytorch.org/whl/cpu",
    )
    .pip_install(
        "fastapi>=0.100.0",
        "uvicorn[standard]>=0.22.0",
        "python-multipart>=0.0.6",
        "nibabel>=5.1.0",
        "numpy>=1.24.0",
        "matplotlib>=3.7.0",
        "Pillow>=9.5.0",
    )
    # Bake source files into the image
    .add_local_file(os.path.join(DEMO_DIR, "models.py"),    remote_path="/app/models.py")
    .add_local_file(os.path.join(DEMO_DIR, "inference.py"), remote_path="/app/inference.py")
    .add_local_file(os.path.join(BACKEND_DIR, "server.py"), remote_path="/app/server.py")
    # Bake model checkpoints into the image (~1 GB total, cached after first build)
    .add_local_file(
        os.path.join(DEMO_DIR, "checkpoints", "baseline_best.pt"),
        remote_path="/checkpoints/baseline_best.pt",
    )
    .add_local_file(
        os.path.join(DEMO_DIR, "checkpoints", "dual_best.pt"),
        remote_path="/checkpoints/dual_best.pt",
    )
)

# ── Modal App ──────────────────────────────────────────────────────────────────
app = modal.App("brain-tumor-segmentation-api")


# ── ASGI entry-point ───────────────────────────────────────────────────────────
@app.function(
    image=image,
    # 4 GB RAM — both models occupy ~2 GB when loaded
    memory=4096,
    # 10-minute timeout per request (full-volume CPU inference ~3-5 min)
    timeout=600,
    # Keep one container warm to avoid cold-start delays
    min_containers=1,
)
@modal.asgi_app()
def fastapi_app():
    """
    Returns the FastAPI app. Runs inside the container where:
      /app/          — source files baked into image
      /checkpoints/  — model weights baked into image
    """
    import sys
    sys.path.insert(0, "/app")

    os.environ.setdefault("BASELINE_CKPT", "/checkpoints/baseline_best.pt")
    os.environ.setdefault("DUAL_CKPT",     "/checkpoints/dual_best.pt")

    from server import web_app   # triggers model loading on cold start
    return web_app
