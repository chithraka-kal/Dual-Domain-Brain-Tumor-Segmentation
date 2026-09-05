import nibabel as nib
import numpy as np
import os

def create_synthetic_data(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    # Create 240x240x155 synthetic brain volume
    t2w_data = np.zeros((240, 240, 155), dtype=np.float32)
    # Sphere for brain tissue
    x, y, z = np.ogrid[:240, :240, :155]
    mask = (x - 120)**2 + (y - 120)**2 + (z - 77)**2 <= 70**2
    t2w_data[mask] = np.random.normal(100, 15, size=mask.sum())
    
    t2w_img = nib.Nifti1Image(t2w_data, affine=np.eye(4))
    t2w_path = os.path.join(output_dir, "sample_t2w.nii.gz")
    nib.save(t2w_img, t2w_path)
    
    # Ground truth segmentation: WT=1, TC=1 or 3, ET=3
    seg_data = np.zeros((240, 240, 155), dtype=np.int16)
    tumor_mask = (x - 120)**2 + (y - 120)**2 + (z - 77)**2 <= 25**2
    core_mask = (x - 120)**2 + (y - 120)**2 + (z - 77)**2 <= 15**2
    et_mask = (x - 120)**2 + (y - 120)**2 + (z - 77)**2 <= 8**2
    
    seg_data[tumor_mask] = 1
    seg_data[core_mask] = 1
    seg_data[et_mask] = 3
    
    seg_img = nib.Nifti1Image(seg_data, affine=np.eye(4))
    seg_path = os.path.join(output_dir, "sample_seg.nii.gz")
    nib.save(seg_img, seg_path)
    
    print(f"Generated synthetic test files:\n - {t2w_path}\n - {seg_path}")

if __name__ == "__main__":
    create_synthetic_data("sample_data")
