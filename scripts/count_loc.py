import argparse
import os
from pathlib import Path


DEFAULT_EXCLUDE_DIRS = {
    ".git",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
}


def is_binary_file(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            chunk = f.read(2048)
        return b"\x00" in chunk
    except OSError:
        return True


def count_non_blank_lines(path: Path) -> int:
    count = 0
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if line.strip():
                count += 1
    return count


def should_skip_dir(dir_name: str, excludes: set[str]) -> bool:
    return dir_name in excludes


def should_skip_file(path: Path) -> bool:
    return path.suffix.lower() == ".md"


def count_lines(root: Path, exclude_dirs: set[str]) -> tuple[int, int]:
    total_lines = 0
    total_files = 0
    for current_root, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d, exclude_dirs)]
        for filename in filenames:
            path = Path(current_root) / filename
            if should_skip_file(path):
                continue
            if is_binary_file(path):
                continue
            total_lines += count_non_blank_lines(path)
            total_files += 1
    return total_lines, total_files


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Count non-blank lines in text files (exclude .md and venv)."
    )
    parser.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parents[1]),
        help="Root directory to scan. Defaults to repo root.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Directory name to exclude (can be repeated).",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    exclude_dirs = set(DEFAULT_EXCLUDE_DIRS)
    exclude_dirs.update(args.exclude_dir)

    total_lines, total_files = count_lines(root, exclude_dirs)
    print(f"Root: {root}")
    print(f"Excluded directories: {', '.join(sorted(exclude_dirs))}")
    print(f"Counted files: {total_files}")
    print(f"Non-blank lines: {total_lines}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
