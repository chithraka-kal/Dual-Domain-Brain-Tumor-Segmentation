# 🧠 Dual-Domain Brain Tumor Segmentation System

> **A High-Performance Frequency-Spatial Deep Learning Framework & Clinical Web Portal for BraTS Multi-Modal MRI Segmentation**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.0-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## 📌 Executive Summary

The **Dual-Domain Brain Tumor Segmentation System** is a medical deep learning application designed to demonstrate state-of-the-art dual-domain (`K-Space Frequency Domain` + `Spatial Domain`) neural network segmentation on multi-modal MRI scans (**BraTS 2023 GLI Benchmark**).

By combining Fast Fourier Transform (FFT) frequency-domain features with 2D spatial context, the proposed **DualDomainUNet** achieves superior segmentation accuracy on complex tumor sub-regions—including **Whole Tumor (WT)**, **Tumor Core (TC)**, and **Enhancing Tumor (ET)**—compared to standard spatial-only U-Net baselines.

The system features a **Next.js 16 Web Portal** for interactive slice navigation, model output comparison, quantitative **Dice Similarity Coefficient (DSC)** analytics, and clinical PDF report generation, backed by an asynchronous **FastAPI + ONNX/PyTorch** model serving engine.

---

## ✨ Key Features

- **🌐 Dual-Domain Neural Architecture**: Evaluates frequency-space $K$-space features alongside spatial representations using PyTorch & ONNX Runtime.
- **📄 Multi-Modal NIfTI Volume Ingestion**: Supports `.nii` and `.nii.gz` BraTS scans (T1-contrast, T2, FLAIR) with zero-slice filtering and $Z$-score normalization.
- **🔍 Interactive Slice Visualizer**: Slide across 3D axial dimensions or auto-detect the slice with maximum tumor burden.
- **🎨 3-Channel Color Overlay Rendering**: Color-coded tumor region masks:
  - 🔴 **Whole Tumor (WT)** — Red Overlay
  - 🟢 **Tumor Core (TC)** — Teal Overlay
  - 🟡 **Enhancing Tumor (ET)** — Yellow Overlay
- **📊 Real-time DSC Metrics & Comparative Analytics**: Side-by-side comparative benchmarks showing performance gains ($\Delta\text{DSC}$) against baseline spatial models.
- **🔒 Authenticated History & Auditing**: Supabase Auth & PostgreSQL storage for historical case retrieval and clinical notes (`inference_sessions` & `dice_metrics`).
- **📥 One-Click Clinical PDF Export**: Generate multi-page quantitative reports containing overlay figures, metric tables, and physician annotations.
- **🔌 Plug-and-Play Checkpoints**: Hot-swappable `.pt` model weight files without application downtime or code modification.

---

## 🛠️ Technology Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend Web Portal** | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Recharts, jsPDF, html2canvas | Interactive visualizer, client-side state management, responsive UI & clinical PDF exports |
| **Backend & API Server** | FastAPI, Uvicorn (ASGI), Python 3.10+, Gradio (embedded UI) | High-throughput REST API, streaming proxy endpoints, and research presentation UI |
| **AI Deep Learning Engine** | PyTorch, ONNX Runtime, NiBabel, SciPy (`scipy.fft`), NumPy, Matplotlib | Model inference (`DualDomainUNet`, `SpatialUNet`), 3D NIfTI parsing, K-Space FFT, & overlay generation |
| **Database & Auth** | Supabase (PostgreSQL), Supabase Auth (JWT), Row Level Security (RLS) | Authenticated access control, user profile management & structured session history persistence |
| **Infrastructure & CI/CD** | Azure Virtual Machine (Ubuntu Linux), Systemd (`brain-tumor-api`), GitHub Actions | Production cloud deployment, process daemon management, and SSH deployment automation |

---

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph Client ["Client Layer"]
        User["👨‍⚕️ Clinician / Researcher"]
        Browser["💻 Web Browser (Next.js 16 App Router)"]
    end

    subgraph Frontend ["Next.js Frontend Portal (Port 3000)"]
        UI["React 19 UI Components"]
        Proxy["Next.js API Proxy (proxy.ts)"]
        State["Client State & Recharts Analytics"]
    end

    subgraph Backend ["FastAPI Backend Engine (Azure VM / Port 8000)"]
        API["FastAPI REST Server (fastapi_server.py)"]
        Uvicorn["Uvicorn ASGI Process"]
        Pipeline["Inference Pipeline (inference.py)"]
        Gradio["Embedded Gradio UI (/gradio)"]
    end

    subgraph AI_Engine ["Deep Learning Subsystem"]
        SpatialModel["🧠 Spatial U-Net Baseline"]
        DualModel["🧠 Dual-Domain U-Net (K-Space + Spatial)"]
        FFT["🌊 2D Fast Fourier Transform (scipy.fft)"]
    end

    subgraph Data_Storage ["Database & Auth Layer"]
        SupabaseAuth["🔐 Supabase Auth (JWT)"]
        SupabaseDB[("🗄️ PostgreSQL Database (Sessions & Metrics)")]
    end

    %% Flow Connections
    User --> Browser
    Browser --> UI
    UI --> Proxy
    Proxy -->|Bearer Token & Multi-part Upload| API
    UI -->|Session Auth| SupabaseAuth
    UI -->|Save History & Metrics| SupabaseDB

    API --> Uvicorn
    API --> Pipeline
    Pipeline --> FFT
    Pipeline --> SpatialModel
    Pipeline --> DualModel
    API --> Gradio

    %% Styling
    classDef clientStyle fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef feStyle fill:#0f172a,stroke:#0ea5e9,stroke-width:2px,color:#f8fafc;
    classDef beStyle fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef aiStyle fill:#311042,stroke:#c084fc,stroke-width:2px,color:#f8fafc;
    classDef dbStyle fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;

    class User,Browser clientStyle;
    class UI,Proxy,State feStyle;
    class API,Uvicorn,Pipeline,Gradio beStyle;
    class SpatialModel,DualModel,FFT aiStyle;
    class SupabaseAuth,SupabaseDB dbStyle;
```

---

## 📐 System Diagrams & Specifications

<details>
<summary><b>🔄 Sequence Diagram (Execution Flow)</b></summary>

```mermaid
sequenceDiagram
    autonumber
    actor User as Radiologist / Researcher
    participant UI as Next.js Web Portal (Frontend)
    participant Auth as Supabase Auth & Database
    participant API as FastAPI Backend Server
    participant Pipe as Inference Pipeline (inference.py)
    participant Models as PyTorch Models (Spatial & Dual-Domain U-Nets)

    %% Step 1: Authentication
    note right of User: Step 1: User Authentication & Session Setup
    User->>UI: Navigate to Portal & Enter Credentials
    UI->>Auth: Authenticate User (Email / Password)
    Auth-->>UI: Return JWT Token & User Profile
    UI-->>User: Display Authenticated Dashboard

    %% Step 2: MRI Upload & Configuration
    note right of User: Step 2: MRI Volume Upload & Parameter Selection
    User->>UI: Upload BraTS MRI Volume (.nii / .nii.gz)
    User->>UI: Select Slice Mode (Max Tumor Slice / Custom Index) & Device (CPU/GPU)
    User->>UI: Click "Run Dual-Domain Segmentation"

    %% Step 3: Backend Processing & Inference
    note right of UI: Step 3: Data Ingestion & Dual-Domain Model Execution
    UI->>API: POST /api/inference (NIfTI File, Slice Params, Device)
    API->>Pipe: Load & Parse Volume via NiBabel
    Pipe->>Pipe: Z-Score Normalization & Slice Filtering
    
    par Baseline Model Execution
        Pipe->>Models: Forward Pass: Preprocessed Slice -> Spatial U-Net
        Models-->>Pipe: Return Spatial Segmentation Mask & Logits
    and Dual-Domain Model Execution
        Pipe->>Pipe: Apply 2D FFT & K-Space Subsampling
        Pipe->>Models: Forward Pass: (K-Space + Spatial) -> Dual-Domain U-Net
        Models-->>Pipe: Return Frequency-Enhanced Segmentation Mask
    end

    %% Step 4: Metric Evaluation & Overlay Rendering
    note right of Pipe: Step 4: Metrics Evaluation & Figure Generation
    Pipe->>Pipe: Calculate Dice Similarity Coefficients (WT, TC, ET)
    Pipe->>Pipe: Render 3-Channel Color Masks (WT: Red, TC: Teal, ET: Yellow)
    Pipe->>Pipe: Compile Matplotlib Side-by-Side Figure
    Pipe-->>API: Return Base64 Overlays, DSC Dict & Execution Time
    API-->>UI: Send JSON Response Payload

    %% Step 5: Persistence & Client Rendering
    note right of UI: Step 5: UI Rendering & History Persistence
    UI->>User: Render Interactive Visualizer & Quantitative Metrics Table
    UI->>Auth: Save Session Record (filename, DSC scores, Base64 images, notes)
    Auth-->>UI: Confirm Session Saved (UUID created)
    UI-->>User: Display Session Saved Badge & Export Options
```
</details>

<details>
<summary><b>🗄️ Entity-Relationship Diagram (ERD)</b></summary>

```mermaid
erDiagram
    USERS ||--|| PROFILES : "1:1 profile details"
    USERS ||--o{ INFERENCE_SESSIONS : "1:N creates sessions"
    INFERENCE_SESSIONS ||--|| MRI_VOLUMES : "1:1 ingests volume"
    INFERENCE_SESSIONS ||--o{ DICE_METRICS : "1:N generates metrics"
    MODEL_CHECKPOINTS ||--o{ INFERENCE_SESSIONS : "1:N used in inference"

    USERS {
        uuid id PK "Primary Key (Auth User ID)"
        string email "User Email Address"
        string encrypted_password "Encrypted Credentials"
        datetime created_at "Account Creation Timestamp"
    }

    PROFILES {
        uuid id PK, FK "References auth.users(id)"
        string email "Unique Email Address"
        string full_name "User Full Name"
        string organization "Hospital / University / Org"
        string role "User Role (Researcher / Clinician)"
        datetime created_at "Profile Creation Date"
    }

    INFERENCE_SESSIONS {
        uuid id PK "Primary Key (Session UUID)"
        uuid user_id FK "References auth.users(id)"
        string filename "Uploaded MRI NIfTI Filename"
        string volume_shape "Volume Dimensions (240x240x155)"
        int display_slice "Selected Axial Slice Index"
        text original_image "Base64 Rendered Original Slice"
        text baseline_image "Base64 Rendered Baseline Mask"
        text dual_domain_image "Base64 Rendered Dual-Domain Mask"
        text ground_truth_image "Base64 Rendered Ground Truth Mask"
        jsonb baseline_dice "JSON Baseline Dice Details"
        jsonb dual_domain_dice "JSON Dual-Domain Dice Details"
        float wt_dsc_dual "Whole Tumor DSC (Dual-Domain)"
        float inference_time_seconds "Processing Time in Seconds"
        string device "Compute Device (CPU / GPU)"
        text notes "User Clinical Notes"
        datetime created_at "Inference Timestamp"
    }

    MRI_VOLUMES {
        uuid id PK "Primary Key (Volume ID)"
        uuid session_id FK "References inference_sessions(id)"
        string t1c_channel "T1-Contrast Enhanced Modality"
        string t2_channel "T2-Weighted Modality"
        string flair_channel "FLAIR Modality File Path"
        int num_slices "Total Axial Slices Count"
        boolean has_ground_truth "Ground Truth Mask Available"
    }

    DICE_METRICS {
        uuid id PK "Primary Key (Metric ID)"
        uuid session_id FK "References inference_sessions(id)"
        string region_name "Tumor Region (WT / TC / ET)"
        float baseline_dsc "Baseline Model DSC Score"
        float dual_domain_dsc "Dual-Domain Model DSC Score"
        float dsc_improvement "Delta Percentage Improvement"
    }

    MODEL_CHECKPOINTS {
        uuid id PK "Primary Key (Checkpoint ID)"
        string model_name "Model Identifier"
        string model_type "Baseline (Spatial) vs Dual-Domain"
        string checkpoint_path "Plug-and-play .pt / .onnx Path"
        string framework "PyTorch / ONNX Runtime Engine"
        float model_size_mb "Checkpoint Size in MB"
        boolean is_active "Active In-Use Flag"
        datetime updated_at "Last Weights Update Date"
    }
```
</details>

<details>
<summary><b>👨‍⚕️ Use Case Diagram</b></summary>

```mermaid
graph LR
    subgraph Actors ["👥 System Actors"]
        Clinician["👨‍⚕️ Radiologist / Medical Researcher"]
        Admin["⚙️ System Administrator / AI Engineer"]
        AuthUser["👤 Authenticated Portal User"]
    end

    subgraph System ["🧠 BraTS Dual-Domain Tumor Segmentation System"]
        
        subgraph AuthMod ["🔐 Auth & Session Management"]
            UC1["Sign In / Authenticate User"]
            UC2["Manage User Profile & Past Cases"]
        end

        subgraph IngestionMod ["📁 Data Ingestion & Preprocessing"]
            UC3["Upload BraTS MRI Scans (.nii / .nii.gz)"]
            UC4["Select Pre-loaded Sample MRI Scans"]
            UC5["Perform Volume Normalization & Slice Filtering"]
        end

        subgraph AIEngine ["⚡ Dual-Domain AI Inference Engine"]
            UC6["Execute Spatial-Only U-Net Baseline Segmentation"]
            UC7["Execute Dual-Domain (K-Space + Spatial) U-Net Model"]
            UC8["Simulate K-Space Frequency Subsampling & Fourier Transform"]
        end

        subgraph AnalyticsMod ["📊 Clinical Analytics & Visualization"]
            UC9["Select Slice Mode (Max Tumor Area vs Custom Slice Index)"]
            UC10["Render 3-Channel Color Overlay (WT, TC, ET)"]
            UC11["Compare Dual-Domain vs Baseline vs Ground Truth"]
            UC12["Calculate & View Dice Similarity Coefficients (DSC)"]
        end

        subgraph AdminMod ["🛠️ Reporting & Infrastructure"]
            UC13["Export Matplotlib Comparison Figure"]
            UC14["Download Quantitative Evaluation Metrics"]
            UC15["Hot-Swap Model Checkpoints (Plug & Play .pt)"]
            UC16["Monitor FastAPI Backend & GPU Health"]
        end

    end

    AuthUser --> UC1
    AuthUser --> UC2

    Clinician --> UC3
    Clinician --> UC4
    Clinician --> UC9
    Clinician --> UC10
    Clinician --> UC11
    Clinician --> UC12
    Clinician --> UC13
    Clinician --> UC14

    Admin --> UC15
    Admin --> UC16

    UC3 -.->|includes| UC5
    UC4 -.->|includes| UC5
    UC5 -.->|triggers| UC6
    UC5 -.->|triggers| UC7
    UC7 -.->|includes| UC8
    UC6 -.->|includes| UC10
    UC7 -.->|includes| UC10
    UC11 -.->|includes| UC12
    UC13 -.->|extends| UC11
```
</details>

---

## 📁 Repository Directory Structure

```
.
├── demo/                       # FastAPI Backend & Inference Subsystem
│   ├── app.py                  # Gradio interactive demonstration app
│   ├── fastapi_server.py       # Asynchronous FastAPI backend REST server
│   ├── inference.py            # Preprocessing, FFT K-Space simulation & overlay pipeline
│   ├── models.py               # PyTorch neural network definitions (SpatialUNet & DualDomainUNet)
│   ├── requirements.txt        # Python backend dependencies
│   ├── checkpoints/            # Plug-and-play model weights (.pt files)
│   │   ├── baseline_best.pt    # Spatial U-Net trained weights
│   │   └── dual_best.pt        # Dual-Domain U-Net trained weights
│   └── start_backend.sh        # Uvicorn production start script
│
├── portal/                     # Next.js 16 Web Portal Frontend
│   ├── app/                    # Next.js App Router pages (login, dashboard, visualizer)
│   ├── components/             # React 19 UI components (metrics tables, slice sliders)
│   ├── proxy.ts                # Next.js API proxy to FastAPI backend
│   ├── supabase/               # SQL schema definitions & RLS security policies
│   │   └── schema.sql          # Database table definitions
│   └── package.json            # Node.js frontend dependencies
│
├── diagrams/                   # System Architecture & Technical Diagrams
│   ├── architecture.mmd        # C4 System Architecture Mermaid diagram
│   ├── Sequence-Diagram.mmd    # End-to-end execution sequence diagram
│   ├── Entity-Relationship-Diagram.mmd # Database ERD diagram
│   └── usecase.mmd             # System Use Case diagram
│
├── .github/workflows/          # CI/CD Deployment Automation
│   └── deploy-backend.yml      # GitHub Actions SSH script to Azure VM
└── text.txt                    # Academic implementation details for research thesis
```

---

## 🚀 Quick Start & Local Setup

### Prerequisites

- **Python 3.10+** (with `pip` and virtual environment support)
- **Node.js 18+** & `npm`
- **Git**

---

### 1. Backend Setup (`/demo`)

```bash
# Navigate to the backend directory
cd demo

# Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/python activate

# Install Python backend dependencies
pip install -r requirements.txt

# Start the FastAPI server (runs on http://localhost:8000)
./start_backend.sh
```

> **Health Check Verification**: Open `http://localhost:8000/api/health` in your browser. Expected output:
> ```json
> {
>   "status": "healthy",
>   "models_loaded": {
>     "baseline": true,
>     "dual_domain": true
>   }
> }
> ```

---

### 2. Frontend Web Portal Setup (`/portal`)

```bash
# Navigate to the portal directory
cd portal

# Install Node.js dependencies
npm install

# Configure environment variables (.env.local)
cp .env.local.example .env.local
```

Add your Supabase and API credentials to `.env.local`:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
FASTAPI_BACKEND_URL=http://localhost:8000
```

Start the Next.js development server:

```bash
npm run dev
```

Open `http://localhost:3000` to launch the **Dual-Domain Brain Tumor Segmentation Portal**.

---

## 📡 API Endpoint Reference

### `POST /api/inference`
Executes spatial baseline and dual-domain inference on an uploaded `.nii` / `.nii.gz` volume.

- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `file`: NIfTI Volume File (`.nii` or `.nii.gz`)
  - `slice_mode`: `"max_tumor"` or `"custom"`
  - `slice_idx`: Integer index (optional, required if `custom`)
  - `device`: `"cpu"` or `"cuda"`
- **Response**: `application/json` containing Base64 encoded slice previews, tumor overlays, and Dice Similarity Coefficients.

### `GET /api/health`
Returns system status, active device (CPU/GPU), and model checkpoint loading status.

---

## ☁️ Cloud Deployment (Azure VM & GitHub Actions)

The backend API is deployed on an **Azure Virtual Machine** running Ubuntu Linux, managed via **Systemd**:

```bash
# Systemd service status check on Azure VM
sudo systemctl status brain-tumor-api
```

Automated deployments are configured via `.github/workflows/deploy-backend.yml`. Pushing changes to `demo/` triggers an automated deployment to the Azure environment.

---

## 📜 Citation & Research Acknowledgments

If you use this codebase or dual-domain architecture in your research, please cite:

```bibtex
@article{brats_dual_domain_2026,
  title={Dual-Domain Brain Tumor Segmentation via Combined K-Space Frequency Subsampling and Spatial U-Nets},
  author={Chithraka et al.},
  journal={BraTS Research & Medical Computer Vision},
  year={2026}
}
```

- **Dataset**: [BraTS 2023 Adult Glioma Challenge Dataset](https://www.synapse.org/Synapse:syn51156910/wiki/622351)
- **Frameworks**: PyTorch, FastAPI, Next.js, Supabase, NiBabel

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
