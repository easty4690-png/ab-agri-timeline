import ast
import subprocess
import sys
import os
import importlib.util

def is_stdlib(module_name):
    # Rough heuristic: if spec comes from built-in or no file path, treat as stdlib
    try:
        spec = importlib.util.find_spec(module_name)
        if spec is None:
            return False
        if spec.origin is None:
            return True
        return "site-packages" not in (spec.origin or "").lower()
    except Exception:
        return False

def extract_top_level_imports(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        tree = ast.parse(f.read(), filename=path)
    tops = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                tops.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                tops.add(node.module.split(".")[0])
    return sorted(tops)

def install_pkg(pkg):
    print(f"Installing {pkg} ...")
    subprocess.run([sys.executable, "-m", "pip", "install", pkg], check=False)

def main():
    script = "gantt_creator_gui.py"
    if not os.path.isfile(script):
        print(f"ERROR: {script} not found in {os.getcwd()}")
        sys.exit(1)
    imports = extract_top_level_imports(script)
    to_install = []
    for pkg in imports:
        if pkg in ("__future__",):
            continue
        if is_stdlib(pkg):
            continue
        try:
            __import__(pkg)
        except ImportError:
            to_install.append(pkg)
    if to_install:
        print("Detected missing packages to install:", to_install)
        for pkg in to_install:
            install_pkg(pkg)
    else:
        print("No missing top-level non-stdlib packages detected.")

    # Check Excel file
    excel = "AB Agri Gantt Creator.xlsx"
    if not os.path.isfile(excel):
        print(f"WARNING: Expected Excel input '{excel}' not found.")
    else:
        print(f"Found Excel input: {excel}")

    # Attempt to run the main script
    print("Running gantt_creator_gui.py ...")
    proc = subprocess.run([sys.executable, script], capture_output=True, text=True)
    print("=== STDOUT ===")
    print(proc.stdout)
    print("=== STDERR ===")
    print(proc.stderr)
    if proc.returncode != 0:
        print(f"Script exited with code {proc.returncode}. Resolve import errors above and rerun.")
    else:
        print("Script ran (exit code 0). If it has a GUI it may have launched.")
    
if __name__ == '__main__':
    main()
