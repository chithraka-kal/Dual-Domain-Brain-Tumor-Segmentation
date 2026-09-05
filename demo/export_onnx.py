# export_onnx.py
"""
Utility script to export SpatialUNet and DualDomainUNet PyTorch models to ONNX format.
Useful for client-side / browser-side execution with ONNX Runtime Web or Gradio-Lite.
"""

import os
import sys
import torch

app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from models import SpatialUNet, DualDomainUNet, load_model

BASELINE_CKPT = os.path.join(app_dir, 'checkpoints/baseline_best.pt')
DUAL_CKPT     = os.path.join(app_dir, 'checkpoints/dual_best.pt')
DEVICE        = torch.device('cpu')

def export_to_onnx():
    os.makedirs(os.path.join(app_dir, 'onnx_models'), exist_ok=True)
    
    print("Loading PyTorch models for ONNX export...")
    spatial_model = load_model(SpatialUNet, BASELINE_CKPT, DEVICE)
    dual_model    = load_model(DualDomainUNet, DUAL_CKPT, DEVICE)
    
    # 1. Export SpatialUNet
    spatial_onnx_path = os.path.join(app_dir, 'onnx_models/spatial_unet.onnx')
    dummy_spatial = torch.randn(1, 1, 240, 240, device=DEVICE)
    
    print(f"Exporting SpatialUNet to {spatial_onnx_path}...")
    torch.onnx.export(
        spatial_model,
        dummy_spatial,
        spatial_onnx_path,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=['spatial_input'],
        output_names=['logits'],
        dynamic_axes={'spatial_input': {0: 'batch_size'}, 'logits': {0: 'batch_size'}},
        dynamo=False
    )
    print("✅ SpatialUNet exported to ONNX.")

    # 2. Export DualDomainUNet
    dual_onnx_path = os.path.join(app_dir, 'onnx_models/dual_domain_unet.onnx')
    dummy_freq = torch.randn(1, 1, 240, 240, device=DEVICE)
    
    print(f"Exporting DualDomainUNet to {dual_onnx_path}...")
    torch.onnx.export(
        dual_model,
        (dummy_spatial, dummy_freq),
        dual_onnx_path,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=['spatial_input', 'freq_input'],
        output_names=['logits'],
        dynamic_axes={
            'spatial_input': {0: 'batch_size'},
            'freq_input': {0: 'batch_size'},
            'logits': {0: 'batch_size'}
        },
        dynamo=False
    )
    print("✅ DualDomainUNet exported to ONNX.")
    print("🎉 ONNX Export Complete!")

if __name__ == '__main__':
    export_to_onnx()
