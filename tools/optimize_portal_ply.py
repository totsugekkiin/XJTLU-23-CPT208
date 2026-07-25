"""Crop and simplify a vertex-coloured triangle PLY for mobile Web AR.

The source scan used by the marker portal is a binary little-endian PLY with
double-precision positions, RGB vertex colours and triangle faces. This tool:

1. optionally crops triangles to an axis-aligned bounding box;
2. merges vertices inside a configurable voxel grid;
3. removes collapsed and duplicate triangles;
4. writes compact float32 positions and uint8 colours.

Example:
    python tools/optimize_portal_ply.py input.ply output.ply --voxel-size 0.075

Optional crop (xmin ymin zmin xmax ymax zmax):
    python tools/optimize_portal_ply.py input.ply output.ply \
        --bounds -8 -5 -2 10 7 6
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np


VERTEX_DTYPE = np.dtype(
    [
        ("x", "<f8"),
        ("y", "<f8"),
        ("z", "<f8"),
        ("red", "u1"),
        ("green", "u1"),
        ("blue", "u1"),
    ]
)
OUTPUT_VERTEX_DTYPE = np.dtype(
    [
        ("x", "<f4"),
        ("y", "<f4"),
        ("z", "<f4"),
        ("red", "u1"),
        ("green", "u1"),
        ("blue", "u1"),
    ]
)


def parse_header(stream) -> tuple[int, int]:
    header_lines: list[str] = []
    while True:
        line = stream.readline()
        if not line:
            raise ValueError("PLY header ended before end_header")
        decoded = line.decode("ascii").strip()
        header_lines.append(decoded)
        if decoded == "end_header":
            break

    header = "\n".join(header_lines)
    if "format binary_little_endian 1.0" not in header:
        raise ValueError("Only binary_little_endian PLY files are supported")

    vertex_match = re.search(r"element vertex (\d+)", header)
    face_match = re.search(r"element face (\d+)", header)
    if not vertex_match or not face_match:
        raise ValueError("PLY must contain vertex and face elements")

    expected_properties = (
        "property double x\n"
        "property double y\n"
        "property double z\n"
        "property uchar red\n"
        "property uchar green\n"
        "property uchar blue"
    )
    if expected_properties not in header:
        raise ValueError(
            "Unsupported vertex layout; expected double x/y/z followed by uchar RGB"
        )
    if "property list uchar uint vertex_indices" not in header:
        raise ValueError("Unsupported face layout; expected uchar count + uint indices")

    return int(vertex_match.group(1)), int(face_match.group(1))


def read_source(path: Path) -> tuple[np.ndarray, np.ndarray]:
    with path.open("rb") as stream:
        vertex_count, face_count = parse_header(stream)
        vertices = np.fromfile(stream, dtype=VERTEX_DTYPE, count=vertex_count)
        if len(vertices) != vertex_count:
            raise ValueError(f"Expected {vertex_count} vertices, read {len(vertices)}")

        face_records = np.fromfile(stream, dtype=np.dtype([("count", "u1"), ("v", "<u4", 3)]))
        if len(face_records) != face_count:
            raise ValueError(f"Expected {face_count} faces, read {len(face_records)}")
        if not np.all(face_records["count"] == 3):
            raise ValueError("Only triangle faces are supported")

    positions = np.column_stack(
        [vertices["x"], vertices["y"], vertices["z"]]
    )
    colours = np.column_stack(
        [vertices["red"], vertices["green"], vertices["blue"]]
    )
    return np.column_stack([positions, colours]), face_records["v"].copy()


def crop_mesh(
    vertex_data: np.ndarray, faces: np.ndarray, bounds: np.ndarray | None
) -> tuple[np.ndarray, np.ndarray]:
    if bounds is None:
        return vertex_data, faces

    positions = vertex_data[:, :3]
    minimum, maximum = bounds[:3], bounds[3:]
    inside = np.all((positions >= minimum) & (positions <= maximum), axis=1)

    # Keep only complete triangles so the crop boundary is predictable and
    # cannot leave indices pointing outside the compacted vertex array.
    kept_faces = faces[np.all(inside[faces], axis=1)]
    if not len(kept_faces):
        raise ValueError("The crop bounds removed every triangle")

    used = np.unique(kept_faces)
    remap = np.full(len(vertex_data), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return vertex_data[used], remap[kept_faces].astype(np.uint32)


def voxel_simplify(
    vertex_data: np.ndarray, faces: np.ndarray, voxel_size: float
) -> tuple[np.ndarray, np.ndarray]:
    positions = vertex_data[:, :3]
    colours = vertex_data[:, 3:6]
    origin = positions.min(axis=0)
    voxel_keys = np.floor((positions - origin) / voxel_size).astype(np.int32)

    _, inverse = np.unique(voxel_keys, axis=0, return_inverse=True)
    cluster_count = int(inverse.max()) + 1
    counts = np.bincount(inverse, minlength=cluster_count)

    merged_positions = np.column_stack(
        [
            np.bincount(inverse, weights=positions[:, axis], minlength=cluster_count)
            / counts
            for axis in range(3)
        ]
    )
    merged_colours = np.column_stack(
        [
            np.bincount(inverse, weights=colours[:, axis], minlength=cluster_count)
            / counts
            for axis in range(3)
        ]
    )
    remapped_faces = inverse[faces]

    nondegenerate = (
        (remapped_faces[:, 0] != remapped_faces[:, 1])
        & (remapped_faces[:, 1] != remapped_faces[:, 2])
        & (remapped_faces[:, 0] != remapped_faces[:, 2])
    )
    remapped_faces = remapped_faces[nondegenerate]

    # Compare sorted copies, but retain the winding of the first occurrence.
    canonical_faces = np.sort(remapped_faces, axis=1)
    _, first_indices = np.unique(canonical_faces, axis=0, return_index=True)
    remapped_faces = remapped_faces[np.sort(first_indices)]

    # A cluster can become unused after collapsed triangles are removed.
    used = np.unique(remapped_faces)
    compact_remap = np.full(cluster_count, -1, dtype=np.int64)
    compact_remap[used] = np.arange(len(used))

    output_vertices = np.empty(len(used), dtype=OUTPUT_VERTEX_DTYPE)
    output_vertices["x"] = merged_positions[used, 0]
    output_vertices["y"] = merged_positions[used, 1]
    output_vertices["z"] = merged_positions[used, 2]
    output_vertices["red"] = np.clip(np.rint(merged_colours[used, 0]), 0, 255)
    output_vertices["green"] = np.clip(np.rint(merged_colours[used, 1]), 0, 255)
    output_vertices["blue"] = np.clip(np.rint(merged_colours[used, 2]), 0, 255)

    return output_vertices, compact_remap[remapped_faces].astype(np.uint32)


def write_ply(path: Path, vertices: np.ndarray, faces: np.ndarray) -> None:
    header = (
        "ply\n"
        "format binary_little_endian 1.0\n"
        "comment Optimized for the Chang Gate marker portal\n"
        f"element vertex {len(vertices)}\n"
        "property float x\n"
        "property float y\n"
        "property float z\n"
        "property uchar red\n"
        "property uchar green\n"
        "property uchar blue\n"
        f"element face {len(faces)}\n"
        "property list uchar uint vertex_indices\n"
        "end_header\n"
    ).encode("ascii")

    face_records = np.empty(
        len(faces), dtype=np.dtype([("count", "u1"), ("v", "<u4", 3)])
    )
    face_records["count"] = 3
    face_records["v"] = faces

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as stream:
        stream.write(header)
        vertices.tofile(stream)
        face_records.tofile(stream)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--voxel-size",
        type=float,
        default=0.075,
        help="World-space merge cell size (default: 0.075)",
    )
    parser.add_argument(
        "--bounds",
        type=float,
        nargs=6,
        metavar=("XMIN", "YMIN", "ZMIN", "XMAX", "YMAX", "ZMAX"),
        help="Optional axis-aligned crop box",
    )
    args = parser.parse_args()

    if args.voxel_size <= 0:
        parser.error("--voxel-size must be greater than zero")

    bounds = np.asarray(args.bounds, dtype=np.float64) if args.bounds else None
    if bounds is not None and np.any(bounds[:3] >= bounds[3:]):
        parser.error("Each crop minimum must be smaller than its maximum")

    source_bytes = args.input.stat().st_size
    vertex_data, faces = read_source(args.input)
    original_vertices, original_faces = len(vertex_data), len(faces)
    vertex_data, faces = crop_mesh(vertex_data, faces, bounds)
    vertices, faces = voxel_simplify(vertex_data, faces, args.voxel_size)
    write_ply(args.output, vertices, faces)
    output_bytes = args.output.stat().st_size

    print(
        f"{original_vertices:,} -> {len(vertices):,} vertices "
        f"({len(vertices) / original_vertices:.1%})"
    )
    print(
        f"{original_faces:,} -> {len(faces):,} faces "
        f"({len(faces) / original_faces:.1%})"
    )
    print(
        f"{source_bytes / 1_048_576:.2f} MiB -> {output_bytes / 1_048_576:.2f} MiB "
        f"({output_bytes / source_bytes:.1%})"
    )
    print(args.output.resolve())


if __name__ == "__main__":
    main()
