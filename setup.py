"""Compatibility shim for zc.buildout develop installs.

All real metadata lives in pyproject.toml (hatchling backend).
This file exists only because zc.buildout requires setup.py
and pkg_resources requires .egg-info metadata to discover packages.
"""
import re
import subprocess
import sys

from pathlib import Path

from setuptools import find_namespace_packages
from setuptools import setup


def get_version():
    init = Path(__file__).parent / "src/diazotheme/aon2026/__init__.py"
    return re.search(r'__version__\s*=\s*["\']([^"\']+)', init.read_text()).group(1)


def ensure_egg_info():
    """Auto-generate .egg-info if missing (needed by buildout/pkg_resources).

    Only runs when not already executing egg_info (prevents recursion).
    """
    egg_info_dir = Path(__file__).parent / "src" / "diazotheme.aon2026.egg-info"
    if not egg_info_dir.exists() and "egg_info" not in sys.argv:
        subprocess.run(
            [sys.executable, __file__, "egg_info"],
            cwd=str(Path(__file__).parent),
            check=False,
            capture_output=True,
        )


ensure_egg_info()

setup(
    name="diazotheme.aon2026",
    version=get_version(),
    package_dir={"": "src"},
    packages=find_namespace_packages(where="src"),
    install_requires=[
        "Products.CMFPlone",
        "plone.api",
        "z3c.jbot",
    ],
    entry_points={
        "plone.autoinclude.plugin": ["target = plone"],
    },
)
