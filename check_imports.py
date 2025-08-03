import ast
import os
import subprocess
import sys

def find_imports(filepath):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        tree = ast.parse(f.read(), filename=filepath)
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module.split(".")[0])
    return imports

project_imports = set()
for root, _, files in os.walk("."):
    for fn in files:
        if fn.endswith(".py"):
            project_imports |= find_imports(os.path.join(root, fn))

installed = {pkg.split("==")[0].lower() for pkg in subprocess.check_output([sys.executable, "-m", "pip", "freeze"]).decode().splitlines()}

missing = [imp for imp in project_imports if imp.lower() not in installed and imp not in ("__future__",)]
print("Potentially missing packages:", missing)
