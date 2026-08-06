"""
visualize.py — Qualitative side-by-side feature-map visualisations.

For a set of representative files (highest / median / lowest cosine similarity),
plot:
  Row 0 : First N channels of the real K-space bottleneck feature map
  Row 1 : First N channels of the simulated K-space bottleneck feature map
  Row 2 : Absolute difference between rows 0 and 1 (per channel)

Additionally, plot_kspace_pair() generates a simple two-panel figure showing
the input K-space log-magnitude maps side by side (useful for sanity-checking
that fftshift was applied correctly — the DC peak should be centred).
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec


def plot_comparison(
    real_kmag,
    sim_kmag,
    real_feat,
    sim_feat,
    n_channels=8,
    title=None,
    save_path=None,
):
    """Three-row grid: real features / simulated features / absolute difference.

    Parameters
    ----------
    real_kmag : np.ndarray
        Shape ``(H, W)`` — real K-space log-magnitude (input to encoder).
    sim_kmag : np.ndarray
        Shape ``(H, W)`` — simulated K-space log-magnitude (input to encoder).
    real_feat : np.ndarray
        Shape ``(C, h, w)`` — bottleneck features from real K-space.
    sim_feat : np.ndarray
        Shape ``(C, h, w)`` — bottleneck features from simulated K-space.
    n_channels : int
        Number of feature channels to display (columns in the grid).
    title : str or None
        Optional suptitle (e.g. filename + cosine similarity score).
    save_path : str or None
        If given, save the figure to this path (PNG, dpi=150).
    """
    n_channels = min(n_channels, real_feat.shape[0])

    # Build a figure: 2 extra columns for the K-space input maps + n_channels
    total_cols = n_channels + 2
    fig = plt.figure(figsize=(1.8 * total_cols, 7), facecolor='#1a1a2e')
    fig.patch.set_facecolor('#1a1a2e')

    outer = gridspec.GridSpec(1, 2, width_ratios=[2, n_channels], wspace=0.05, figure=fig)

    # --- Left panel: K-space input maps ---
    left = gridspec.GridSpecFromSubplotSpec(
        3, 1, subplot_spec=outer[0], hspace=0.15
    )
    ax_r_k = fig.add_subplot(left[0])
    ax_s_k = fig.add_subplot(left[1])
    ax_diff_k = fig.add_subplot(left[2])

    ax_r_k.imshow(real_kmag, cmap='inferno', vmin=0, vmax=1)
    ax_r_k.set_title('Real K-space\n(log-mag)', color='white', fontsize=8)
    ax_r_k.axis('off')

    ax_s_k.imshow(sim_kmag, cmap='inferno', vmin=0, vmax=1)
    ax_s_k.set_title('Simulated K-space\n(log-mag)', color='white', fontsize=8)
    ax_s_k.axis('off')

    diff_kspace = np.abs(real_kmag - sim_kmag)
    ax_diff_k.imshow(diff_kspace, cmap='hot', vmin=0, vmax=diff_kspace.max() + 1e-8)
    ax_diff_k.set_title('K-space\ndifference', color='white', fontsize=8)
    ax_diff_k.axis('off')

    # --- Right panel: feature map channels ---
    right = gridspec.GridSpecFromSubplotSpec(
        3, n_channels, subplot_spec=outer[1], hspace=0.05, wspace=0.05
    )

    for c in range(n_channels):
        ax0 = fig.add_subplot(right[0, c])
        ax1 = fig.add_subplot(right[1, c])
        ax2 = fig.add_subplot(right[2, c])

        ax0.imshow(real_feat[c], cmap='viridis')
        ax0.axis('off')
        if c == 0:
            ax0.set_ylabel('Real\nfeatures', color='white', fontsize=7)

        ax1.imshow(sim_feat[c], cmap='viridis')
        ax1.axis('off')
        if c == 0:
            ax1.set_ylabel('Sim.\nfeatures', color='white', fontsize=7)

        diff = np.abs(real_feat[c] - sim_feat[c])
        ax2.imshow(diff, cmap='hot')
        ax2.axis('off')
        if c == 0:
            ax2.set_ylabel('|Diff|', color='white', fontsize=7)

        ax0.set_title(f'Ch {c}', color='#aaaaaa', fontsize=6)

    if title:
        fig.suptitle(title, color='white', fontsize=10, y=1.01)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
        print(f'  Saved figure → {save_path}')

    plt.close(fig)


def plot_kspace_pair(real_kmag, sim_kmag, title=None, save_path=None):
    """Simple two-panel figure for sanity-checking K-space input maps.

    DC peak should appear at the *centre* of both maps (not in a corner).
    If it appears in a corner, fftshift was not applied correctly.
    """
    fig, axes = plt.subplots(1, 2, figsize=(8, 4), facecolor='#1a1a2e')
    for ax, img, lbl in zip(
        axes,
        [real_kmag, sim_kmag],
        ['Real K-space (log-mag)', 'Simulated K-space (log-mag)'],
    ):
        ax.imshow(img, cmap='inferno', vmin=0, vmax=1)
        ax.set_title(lbl, color='white', fontsize=10)
        ax.axis('off')
        ax.set_facecolor('#1a1a2e')

    if title:
        fig.suptitle(title, color='white', fontsize=11)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=120, bbox_inches='tight', facecolor=fig.get_facecolor())
        print(f'  Saved K-space pair figure → {save_path}')

    plt.close(fig)
