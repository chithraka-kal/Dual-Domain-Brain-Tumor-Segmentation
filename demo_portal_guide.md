# BraTS Dual-Domain Segmentation — Demo Portal
## Copilot Agent Build Guide

---

## Project Summary

Build a Gradio web application that demonstrates the dual-domain brain tumor segmentation research. The app loads two trained PyTorch models (baseline SpatialUNet and proposed DualDomainUNet), accepts an MRI scan upload, runs inference, and displays segmentation results side by side. This is a research demonstration tool for academic presentation and viva examination.

**Key constraint:** Models are plug-and-play. Replacing a `.pt` checkpoint file is the only action needed to update the model — zero code changes required.

---

## Environment

```
Platform   : Google Colab notebook (runs in browser, generates shareable link)
Python     : 3.10+
GPU        : Optional (inference works on CPU in ~20 seconds, GPU in ~3 seconds)
Input data : BraTS 2023 GLI format (.nii.gz or .nii files)
```

---

## File Structure

```
demo/
├── app.py                  ← Main Gradio application (build this first)
├── models.py               ← Model architecture definitions (copy from training)
├── inference.py            ← Preprocessing + inference pipeline
├── checkpoints/
│   ├── baseline_best.pt    ← Spatial-only U-Net checkpoint (plug-and-play)
│   └── dual_best.pt        ← Dual-domain U-Net checkpoint (plug-and-play)
└── sample_data/
    └── README.txt          ← Instructions for test uploads
```

---

## Step 1 — Install Dependencies

```python
# Run this cell first in Colab
!pip install gradio nibabel torch torchvision numpy matplotlib scipy -q
```

---

## Step 2 — models.py

Copy the exact architecture classes used during training. Do not modify — the checkpoint weights must match exactly.

```python
# models.py
import torch
import torch.nn as nn


class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )
    def forward(self, x): return self.block(x)


class Encoder(nn.Module):
    def __init__(self, in_ch=1, base=64):
        super().__init__()
        self.enc1 = ConvBlock(in_ch,  base)
        self.enc2 = ConvBlock(base,   base*2)
        self.enc3 = ConvBlock(base*2, base*4)
        self.enc4 = ConvBlock(base*4, base*8)
        self.bottleneck = ConvBlock(base*8, base*16)
        self.pool = nn.MaxPool2d(2)
        self.drop = nn.Dropout2d(0.3)
    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        b  = self.drop(self.bottleneck(self.pool(e4)))
        return b, (e1, e2, e3, e4)


class Decoder(nn.Module):
    def __init__(self, bottleneck_ch=1024, base=64, out_ch=3):
        super().__init__()
        self.up4  = nn.ConvTranspose2d(bottleneck_ch, base*8, 2, stride=2)
        self.dec4 = ConvBlock(base*16, base*8)
        self.up3  = nn.ConvTranspose2d(base*8,  base*4, 2, stride=2)
        self.dec3 = ConvBlock(base*8,  base*4)
        self.up2  = nn.ConvTranspose2d(base*4,  base*2, 2, stride=2)
        self.dec2 = ConvBlock(base*4,  base*2)
        self.up1  = nn.ConvTranspose2d(base*2,  base,   2, stride=2)
        self.dec1 = ConvBlock(base*2,  base)
        self.drop = nn.Dropout2d(0.3)
        self.out  = nn.Conv2d(base, out_ch, 1)
        # Raw logits output — sigmoid applied in inference pipeline
    def forward(self, b, skips):
        e1, e2, e3, e4 = skips
        d = self.drop(self.dec4(torch.cat([self.up4(b), e4], 1)))
        d = self.drop(self.dec3(torch.cat([self.up3(d), e3], 1)))
        d = self.dec2(torch.cat([self.up2(d), e2], 1))
        d = self.dec1(torch.cat([self.up1(d), e1], 1))
        return self.out(d)


class SpatialUNet(nn.Module):
    """Baseline: spatial T2w input only."""
    def __init__(self, base=64, out_ch=3):
        super().__init__()
        self.encoder = Encoder(1, base)
        self.decoder = Decoder(base*16, base, out_ch)
    def forward(self, x):
        b, skips = self.encoder(x)
        return self.decoder(b, skips)


class DualDomainUNet(nn.Module):
    """Proposed: parallel spatial + frequency encoders."""
    def __init__(self, base=64, out_ch=3):
        super().__init__()
        self.spatial_enc = Encoder(1, base)
        self.freq_enc    = Encoder(1, base)
        self.fusion = nn.Sequential(
            nn.Conv2d(base*32, base*16, 1),
            nn.BatchNorm2d(base*16),
            nn.ReLU(inplace=True),
        )
        self.decoder = Decoder(base*16, base, out_ch)
    def forward(self, spatial, freq):
        sb, skips = self.spatial_enc(spatial)
        fb, _     = self.freq_enc(freq)
        return self.decoder(self.fusion(torch.cat([sb, fb], 1)), skips)


def load_model(model_class, checkpoint_path, device):
    """
    Load a model from checkpoint. Plug-and-play: replace the .pt file
    on disk and call this function again — no other changes needed.
    Returns model in eval mode.
    """
    model = model_class().to(device)
    ckpt  = torch.load(checkpoint_path, map_location=device, weights_only=False)
    # Handle both raw state_dict and our checkpoint dict format
    state = ckpt.get('model_state_dict', ckpt)
    model.load_state_dict(state)
    model.eval()
    print(f"Loaded {model_class.__name__} from {checkpoint_path}")
    return model
```

---

## Step 3 — inference.py

```python
# inference.py
import numpy as np
import torch
import nibabel as nib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import ListedColormap
import io
from PIL import Image


# BraTS 2023 label scheme
REGION_NAMES  = ['Whole Tumor (WT)', 'Tumor Core (TC)', 'Enhancing Tumor (ET)']
REGION_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D']   # red, teal, yellow


def preprocess_volume(nii_path):
    """
    Load a T2w NIfTI volume and return:
      - vol_norm   : (240, 240, 155) float32 normalised volume
      - tumor_slices: list of z indices containing tissue (non-zero)
    """
    vol = nib.load(nii_path).get_fdata().astype(np.float32)

    # Per-volume z-score normalisation (same as training)
    brain_mask = vol > 0
    if brain_mask.sum() > 0:
        vol_mean = vol[brain_mask].mean()
        vol_std  = vol[brain_mask].std()
    else:
        vol_mean, vol_std = 0.0, 1.0
    vol_norm = (vol - vol_mean) / (vol_std + 1e-8)

    # Find non-empty slices (tissue present, not necessarily tumor)
    tissue_slices = [z for z in range(vol_norm.shape[2])
                     if vol_norm[:, :, z].max() > 0]

    return vol_norm, tissue_slices


def slice_to_tensors(vol_norm, z, device):
    """
    Convert one axial slice to model input tensors.
    Returns spatial (1,1,240,240) and freq (1,1,240,240) on device.
    """
    t2w = vol_norm[:, :, z].astype(np.float32)

    # FFT K-space simulation (identical to training)
    kspace = np.fft.fftshift(np.fft.fft2(t2w))
    kmag   = np.log1p(np.abs(kspace)).astype(np.float32)
    kmin, kmax = kmag.min(), kmag.max()
    kmag_norm = (kmag - kmin) / (kmax - kmin + 1e-8)

    spatial = torch.from_numpy(t2w[np.newaxis, np.newaxis]).to(device)
    freq    = torch.from_numpy(kmag_norm[np.newaxis, np.newaxis]).to(device)

    return spatial, freq


@torch.no_grad()
def run_inference(model, model_type, vol_norm, tissue_slices, device, threshold=0.5):
    """
    Run full-volume inference. Returns predicted masks (240, 240, 155, 3).
    model_type: 'spatial' or 'dual'
    """
    H, W, D = vol_norm.shape
    pred_volume = np.zeros((H, W, D, 3), dtype=np.float32)

    for z in tissue_slices:
        spatial, freq = slice_to_tensors(vol_norm, z, device)

        if model_type == 'spatial':
            logits = model(spatial)
        else:
            logits = model(spatial, freq)

        probs = torch.sigmoid(logits).squeeze(0).cpu().numpy()  # (3, H, W)
        pred_volume[:, :, z, :] = (probs > threshold).astype(np.float32).transpose(1, 2, 0)

    return pred_volume


def compute_dice(pred, gt, channel):
    """Compute Dice for one region channel."""
    p = pred[:, :, :, channel].flatten()
    t = gt[:, :, :, channel].flatten()
    inter = (p * t).sum()
    union = p.sum() + t.sum()
    return float((2 * inter + 1e-5) / (union + 1e-5))


def build_seg_mask_from_nii(seg_path):
    """Load ground truth segmentation and convert to 3-channel binary."""
    seg = nib.load(seg_path).get_fdata().astype(np.int16)
    WT  = (seg >= 1).astype(np.float32)
    TC  = ((seg == 1) | (seg == 3)).astype(np.float32)
    ET  = (seg == 3).astype(np.float32)
    return np.stack([WT, TC, ET], axis=-1)  # (H, W, D, 3)


def find_best_slice(pred_volume, gt_volume=None):
    """Find the slice with most predicted tumor pixels (or GT tumor if available)."""
    source = gt_volume if gt_volume is not None else pred_volume
    tumor_counts = source[:, :, :, 0].sum(axis=(0, 1))
    z = int(np.argmax(tumor_counts))
    # Fallback to middle if prediction is all zeros
    if tumor_counts[z] == 0:
        z = pred_volume.shape[2] // 2
    return z


def make_overlay(t2w_slice, mask_slice, alpha=0.45):
    """
    Blend T2w grayscale with coloured segmentation overlay.
    mask_slice: (H, W, 3) binary — WT, TC, ET channels.
    Returns RGB numpy array (H, W, 3) uint8.
    """
    t2w_norm = t2w_slice - t2w_slice.min()
    if t2w_norm.max() > 0:
        t2w_norm = t2w_norm / t2w_norm.max()
    rgb = np.stack([t2w_norm] * 3, axis=-1)

    colours = np.array([
        [1.0, 0.42, 0.42],  # WT — red
        [0.31, 0.80, 0.77],  # TC — teal
        [1.0, 0.90, 0.43],  # ET — yellow
    ])

    overlay = rgb.copy()
    for c in range(3):
        mask = mask_slice[:, :, c] > 0
        if mask.any():
            for ch in range(3):
                overlay[:, :, ch][mask] = (
                    (1 - alpha) * rgb[:, :, ch][mask] +
                    alpha * colours[c, ch]
                )

    return (overlay * 255).clip(0, 255).astype(np.uint8)


def build_comparison_figure(
    t2w_slice, z,
    baseline_mask, dual_mask,
    gt_mask=None,
    baseline_dice=None, dual_dice=None
):
    """
    Build a side-by-side comparison figure.
    Returns PIL Image.
    """
    n_cols = 4 if gt_mask is not None else 3
    fig, axes = plt.subplots(1, n_cols, figsize=(5 * n_cols, 5.5))
    fig.patch.set_facecolor('#1a1a2e')

    def show(ax, img, title, subtitle=''):
        ax.imshow(img)
        ax.set_title(f'{title}\n{subtitle}', color='white', fontsize=11,
                     fontweight='bold', pad=6)
        ax.axis('off')
        for spine in ax.spines.values():
            spine.set_edgecolor('#444')

    # Col 0 — original T2w
    t2w_display = t2w_slice - t2w_slice.min()
    if t2w_display.max() > 0:
        t2w_display = t2w_display / t2w_display.max()
    show(axes[0],
         (t2w_display * 255).astype(np.uint8),
         f'T2w MRI',
         f'Axial slice z={z}')

    # Col 1 — baseline
    b_sub = ''
    if baseline_dice:
        b_sub = f"WT={baseline_dice[0]:.3f}  TC={baseline_dice[1]:.3f}  ET={baseline_dice[2]:.3f}"
    show(axes[1],
         make_overlay(t2w_slice, baseline_mask),
         'Baseline U-Net\n(Spatial only)',
         b_sub)

    # Col 2 — dual-domain
    d_sub = ''
    if dual_dice:
        d_sub = f"WT={dual_dice[0]:.3f}  TC={dual_dice[1]:.3f}  ET={dual_dice[2]:.3f}"
    show(axes[2],
         make_overlay(t2w_slice, dual_mask),
         'Dual-Domain U-Net\n(Proposed)',
         d_sub)

    # Col 3 — ground truth (optional)
    if gt_mask is not None:
        show(axes[3],
             make_overlay(t2w_slice, gt_mask),
             'Ground Truth\n(Expert annotation)',
             '')

    # Legend
    legend_patches = [
        mpatches.Patch(color='#FF6B6B', label='Whole Tumor (WT)'),
        mpatches.Patch(color='#4ECDC4', label='Tumor Core (TC)'),
        mpatches.Patch(color='#FFE66D', label='Enhancing Tumor (ET)'),
    ]
    fig.legend(handles=legend_patches, loc='lower center', ncol=3,
               frameon=False, fontsize=9,
               labelcolor='white', bbox_to_anchor=(0.5, -0.02))

    plt.tight_layout(rect=[0, 0.05, 1, 1])

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=130,
                bbox_inches='tight', facecolor='#1a1a2e')
    plt.close()
    buf.seek(0)
    return Image.open(buf)
```

---

## Step 4 — app.py

```python
# app.py
import os, time
import gradio as gr
import numpy as np
import torch

from models    import SpatialUNet, DualDomainUNet, load_model
from inference import (preprocess_volume, run_inference,
                       build_seg_mask_from_nii, find_best_slice,
                       build_comparison_figure, compute_dice)

# ── Configuration ─────────────────────────────────────────────────────────────
BASELINE_CKPT = 'checkpoints/baseline_best.pt'
DUAL_CKPT     = 'checkpoints/dual_best.pt'
DEVICE        = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# ── Load models once at startup ───────────────────────────────────────────────
print(f'Device: {DEVICE}')
baseline_model = load_model(SpatialUNet,     BASELINE_CKPT, DEVICE)
dual_model     = load_model(DualDomainUNet,  DUAL_CKPT,     DEVICE)
print('Both models loaded ✅')


# ── Core prediction function ──────────────────────────────────────────────────
def predict(t2w_file, seg_file, slice_mode, custom_z):
    """
    Main inference function called by Gradio.

    t2w_file   : uploaded T2w NIfTI file path
    seg_file   : uploaded segmentation NIfTI (optional, for Dice computation)
    slice_mode : 'Best tumor slice' or 'Custom slice'
    custom_z   : int, used if slice_mode is 'Custom slice'
    """
    if t2w_file is None:
        return None, "Please upload a T2w MRI file (.nii or .nii.gz)"

    start = time.time()

    # Preprocess
    vol_norm, tissue_slices = preprocess_volume(t2w_file.name)
    if not tissue_slices:
        return None, "No tissue found in the uploaded volume."

    # Load ground truth if provided
    gt_volume = None
    if seg_file is not None:
        gt_volume = build_seg_mask_from_nii(seg_file.name)

    # Run inference — both models
    baseline_preds = run_inference(baseline_model, 'spatial',
                                   vol_norm, tissue_slices, DEVICE)
    dual_preds     = run_inference(dual_model,     'dual',
                                   vol_norm, tissue_slices, DEVICE)

    # Choose display slice
    if slice_mode == 'Custom slice':
        z = max(0, min(int(custom_z), vol_norm.shape[2] - 1))
    else:
        z = find_best_slice(dual_preds, gt_volume)

    # Compute Dice scores if GT available
    baseline_dice, dual_dice = None, None
    if gt_volume is not None:
        baseline_dice = [compute_dice(baseline_preds, gt_volume, c) for c in range(3)]
        dual_dice     = [compute_dice(dual_preds,     gt_volume, c) for c in range(3)]

    # Build figure
    figure = build_comparison_figure(
        t2w_slice    = vol_norm[:, :, z],
        z            = z,
        baseline_mask= baseline_preds[:, :, z, :],
        dual_mask    = dual_preds[:, :, z, :],
        gt_mask      = gt_volume[:, :, z, :] if gt_volume is not None else None,
        baseline_dice= baseline_dice,
        dual_dice    = dual_dice,
    )

    elapsed = time.time() - start

    # Build text summary
    lines = [
        f"**Inference complete** in {elapsed:.1f}s on {str(DEVICE).upper()}",
        f"Volume shape: {vol_norm.shape}  |  Displaying slice z={z}",
        "",
    ]
    if baseline_dice and dual_dice:
        lines += [
            "**Dice Similarity Coefficient (DSC):**",
            "",
            f"| Region | Baseline | Dual-Domain | Improvement |",
            f"|--------|----------|-------------|-------------|",
            f"| Whole Tumor (WT) | {baseline_dice[0]:.4f} | {dual_dice[0]:.4f} | {dual_dice[0]-baseline_dice[0]:+.4f} |",
            f"| Tumor Core (TC)  | {baseline_dice[1]:.4f} | {dual_dice[1]:.4f} | {dual_dice[1]-baseline_dice[1]:+.4f} |",
            f"| Enhancing Tumor (ET) | {baseline_dice[2]:.4f} | {dual_dice[2]:.4f} | {dual_dice[2]-baseline_dice[2]:+.4f} |",
        ]
    else:
        lines.append("_Upload a segmentation file (.seg.nii.gz) to see Dice scores._")

    return figure, "\n".join(lines)


# ── Gradio UI ─────────────────────────────────────────────────────────────────
with gr.Blocks(theme=gr.themes.Base(), title="BraTS Dual-Domain Demo") as demo:

    gr.Markdown("""
    # 🧠 Dual-Domain Brain Tumor Segmentation
    **Research Demo** — BSc Computer Science Final Year Project, NSBM Green University

    Upload a BraTS T2-weighted MRI scan to compare the **baseline spatial U-Net** against the
    proposed **dual-domain U-Net** that processes both spatial and frequency-domain (K-space) representations.
    Optionally upload the segmentation file to compute Dice scores.
    """)

    with gr.Row():
        with gr.Column(scale=1):
            t2w_input = gr.File(
                label="T2w MRI — upload *-t2w.nii or *-t2w.nii.gz",
                file_types=['.nii', '.gz']
            )
            seg_input = gr.File(
                label="Segmentation (optional) — upload *-seg.nii.gz for Dice scores",
                file_types=['.nii', '.gz']
            )
            slice_mode = gr.Radio(
                choices=['Best tumor slice', 'Custom slice'],
                value='Best tumor slice',
                label='Slice selection'
            )
            custom_z = gr.Slider(
                minimum=0, maximum=154, value=77, step=1,
                label='Custom slice (z index)',
                visible=False
            )
            slice_mode.change(
                fn=lambda m: gr.update(visible=(m == 'Custom slice')),
                inputs=slice_mode, outputs=custom_z
            )
            run_btn = gr.Button("Run Inference", variant="primary")

        with gr.Column(scale=2):
            output_img  = gr.Image(label="Segmentation Comparison", type="pil")
            output_text = gr.Markdown()

    run_btn.click(
        fn=predict,
        inputs=[t2w_input, seg_input, slice_mode, custom_z],
        outputs=[output_img, output_text]
    )

    gr.Markdown("""
    ---
    **Models loaded:**
    - **Baseline SpatialUNet** — 31M parameters, T2w spatial input only
    - **DualDomainUNet** — 52M parameters, parallel spatial + FFT K-space encoders

    **Colour legend:** <span style="display: inline-block; width: 12px; height: 12px; background-color: #FF6B6B; border-radius: 2px; margin-right: 4px; vertical-align: middle;"></span> Whole Tumor (WT) &nbsp;·&nbsp; <span style="display: inline-block; width: 12px; height: 12px; background-color: #4ECDC4; border-radius: 2px; margin-right: 4px; vertical-align: middle;"></span> Tumor Core (TC) &nbsp;·&nbsp; <span style="display: inline-block; width: 12px; height: 12px; background-color: #FFE66D; border-radius: 2px; margin-right: 4px; vertical-align: middle;"></span> Enhancing Tumor (ET)

    **Data:** BraTS 2023 Glioma dataset. Upload any BraTS case T2w file for inference.
    """)


# ── Launch ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    demo.launch(
        share=True,          # generates public URL valid for 72 hours
        debug=False,
        show_error=True,
    )
```

---

## Step 5 — Colab Launch Cell

Paste this as a single cell in a Colab notebook. Run it after uploading checkpoints.

```python
import os, sys

# 1. Install
!pip install gradio nibabel -q

# 2. Upload your checkpoints (run this block, pick files when prompted)
from google.colab import files
os.makedirs('checkpoints', exist_ok=True)
print("Upload baseline_best.pt:")
up = files.upload()
for k, v in up.items():
    with open(f'checkpoints/{k}', 'wb') as f: f.write(v)

print("Upload dual_best.pt:")
up = files.upload()
for k, v in up.items():
    with open(f'checkpoints/{k}', 'wb') as f: f.write(v)

# 3. Write models.py and inference.py and app.py
# (paste the code from Steps 2, 3, 4 into separate cells and run them,
#  OR upload all three .py files using files.upload())

# 4. Launch
%run app.py
```

---

## Step 6 — Replacing the Model (Plug-and-Play)

When a new best checkpoint is available from continued training:

1. Download the new `dual_best.pt` from Kaggle output
2. In Colab, re-upload:
   ```python
   from google.colab import files
   up = files.upload()  # upload new dual_best.pt
   import shutil
   shutil.move('dual_best.pt', 'checkpoints/dual_best.pt')
   ```
3. Restart the app cell — `load_model()` picks up the new file automatically
4. No code changes needed anywhere

---

## Expected Output

The app produces a side-by-side figure showing:

```
[ T2w MRI ]  [ Baseline Prediction ]  [ Dual-Domain Prediction ]  [ Ground Truth* ]
                WT=0.797 TC=0.522        WT=0.802 TC=0.700
                ET=0.433                 ET=0.617

* Ground truth column only appears if segmentation file is uploaded
```

Inference time on CPU: ~20 seconds per volume
Inference time on GPU (T4): ~3 seconds per volume

---

## Known Limitations

- Input must be skull-stripped and co-registered (standard BraTS preprocessing already applied)
- Only T2w modality is supported (matches training configuration)
- Volume must be 240×240 in the axial plane (standard BraTS dimensions)
- No preprocessing for non-BraTS MRI (different scanner, different resolution) — out of scope for this demo

---

## Notes for Viva

- The app loads both models at startup and keeps them in memory — subsequent inferences are instant
- The shareable Gradio link works for 72 hours — generate it the morning of the viva
- If running on CPU (no GPU Colab), inference takes ~20 seconds — tell the examiner this upfront and note that GPU deployment brings it to ~3 seconds
- The Dice score table in the output directly shows the research finding: dual-domain consistently outperforms baseline on TC and ET regions
