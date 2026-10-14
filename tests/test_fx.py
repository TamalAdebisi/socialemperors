"""
Effect files: fx/p.miniFireball2.swf, which the game asks for and nobody has,
is a copy of p.fireBall_02.swf under the class name the game looks for, made
by tools/rename_swf_class.py.

Run from the repository folder:  python -m unittest discover tests
"""

import os
import sys
import unittest
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import rename_swf_class

FX = os.path.join(ROOT, "assets", "fx")


def read(name):
    with open(os.path.join(FX, name), "rb") as f:
        return f.read()


class StandInTest(unittest.TestCase):

    def test_the_stand_in_is_the_tool_s_copy(self):
        made = rename_swf_class.rename(read("p.fireBall_02.swf"), "p.fireBall_02", "p.miniFireball2")
        self.assertEqual(made, read("p.miniFireball2.swf"))

    def test_the_stand_in_carries_only_the_new_class_name(self):
        data = read("p.miniFireball2.swf")
        self.assertEqual(data[:3], b"CWS")
        body = zlib.decompress(data[8:])
        self.assertEqual(int.from_bytes(data[4:8], "little"), 8 + len(body))
        self.assertIn(b"p.miniFireball2\0", body)  # the art's class
        self.assertIn(b"p:miniFireball2", body)  # the compiled class
        self.assertNotIn(b"fireBall_02", body)

    def test_a_name_that_is_not_there_is_refused(self):
        with self.assertRaises(ValueError):
            rename_swf_class.rename(read("p.fireBall_02.swf"), "p.somethingElse", "p.miniFireball2")


if __name__ == "__main__":
    unittest.main()
