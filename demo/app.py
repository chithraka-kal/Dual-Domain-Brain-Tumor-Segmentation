# app.py
import os, time, sys
import gradio as gr
import numpy as np
import torch

# Ensure demo directory is in path
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from models import SpatialUNet, DualDomainUNet, load_model
from inference import (preprocess_volume, run_inference,
                       build_seg_mask_from_nii, find_best_slice,
                       build_comparison_figure, compute_dice)

# ── Configuration ─────────────────────────────────────────────────────────────
BASELINE_CKPT = os.path.join(app_dir, 'checkpoints/baseline_best.pt')
DUAL_CKPT     = os.path.join(app_dir, 'checkpoints/dual_best.pt')
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
with gr.Blocks(title="BraTS Dual-Domain Demo") as demo:

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

    **Colour legend:** 🔴 Whole Tumor (WT) · 🩵 Tumor Core (TC) · 🟡 Enhancing Tumor (ET)

    **Data:** BraTS 2023 Glioma dataset. Upload any BraTS case T2w file for inference.
    """)


# ── Launch ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    demo.launch(
        theme=gr.themes.Base(),
        share=True,          # generates public URL valid for 72 hours
        debug=False,
        show_error=True,
    )
