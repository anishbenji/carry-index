"""Whole grams: tools/validate.py rejects a fractional weight_g or metric display weight.

Run: uv run --no-project --with pyyaml --with jsonschema python -m unittest tools/test_validate_weights.py
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BAG = os.path.join('data', 'bags', 'ula-equipment', 'ula-cicada-22l.yaml')


class ValidatorWholeGramsTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix='cj-weights-')
        shutil.copytree(os.path.join(REPO, 'data'), os.path.join(self.root, 'data'),
                        ignore=shutil.ignore_patterns('my-notes.yaml', 'my-bags.yaml'))
        shutil.copytree(os.path.join(REPO, 'schema'), os.path.join(self.root, 'schema'))
        os.makedirs(os.path.join(self.root, 'tools'))
        shutil.copy(os.path.join(REPO, 'tools', 'validate.py'), os.path.join(self.root, 'tools'))

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_validator(self):
        return subprocess.run([sys.executable, os.path.join(self.root, 'tools', 'validate.py'),
                               '--report', os.path.join(self.root, 'report.md')], capture_output=True, text=True)

    def test_catalogue_as_committed_passes(self):
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_fractional_weight_is_rejected(self):
        # Set the first weight_g and the first metric display weight to a fractional value, whatever whole
        # number the catalogue holds today; each must be rejected.
        path = os.path.join(self.root, BAG)
        with open(path, encoding='utf-8') as f:
            text = f.read()
        text, n1 = re.subn(r'^(  weight_g: )\d+$', r'\g<1>799.5', text, count=1, flags=re.M)
        text, n2 = re.subn(r'^(        g: )\d+$', r'\g<1>798.5', text, count=1, flags=re.M)
        self.assertEqual((n1, n2), (1, 1))
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        result = self.run_validator()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('799.5', result.stdout)
        self.assertIn('798.5', result.stdout)

if __name__ == '__main__':
    unittest.main()
