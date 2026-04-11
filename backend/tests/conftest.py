import sys
from pathlib import Path

# Make `from app.*` importable when pytest is invoked from any directory.
sys.path.insert(0, str(Path(__file__).parent.parent))
