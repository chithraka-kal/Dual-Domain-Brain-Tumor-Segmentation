"""
run_all.py — End-to-end orchestration of the fastMRI frequency-encoder
             comparison pipeline (Steps 1-8 of the build guide).

Usage
-----
    python run_all.py --fastmri_dir /fastMRI-data --checkpoint /models/dual_best.pt

Optional flags
--------------
    --out_dir   outputs/        Where to write CSV, figures, summary, etc.
    --n_files   20              How many AXT2 files to process (15-30 recommended).
    --n_vis     8               Number of bottleneck channels to display in figures.

Outputs
-------
    outputs/selected_files.txt
    outputs/feature_similarity.csv
    outputs/feature_maps_sample_0.png   (lowest similarity)
    outputs/feature_maps_sample_1.png   (median similarity)
    outputs/feature_maps_sample_2.png   (highest similarity)
    outputs/kspace_sanity_*.png         (K-space input sanity checks)
    outputs/summary.md
"""

import argparse
import csv
import os

import numpy as np
import torch
from scipy.ndimage import zoom

from extract import (
    list_axt2_files,
    load_middle_slice_kspace,
    real_kspace_logmag,
    reconstruct_t2w_from_kspace,
    save_selected_files,
    simulated_kspace_logmag,
)
from model import get_encoder_features, load_frequency_encoder
from compare import cosine_similarity, mse
from visualize import plot_comparison, plot_kspace_pair


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def resize_240(arr):
    """Bilinear resize to 240×240 — matches the BraTS training resolution and
    keeps spatial dimensions divisible by 16 for the encoder's pooling stages.
    """
    if arr.shape == (240, 240):
        return arr.astype(np.float32)
    factors = (240 / arr.shape[0], 240 / arr.shape[1])
    return zoom(arr, factors, order=1).astype(np.float32)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main(fastmri_dir, checkpoint_path, out_dir='outputs', n_files=20, n_vis=8):
    os.makedirs(out_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Device
    # ------------------------------------------------------------------
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Using device: {device}')

    # ------------------------------------------------------------------
    # Step 1 — Select AXT2 files
    # ------------------------------------------------------------------
    print('\n=== Step 1: Selecting AXT2 files ===')
    files = list_axt2_files(fastmri_dir, n=n_files)
    if not files:
        raise RuntimeError(
            f'No AXT2 files found in {fastmri_dir!r}. '
            'Check the path and that .h5 files are present.'
        )
    save_selected_files(files, os.path.join(out_dir, 'selected_files.txt'))

    # ------------------------------------------------------------------
    # Step 4 — Load frequency encoder from checkpoint
    # ------------------------------------------------------------------
    print('\n=== Step 4: Loading frequency encoder ===')
    freq_encoder = load_frequency_encoder(checkpoint_path, device)
    print(f'Checkpoint loaded from {checkpoint_path}')

    # ------------------------------------------------------------------
    # Steps 2-3-5-6 — Process each file
    # ------------------------------------------------------------------
    print('\n=== Steps 2-3-5-6: Processing files ===')
    rows = []
    all_data = []

    for idx, path in enumerate(files):
        fname = os.path.basename(path)
        print(f'[{idx + 1}/{len(files)}] {fname}', end=' ... ')

        # Step 2: real K-space
        coil_kspace = load_middle_slice_kspace(path)
        t2w = reconstruct_t2w_from_kspace(coil_kspace)
        real_kmag = resize_240(real_kspace_logmag(coil_kspace))

        # Step 3: simulated K-space (same image, same normalisation as BraTS)
        sim_kmag = resize_240(simulated_kspace_logmag(t2w))

        # Sanity-check shapes
        assert real_kmag.shape == sim_kmag.shape == (240, 240), \
            f'Unexpected shape after resize: {real_kmag.shape}'

        # Step 5: encoder features
        real_feat, _ = get_encoder_features(freq_encoder, real_kmag, device)
        sim_feat, _ = get_encoder_features(freq_encoder, sim_kmag, device)

        # Step 6: similarity scores
        mean_cos, per_ch = cosine_similarity(real_feat, sim_feat)
        m = mse(real_feat, sim_feat)

        print(f'cos={mean_cos:.4f}  mse={m:.6f}')

        rows.append({
            'file': fname,
            'mean_cosine_similarity': mean_cos,
            'mse': m,
        })
        all_data.append({
            'path': path,
            'real_kmag': real_kmag,
            'sim_kmag': sim_kmag,
            'real_feat': real_feat,
            'sim_feat': sim_feat,
            'cos': mean_cos,
        })

    # ------------------------------------------------------------------
    # Step 6 (continued) — Save CSV and compute headline statistic
    # ------------------------------------------------------------------
    csv_path = os.path.join(out_dir, 'feature_similarity.csv')
    with open(csv_path, 'w', newline='') as fh:
        writer = csv.DictWriter(
            fh, fieldnames=['file', 'mean_cosine_similarity', 'mse']
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f'\nSaved → {csv_path}')

    cos_values = [r['mean_cosine_similarity'] for r in rows]
    mse_values = [r['mse'] for r in rows]
    mean_cos_all = np.mean(cos_values)
    std_cos_all = np.std(cos_values)
    print(f'\n=== Headline result ===')
    print(f'Mean cosine similarity : {mean_cos_all:.4f} ± {std_cos_all:.4f}')
    print(f'Mean MSE               : {np.mean(mse_values):.6f} ± {np.std(mse_values):.6f}')

    # ------------------------------------------------------------------
    # Step 7 — Qualitative visualisation
    # ------------------------------------------------------------------
    print('\n=== Step 7: Generating figures ===')
    all_data_sorted = sorted(all_data, key=lambda d: d['cos'])

    # Sanity-check K-space pair for the median file
    mid_entry = all_data_sorted[len(all_data_sorted) // 2]
    plot_kspace_pair(
        mid_entry['real_kmag'],
        mid_entry['sim_kmag'],
        title=f"K-space inputs — {os.path.basename(mid_entry['path'])}",
        save_path=os.path.join(out_dir, 'kspace_sanity_median.png'),
    )

    # Representative picks: lowest / median / highest similarity
    picks = [
        (0, 'lowest', all_data_sorted[0]),
        (1, 'median', all_data_sorted[len(all_data_sorted) // 2]),
        (2, 'highest', all_data_sorted[-1]),
    ]

    for i, label, entry in picks:
        save_path = os.path.join(out_dir, f'feature_maps_sample_{i}.png')
        plot_comparison(
            entry['real_kmag'],
            entry['sim_kmag'],
            entry['real_feat'],
            entry['sim_feat'],
            n_channels=n_vis,
            title=(
                f"{label.capitalize()} similarity — "
                f"{os.path.basename(entry['path'])}  "
                f"(cos={entry['cos']:.4f})"
            ),
            save_path=save_path,
        )

    # ------------------------------------------------------------------
    # Step 8 — Write summary.md
    # ------------------------------------------------------------------
    print('\n=== Step 8: Writing summary.md ===')
    _write_summary(
        out_dir=out_dir,
        files=files,
        rows=rows,
        mean_cos=mean_cos_all,
        std_cos=std_cos_all,
        mse_values=mse_values,
    )

    print(f'\nDone. Outputs in: {out_dir}/')


# ---------------------------------------------------------------------------
# Step 8 helper
# ---------------------------------------------------------------------------

def _interpret_cos(mean_cos):
    if mean_cos > 0.8:
        return (
            'The frequency encoder responds **consistently similarly** to real '
            'and FFT-simulated K-space inputs. This is supportive (though not '
            'conclusive proof) of reasonable feature-level transfer to real '
            'acquisition data under the tested conditions.'
        )
    elif mean_cos >= 0.5:
        return (
            'The frequency encoder shows **partial overlap** between real and '
            'simulated K-space representations. The encoder captures some shared '
            'structure but also responds differently in ways worth investigating '
            '(e.g. sensitivity to noise patterns, coil-specific artifacts, or '
            'undersampling characteristics absent in the simulated pipeline).'
        )
    else:
        return (
            'The frequency encoder shows **meaningful divergence** between its '
            'responses to real and simulated K-space. This is a genuine finding '
            'and should be stated as a limitation: the model was trained on '
            'FFT-simulated K-space and its frequency-domain representations do '
            'not reliably generalise to raw multi-coil acquisition data under '
            'the tested conditions.'
        )


def _write_summary(out_dir, files, rows, mean_cos, std_cos, mse_values):
    mse_mean = np.mean(mse_values)
    mse_std = np.std(mse_values)
    mse_range = (min(mse_values), max(mse_values))

    mse_desc = (
        'low and consistent'
        if mse_std / (mse_mean + 1e-8) < 0.3
        else 'variable across files'
    )

    interpretation = _interpret_cos(mean_cos)

    content = f"""# fastMRI Frequency-Encoder Comparison — Summary

## Dataset

- **Files processed**: {len(files)}
- All files verified as `AXT2` via HDF5 `acquisition` attribute (not filename).
- Middle slice extracted per volume for consistency.
- K-space maps resized to 240×240 (bilinear) before the encoder.

## Headline Result

| Metric | Value |
|--------|-------|
| Mean cosine similarity | **{mean_cos:.4f} ± {std_cos:.4f}** |
| Mean MSE | {mse_mean:.6f} ± {mse_std:.6f} |
| MSE range | [{mse_range[0]:.6f}, {mse_range[1]:.6f}] |

## Interpretation

{interpretation}

MSE was {mse_desc} across files (mean {mse_mean:.6f}, SD {mse_std:.6f},
range [{mse_range[0]:.6f}–{mse_range[1]:.6f}]).

> **Scope note**: These results are based on {len(files)} AXT2 files from the
> fastMRI brain dataset. This sample size is sufficient for a directional
> comparison but not for strong generalisability claims; results should be
> interpreted as indicative rather than exhaustive.

## Per-file Scores

| File | Cosine Similarity | MSE |
|------|-------------------|-----|
""" + '\n'.join(
        f"| {r['file']} | {r['mean_cosine_similarity']:.4f} | {r['mse']:.6f} |"
        for r in rows
    ) + '\n'

    summary_path = os.path.join(out_dir, 'summary.md')
    with open(summary_path, 'w') as fh:
        fh.write(content)
    print(f'Saved → {summary_path}')


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='fastMRI frequency-encoder comparison pipeline'
    )
    parser.add_argument(
        '--fastmri_dir',
        default='../fastMRI-data',
        help='Directory containing fastMRI brain .h5 files (default: ../fastMRI-data)',
    )
    parser.add_argument(
        '--checkpoint',
        default='/models/dual_best.pt',
        help='Path to dual_best.pt checkpoint (default: /models/dual_best.pt)',
    )
    parser.add_argument(
        '--out_dir',
        default='outputs',
        help='Output directory (default: outputs)',
    )
    parser.add_argument(
        '--n_files',
        type=int,
        default=20,
        help='Number of AXT2 files to process (default: 20)',
    )
    parser.add_argument(
        '--n_vis',
        type=int,
        default=8,
        help='Number of bottleneck channels to show in figures (default: 8)',
    )
    args = parser.parse_args()
    main(args.fastmri_dir, args.checkpoint, args.out_dir, args.n_files, args.n_vis)
