"""Downscale embedded GLB textures without changing meshes or materials.

Usage:
    python tools/optimize_glb_textures.py input.glb output.glb
"""

from __future__ import annotations

import argparse
import io
import json
import struct
from pathlib import Path

from PIL import Image


GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def padded(data: bytes, fill: bytes) -> bytes:
    remainder = len(data) % 4
    return data if remainder == 0 else data + fill * (4 - remainder)


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if data[:4] != GLB_MAGIC:
        raise ValueError(f"{path} is not a binary glTF file")

    offset = 12
    document = None
    binary = None
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8 : offset + 8 + chunk_length]
        if chunk_type == JSON_CHUNK:
            document = json.loads(chunk.decode("utf-8").rstrip(" \t\r\n\0"))
        elif chunk_type == BIN_CHUNK:
            binary = chunk
        offset += 8 + chunk_length

    if document is None or binary is None:
        raise ValueError("GLB must contain JSON and BIN chunks")
    return document, binary


def texture_limit(name: str, default_size: int, packed_size: int) -> int:
    lowered = name.lower()
    if "metallic" in lowered or "roughness" in lowered or "occlusion" in lowered:
        return packed_size
    return default_size


def optimize_image(data: bytes, max_size: int) -> tuple[bytes, tuple[int, int], tuple[int, int]]:
    with Image.open(io.BytesIO(data)) as image:
        original_size = image.size
        image.load()
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="PNG", optimize=True, compress_level=9)
        return output.getvalue(), original_size, image.size


def rebuild_binary(document: dict, binary: bytes, replacements: dict[int, bytes]) -> bytes:
    rebuilt = bytearray()
    for index, view in enumerate(document.get("bufferViews", [])):
        old_offset = view.get("byteOffset", 0)
        old_length = view["byteLength"]
        payload = replacements.get(index, binary[old_offset : old_offset + old_length])
        while len(rebuilt) % 4:
            rebuilt.append(0)
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(payload)
        rebuilt.extend(payload)

    document["buffers"][0]["byteLength"] = len(rebuilt)
    return bytes(rebuilt)


def write_glb(path: Path, document: dict, binary: bytes) -> None:
    json_data = padded(
        json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        b" ",
    )
    bin_data = padded(binary, b"\0")
    total_length = 12 + 8 + len(json_data) + 8 + len(bin_data)
    header = struct.pack("<4sII", GLB_MAGIC, 2, total_length)
    json_header = struct.pack("<II", len(json_data), JSON_CHUNK)
    bin_header = struct.pack("<II", len(bin_data), BIN_CHUNK)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + json_header + json_data + bin_header + bin_data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--default-size", type=int, default=2048)
    parser.add_argument("--packed-size", type=int, default=1024)
    args = parser.parse_args()

    document, binary = read_glb(args.input)
    replacements: dict[int, bytes] = {}
    total_before = 0
    total_after = 0

    for index, image_def in enumerate(document.get("images", [])):
        view_index = image_def.get("bufferView")
        if view_index is None or image_def.get("mimeType") != "image/png":
            continue
        view = document["bufferViews"][view_index]
        start = view.get("byteOffset", 0)
        source = binary[start : start + view["byteLength"]]
        limit = texture_limit(
            image_def.get("name", f"image-{index}"),
            args.default_size,
            args.packed_size,
        )
        optimized, original_size, result_size = optimize_image(source, limit)
        replacements[view_index] = optimized
        total_before += len(source)
        total_after += len(optimized)
        print(
            f"{image_def.get('name', f'image-{index}')}: "
            f"{original_size[0]}x{original_size[1]} -> "
            f"{result_size[0]}x{result_size[1]}, "
            f"{len(source) / 1_048_576:.2f} MiB -> {len(optimized) / 1_048_576:.2f} MiB"
        )

    rebuilt_binary = rebuild_binary(document, binary, replacements)
    write_glb(args.output, document, rebuilt_binary)
    print(
        f"Embedded textures: {total_before / 1_048_576:.2f} MiB -> "
        f"{total_after / 1_048_576:.2f} MiB"
    )
    print(f"Wrote {args.output} ({args.output.stat().st_size / 1_048_576:.2f} MiB)")


if __name__ == "__main__":
    main()
