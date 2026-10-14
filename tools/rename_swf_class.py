"""
Copy a small effect SWF under a new class name.

The game loads an effect (a projectile, say) from fx/<name>.swf and then asks
the loaded file for a class called exactly <name>. So a file the game asks for
but nobody has can't be replaced by a plain copy of another effect: the copy
must also carry the new class name inside. This script makes such a copy.

    python tools/rename_swf_class.py assets/fx/p.fireBall_02.swf p.miniFireball2

writes assets/fx/p.miniFireball2.swf: the same art, with its class renamed
from p.fireBall_02 to p.miniFireball2.

How: a SWF is a short header followed by tagged blocks. The name appears in
two of them: the SymbolClass block, which links the art to the class "p.x",
and the DoABC block (the compiled ActionScript), whose list of strings holds
"x" and "p:x". Both are rewritten, the block lengths and the file length are
fixed, and the file is compressed again. Everything else is copied unchanged.
Only for simple files whose class sits directly in a package, like the fx ones.
"""

import os
import struct
import sys
import zlib

SYMBOL_CLASS, DO_ABC, DO_ABC_OLD = 76, 82, 72


def read_u30(data: bytes, pos: int):
    value = shift = 0
    while True:
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80 or shift >= 28:
            return value, pos
        shift += 7


def write_u30(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def read_cstring(data: bytes, pos: int):
    end = data.index(b"\0", pos)
    return data[pos:end], end + 1


def rename_abc(abc: bytes, renames: dict) -> tuple:
    """The ABC block with its constant strings renamed; and how many were."""
    pos = 4  # minor and major version
    count, pos = read_u30(abc, pos)  # ints
    for _ in range(max(count - 1, 0)):
        _, pos = read_u30(abc, pos)
    count, pos = read_u30(abc, pos)  # uints
    for _ in range(max(count - 1, 0)):
        _, pos = read_u30(abc, pos)
    count, pos = read_u30(abc, pos)  # doubles
    pos += 8 * max(count - 1, 0)
    start = pos
    count, pos = read_u30(abc, pos)  # strings
    strings, changed = [], 0
    for _ in range(max(count - 1, 0)):
        size, pos = read_u30(abc, pos)
        text = abc[pos:pos + size]
        pos += size
        if text in renames:
            text, changed = renames[text], changed + 1
        strings.append(text)
    pool = write_u30(count) + b"".join(write_u30(len(s)) + s for s in strings)
    return abc[:start] + pool + abc[pos:], changed


def rename_symbols(body: bytes, renames: dict) -> tuple:
    count = struct.unpack_from("<H", body, 0)[0]
    out, pos, changed = bytearray(body[:2]), 2, 0
    for _ in range(count):
        out += body[pos:pos + 2]
        name, pos = read_cstring(body, pos + 2)
        if name in renames:
            name, changed = renames[name], changed + 1
        out += name + b"\0"
    return bytes(out), changed


def rename(swf: bytes, old: str, new: str) -> bytes:
    if swf[:3] == b"CWS":
        body = zlib.decompress(swf[8:])
    elif swf[:3] == b"FWS":
        body = swf[8:]
    else:
        raise ValueError("not an uncompressed or zlib-compressed SWF")
    package, _, short_old = old.rpartition(".")
    short_new = new.rpartition(".")[2]
    if not package or new.rpartition(".")[0] != package:
        raise ValueError("both names need the same package, like p.old and p.new")
    symbol_renames = {old.encode(): new.encode()}
    abc_renames = {short_old.encode(): short_new.encode(),
                   f"{package}:{short_old}".encode(): f"{package}:{short_new}".encode()}

    bits = body[0] >> 3  # the stage size: a rectangle of 4 numbers, each this many bits
    pos = (5 + 4 * bits + 7) // 8 + 4  # then the frame rate and frame count
    out = bytearray(body[:pos])
    symbols = abc_strings = 0
    while pos < len(body):
        code_and_length = struct.unpack_from("<H", body, pos)[0]
        code, length, header = code_and_length >> 6, code_and_length & 0x3F, 2
        if length == 0x3F:
            length, header = struct.unpack_from("<I", body, pos + 2)[0], 6
        content = body[pos + header:pos + header + length]
        if code == SYMBOL_CLASS:
            content, n = rename_symbols(content, symbol_renames)
            symbols += n
        elif code == DO_ABC:
            abc_start = read_cstring(content, 4)[1]  # after the flags and the block's name
            abc, n = rename_abc(content[abc_start:], abc_renames)
            content, abc_strings = content[:abc_start] + abc, abc_strings + n
        elif code == DO_ABC_OLD:
            content, n = rename_abc(content, abc_renames)
            abc_strings += n
        if code in (SYMBOL_CLASS, DO_ABC, DO_ABC_OLD):
            out += struct.pack("<HI", (code << 6) | 0x3F, len(content)) + content
        else:
            out += body[pos:pos + header + length]
        pos += header + length
    if symbols != 1 or abc_strings != 2:
        raise ValueError(f"expected 1 symbol and 2 class strings named {old}, found {symbols} and {abc_strings}")
    header = b"CWS" + swf[3:4] + struct.pack("<I", 8 + len(out))
    return header + zlib.compress(bytes(out), 9)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    source, new = sys.argv[1], sys.argv[2]
    old = os.path.splitext(os.path.basename(source))[0]
    target = os.path.join(os.path.dirname(source), new + ".swf")
    with open(source, "rb") as f:
        data = rename(f.read(), old, new)
    with open(target, "wb") as f:
        f.write(data)
    print(f"{target}: {len(data)} bytes, class {old} renamed {new}")


if __name__ == "__main__":
    main()
