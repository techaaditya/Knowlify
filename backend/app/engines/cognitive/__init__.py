"""
Cognitive Engine (Engine 2) Package Initializer.

This package contains the core cognitive modules for the Knowlify student modeling:
1. StudentModelingEngine (student_model.py): Manages student profiles, logs quiz attempts, and tracks mastery stats.
2. BKTEngine (bkt.py): Performs Bayesian Knowledge Tracing to update mastery scores.
3. Misconception Tracking: Inspects patterns of wrong answers to identify systemic misconceptions.
"""

# ==============================================================================
# Why we use __init__.py:
# 1. Package Identifier: It tells Python that this 'cognitive' folder should be 
#    treated as a package/module that can be imported.
# 2. Simplified Imports: It allows other parts of the application to import
#    key classes directly from this package level (e.g., `from cognitive import BKTEngine`)
#    rather than having to specify the full submodule path.
# 3. Clean Interface: It acts as an API gateway, exposing only the main classes.
# ==============================================================================

# Define a list of modules/classes exported by this package
__all__ = ["StudentModelingEngine", "BKTEngine"]

# Safe imports: Wrap imports in try-except blocks so that if any module is
# missing or has an error during development, the package load doesn't crash completely.

# 1. Import StudentModelingEngine safely
try:
    from .student_model import StudentModelingEngine
except ImportError:
    try:
        from student_model import StudentModelingEngine
    except ImportError:
        StudentModelingEngine = None

# 2. Import BKTEngine safely
try:
    from .bkt import BKTEngine
except ImportError:
    try:
        from bkt import BKTEngine
    except ImportError:
        BKTEngine = None
