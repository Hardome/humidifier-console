"""Enforce branch coverage for business logic independently of HTTP and LAN adapters."""

import json
from pathlib import Path

BUSINESS_MODULES = {
    "capabilities.py",
    "command_store.py",
    "events.py",
    "measurements.py",
    "notifications.py",
    "rule_validation.py",
    "scheduler.py",
    "service.py",
    "settings_store.py",
    "rule_store.py",
}


def main() -> int:
    report = json.loads(Path(".tmp/coverage.json").read_text(encoding="utf-8"))
    summaries = [
        details["summary"]
        for filename, details in report["files"].items()
        if Path(filename).parent.name == "app" and Path(filename).name in BUSINESS_MODULES
    ]
    if len(summaries) != len(BUSINESS_MODULES):
        print("Coverage report is missing business modules")
        return 1
    total = sum(summary["num_branches"] for summary in summaries)
    covered = sum(summary["covered_branches"] for summary in summaries)
    percent = 100 * covered / total if total else 0
    print(f"Business branch coverage: {percent:.1f}% (required: 85%)")
    return 0 if total and percent >= 85 else 1


if __name__ == "__main__":
    raise SystemExit(main())
