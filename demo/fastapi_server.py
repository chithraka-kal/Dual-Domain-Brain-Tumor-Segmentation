# fastapi_server.py
"""
FastAPI Backend Server for Dual-Domain Brain Tumor Segmentation Portal
Exposes REST API endpoints (/api/inference, /api/health) and optionally mounts Gradio UI (/gradio).
Designed for Azure VM and Docker deployments with streaming keepalive support.
"""

import os
import sys
import time
import io
import base64
import asyncio
import json
import queue as queue_module
import tempfile
import threading
from typing import Optional

import torch
import os
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    ort = None

# Optimize PyTorch CPU threads for maximum speed on Azure VM
num_cpus = os.cpu_count() or 4
torch.set_num_threads(num_cpus)
try:
    torch.set_num_interop_threads(min(4, num_cpus))
except Exception:
    pass
print(f"[server] Configured PyTorch CPU threads: {torch.get_num_threads()}")
import nibabel as nib
from PIL import Image

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn

# Ensure demo directory is in sys.path
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from models import SpatialUNet, DualDomainUNet, load_model
from inference import (
    preprocess_volume,
    run_inference,
    run_onnx_inference,
    build_seg_mask_from_nii,
    find_best_slice,
    make_overlay,
    compute_dice
)

# ── Paths & Device Configuration ──────────────────────────────────────────────
BASELINE_CKPT = os.environ.get("BASELINE_CKPT", os.path.join(app_dir, "checkpoints", "baseline_best.pt"))
DUAL_CKPT     = os.environ.get("DUAL_CKPT",     os.path.join(app_dir, "checkpoints", "dual_best.pt"))
BASELINE_ONNX = os.path.join(app_dir, "onnx_models", "spatial_unet.onnx")
DUAL_ONNX     = os.path.join(app_dir, "onnx_models", "dual_domain_unet.onnx")
DEVICE        = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"[server] Running on Device: {DEVICE}")
baseline_model = None
dual_model = None
baseline_session = None
dual_session = None

if ort is not None and DEVICE.type == "cpu" and os.path.exists(BASELINE_ONNX) and os.path.exists(DUAL_ONNX):
    print("[server] Loading ONNX Runtime CPU models ...")
    ort_options = ort.SessionOptions()
    ort_options.intra_op_num_threads = max(1, min(8, num_cpus))
    ort_options.inter_op_num_threads = 1
    baseline_session = ort.InferenceSession(BASELINE_ONNX, sess_options=ort_options, providers=["CPUExecutionProvider"])
    dual_session = ort.InferenceSession(DUAL_ONNX, sess_options=ort_options, providers=["CPUExecutionProvider"])
    print(f"[server] ONNX Runtime enabled with {ort_options.intra_op_num_threads} threads")

# Keep PyTorch as a fallback; ONNX avoids loading the much larger checkpoints on CPU.
if baseline_session is None or dual_session is None:
    if os.path.exists(BASELINE_CKPT):
        print(f"[server] Loading baseline model from {BASELINE_CKPT} ...")
        try:
            baseline_model = load_model(SpatialUNet, BASELINE_CKPT, DEVICE)
        except Exception as e:
            print(f"[server] ERROR loading baseline model: {e}")
    else:
        print(f"[server] WARNING: Baseline checkpoint not found at {BASELINE_CKPT}")

    if os.path.exists(DUAL_CKPT):
        print(f"[server] Loading dual-domain model from {DUAL_CKPT} ...")
        try:
            dual_model = load_model(DualDomainUNet, DUAL_CKPT, DEVICE)
        except Exception as e:
            print(f"[server] ERROR loading dual-domain model: {e}")
    else:
        print(f"[server] WARNING: Dual-domain checkpoint not found at {DUAL_CKPT}")

import subprocess

def get_git_version() -> str:
    """Retrieve dynamic version based on Git commit hash and commit count."""
    if os.environ.get("SERVER_VERSION"):
        return os.environ.get("SERVER_VERSION")

    try:
        commit_hash = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=app_dir,
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        commit_count = subprocess.check_output(
            ["git", "rev-list", "--count", "HEAD"],
            cwd=app_dir,
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        return f"1.0.{commit_count}-{commit_hash}"
    except Exception:
        pass

    version_file = os.path.join(app_dir, "VERSION")
    if os.path.exists(version_file):
        with open(version_file, "r") as f:
            return f.read().strip()

    return "1.0.0-dev"

SERVER_VERSION = get_git_version()
print(f"[server] Version: {SERVER_VERSION}")

# Initialize FastAPI application
app = FastAPI(
    title="Dual-Domain Brain Tumor Segmentation API",
    version=SERVER_VERSION,
    description="REST API server delivering real-time MRI tumor segmentation inference"
)

# Enable CORS for Next.js portal frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper Image Encoding Functions ──────────────────────────────────────────
def slice_to_base64_png(slice_2d: np.ndarray) -> str:
    """Convert 2D grayscale slice array to base64 PNG data URL."""
    s_min, s_max = slice_2d.min(), slice_2d.max()
    if s_max > s_min:
        norm = (slice_2d - s_min) / (s_max - s_min)
    else:
        norm = np.zeros_like(slice_2d)
    img_uint8 = (norm * 255).astype(np.uint8)
    rgb = np.stack([img_uint8] * 3, axis=-1)
    img = Image.fromarray(rgb)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{b64}"


def overlay_to_base64_png(t2w_slice: np.ndarray, mask_slice: np.ndarray, alpha: float = 0.45) -> str:
    """Blend T2w slice with segmentation mask overlay and convert to base64 PNG data URL."""
    rgb_overlay = make_overlay(t2w_slice, mask_slice, alpha=alpha)
    img = Image.fromarray(rgb_overlay)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{b64}"


# ── REST API Endpoints ────────────────────────────────────────────────────────
@app.get("/")
@app.get("/api/health")
def health_check():
    """Health check endpoint to verify API, version, and model status."""
    return {
        "status": "online",
        "version": SERVER_VERSION,
        "device": str(DEVICE).upper(),
        "baseline_model": "loaded" if baseline_model is not None or baseline_session is not None else "missing",
        "dual_domain_model": "loaded" if dual_model is not None or dual_session is not None else "missing",
        "gradio_ui": "/gradio"
    }


@app.post("/api/inference")
async def run_inference_api(
    t2w_file: UploadFile = File(...),
    seg_file: Optional[UploadFile] = File(None),
    slice_mode: str = Form("auto"),
    custom_slice: int = Form(77)
):
    """
    Streaming Inference Endpoint called by Next.js frontend portal.
    Sends whitespace keepalive bytes every 5s while PyTorch runs in a background thread.
    Prevents TCP/HTTP timeouts during CPU inference.
    """
    if (baseline_session is None or dual_session is None) and (baseline_model is None or dual_model is None):
        raise HTTPException(
            status_code=500,
            detail="Model checkpoints not loaded on server. Please place baseline_best.pt and dual_best.pt in checkpoints/."
        )

    if not t2w_file.filename:
        raise HTTPException(status_code=400, detail="No T2w file uploaded.")

    # Read file bytes async up-front before thread handoff
    t2w_content = await t2w_file.read()
    seg_content = None
    seg_filename = ""
    if seg_file and seg_file.filename:
        seg_content = await seg_file.read()
        seg_filename = seg_file.filename

    result_queue: queue_module.Queue = queue_module.Queue()
    error_queue: queue_module.Queue = queue_module.Queue()

    def inference_thread():
        t2w_path = seg_path = None
        try:
            start_time = time.time()

            t2w_suffix = ".nii.gz" if t2w_file.filename.endswith(".gz") else ".nii"
            with tempfile.NamedTemporaryFile(delete=False, suffix=t2w_suffix) as tmp_t2w:
                tmp_t2w.write(t2w_content)
                t2w_path = tmp_t2w.name

            if seg_content:
                seg_suffix = ".nii.gz" if seg_filename.endswith(".gz") else ".nii"
                with tempfile.NamedTemporaryFile(delete=False, suffix=seg_suffix) as tmp_seg:
                    tmp_seg.write(seg_content)
                    seg_path = tmp_seg.name

            # 1. Preprocess input MRI volume
            vol_norm, tissue_slices = preprocess_volume(t2w_path)
            if not tissue_slices:
                error_queue.put(HTTPException(status_code=400, detail="No brain tissue detected in uploaded MRI volume."))
                return

            # 2. Build ground truth binary mask if available
            gt_volume = build_seg_mask_from_nii(seg_path) if seg_path else None

            # 3. Run inference on PyTorch models
            if baseline_session is not None and dual_session is not None:
                baseline_preds = run_onnx_inference(baseline_session, 'spatial', vol_norm, tissue_slices)
                dual_preds = run_onnx_inference(dual_session, 'dual', vol_norm, tissue_slices)
            else:
                baseline_preds = run_inference(baseline_model, 'spatial', vol_norm, tissue_slices, DEVICE)
                dual_preds = run_inference(dual_model, 'dual', vol_norm, tissue_slices, DEVICE)

            # 4. Determine slice index to render
            if slice_mode in ('manual', 'Custom slice'):
                z = max(0, min(int(custom_slice), vol_norm.shape[2] - 1))
            else:
                z = find_best_slice(dual_preds, gt_volume)

            # 5. Calculate region Dice Similarity Coefficients (DSC)
            baseline_dice_dict = dual_dice_dict = None
            if gt_volume is not None:
                b_dice = [compute_dice(baseline_preds, gt_volume, c) for c in range(3)]
                d_dice = [compute_dice(dual_preds,     gt_volume, c) for c in range(3)]
                baseline_dice_dict = {
                    "wt": round(b_dice[0], 4),
                    "tc": round(b_dice[1], 4),
                    "et": round(b_dice[2], 4)
                }
                dual_dice_dict = {
                    "wt": round(d_dice[0], 4),
                    "tc": round(d_dice[1], 4),
                    "et": round(d_dice[2], 4)
                }

            # 6. Render images to base64 PNGs
            t2w_slice           = vol_norm[:, :, z]
            baseline_mask_slice = baseline_preds[:, :, z, :]
            dual_mask_slice     = dual_preds[:, :, z, :]

            original_b64 = slice_to_base64_png(t2w_slice)
            baseline_b64 = overlay_to_base64_png(t2w_slice, baseline_mask_slice)
            dual_b64     = overlay_to_base64_png(t2w_slice, dual_mask_slice)
            gt_b64       = overlay_to_base64_png(t2w_slice, gt_volume[:, :, z, :]) if gt_volume is not None else None

            elapsed = time.time() - start_time
            shape_str = f"{vol_norm.shape[0]}×{vol_norm.shape[1]}×{vol_norm.shape[2]}"

            result_queue.put({
                "originalImage": original_b64,
                "baselineImage": baseline_b64,
                "dualDomainImage": dual_b64,
                "groundTruthImage": gt_b64,
                "baselineDice": baseline_dice_dict,
                "dualDomainDice": dual_dice_dict,
                "inferenceTimeSeconds": round(elapsed, 2),
                "device": str(DEVICE).upper(),
                "volumeShape": shape_str,
                "displaySlice": z,
                "sessionId": f"inf_{int(time.time())}"
            })

        except Exception as e:
            error_queue.put(e)
        finally:
            if t2w_path and os.path.exists(t2w_path):
                os.remove(t2w_path)
            if seg_path and os.path.exists(seg_path):
                os.remove(seg_path)

    thread = threading.Thread(target=inference_thread, daemon=True)
    thread.start()

    async def generate():
        """
        Yield keepalive whitespace every 5s until inference completes,
        then yield the JSON result. JSON.parse ignores leading whitespace.
        """
        while True:
            try:
                result = result_queue.get_nowait()
                print("[server] Inference complete, sending response")
                yield json.dumps(result)
                return
            except queue_module.Empty:
                pass

            try:
                err = error_queue.get_nowait()
                print(f"[server] Inference error: {err}")
                if isinstance(err, HTTPException):
                    yield json.dumps({"error": err.detail})
                else:
                    yield json.dumps({"error": str(err)})
                return
            except queue_module.Empty:
                pass

            if not thread.is_alive():
                yield json.dumps({"error": "Inference thread exited unexpectedly."})
                return

            yield " "
            await asyncio.sleep(5)

    return StreamingResponse(generate(), media_type="application/json")


# ── Mount optional Gradio interface ──────────────────────────────────────────
try:
    from app import demo as gradio_demo
    import gradio as gr
    app = gr.mount_gradio_app(app, gradio_demo, path="/gradio")
except Exception as e:
    print(f"[server] Gradio mount skipped or unavailable: {e}")

if __name__ == "__main__":
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8000, reload=False)
