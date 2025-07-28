#!/usr/bin/env python3
"""
Setup script for molvis widget package.
"""

import subprocess
import shutil
from pathlib import Path
from setuptools import setup, find_packages


def build_js():
    """Build JavaScript assets and copy to static directory."""
    project_root = Path(__file__).parent
    
    # Build JavaScript
    print("Building JavaScript...")
    subprocess.run(["npm", "run", "build"], cwd=project_root, check=True)
    
    # Copy built assets to static directory
    dist_dir = project_root / "dist"
    static_dir = project_root / "src" / "molvis" / "static"
    
    if dist_dir.exists():
        # Create static directory if it doesn't exist
        static_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy all files from dist to static
        for item in dist_dir.iterdir():
            if item.is_file():
                shutil.copy2(item, static_dir)
            elif item.is_dir():
                shutil.copytree(item, static_dir / item.name, dirs_exist_ok=True)
        print(f"JavaScript assets copied to {static_dir}")
    else:
        print("Warning: dist directory not found")


if __name__ == "__main__":
    # Build JavaScript first
    build_js()
    
    # Setup Python package
    setup(
        name="molvis",
        version="0.1.0",
        description="Jupyter widget for molvis",
        author="Roy Kid",
        author_email="lijichen365@gmail.com",
        python_requires=">=3.10",
        package_dir={"": "src"},
        packages=find_packages(where="src"),
        package_data={"molvis": ["static/**/*"]},
        install_requires=["anywidget"],
        extras_require={
            "dev": ["anywidget[dev]"],
        },
    ) 