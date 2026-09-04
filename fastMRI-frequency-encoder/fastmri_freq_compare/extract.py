"""
extract.py — K-space loading, reconstruction, and normalization helpers.

Covers:
  - Scanning a fastMRI directory for AXT2-typed .h5 files (Step 1)
  - Loading the middle slice of multi-coil K-space (Step 2)
  - Reconstructing the T2w image via IFFT + root-sum-of-squares (Step 2)
  - Computing the real K-space log-magnitude map (Step 2)
  - Computing the FFT-simulated K-space log-magnitude map (Step 3)

fastMRI K-space convention (confirmed by debug_kspace_convention.py):
  Raw .h5 kspace arrays are stored in the ALREADY-CENTERED convention:
  DC component sits at the array center (H//2, W//2), NOT at [0,0].
  This matches the official fastMRI ifft2c which does:
    ifftshift → ifft2 → fftshift
  i.e. it assumes the input kspace IS already center-shifted.

  Consequence for real_kspace_logmag():
    Do NOT apply fftshift to the RSS-combined array — DC is already at center.
    Applying fftshift would move DC to the corner (confirmed: argmax moves
    from (320,160) to (0,0) on a 640×320 volume).

  Consequence for reconstruct_t2w_from_kspace():
    The ifftshift BEFORE ifft2 undoes the centering (puts DC back at corner
    for the numpy IFFT), and the ifftshift AFTER shifts the image to center —
    this is the correct chain matching fastMRI's ifft2c_new.

Known bugs avoided:
  - Acquisition type is checked from HDF5 metadata, never inferred from filename.
  - NO fftshift applied to real K-space (it is already centered in the .h5 file).
"""

import os
import glob
import numpy as np
import h5py


# ---------------------------------------------------------------------------
# Step 1 — File selection
# ---------------------------------------------------------------------------

def list_axt2_files(fastmri_dir, n=20):
    """Scan *fastmri_dir* and return up to *n* paths whose HDF5 ``acquisition``
    attribute is exactly ``'AXT2'``.

    Writes the selected list to
    ``<fastmri_dir>/../outputs/selected_files.txt`` so the run is
    reproducible.  (The caller is responsible for creating ``outputs/``.)
    """
    candidates = sorted(glob.glob(os.path.join(fastmri_dir, '*.h5')))
    axt2_files = []

    for path in candidates:
        try:
            with h5py.File(path, 'r') as f:
                acquisition = f.attrs.get('acquisition', b'')
                if isinstance(acquisition, bytes):
                    acquisition = acquisition.decode('utf-8')
                if acquisition.strip() == 'AXT2':
                    axt2_files.append(path)
        except Exception as exc:
            print(f'[SKIP] {path}: {exc}')

        if len(axt2_files) >= n:
            break

    print(f'Found {len(axt2_files)} AXT2 files out of {len(candidates)} scanned.')
    return axt2_files


def save_selected_files(file_list, out_path):
    """Persist the list of selected .h5 paths to *out_path* for reproducibility."""
    with open(out_path, 'w') as fh:
        for p in file_list:
            fh.write(p + '\n')
    print(f'Selected file list saved to {out_path}')


# ---------------------------------------------------------------------------
# Step 2 — Load K-space and reconstruct T2w
# ---------------------------------------------------------------------------

def load_middle_slice_kspace(h5_path):
    """Return the middle slice of multi-coil K-space from a fastMRI brain .h5.

    Returns
    -------
    np.ndarray
        Shape ``(num_coils, H, W)``, complex128.
    """
    with h5py.File(h5_path, 'r') as f:
        kspace = f['kspace'][()]  # (num_slices, num_coils, H, W), complex
    mid = kspace.shape[0] // 2
    return kspace[mid]  # (num_coils, H, W)


def reconstruct_t2w_from_kspace(coil_kspace):
    """Standard fastMRI reconstruction: IFFT per coil then root-sum-of-squares.

    Parameters
    ----------
    coil_kspace : np.ndarray
        Shape ``(num_coils, H, W)``, complex.

    Returns
    -------
    np.ndarray
        Shape ``(H, W)``, float32 — the reconstructed magnitude image.
    """
    # IFFT per coil; fftshift centres the image (undoes the k-space centring)
    coil_images = np.fft.ifftshift(
        np.fft.ifft2(
            np.fft.ifftshift(coil_kspace, axes=(-2, -1)),
            axes=(-2, -1),
        ),
        axes=(-2, -1),
    )
    rss = np.sqrt(np.sum(np.abs(coil_images) ** 2, axis=0))
    return rss.astype(np.float32)


def real_kspace_logmag(coil_kspace):
    """Root-sum-of-squares magnitude of multi-coil K-space, log1p, min-max.

    fastMRI stores raw K-space in the ALREADY-CENTERED convention (DC at
    center of the array). Confirmed by debug_kspace_convention.py:
    ``np.unravel_index(combined.argmax(), combined.shape)`` returns (320, 160)
    on a (640, 320) volume — exactly the center — with NO shifts applied.

    Therefore NO fftshift is applied here. Applying one would move DC to the
    corner, producing an inverted representation that does NOT match the
    simulated K-space pipeline (which does fftshift AFTER fft2 to center DC).

    Parameters
    ----------
    coil_kspace : np.ndarray
        Shape ``(num_coils, H, W)``, complex — directly from the .h5 file.

    Returns
    -------
    np.ndarray
        Shape ``(H, W)``, float32, values in ``[0, 1]``.
    """
    # RSS-combine across coils in magnitude domain — DC already at center
    combined = np.sqrt(np.sum(np.abs(coil_kspace) ** 2, axis=0))  # (H, W), real ≥ 0
    # No fftshift needed: fastMRI raw kspace is stored centered (verified)
    kmag = np.log1p(combined).astype(np.float32)
    kmin, kmax = kmag.min(), kmag.max()
    return (kmag - kmin) / (kmax - kmin + 1e-8)


# ---------------------------------------------------------------------------
# Step 3 — FFT-simulated K-space (must match BraTS preprocessing exactly)
# ---------------------------------------------------------------------------

def simulated_kspace_logmag(t2w_slice):
    """Simulate K-space from a reconstructed T2w image using the identical
    pipeline used in BraTS preprocessing (FFT → fftshift → log1p → min-max).

    Parameters
    ----------
    t2w_slice : np.ndarray
        Shape ``(H, W)``, float32 — output of :func:`reconstruct_t2w_from_kspace`.

    Returns
    -------
    np.ndarray
        Shape ``(H, W)``, float32, values in ``[0, 1]``.
    """
    kspace = np.fft.fftshift(np.fft.fft2(t2w_slice.astype(np.float32)))
    kmag = np.log1p(np.abs(kspace)).astype(np.float32)
    kmin, kmax = kmag.min(), kmag.max()
    return (kmag - kmin) / (kmax - kmin + 1e-8)
