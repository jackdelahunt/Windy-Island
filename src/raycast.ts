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

export function intersectRayMesh(ray: Ray, mesh: Mesh): vec3 | null {
    const vertices = mesh.vertices;
    const indices = mesh.indices;

    if (!vertices || !indices) {
        return null;
    }

    const stride = 8;
    let closest: vec3 | null = null;
    let closestDist = Infinity;

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * stride;
        const i1 = indices[i + 1] * stride;
        const i2 = indices[i + 2] * stride;

        const v0 = vec3.fromValues(vertices[i0], vertices[i0 + 1], vertices[i0 + 2]);
        const v1 = vec3.fromValues(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]);
        const v2 = vec3.fromValues(vertices[i2], vertices[i2 + 1], vertices[i2 + 2]);

        const hit = intersectRayTriangle(ray, v0, v1, v2);

        if (hit) {
            const dist = vec3.distance(ray.origin, hit);
            if (dist < closestDist) {
                closestDist = dist;
                closest = hit;
            }
        }
    }

    return closest;
}

export function sampleIslandSurface(mesh: Mesh, extent: number, spacing: number, rayHeight: number): vec3[] {
    const points: vec3[] = [];

    const gridSize = Math.floor(extent / spacing) + 1;
    const halfExtent = (gridSize - 1) * spacing / 2;

    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
            const xPos = x * spacing - halfExtent;
            const zPos = z * spacing - halfExtent;

            const ray: Ray = {
                origin: vec3.fromValues(xPos, rayHeight, zPos),
                direction: vec3.fromValues(0, -1, 0),
            };

            const hit = intersectRayMesh(ray, mesh);

            if (hit) {
                points.push(hit);
            }
        }
    }

    return points;
}
