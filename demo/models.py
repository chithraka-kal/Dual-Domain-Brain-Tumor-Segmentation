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
