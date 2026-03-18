import { vec3 } from "gl-matrix";
import type { Mesh } from "./mesh";

export type Ray = {
    origin: vec3,
    direction: vec3,
};

const EPSILON = 0.000001;

function vec3Sub(out: vec3, a: vec3, b: vec3): vec3 {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
}

function vec3Cross(out: vec3, a: vec3, b: vec3): vec3 {
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
    return out;
}

function vec3Dot(a: vec3, b: vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function intersectRayTriangle(
    ray: Ray,
    v0: vec3,
    v1: vec3,
    v2: vec3
): vec3 | null {
    const edge1 = vec3.create();
    const edge2 = vec3.create();
    const h = vec3.create();
    const s = vec3.create();
    const q = vec3.create();

    vec3Sub(edge1, v1, v0);
    vec3Sub(edge2, v2, v0);

    vec3Cross(h, ray.direction, edge2);
    const a = vec3Dot(edge1, h);

    if (a > -EPSILON && a < EPSILON) {
        return null;
    }

    const f = 1.0 / a;
    vec3Sub(s, ray.origin, v0);
    const u = f * vec3Dot(s, h);

    if (u < 0.0 || u > 1.0) {
        return null;
    }

    vec3Cross(q, s, edge1);
    const v = f * vec3Dot(ray.direction, q);

    if (v < 0.0 || u + v > 1.0) {
        return null;
    }

    const t = f * vec3Dot(edge2, q);

    if (t > EPSILON) {
        const intersection = vec3.create();
        vec3.scaleAndAdd(intersection, ray.origin, ray.direction, t);
        return intersection;
    }

    return null;
}

type SpatialGrid = {
    cells: Map<number, number[]>;
    cellSize: number;
    minX: number;
    minZ: number;
};

const BEACH_LINE = 1;
const MIN_FLATNESS = 0.8;

function buildSpatialGrid(mesh: Mesh, cellSize: number): SpatialGrid {
    const vertices = mesh.vertices!;
    const indices = mesh.indices!;
    const stride = 8;

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < indices.length; i += 3) {
        for (let j = 0; j < 3; j++) {
            const idx = indices[i + j] * stride;
            const x = vertices[idx];
            const z = vertices[idx + 2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }
    }

    const cells = new Map<number, number[]>();
    const invCellSize = 1.0 / cellSize;

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * stride;
        const i1 = indices[i + 1] * stride;
        const i2 = indices[i + 2] * stride;

        const y0 = vertices[i0 + 1];
        const y1 = vertices[i1 + 1];
        const y2 = vertices[i2 + 1];

        if (y0 <= BEACH_LINE || y1 <= BEACH_LINE || y2 <= BEACH_LINE) {
            continue;
        }

        const nx = vertices[i0 + 3] + vertices[i1 + 3] + vertices[i2 + 3];
        const ny = vertices[i0 + 4] + vertices[i1 + 4] + vertices[i2 + 4];
        const nz = vertices[i0 + 5] + vertices[i1 + 5] + vertices[i2 + 5];
        const normalLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const normalY = ny / normalLen;

        if (normalY < MIN_FLATNESS) {
            continue;
        }

        const minTx = Math.floor((Math.min(vertices[i0], vertices[i1], vertices[i2]) - minX) * invCellSize);
        const maxTx = Math.floor((Math.max(vertices[i0], vertices[i1], vertices[i2]) - minX) * invCellSize);
        const minTz = Math.floor((Math.min(vertices[i0 + 2], vertices[i1 + 2], vertices[i2 + 2]) - minZ) * invCellSize);
        const maxTz = Math.floor((Math.max(vertices[i0 + 2], vertices[i1 + 2], vertices[i2 + 2]) - minZ) * invCellSize);

        for (let cx = minTx; cx <= maxTx; cx++) {
            for (let cz = minTz; cz <= maxTz; cz++) {
                const key = cx * 10000 + cz;
                const cell = cells.get(key);
                if (cell) {
                    cell.push(i);
                } else {
                    cells.set(key, [i]);
                }
            }
        }
    }

    return { cells, cellSize, minX, minZ };
}

function intersectRayMeshWithGrid(ray: Ray, mesh: Mesh, grid: SpatialGrid): vec3 | null {
    const vertices = mesh.vertices!;
    const indices = mesh.indices!;
    const stride = 8;

    const cellX = Math.floor((ray.origin[0] - grid.minX) / grid.cellSize);
    const cellZ = Math.floor((ray.origin[2] - grid.minZ) / grid.cellSize);
    const key = cellX * 10000 + cellZ;
    const triangles = grid.cells.get(key);

    if (!triangles) {
        return null;
    }

    let closest: vec3 | null = null;
    let closestDist = Infinity;

    for (const i of triangles) {
        const i0 = indices[i] * stride;
        const i1 = indices[i + 1] * stride;
        const i2 = indices[i + 2] * stride;

        const v0 = vec3.fromValues(vertices[i0], vertices[i0 + 1], vertices[i0 + 2]);
        const v1 = vec3.fromValues(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]);
        const v2 = vec3.fromValues(vertices[i2], vertices[i2 + 1], vertices[i2 + 2]);

        const hit = intersectRayTriangle(ray, v0, v1, v2);

        if (hit) {
            const dist = ray.origin[1] - hit[1];
            if (dist < closestDist) {
                closestDist = dist;
                closest = hit;
            }
        }
    }

    return closest;
}

export function sampleIslandSurface(mesh: Mesh, extent: number, spacing: number, variance: number, rayHeight: number): vec3[] {
    const points: vec3[] = [];
    const gridSize = Math.floor(extent / spacing) + 1;
    const halfExtent = (gridSize - 1) * spacing / 2;
    const cellSize = spacing;

    const grid = buildSpatialGrid(mesh, cellSize);

    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
            const noisex = ((Math.random() * 2) - 1) * variance;
            const noisez = ((Math.random() * 2) - 1) * variance;

            const xPos = x * spacing - halfExtent + noisex;
            const zPos = z * spacing - halfExtent + noisez;

            const ray: Ray = {
                origin: vec3.fromValues(xPos, rayHeight, zPos),
                direction: vec3.fromValues(0, -1, 0),
            };

            const hit = intersectRayMeshWithGrid(ray, mesh, grid);

            if (hit) {
                points.push(hit);
            }
        }
    }

    return points;
}
