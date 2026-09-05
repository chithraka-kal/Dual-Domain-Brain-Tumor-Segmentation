"""
upload_checkpoints.py
Run this ONCE before deploying to upload the model weights to the Modal Volume.

Usage:
    python upload_checkpoints.py
"""

import os
import modal

DEMO_DIR         = os.path.join(os.path.dirname(__file__), "..", "demo", "checkpoints")
BASELINE_SRC     = os.path.join(DEMO_DIR, "baseline_best.pt")
DUAL_SRC         = os.path.join(DEMO_DIR, "dual_best.pt")
VOLUME_NAME      = "model-checkpoints"

print(f"Opening Modal Volume '{VOLUME_NAME}' ...")
vol = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

def upload():
    with vol.batch_upload(force=True) as batch:
        print(f"  Uploading {BASELINE_SRC} ...")
        batch.put_file(BASELINE_SRC, "/baseline_best.pt")
        print(f"  Uploading {DUAL_SRC} ...")
        batch.put_file(DUAL_SRC, "/dual_best.pt")
    print("Upload complete ✅")
    print("You can now run:  modal deploy app.py")

if __name__ == "__main__":
    upload()
