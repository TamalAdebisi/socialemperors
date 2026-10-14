"""
A test for every command: each command command.py handles must be sent by
some test in this folder, as a quoted string ("next_step", 'move'...). A new
command without a test fails here, naming it.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import re
import unittest

from constants import Constant

TESTS = os.path.dirname(os.path.abspath(__file__))
COMMAND_PY = os.path.join(os.path.dirname(TESTS), "command.py")


def handled_commands() -> set:
    """The commands command.py answers, by the client's name for them."""
    with open(COMMAND_PY) as f:
        names = set(re.findall(r"Constant\.(CMD_\w+)", f.read()))
    return {getattr(Constant, name) for name in names}


def sent_by_tests() -> str:
    text = ""
    for file in sorted(os.listdir(TESTS)):
        if file.endswith(".py") and file != os.path.basename(__file__):
            with open(os.path.join(TESTS, file)) as f:
                text += f.read()
    return text


class EveryCommandTest(unittest.TestCase):

    def test_every_command_is_sent_by_a_test(self):
        tests = sent_by_tests()
        untested = sorted(cmd for cmd in handled_commands()
                          if f'"{cmd}"' not in tests and f"'{cmd}'" not in tests)
        if untested:
            self.fail(f"No test sends these commands: {', '.join(untested)}")

    def test_the_scan_finds_the_commands(self):
        # If command.py is ever written differently, the scan above must not quietly find nothing.
        commands = handled_commands()
        self.assertGreater(len(commands), 100)
        self.assertIn("next_step", commands)


if __name__ == "__main__":
    unittest.main()
