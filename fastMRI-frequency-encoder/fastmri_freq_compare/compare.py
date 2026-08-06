"""
compare.py — Quantitative feature-similarity metrics.

For each fastMRI file, we compare two (C, H, W) bottleneck feature maps:
  - real_feat  : produced by running real K-space through the frequency encoder
  - sim_feat   : produced by running FFT-simulated K-space through the same encoder

Metrics
-------
cosine_similarity
    Channel-wise cosine similarity averaged across all C channels.
    Range [−1, 1]; values near 1.0 indicate very similar representations.
mse
    Mean squared error across all elements — a magnitude-sensitive complement
    to cosine similarity (which is scale-invariant).
"""

import numpy as np


def cosine_similarity(feat_a, feat_b):
    """Channel-wise cosine similarity, averaged across all channels.

    Parameters
    ----------
    feat_a, feat_b : np.ndarray
        Shape ``(C, H, W)`` — feature maps from the **same spatial location**
        (real vs. simulated input, same file/slice).

    Returns
    -------
    mean_cos : float
        Scalar mean across the C channel-wise cosine similarities.
    per_channel_cos : np.ndarray
        Shape ``(C,)`` — raw per-channel scores (useful for distribution plots).
    """
    if feat_a.shape != feat_b.shape:
        raise ValueError(
            f'Shape mismatch: feat_a {feat_a.shape} vs feat_b {feat_b.shape}'
        )

    # Flatten each channel to a vector: (C, H*W)
    a_flat = feat_a.reshape(feat_a.shape[0], -1)
    b_flat = feat_b.reshape(feat_b.shape[0], -1)

    numerator = np.sum(a_flat * b_flat, axis=1)
    denom = (
        np.linalg.norm(a_flat, axis=1) * np.linalg.norm(b_flat, axis=1) + 1e-8
    )
    per_channel_cos = numerator / denom

    return float(per_channel_cos.mean()), per_channel_cos


def mse(feat_a, feat_b):
    """Mean squared error between two feature maps.

    Parameters
    ----------
    feat_a, feat_b : np.ndarray
        Shape ``(C, H, W)``.

    Returns
    -------
    float
    """
    return float(np.mean((feat_a - feat_b) ** 2))
