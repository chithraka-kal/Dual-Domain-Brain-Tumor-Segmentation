"""
server.py — Clean FastAPI server for Modal deployment.
No Gradio dependency. Reads checkpoint paths from env vars.
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

# ── Path setup ─────────────────────────────────────────────────────────────────
sys.path.insert(0, "/app")

from models import SpatialUNet, DualDomainUNet, load_model
from inference import (
    preprocess_volume,
    run_inference,
    build_seg_mask_from_nii,
    find_best_slice,
    make_overlay,
    compute_dice,
)

# ── Load models once at cold-start ─────────────────────────────────────────────
BASELINE_CKPT = os.environ.get("BASELINE_CKPT", "/checkpoints/baseline_best.pt")
DUAL_CKPT     = os.environ.get("DUAL_CKPT",     "/checkpoints/dual_best.pt")
DEVICE        = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"[server] Device: {DEVICE}")
print(f"[server] Loading baseline from {BASELINE_CKPT} ...")
baseline_model = load_model(SpatialUNet,    BASELINE_CKPT, DEVICE)
print(f"[server] Loading dual-domain from {DUAL_CKPT} ...")
dual_model     = load_model(DualDomainUNet, DUAL_CKPT,     DEVICE)
print("[server] Both models loaded ✅")


# ── FastAPI app ────────────────────────────────────────────────────────────────
web_app = FastAPI(
    title="Dual-Domain Brain Tumor Segmentation API",
    version="1.0.0",
    description="REST API for real-time MRI tumor segmentation inference",
)

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: numpy slice → base64 PNG ──────────────────────────────────────────
def slice_to_base64_png(slice_2d: np.ndarray) -> str:
    s_min, s_max = slice_2d.min(), slice_2d.max()
    norm = (slice_2d - s_min) / (s_max - s_min) if s_max > s_min else np.zeros_like(slice_2d)
    img_uint8 = (norm * 255).astype(np.uint8)
    rgb = np.stack([img_uint8] * 3, axis=-1)
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def overlay_to_base64_png(t2w_slice: np.ndarray, mask_slice: np.ndarray, alpha: float = 0.45) -> str:
    rgb_overlay = make_overlay(t2w_slice, mask_slice, alpha=alpha)
    buf = io.BytesIO()
    Image.fromarray(rgb_overlay).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ── Endpoints ──────────────────────────────────────────────────────────────────
@web_app.get("/")
@web_app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "device": str(DEVICE).upper(),
        "baseline_model": "loaded",
        "dual_domain_model": "loaded",
    }


@web_app.post("/api/inference")
def run_inference_api(
    t2w_file: UploadFile = File(...),
    seg_file: Optional[UploadFile] = File(None),
    slice_mode: str = Form("auto"),
    custom_slice: int = Form(77),
):
    """
    Primary inference endpoint called by the Next.js portal.
    FastAPI runs sync def endpoints in a thread pool — safe for PyTorch ops.
    """
    if not t2w_file.filename:
        raise HTTPException(status_code=400, detail="No T2w file uploaded.")

    start_time = time.time()
    t2w_suffix = ".nii.gz" if t2w_file.filename.endswith(".gz") else ".nii"

    with tempfile.NamedTemporaryFile(delete=False, suffix=t2w_suffix) as tmp:
        tmp.write(t2w_file.file.read())
        t2w_path = tmp.name

    seg_path = None
    if seg_file and seg_file.filename:
        seg_suffix = ".nii.gz" if seg_file.filename.endswith(".gz") else ".nii"
        with tempfile.NamedTemporaryFile(delete=False, suffix=seg_suffix) as tmp:
            tmp.write(seg_file.file.read())
            seg_path = tmp.name

    try:
        # 1. Preprocess
        vol_norm, tissue_slices = preprocess_volume(t2w_path)
        if not tissue_slices:
            raise HTTPException(status_code=400, detail="No brain tissue detected.")

        # 2. Ground truth (optional)
        gt_volume = build_seg_mask_from_nii(seg_path) if seg_path else None

        # 3. Inference
        baseline_preds = run_inference(baseline_model, "spatial", vol_norm, tissue_slices, DEVICE)
        dual_preds     = run_inference(dual_model,     "dual",    vol_norm, tissue_slices, DEVICE)

        # 4. Choose display slice
        if slice_mode in ("manual", "Custom slice"):
            z = max(0, min(int(custom_slice), vol_norm.shape[2] - 1))
        else:
            z = find_best_slice(dual_preds, gt_volume)

        # 5. Dice scores
        baseline_dice_dict = dual_dice_dict = None
        if gt_volume is not None:
            b = [compute_dice(baseline_preds, gt_volume, c) for c in range(3)]
            d = [compute_dice(dual_preds,     gt_volume, c) for c in range(3)]
            baseline_dice_dict = {"wt": round(b[0], 4), "tc": round(b[1], 4), "et": round(b[2], 4)}
            dual_dice_dict     = {"wt": round(d[0], 4), "tc": round(d[1], 4), "et": round(d[2], 4)}

        # 6. Render to base64
        t2w_slice           = vol_norm[:, :, z]
        baseline_mask_slice = baseline_preds[:, :, z, :]
        dual_mask_slice     = dual_preds[:, :, z, :]

        original_b64 = slice_to_base64_png(t2w_slice)
        baseline_b64 = overlay_to_base64_png(t2w_slice, baseline_mask_slice)
        dual_b64     = overlay_to_base64_png(t2w_slice, dual_mask_slice)
        gt_b64       = overlay_to_base64_png(t2w_slice, gt_volume[:, :, z, :]) if gt_volume is not None else None

        elapsed   = time.time() - start_time
        shape_str = f"{vol_norm.shape[0]}×{vol_norm.shape[1]}×{vol_norm.shape[2]}"

        return JSONResponse(content={
            "originalImage":       original_b64,
            "baselineImage":       baseline_b64,
            "dualDomainImage":     dual_b64,
            "groundTruthImage":    gt_b64,
            "baselineDice":        baseline_dice_dict,
            "dualDomainDice":      dual_dice_dict,
            "inferenceTimeSeconds": round(elapsed, 2),
            "device":              str(DEVICE).upper(),
            "volumeShape":         shape_str,
            "displaySlice":        z,
            "sessionId":           f"inf_{int(time.time())}",
        })

    finally:
        if os.path.exists(t2w_path):
            os.remove(t2w_path)
        if seg_path and os.path.exists(seg_path):
            os.remove(seg_path)
