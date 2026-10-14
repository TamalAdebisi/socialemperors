"""
Switch on the welcome-back bonus in the game client.

The game has a "welcome-back" chest for new players: on their 2nd and 3rd
day they open it and get gold, cash or a unit. The client we serve
(SocialEmpires0926bsec.swf) has it switched off by one setting, the
Boolean Config.COME_BACK_2ND_3RD in the package "core", which is false.
Nothing the server or the page sends can change it, so this script makes a
copy of the client with that one setting true.

    python tools/patch_client.py assets/flash/SocialEmpires0926bsec.swf \
                                 assets/flash/SocialEmpires0926bsec_comeback.swf

How: a SWF is a short header, then (zlib-compressed) tagged blocks. The
game's ActionScript is compiled into one DoABC block. The setting lives
there twice, as the compiler always writes a static variable with a value:

  1. the variable's default value, stored with its declaration in the class
     (a constant kind byte, and the index next to it: "false" both times);
  2. the class's start-up code, which runs once before the class is used and
     sets the variable again: "find the variable, push false, set it".

The start-up code is what the running game ends up with, so step 2 is the
change that matters; step 1 is changed too, so the file reads exactly as if
the variable had been written "= true" (the compiler's own pattern for the
class's other true settings). Three bytes change, each to a value of the same
length, so no block or file length moves. Nothing else in the game sets this
variable (the script checks), and it is only read in two places: the icon
bar at start-up, and the level up to level 4.

The script refuses any other file (it checks the SHA-256), finds the bytes by
reading the bytecode rather than trusting fixed positions, checks they hold
what is expected, writes the copy compressed the same way (CWS, zlib), then
reads the copy back to check that exactly those three bytes differ.
"""

import hashlib
import struct
import sys
import zlib

EXPECTED_SHA256 = "072a486392cdb420ed60ea78a3dd785f55f8d61fea12719a653d2b678fe3251b"  # SocialEmpires0926bsec.swf
PACKAGE, CLASS, SETTING = "core", "Config", "COME_BACK_2ND_3RD"

DO_ABC = 82
CONSTANT_FALSE, CONSTANT_TRUE = 0x0A, 0x0B  # a slot's default value kinds (and the index the compiler writes)
PUSHFALSE, PUSHTRUE = 0x27, 0x26
FINDPROPERTY, SETPROPERTY, INITPROPERTY = 0x5E, 0x61, 0x68
STORES = (SETPROPERTY, INITPROPERTY, 0x05, 0x6A)  # setproperty, initproperty, setsuper, deleteproperty


def read_u30(data: bytes, pos: int):
    value = shift = 0
    while True:
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80 or shift >= 28:
            return value, pos
        shift += 7


def skip_u30(data: bytes, pos: int, count: int = 1) -> int:
    for _ in range(count):
        _, pos = read_u30(data, pos)
    return pos


# Which instructions carry which operands (AVM2 overview, section "Instructions")
_ONE_INDEX = {0x04, 0x05, 0x06, 0x08, 0x25, 0x2C, 0x2D, 0x2E, 0x2F, 0x31, 0x40, 0x41, 0x42, 0x49, 0x53,
              0x55, 0x56, 0x58, 0x59, 0x5A, 0x5D, 0x5E, 0x5F, 0x60, 0x61, 0x62, 0x63, 0x66, 0x67, 0x68,
              0x6A, 0x6C, 0x6D, 0x6E, 0x6F, 0x80, 0x86, 0x92, 0x94, 0xB2, 0xC2, 0xC3, 0xF0, 0xF1, 0xF2}
_TWO_INDEXES = {0x32, 0x43, 0x44, 0x45, 0x46, 0x4A, 0x4C, 0x4E, 0x4F}
_BRANCHES = set(range(0x0C, 0x1B))  # a 3 byte offset
_ONE_BYTE = {0x24, 0x65}  # pushbyte, getscopeobject


def instructions(code: bytes, pos: int, length: int):
    """(position, opcode, first operand or None) for each instruction of a method body."""
    end = pos + length
    while pos < end:
        at, op = pos, code[pos]
        pos += 1
        operand = None
        if op in _ONE_INDEX:
            operand, pos = read_u30(code, pos)
        elif op in _TWO_INDEXES:
            operand, pos = read_u30(code, pos)
            pos = skip_u30(code, pos)
        elif op in _BRANCHES:
            pos += 3
        elif op == 0x1B:  # lookupswitch
            cases, pos = read_u30(code, pos + 3)
            pos += 3 * (cases + 1)
        elif op in _ONE_BYTE:
            operand = code[pos]
            pos += 1
        elif op == 0xEF:  # debug
            pos = skip_u30(code, pos + 1) + 1
            pos = skip_u30(code, pos)
        yield at, op, operand
    if pos != end:
        raise ValueError("a method body did not decode to its own length")


class ABC:
    """Just enough of an ActionScript bytecode block to find a class's
    static variable and the code that sets it."""

    def __init__(self, data: bytes):
        self.data = data
        pos = 4  # minor and major version
        for size in (None, None, 8):  # ints, uints, doubles
            count, pos = read_u30(data, pos)
            for _ in range(max(count - 1, 0)):
                pos = pos + size if size else skip_u30(data, pos)
        count, pos = read_u30(data, pos)
        self.strings = [None]
        for _ in range(max(count - 1, 0)):
            size, pos = read_u30(data, pos)
            self.strings.append(data[pos:pos + size].decode("utf-8", "replace"))
            pos += size
        count, pos = read_u30(data, pos)
        self.namespaces = [None]
        for _ in range(max(count - 1, 0)):
            name, pos = read_u30(data, pos + 1)
            self.namespaces.append(name)
        count, pos = read_u30(data, pos)
        for _ in range(max(count - 1, 0)):  # namespace sets
            size, pos = read_u30(data, pos)
            pos = skip_u30(data, pos, size)
        count, pos = read_u30(data, pos)
        self.names = [None]  # (namespace or None, name) of each multiname
        for _ in range(max(count - 1, 0)):
            kind = data[pos]
            pos += 1
            if kind in (0x07, 0x0D):  # QName
                ns, pos = read_u30(data, pos)
                name, pos = read_u30(data, pos)
                self.names.append((ns, name))
            elif kind in (0x09, 0x0E):  # Multiname
                name, pos = read_u30(data, pos)
                pos = skip_u30(data, pos)
                self.names.append((None, name))
            elif kind in (0x0F, 0x10):  # RTQName
                name, pos = read_u30(data, pos)
                self.names.append((None, name))
            elif kind in (0x11, 0x12):  # RTQNameL
                self.names.append((None, 0))
            elif kind in (0x1B, 0x1C):  # MultinameL
                pos = skip_u30(data, pos)
                self.names.append((None, 0))
            elif kind == 0x1D:  # generic type, like Vector.<int>
                pos = skip_u30(data, pos)
                size, pos = read_u30(data, pos)
                pos = skip_u30(data, pos, size)
                self.names.append((None, 0))
            else:
                raise ValueError(f"unknown multiname kind {kind:#x}")
        count, pos = read_u30(data, pos)
        for _ in range(count):  # methods
            params, pos = read_u30(data, pos)
            pos = skip_u30(data, pos, 1 + params + 1)  # return type, parameter types, name
            flags = data[pos]
            pos += 1
            if flags & 0x08:  # optional parameters
                options, pos = read_u30(data, pos)
                for _ in range(options):
                    pos = skip_u30(data, pos) + 1
            if flags & 0x80:  # parameter names
                pos = skip_u30(data, pos, params)
        count, pos = read_u30(data, pos)
        for _ in range(count):  # metadata
            pos = skip_u30(data, pos)
            items, pos = read_u30(data, pos)
            pos = skip_u30(data, pos, 2 * items)
        count, pos = read_u30(data, pos)
        self.instance_names = []
        for _ in range(count):
            name, pos = read_u30(data, pos)
            pos = skip_u30(data, pos)  # super class
            flags = data[pos]
            pos += 1
            if flags & 0x08:  # protected namespace
                pos = skip_u30(data, pos)
            interfaces, pos = read_u30(data, pos)
            pos = skip_u30(data, pos, interfaces + 1)  # interfaces, instance initialiser
            _, pos = self._traits(pos)
            self.instance_names.append(name)
        self.classes = []  # (class initialiser method, static traits)
        for _ in range(count):
            cinit, pos = read_u30(data, pos)
            traits, pos = self._traits(pos)
            self.classes.append((cinit, traits))
        count, pos = read_u30(data, pos)
        for _ in range(count):  # scripts
            pos = skip_u30(data, pos)
            _, pos = self._traits(pos)
        count, pos = read_u30(data, pos)
        self.bodies = {}  # method -> (code position, code length)
        for _ in range(count):
            method, pos = read_u30(data, pos)
            pos = skip_u30(data, pos, 4)  # stack, locals, scope depths
            length, pos = read_u30(data, pos)
            self.bodies[method] = (pos, length)
            pos += length
            exceptions, pos = read_u30(data, pos)
            pos = skip_u30(data, pos, 5 * exceptions)
            _, pos = self._traits(pos)
        if pos != len(data):
            raise ValueError("the ActionScript block did not decode to its own length")

    def _traits(self, pos: int):
        data, traits = self.data, []
        count, pos = read_u30(data, pos)
        for _ in range(count):
            trait = {}
            trait["name"], pos = read_u30(data, pos)
            kind = data[pos]
            pos += 1
            trait["kind"] = kind & 0x0F
            if trait["kind"] in (0, 6):  # a variable or a constant
                pos = skip_u30(data, pos)  # slot
                trait["type"], pos = read_u30(data, pos)
                trait["value_index_at"] = pos
                trait["value_index"], pos = read_u30(data, pos)
                if trait["value_index"]:
                    trait["value_kind_at"], trait["value_kind"] = pos, data[pos]
                    pos += 1
            else:
                pos = skip_u30(data, pos, 2)
            if kind & 0x40:  # metadata
                size, pos = read_u30(data, pos)
                pos = skip_u30(data, pos, size)
            traits.append(trait)
        return traits, pos

    def full_name(self, index: int):
        ns, name = self.names[index]
        package = self.strings[self.namespaces[ns]] if ns is not None and self.namespaces[ns] else ""
        return package, self.strings[name] if name else None


def find_setting(abc: ABC) -> dict:
    """The three positions to change, in the ActionScript block, after
    checking each holds what the unpatched game has."""
    found = [i for i, name in enumerate(abc.instance_names) if abc.full_name(name) == (PACKAGE, CLASS)]
    if len(found) != 1:
        raise ValueError(f"expected one class {PACKAGE}.{CLASS}, found {len(found)}")
    cinit, traits = abc.classes[found[0]]
    slots = [t for t in traits if abc.full_name(t["name"]) == ("", SETTING)]
    if len(slots) != 1 or slots[0]["kind"] != 0 or abc.full_name(slots[0]["type"]) != ("", "Boolean"):
        raise ValueError(f"expected one Boolean variable {SETTING} in {CLASS}")
    slot = slots[0]
    if (slot["value_index"], slot.get("value_kind")) != (CONSTANT_FALSE, CONSTANT_FALSE):
        raise ValueError(f"{SETTING} is not declared false (already patched?)")
    name = slot["name"]

    # Every write to the setting, anywhere in the game: there must be just the one.
    writes = []
    for method, (pos, length) in abc.bodies.items():
        code = list(instructions(abc.data, pos, length))
        for i, (at, op, operand) in enumerate(code):
            if op in STORES and operand is not None and abc.full_name(operand)[1] == SETTING:
                writes.append((method, i, code))
    if len(writes) != 1 or writes[0][0] != cinit:
        raise ValueError(f"expected {SETTING} to be set once, by {CLASS}'s start-up code; found {len(writes)} writes")
    _, i, code = writes[0]
    (find_at, find_op, find_name), (push_at, push_op, _), (_, store_op, _) = code[i - 2:i + 1]
    if (find_op, find_name, push_op, store_op) != (FINDPROPERTY, name, PUSHFALSE, SETPROPERTY):
        raise ValueError(f"{CLASS}'s start-up code does not set {SETTING} to false as expected")
    return {"value_index": slot["value_index_at"], "value_kind": slot["value_kind_at"], "start_up": push_at}


def patch(swf: bytes):
    """The patched file, and the changed positions in the uncompressed file."""
    if hashlib.sha256(swf).hexdigest() != EXPECTED_SHA256:
        raise ValueError("not the expected game client (SocialEmpires0926bsec.swf): SHA-256 differs")
    if swf[:3] != b"CWS":
        raise ValueError("expected a zlib-compressed SWF (CWS)")
    body = bytearray(zlib.decompress(swf[8:]))
    if 8 + len(body) != struct.unpack_from("<I", swf, 4)[0]:
        raise ValueError("the SWF's length field does not match its contents")

    bits = body[0] >> 3  # the stage size: a rectangle of 4 numbers, each this many bits
    pos = (5 + 4 * bits + 7) // 8 + 4  # then the frame rate and frame count
    blocks = []
    while pos < len(body):
        code_and_length = struct.unpack_from("<H", body, pos)[0]
        code, length, header = code_and_length >> 6, code_and_length & 0x3F, 2
        if length == 0x3F:
            length, header = struct.unpack_from("<I", body, pos + 2)[0], 6
        if code == DO_ABC:
            name_end = body.index(b"\0", pos + header + 4)  # after the flags, the block's name
            blocks.append((name_end + 1, pos + header + length))
        pos += header + length
    if len(blocks) != 1:
        raise ValueError(f"expected one DoABC block, found {len(blocks)}")
    abc_start, abc_end = blocks[0]
    places = find_setting(ABC(bytes(body[abc_start:abc_end])))

    changes = {abc_start + places["value_index"]: (CONSTANT_FALSE, CONSTANT_TRUE),
               abc_start + places["value_kind"]: (CONSTANT_FALSE, CONSTANT_TRUE),
               abc_start + places["start_up"]: (PUSHFALSE, PUSHTRUE)}
    original = bytes(body)
    for at, (old, new) in changes.items():
        assert body[at] == old
        body[at] = new

    patched = swf[:8] + zlib.compress(bytes(body), 9)  # same signature, version and length

    # Read it back: the same length, and only the three bytes differ.
    again = zlib.decompress(patched[8:])
    differ = [i for i in range(len(original)) if original[i] != again[i]] if len(again) == len(original) else None
    if differ != sorted(changes):
        raise AssertionError("the patched file differs from the original in more than the setting")
    check = ABC(bytes(again[abc_start:abc_end]))
    try:
        find_setting(check)
    except ValueError:
        pass  # good: it no longer reads as false
    else:
        raise AssertionError("the patched file still has the setting false")
    return patched, {8 + at: change for at, change in changes.items()}  # 8: the header before the compressed part


def main():
    if len(sys.argv) != 3 or sys.argv[1] == sys.argv[2]:
        sys.exit(__doc__)
    source, target = sys.argv[1], sys.argv[2]
    with open(source, "rb") as f:
        patched, changes = patch(f.read())
    with open(target, "wb") as f:
        f.write(patched)
    print(f"{target}: {len(patched)} bytes, SHA-256 {hashlib.sha256(patched).hexdigest()}")
    print(f"{PACKAGE}.{CLASS}.{SETTING} is now true. Changed, at these positions of the uncompressed file:")
    for at, (old, new) in sorted(changes.items()):
        print(f"  {at}: {old:#04x} -> {new:#04x}")


if __name__ == "__main__":
    main()
