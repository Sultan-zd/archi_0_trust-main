from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"

DATASET_CSV = DATA_RAW / "Final_EVSE_A.csv"
SEED = 42

COL_SCENARIO = "CSVNameFile"
COL_STATUS = "status"
COL_CLASS = "multiclass"

DROP_COLUMNS = [COL_SCENARIO, COL_STATUS, COL_CLASS, "src_port"]

CLASSES = ["Benign", "DoS", "Recon"]
MAX_DOS_ROWS = 100_000
VAL_SIZE = 0.15
TEST_SIZE = 0.15

DEFAULT_MFA_THRESHOLD = 30
DEFAULT_DENY_THRESHOLD = 60
