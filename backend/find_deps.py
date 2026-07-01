import ast
import os
import sys

def get_imports(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            tree = ast.parse(f.read(), filename=filepath)
        except Exception:
            return set()
            
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.level == 0:
                imports.add(node.module.split('.')[0])
    return imports

def main():
    stdlib = sys.stdlib_module_names if hasattr(sys, 'stdlib_module_names') else set()
    local_modules = {'app', 'tests', 'migrations', 'scripts', 'alembic'}
    
    all_imports = set()
    
    for root, dirs, files in os.walk('.'):
        if 'venv' in root or '__pycache__' in root or '.git' in root or '.pytest_cache' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                all_imports.update(get_imports(os.path.join(root, file)))
                
    external_imports = set()
    for imp in all_imports:
        if imp not in stdlib and imp not in local_modules:
            external_imports.add(imp)
            
    print("External Imports found in code:")
    for imp in sorted(external_imports):
        print(f"- {imp}")
        
    print("\nParsing requirements.txt:")
    with open('requirements.txt', 'r') as f:
        reqs = f.readlines()
        
    print("Requirements listed:")
    for req in reqs:
        req = req.strip()
        if req and not req.startswith('#'):
            print(f"- {req}")

if __name__ == '__main__':
    main()
