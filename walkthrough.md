# BraTS Dual-Domain Brain Tumor Segmentation Demo Portal Walkthrough

The demo portal application has been successfully implemented and verified. Below is a summary of the accomplishments.

## Directory Structure

All files have been organized inside the `demo/` subdirectory of the workspace:

```
demo/
├── app.py                  ← Main Gradio application
├── models.py               ← PyTorch models (SpatialUNet, DualDomainUNet)
├── inference.py            ← Volume preprocessing, prediction, overlay and figure plotting
├── checkpoints/            ← Pretrained model checkpoints (plug-and-play)
│   ├── baseline_best.pt
│   └── dual_best.pt
├── sample_data/
│   └── README.txt          ← Instructions on loading sample files
└── venv/                   ← Python virtual environment with dependencies
```

## Changes Made

1. **Created `demo/models.py`**:
   - Implemented exact PyTorch neural network classes (`SpatialUNet`, `DualDomainUNet`, `Encoder`, `Decoder`, `ConvBlock`) and `load_model` helper matching training structures.
2. **Created `demo/inference.py`**:
   - Added `preprocess_volume` to perform volume normalization and empty-slice filtering.
   - Added K-Space simulation inside `slice_to_tensors`.
   - Added prediction loops, Dice Similarity Coefficient (DSC) metrics calculation, and colored mask overlays blending (Whole Tumor - red, Tumor Core - teal, Enhancing Tumor - yellow).
   - Constructed `build_comparison_figure` using Matplotlib to compile axial scans side-by-side.
3. **Created `demo/app.py`**:
   - Designed the Gradio interface layout with drag-and-drop file inputs, radio buttons for slice selection, sliding custom axial slice selector, and visual panels.
   - Handled relative checkpoint loading, device fallbacks (CPU vs GPU), and structured inference performance reports.
4. **Organized Checkpoints**:
   - Relocated user's `.pt` weight files into `demo/checkpoints/` for plug-and-play operation.
5. **Configured Dependencies**:
   - Established a clean Python virtual environment at `demo/venv/` and installed required packages: `gradio`, `nibabel`, `scipy`, `matplotlib`, `torch` (CPU wheel to avoid CUDA package bloat during setup), and `torchvision`.

## Validation & Testing

- Run verification command:
  ```bash
  demo/venv/bin/python demo/app.py
  ```
- Output trace confirmed proper startup:
  ```
  Device: cpu
  Loaded SpatialUNet from /run/media/chithraka/829a8d81-081f-42c2-90e0-67ef311faccc/Research/SYSTEM/demo/checkpoints/baseline_best.pt
  Loaded DualDomainUNet from /run/media/chithraka/829a8d81-081f-42c2-90e0-67ef311faccc/Research/SYSTEM/demo/checkpoints/dual_best.pt
  Both models loaded ✅
  * Running on local URL:  http://127.0.0.1:7860
  * Running on public URL: https://b182b013d4fc076beb.gradio.live
  ```
# ./demo/start_backend.sh