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
def run_inference(model, model_type, vol_norm, tissue_slices, device, threshold=0.5, batch_size=16):
    """
    Run full-volume inference using slice batching for high-performance PyTorch execution.
    Returns predicted masks (240, 240, 155, 3).
    model_type: 'spatial' or 'dual'
    """
    H, W, D = vol_norm.shape
    pred_volume = np.zeros((H, W, D, 3), dtype=np.float32)

    for i in range(0, len(tissue_slices), batch_size):
        batch_zs = tissue_slices[i:i + batch_size]
        spatials, freqs = [], []
        for z in batch_zs:
            s, f = slice_to_tensors(vol_norm, z, device)
            spatials.append(s)
            freqs.append(f)

        spatial_batch = torch.cat(spatials, dim=0)
        freq_batch    = torch.cat(freqs, dim=0)

        if model_type == 'spatial':
            logits = model(spatial_batch)
        else:
            logits = model(spatial_batch, freq_batch)

        probs  = torch.sigmoid(logits).cpu().numpy()  # (B, 3, H, W)
        binary = (probs > threshold).astype(np.float32)

        for idx, z in enumerate(batch_zs):
            pred_volume[:, :, z, :] = binary[idx].transpose(1, 2, 0)

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
