#!/usr/bin/env python3
"""yord — single entry point for Shopify → Supabase migration tooling.

Wraps the standalone scripts in migration order, streams their output,
and records a run ledger under .yord/runs/ so reruns and audits agree
on what already completed.

Usage:
    python yord.py migrate --dry-run     # print plan + env check only
    python yord.py migrate --execute     # run the full pipeline
    python yord.py migrate --execute --from blogs
    python yord.py verify                # verify_migration.py
    python yord.py blogs                 # migrate_blogs.py
    python yord.py collections --execute # populate_collections.py keyword mode
    python yord.py media                 # migrate_media.py
    python yord.py optimize [--resume]   # optimize_images.py

Notes:
- Steps that support --execute (migrate_via_rest, populate_collections) get the
  flag appended when the pipeline runs with --execute; the rest run on invoke.
- Per-script checkpoint files (*_checkpoint.json) still own resume state;
  --from only skips already-completed pipeline steps in a fresh run.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
STATE_DIR = SCRIPT_DIR / ".yord" / "runs"

# (step name, script, extra args, accepts --execute). Order matches AGENTS.md
# fresh-migration order. The flag is appended only for steps that define it.
PIPELINE = [
    ("core", "migrate_via_rest.py", [], True),
    ("media", "migrate_media.py", [], False),
    ("blogs", "migrate_blogs.py", [], False),
    ("collections", "populate_collections.py", ["--mode=keyword"], True),
    ("verify", "verify_migration.py", [], False),
    ("optimize", "optimize_images.py", [], False),
]

SUPABASE_ENV = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
]

SHOPIFY_ENV = [
    "SHOPIFY_STORE_NAME",
    "SHOPIFY_ADMIN_API_ACCESS_TOKEN",
]


def missing_env(keys: list[str]) -> list[str]:
    return [key for key in keys if not os.getenv(key)]


def run_step(script: str, args: list[str], log_path: Path) -> int:
    target = SCRIPT_DIR / script
    cmd = [sys.executable, str(target), *args]
    print(f"\n$ {' '.join(cmd)}")
    with open(log_path, "w") as log:
        proc = subprocess.Popen(
            cmd, cwd=SCRIPT_DIR, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True,
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            print(line, end="")
            log.write(line)
        proc.wait()
        return proc.returncode


def cmd_migrate(execute: bool, from_step: str) -> int:
    steps = PIPELINE
    if from_step:
        names = [name for name, _, _, _ in PIPELINE]
        if from_step not in names:
            print(f"Unknown step {from_step!r}. Choose from: {', '.join(names)}")
            return 2
        steps = PIPELINE[names.index(from_step):]

    print("Migration plan:")
    for name, script, args, accepts_execute in steps:
        planned = [*args, "--execute"] if accepts_execute and execute else args
        print(f"  {name:12} {script} {' '.join(planned)}")

    missing = missing_env(SUPABASE_ENV + SHOPIFY_ENV)
    if missing:
        print(f"\nMissing env vars: {', '.join(missing)} (see root .env.example)")
    if not execute:
        print("\nDry run — nothing executed. Re-run with --execute to apply.")
        return 0 if not missing else 2
    if missing:
        print("\nRefusing to run with --execute until those are set.")
        return 2

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = STATE_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    ledger: list[dict] = []
    rc = 0
    for name, script, args, accepts_execute in steps:
        step_args = [*args, "--execute"] if accepts_execute else args
        start = datetime.now(timezone.utc).isoformat()
        code = run_step(script, step_args, run_dir / f"{name}.log")
        ledger.append({"step": name, "script": script, "exit": code, "started": start})
        if code != 0:
            print(f"\nStep {name!r} failed (exit {code}). Resume with --from {name}.")
            rc = code
            break
    with open(run_dir / "ledger.json", "w") as f:
        json.dump({"run": run_id, "steps": ledger}, f, indent=2)
    print(f"\nLedger: {run_dir / 'ledger.json'}")
    return rc


def cmd_run(script: str, args: list[str], env_keys: list[str]) -> int:
    missing = missing_env(env_keys)
    if missing:
        print(f"Missing env vars: {', '.join(missing)} (see root .env.example)")
        return 2
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = STATE_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_step(script, args, run_dir / f"{Path(script).stem}.log")


def main() -> int:
    parser = argparse.ArgumentParser(prog="yord", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    p_mig = sub.add_parser("migrate", help="run the full migration pipeline")
    p_mig.add_argument("--execute", action="store_true", help="apply changes (default is dry run)")
    p_mig.add_argument("--dry-run", action="store_true", help="print plan only")
    p_mig.add_argument("--from", dest="from_step", default="", help="resume pipeline at STEP")

    sub.add_parser("verify", help="run verify_migration.py")
    sub.add_parser("blogs", help="run migrate_blogs.py")
    sub.add_parser("media", help="run migrate_media.py")

    p_col = sub.add_parser("collections", help="run populate_collections.py")
    p_col.add_argument("--execute", action="store_true", help="apply changes (default is dry run)")

    p_opt = sub.add_parser("optimize", help="run optimize_images.py")
    p_opt.add_argument("--resume", action="store_true", help="resume from checkpoint")

    args, passthrough = parser.parse_known_args()
    if args.command == "migrate":
        if passthrough:
            parser.error(f"unexpected arguments for migrate: {' '.join(passthrough)}")
        return cmd_migrate(bool(args.execute and not args.dry_run), args.from_step)
    if args.command == "verify":
        return cmd_run("verify_migration.py", passthrough, SUPABASE_ENV)
    if args.command == "blogs":
        return cmd_run("migrate_blogs.py", passthrough, SUPABASE_ENV + SHOPIFY_ENV)
    if args.command == "media":
        return cmd_run("migrate_media.py", passthrough, SUPABASE_ENV + SHOPIFY_ENV)
    if args.command == "collections":
        base = ["--mode=keyword"]
        return cmd_run(
            "populate_collections.py",
            base + (["--execute"] if args.execute else ["--dry-run"]) + passthrough,
            SUPABASE_ENV + SHOPIFY_ENV,
        )
    if args.command == "optimize":
        return cmd_run("optimize_images.py", (["--resume"] if args.resume else []) + passthrough, SUPABASE_ENV)
    return 2


if __name__ == "__main__":
    sys.exit(main())
