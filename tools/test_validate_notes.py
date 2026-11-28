"""Behaviour of tools/validate.py around the private notes file (data/my-notes.yaml).

The notes file is never committed, so clean checkouts (worktrees, CI) lack it. The validator must then
skip the my_note link check and say so, both on stdout and in the saved report; when the file exists,
a my_note id it does not define is still an error.

Run: uv run --no-project --with pyyaml --with jsonschema python -m unittest tools/test_validate_notes.py
"""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SKIP_LINE = 'my_note links not checked'


class ValidatorNotesTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix='cj-validate-')
        shutil.copytree(os.path.join(REPO, 'data'), os.path.join(self.root, 'data'),
                        ignore=shutil.ignore_patterns('my-notes.yaml', 'my-bags.yaml'))
        shutil.copytree(os.path.join(REPO, 'schema'), os.path.join(self.root, 'schema'))
        os.makedirs(os.path.join(self.root, 'tools'))
        shutil.copy(os.path.join(REPO, 'tools', 'validate.py'), os.path.join(self.root, 'tools'))
        self.report = os.path.join(self.root, 'report.md')

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_validator(self):
        return subprocess.run([sys.executable, os.path.join(self.root, 'tools', 'validate.py'),
                               '--report', self.report], capture_output=True, text=True)

    def test_absent_notes_file_skips_the_check_and_says_so(self):
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(SKIP_LINE, result.stdout)
        with open(self.report, encoding='utf-8') as f:
            self.assertIn(SKIP_LINE, f.read())

    def test_present_notes_file_still_rejects_an_undefined_note(self):
        # A synthetic, empty notes file: every my_note reference in the public data is now undefined.
        with open(os.path.join(self.root, 'data', 'my-notes.yaml'), 'w', encoding='utf-8') as f:
            f.write('[]\n')
        result = self.run_validator()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('is not in my-notes.yaml', result.stdout)
        self.assertNotIn(SKIP_LINE, result.stdout)


if __name__ == '__main__':
    unittest.main()
