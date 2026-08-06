"""
model.py — Architecture classes for the Dual-Domain U-Net and helpers
for loading just the frequency encoder from a saved checkpoint.

State-dict keys must match the training checkpoint exactly; do not rename
any nn.Module attributes without also re-saving the checkpoint.
"""

import torch
import torch.nn as nn
import numpy as np


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

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

    def forward(self, x):
        return self.block(x)


class Encoder(nn.Module):
    def __init__(self, in_ch=1, base=64):
        super().__init__()
        self.enc1 = ConvBlock(in_ch, base)
        self.enc2 = ConvBlock(base, base * 2)
        self.enc3 = ConvBlock(base * 2, base * 4)
        self.enc4 = ConvBlock(base * 4, base * 8)
        self.bottleneck = ConvBlock(base * 8, base * 16)
        self.pool = nn.MaxPool2d(2)
        self.drop = nn.Dropout2d(0.3)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        bottleneck = self.drop(self.bottleneck(self.pool(e4)))
        return bottleneck, (e1, e2, e3, e4)


class Decoder(nn.Module):
    def __init__(self, bottleneck_ch=1024, base=64, out_ch=3):
        super().__init__()
        self.up4 = nn.ConvTranspose2d(bottleneck_ch, base * 8, 2, stride=2)
        self.dec4 = ConvBlock(base * 16, base * 8)
        self.up3 = nn.ConvTranspose2d(base * 8, base * 4, 2, stride=2)
        self.dec3 = ConvBlock(base * 8, base * 4)
        self.up2 = nn.ConvTranspose2d(base * 4, base * 2, 2, stride=2)
        self.dec2 = ConvBlock(base * 4, base * 2)
        self.up1 = nn.ConvTranspose2d(base * 2, base, 2, stride=2)
        self.dec1 = ConvBlock(base * 2, base)
        self.drop = nn.Dropout2d(0.3)
        self.out = nn.Conv2d(base, out_ch, 1)

    def forward(self, b, skips):
        e1, e2, e3, e4 = skips
        d = self.drop(self.dec4(torch.cat([self.up4(b), e4], 1)))
        d = self.drop(self.dec3(torch.cat([self.up3(d), e3], 1)))
        d = self.dec2(torch.cat([self.up2(d), e2], 1))
        d = self.dec1(torch.cat([self.up1(d), e1], 1))
        return self.out(d)


class DualDomainUNet(nn.Module):
    def __init__(self, base=64, out_ch=3):
        super().__init__()
        self.spatial_enc = Encoder(1, base)
        self.freq_enc = Encoder(1, base)
        self.fusion = nn.Sequential(
            nn.Conv2d(base * 32, base * 16, 1),
            nn.BatchNorm2d(base * 16),
            nn.ReLU(inplace=True),
        )
        self.decoder = Decoder(base * 16, base, out_ch)

    def forward(self, spatial, freq):
        sb, skips = self.spatial_enc(spatial)
        fb, _ = self.freq_enc(freq)
        return self.decoder(self.fusion(torch.cat([sb, fb], 1)), skips)


# ---------------------------------------------------------------------------
# Checkpoint loading
# ---------------------------------------------------------------------------

def load_frequency_encoder(checkpoint_path, device):
    """Load the full DualDomainUNet from *checkpoint_path*, then return
    **only** the ``freq_enc`` submodule in eval mode, ready to accept a
    ``(1, 1, H, W)`` K-space log-magnitude tensor.

    The checkpoint may be a raw ``state_dict`` or a dict with key
    ``'model_state_dict'`` — both are handled.
    """
    model = DualDomainUNet().to(device)
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    state = ckpt.get('model_state_dict', ckpt)
    model.load_state_dict(state)
    model.eval()
    return model.freq_enc


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

@torch.no_grad()
def get_encoder_features(freq_encoder, kmag_2d, device):
    """Forward-pass a single K-space log-magnitude map through the encoder.

    Parameters
    ----------
    freq_encoder : nn.Module
        The ``freq_enc`` submodule returned by :func:`load_frequency_encoder`.
    kmag_2d : np.ndarray
        Shape ``(240, 240)``, dtype float32, values in ``[0, 1]``.
    device : torch.device

    Returns
    -------
    bottleneck : np.ndarray
        Shape ``(1024, 15, 15)`` — the deepest, most semantically compressed
        representation from the encoder.
    skips : list[np.ndarray]
        Four skip-connection feature maps (enc1–enc4), each as numpy arrays.
    """
    x = torch.from_numpy(kmag_2d[np.newaxis, np.newaxis]).float().to(device)
    bottleneck, skips = freq_encoder(x)
    bottleneck_np = bottleneck.squeeze(0).cpu().numpy()
    skips_np = [s.squeeze(0).cpu().numpy() for s in skips]
    return bottleneck_np, skips_np
