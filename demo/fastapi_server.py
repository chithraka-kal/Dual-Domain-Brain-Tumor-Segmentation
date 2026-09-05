# fastapi_server.py
"""
FastAPI Backend Server for Dual-Domain Brain Tumor Segmentation Portal
Exposes REST API endpoints (/api/inference, /api/health) and mounts Gradio UI (/gradio).
"""

import os
import sys
import time
import io
import base64
import tempfile
from typing import Optional

import torch
import numpy as np
import nibabel as nib
from PIL import Image

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Ensure demo directory is in sys.path
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# Import models & gradio demo from app.py to reuse loaded weights and avoid double-loading
from app import (
    baseline_model,
    dual_model,
    DEVICE,
    demo as gradio_demo
)
from inference import (
    preprocess_volume,
    run_inference,
    build_seg_mask_from_nii,
    find_best_slice,
    make_overlay,
    compute_dice
)

# Initialize FastAPI application
app = FastAPI(
    title="Dual-Domain Brain Tumor Segmentation API",
    version="1.0.0",
    description="REST API server delivering real-time MRI tumor segmentation inference"
)

# Enable CORS for Next.js portal frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    """Health check endpoint to verify API and model status."""
    return {
        "status": "online",
        "device": str(DEVICE).upper(),
        "baseline_model": "loaded",
        "dual_domain_model": "loaded",
        "gradio_ui": "/gradio"
    }


@app.post("/api/inference")
def run_inference_api(
    t2w_file: UploadFile = File(...),
    seg_file: Optional[UploadFile] = File(None),
    slice_mode: str = Form("auto"),
    custom_slice: int = Form(77)
):
    """
    Synchronous Inference Endpoint called by Next.js frontend portal.
    FastAPI runs synchronous def endpoints in a background threadpool, preventing main loop blocking during PyTorch operations.
    """
    if not t2w_file.filename:
        raise HTTPException(status_code=400, detail="No T2w file uploaded.")

    start_time = time.time()

    # Determine file extension for temp files
    t2w_suffix = ".nii.gz" if t2w_file.filename.endswith(".gz") else ".nii"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=t2w_suffix) as tmp_t2w:
        t2w_content = t2w_file.file.read()
        tmp_t2w.write(t2w_content)
        t2w_path = tmp_t2w.name

    seg_path = None
    if seg_file and seg_file.filename:
        seg_suffix = ".nii.gz" if seg_file.filename.endswith(".gz") else ".nii"
        with tempfile.NamedTemporaryFile(delete=False, suffix=seg_suffix) as tmp_seg:
            seg_content = seg_file.file.read()
            tmp_seg.write(seg_content)
            seg_path = tmp_seg.name

    try:
        # 1. Preprocess input MRI volume
        vol_norm, tissue_slices = preprocess_volume(t2w_path)
        if not tissue_slices:
            raise HTTPException(status_code=400, detail="No brain tissue detected in uploaded MRI volume.")

        # 2. Build ground truth binary mask if available
        gt_volume = None
        if seg_path:
            gt_volume = build_seg_mask_from_nii(seg_path)

        # 3. Run inference on PyTorch models
        baseline_preds = run_inference(baseline_model, 'spatial', vol_norm, tissue_slices, DEVICE)
        dual_preds     = run_inference(dual_model,     'dual',    vol_norm, tissue_slices, DEVICE)

        # 4. Determine slice index to render
        if slice_mode in ('manual', 'Custom slice'):
            z = max(0, min(int(custom_slice), vol_norm.shape[2] - 1))
        else:
            z = find_best_slice(dual_preds, gt_volume)

        # 5. Calculate region Dice Similarity Coefficients (DSC)
        baseline_dice_dict = None
        dual_dice_dict = None
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

        gt_b64 = None
        if gt_volume is not None:
            gt_mask_slice = gt_volume[:, :, z, :]
            gt_b64 = overlay_to_base64_png(t2w_slice, gt_mask_slice)

        elapsed = time.time() - start_time
        shape_str = f"{vol_norm.shape[0]}×{vol_norm.shape[1]}×{vol_norm.shape[2]}"

        return JSONResponse(content={
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

    finally:
        # Clean up temp files
        if os.path.exists(t2w_path):
            os.remove(t2w_path)
        if seg_path and os.path.exists(seg_path):
            os.remove(seg_path)


# ── Mount Gradio interface ───────────────────────────────────────────────────
import gradio as gr
app = gr.mount_gradio_app(app, gradio_demo, path="/gradio")

if __name__ == "__main__":
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8000, reload=False)
