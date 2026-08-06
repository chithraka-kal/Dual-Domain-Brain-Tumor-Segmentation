# Build Guide: fastMRI Frequency-Encoder Comparison App

## Purpose

This is a **new, standalone** analysis app — do not modify the existing BraTS
evaluation notebook/pipeline. This app answers one question: *does the
trained dual-domain model's frequency encoder respond similarly to real
fastMRI K-space as it does to the FFT-simulated K-space it was trained on?*

This is a feature-level comparison (inside the trained model), not a raw
data-distribution comparison, and not a segmentation-accuracy comparison.
fastMRI has no tumor segmentation ground truth, so no DSC/HD95 is computed
anywhere in this app.

## Prerequisites the agent should confirm before starting

- A local or mounted copy of fastMRI brain `.h5` files (multi-coil brain
  dataset), OR the ability to download a small subset if credentials/access
  are already configured. If no fastMRI access exists, stop and ask the user
  rather than guessing a source.
- The trained checkpoint file `dual_best.pt` (the dual-domain model), copied
  into this project's working directory.
- Python packages: `h5py`, `numpy`, `torch`, `matplotlib`, `scipy`.

## Project structure to create

```
fastmri_freq_compare/
  data/                      # small local cache of selected .h5 files (gitignored)
  outputs/
    feature_similarity.csv     # per-file, per-layer similarity scores
    feature_maps_sample.png    # qualitative side-by-side visualization
    summary.md                  # final written interpretation
  model.py                    # copy of the architecture classes (below)
  extract.py                  # real + simulated K-space extraction
  compare.py                  # runs both through the encoder, computes similarity
  visualize.py                # side-by-side feature map figure
  run_all.py                  # orchestrates the full pipeline end to end
```

---

## Step 1 — Select ~15-30 AXT2 files

fastMRI brain `.h5` files store the sequence type in file-level HDF5
attributes. **This step has a known failure mode**: earlier work on this
project accidentally selected an `AXT1POST` file instead of `AXT2` because
the acquisition type wasn't checked before use. Always filter explicitly.

```python
import h5py
import glob
import os

def list_axt2_files(fastmri_dir, n=20):
    """Scans a directory of fastMRI brain .h5 files and returns paths whose
    acquisition attribute is exactly 'AXT2'."""
    candidates = glob.glob(os.path.join(fastmri_dir, '*.h5'))
    axt2_files = []
    for path in candidates:
        try:
            with h5py.File(path, 'r') as f:
                acquisition = f.attrs.get('acquisition', b'')
                if isinstance(acquisition, bytes):
                    acquisition = acquisition.decode('utf-8')
                if acquisition == 'AXT2':
                    axt2_files.append(path)
        except Exception as e:
            print(f'Skipping {path}: {e}')
        if len(axt2_files) >= n:
            break
    print(f'Found {len(axt2_files)} AXT2 files out of {len(candidates)} scanned')
    return axt2_files
```

Save the selected file list (e.g. to `outputs/selected_files.txt`) so the
run is reproducible and reviewable.

---

## Step 2 — Extract real K-space and reconstruct T2w

fastMRI stores raw multi-coil K-space under the `kspace` dataset
(complex-valued, shape `[num_slices, num_coils, H, W]`). Take the middle
slice of each volume (or a fixed slice index) for consistency across files.

**Known bug to avoid repeating**: `fftshift` must be applied to center the
DC component before taking the magnitude, or the resulting map looks like a
single bright dot in a corner instead of the correct center-bright pattern.

```python
import numpy as np

def load_middle_slice_kspace(h5_path):
    import h5py
    with h5py.File(h5_path, 'r') as f:
        kspace = f['kspace'][()]  # shape (num_slices, num_coils, H, W), complex
    mid = kspace.shape[0] // 2
    return kspace[mid]  # shape (num_coils, H, W), complex

def reconstruct_t2w_from_kspace(coil_kspace):
    """Standard fastMRI single-slice reconstruction: IFFT per coil, then
    root-sum-of-squares combine across coils. Returns a real-valued image."""
    coil_images = np.fft.ifftshift(
        np.fft.ifft2(np.fft.ifftshift(coil_kspace, axes=(-2, -1)), axes=(-2, -1)),
        axes=(-2, -1),
    )
    rss = np.sqrt(np.sum(np.abs(coil_images) ** 2, axis=0))
    return rss.astype(np.float32)

def real_kspace_logmag(coil_kspace):
    """Root-sum-of-squares combine across coils, THEN fftshift + log-magnitude,
    matching the same treatment given to simulated K-space below."""
    combined = np.sqrt(np.sum(np.abs(coil_kspace) ** 2, axis=0))  # (H, W), real, >=0
    # combined is already a magnitude-like quantity from raw k-space; shift so
    # DC sits at the center before taking log, mirroring the simulated pipeline
    shifted = np.fft.fftshift(combined)
    kmag = np.log1p(shifted).astype(np.float32)
    kmin, kmax = kmag.min(), kmag.max()
    return (kmag - kmin) / (kmax - kmin + 1e-8)
```

Save both the reconstructed T2w image and the real K-space log-magnitude map
per file (e.g. as `.npy`) for the next steps.

---

## Step 3 — Compute FFT-simulated K-space from the SAME reconstructed image

This must use the exact same code path as the BraTS preprocessing pipeline
(the `evaluate_case()` function in the existing notebook), so the comparison
is fair — same log1p, same min-max normalization:

```python
def simulated_kspace_logmag(t2w_slice):
    """Identical to the FFT-simulation step used throughout BraTS preprocessing."""
    kspace = np.fft.fftshift(np.fft.fft2(t2w_slice.astype(np.float32)))
    kmag = np.log1p(np.abs(kspace)).astype(np.float32)
    kmin, kmax = kmag.min(), kmag.max()
    return (kmag - kmin) / (kmax - kmin + 1e-8)
```

Run this on the `reconstruct_t2w_from_kspace()` output from Step 2. Now, for
each file, you have two K-space log-magnitude maps derived from the *same*
underlying image content: one from real raw K-space, one simulated via FFT.

**Shape note**: fastMRI brain images are typically not 240×240 (often
320×320 or variable). Before feeding either map into the encoder, resize
(bilinear) or center-crop both to 240×240, matching the BraTS training
resolution, and to a size divisible by 16 (240 already is) so the encoder's
pooling stages behave identically to training.

---

## Step 4 — Load the trained model and extract just the frequency encoder

Copy these exact class definitions (from the existing evaluation notebook)
into `model.py` — the state dict keys must match exactly or loading will
fail:

```python
import torch
import torch.nn as nn

class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True))
    def forward(self, x): return self.block(x)

class Encoder(nn.Module):
    def __init__(self, in_ch=1, base=64):
        super().__init__()
        self.enc1 = ConvBlock(in_ch, base); self.enc2 = ConvBlock(base, base*2)
        self.enc3 = ConvBlock(base*2, base*4); self.enc4 = ConvBlock(base*4, base*8)
        self.bottleneck = ConvBlock(base*8, base*16)
        self.pool = nn.MaxPool2d(2); self.drop = nn.Dropout2d(0.3)
    def forward(self, x):
        e1=self.enc1(x); e2=self.enc2(self.pool(e1))
        e3=self.enc3(self.pool(e2)); e4=self.enc4(self.pool(e3))
        return self.drop(self.bottleneck(self.pool(e4))), (e1,e2,e3,e4)

class Decoder(nn.Module):
    def __init__(self, bottleneck_ch=1024, base=64, out_ch=3):
        super().__init__()
        self.up4=nn.ConvTranspose2d(bottleneck_ch,base*8,2,stride=2); self.dec4=ConvBlock(base*16,base*8)
        self.up3=nn.ConvTranspose2d(base*8,base*4,2,stride=2);        self.dec3=ConvBlock(base*8,base*4)
        self.up2=nn.ConvTranspose2d(base*4,base*2,2,stride=2);        self.dec2=ConvBlock(base*4,base*2)
        self.up1=nn.ConvTranspose2d(base*2,base,2,stride=2);          self.dec1=ConvBlock(base*2,base)
        self.drop=nn.Dropout2d(0.3); self.out=nn.Conv2d(base,out_ch,1)
    def forward(self, b, skips):
        e1,e2,e3,e4=skips
        d=self.drop(self.dec4(torch.cat([self.up4(b),e4],1)))
        d=self.drop(self.dec3(torch.cat([self.up3(d),e3],1)))
        d=self.dec2(torch.cat([self.up2(d),e2],1))
        d=self.dec1(torch.cat([self.up1(d),e1],1))
        return self.out(d)

class DualDomainUNet(nn.Module):
    def __init__(self, base=64, out_ch=3):
        super().__init__()
        self.spatial_enc=Encoder(1,base); self.freq_enc=Encoder(1,base)
        self.fusion=nn.Sequential(nn.Conv2d(base*32,base*16,1),nn.BatchNorm2d(base*16),nn.ReLU(inplace=True))
        self.decoder=Decoder(base*16,base,out_ch)
    def forward(self, spatial, freq):
        sb,skips=self.spatial_enc(spatial); fb,_=self.freq_enc(freq)
        return self.decoder(self.fusion(torch.cat([sb,fb],1)),skips)


def load_frequency_encoder(checkpoint_path, device):
    """Loads the full dual-domain model, then returns ONLY the freq_enc
    submodule, in eval mode, ready to accept a (1, 1, H, W) K-space map."""
    model = DualDomainUNet().to(device)
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt.get('model_state_dict', ckpt))
    model.eval()
    return model.freq_enc
```

---

## Step 5 — Pass both K-space maps through the frequency encoder

```python
import torch

@torch.no_grad()
def get_encoder_features(freq_encoder, kmag_2d, device):
    """kmag_2d: (240, 240) float32, already resized and normalized to [0,1].
    Returns the bottleneck feature map (the deepest, most semantically
    compressed representation) as a numpy array of shape (1024, 15, 15)."""
    x = torch.from_numpy(kmag_2d[np.newaxis, np.newaxis]).float().to(device)
    bottleneck, skips = freq_encoder(x)
    return bottleneck.squeeze(0).cpu().numpy(), [s.squeeze(0).cpu().numpy() for s in skips]
```

Run this once with the real K-space map, once with the simulated K-space map
(from the same file/slice), for every selected file. Store both bottleneck
feature maps per file.

---

## Step 6 — Compare the resulting feature maps

Compute both a quantitative similarity score and prepare data for the
qualitative visualization:

```python
import numpy as np

def cosine_similarity(feat_a, feat_b):
    """Channel-wise cosine similarity, averaged across all channels.
    feat_a, feat_b: (C, H, W) numpy arrays from the SAME spatial location
    (real vs. simulated input, same file)."""
    a_flat = feat_a.reshape(feat_a.shape[0], -1)
    b_flat = feat_b.reshape(feat_b.shape[0], -1)
    num = np.sum(a_flat * b_flat, axis=1)
    denom = np.linalg.norm(a_flat, axis=1) * np.linalg.norm(b_flat, axis=1) + 1e-8
    per_channel_cos = num / denom
    return float(per_channel_cos.mean()), per_channel_cos

def mse(feat_a, feat_b):
    return float(np.mean((feat_a - feat_b) ** 2))
```

For each file, compute `cosine_similarity(real_bottleneck, sim_bottleneck)`
and `mse(...)`. Save every file's scores as rows in
`outputs/feature_similarity.csv` with columns:
`file, mean_cosine_similarity, mse`.

Then compute and report the **mean and standard deviation of
mean_cosine_similarity across all files** — this single number (e.g.
"0.82 ± 0.09") is the headline quantitative result.

---

## Step 7 — Qualitative visualization

Pick 3-4 representative files (e.g. highest, median, and lowest similarity
score) and plot, for each: the real K-space map, the simulated K-space map,
and the first ~8 channels of each feature map (as small grayscale tiles) side
by side, so a reader can visually judge whether the encoder is "seeing"
similar structure.

```python
import matplotlib.pyplot as plt

def plot_comparison(real_kmag, sim_kmag, real_feat, sim_feat, n_channels=8, save_path=None):
    fig, axes = plt.subplots(3, n_channels, figsize=(2*n_channels, 6))
    for c in range(n_channels):
        axes[0, c].imshow(real_feat[c], cmap='viridis'); axes[0, c].axis('off')
        axes[1, c].imshow(sim_feat[c], cmap='viridis'); axes[1, c].axis('off')
        diff = np.abs(real_feat[c] - sim_feat[c])
        axes[2, c].imshow(diff, cmap='hot'); axes[2, c].axis('off')
    axes[0, 0].set_ylabel('Real K-space\nfeatures', fontsize=9)
    axes[1, 0].set_ylabel('Simulated K-space\nfeatures', fontsize=9)
    axes[2, 0].set_ylabel('Abs. difference', fontsize=9)
    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
```

Save the combined figure to `outputs/feature_maps_sample.png`.

---

## Step 8 — Write the interpretation

Populate `outputs/summary.md` with, at minimum:

- How many files were processed, and confirmation all were verified `AXT2`.
- The headline number: mean ± SD cosine similarity across all files.
- Whether MSE trended low/consistent or high/variable across files.
- 2-3 sentences of plain interpretation, calibrated honestly to the actual
  numbers — do not default to a positive framing if the numbers don't
  support it. Guidance:
  - Mean cosine similarity roughly > 0.8, low variance → encoder responds
    consistently similarly to real and simulated input; supportive (not
    proof of) transfer to real acquisition data.
  - Mean cosine similarity roughly 0.5-0.8 → partial overlap; the encoder
    captures some shared structure but also reacts differently to real
    K-space in ways worth investigating (e.g. is it responding to noise or
    coil artifacts specifically).
  - Mean cosine similarity low (<0.5) or highly variable across files →
    meaningful divergence; state this plainly as a limitation rather than
    downplaying it — this is still a genuine, useful finding for the paper.
- One sentence noting the sample size (15-30 files) as a scope limit on how
  strongly any of the above should be stated.

---

## Step 9 — `run_all.py`

Wire steps 1-8 into a single script that a user can run start to finish:

```python
from extract import list_axt2_files, load_middle_slice_kspace, reconstruct_t2w_from_kspace, real_kspace_logmag, simulated_kspace_logmag
from model import load_frequency_encoder, get_encoder_features
from compare import cosine_similarity, mse
from visualize import plot_comparison
import numpy as np, csv, torch, os

def resize_240(arr):
    from scipy.ndimage import zoom
    factors = (240 / arr.shape[0], 240 / arr.shape[1])
    return zoom(arr, factors, order=1).astype(np.float32)

def main(fastmri_dir, checkpoint_path, out_dir='outputs', n_files=20):
    os.makedirs(out_dir, exist_ok=True)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    freq_encoder = load_frequency_encoder(checkpoint_path, device)

    files = list_axt2_files(fastmri_dir, n=n_files)
    rows = []
    all_data = []

    for path in files:
        coil_kspace = load_middle_slice_kspace(path)
        t2w = reconstruct_t2w_from_kspace(coil_kspace)
        real_kmag = resize_240(real_kspace_logmag(coil_kspace))
        sim_kmag  = resize_240(simulated_kspace_logmag(t2w))

        real_feat, _ = get_encoder_features(freq_encoder, real_kmag, device)
        sim_feat, _  = get_encoder_features(freq_encoder, sim_kmag, device)

        mean_cos, _ = cosine_similarity(real_feat, sim_feat)
        m = mse(real_feat, sim_feat)
        rows.append({'file': os.path.basename(path), 'mean_cosine_similarity': mean_cos, 'mse': m})
        all_data.append((path, real_kmag, sim_kmag, real_feat, sim_feat, mean_cos))
        print(f'{os.path.basename(path)}: cos={mean_cos:.4f}, mse={m:.6f}')

    with open(os.path.join(out_dir, 'feature_similarity.csv'), 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['file', 'mean_cosine_similarity', 'mse'])
        writer.writeheader()
        writer.writerows(rows)

    cos_values = [r['mean_cosine_similarity'] for r in rows]
    print(f'\nOverall: {np.mean(cos_values):.4f} ± {np.std(cos_values):.4f}')

    all_data.sort(key=lambda x: x[5])
    picks = [all_data[0], all_data[len(all_data)//2], all_data[-1]]
    for i, (path, real_kmag, sim_kmag, real_feat, sim_feat, cos) in enumerate(picks):
        plot_comparison(real_kmag, sim_kmag, real_feat, sim_feat,
                         save_path=os.path.join(out_dir, f'feature_maps_sample_{i}.png'))

    print(f'\nDone. See {out_dir}/feature_similarity.csv and feature_maps_sample_*.png')
    print('Now write outputs/summary.md per Step 8 guidance in the build guide.')

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--fastmri_dir', required=True)
    parser.add_argument('--checkpoint', required=True)
    parser.add_argument('--out_dir', default='outputs')
    parser.add_argument('--n_files', type=int, default=20)
    args = parser.parse_args()
    main(args.fastmri_dir, args.checkpoint, args.out_dir, args.n_files)
```

---

## Acceptance checklist (agent should verify before declaring done)

- [ ] All selected files confirmed `AXT2` via metadata check (not assumed from filename)
- [ ] `fftshift` applied before magnitude computation on real K-space (avoids the corner-dot bug)
- [ ] Real and simulated K-space maps both resized to identical 240×240 shape before the encoder
- [ ] Both maps normalized with the identical log1p + min-max procedure
- [ ] Frequency encoder loaded from `dual_best.pt` state dict without shape-mismatch errors
- [ ] `feature_similarity.csv` has one row per processed file, no NaNs
- [ ] At least one qualitative figure saved showing real vs. simulated feature maps side by side
- [ ] `summary.md` states the actual mean ± SD result and an honestly-calibrated interpretation (not a predetermined positive conclusion)
- [ ] Existing BraTS notebook/pipeline left untouched

