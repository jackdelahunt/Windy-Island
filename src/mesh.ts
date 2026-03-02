import "gl-matrix";
import OBJFileParser  from "obj-file-parser";

export type Mesh = {
    vao: WebGLVertexArrayObject;
    index_buffer: WebGLBuffer;
    index_count: number;
};

export function mesh_load_obj(gl: WebGL2RenderingContext, obj_source: string): Mesh {
    const obj_file = new OBJFileParser(obj_source);
    const obj = obj_file.parse();

    const model = obj.models[0];

    const vertices: number[] = [];
    const indices: number[] = [];

    for (const face of model.faces) {
        for (const vertex of face.vertices) {
            const position = model.vertices[vertex.vertexIndex - 1];
            const normal = model.vertexNormals[vertex.vertexNormalIndex - 1];
            const uv = model.textureCoords[vertex.textureCoordsIndex - 1];

            vertices.push(position.x, position.y, position.z, normal.x, normal.y, normal.z, uv.u, uv.v);
            indices.push(indices.length);
        }
    }

    const vertex_array = new Float32Array(vertices);
    const index_array = new Uint16Array(indices);

    return mesh_upload_data(gl, vertex_array, index_array);
}

export function mesh_load_cube(gl: WebGL2RenderingContext): Mesh {
    const vertices = new Float32Array([
        // --- FRONT FACE (z = +0.5) ---
        // position(x,y,z)    normal(0,0,1)    uv(u,v)
        -0.5, -0.5,  0.5,   0, 0, 1,   0, 0,   // bottom-left
         0.5, -0.5,  0.5,   0, 0, 1,   1, 0,   // bottom-right
         0.5,  0.5,  0.5,   0, 0, 1,   1, 1,   // top-right
        -0.5,  0.5,  0.5,   0, 0, 1,   0, 1,   // top-left

        // --- BACK FACE (z = -0.5) ---
        // Normal points backward (0, 0, -1)
        -0.5, -0.5, -0.5,   0, 0, -1,  0, 0,   // bottom-left
        -0.5,  0.5, -0.5,   0, 0, -1,  0, 1,   // top-left
         0.5,  0.5, -0.5,   0, 0, -1,  1, 1,   // top-right
         0.5, -0.5, -0.5,   0, 0, -1,  1, 0,   // bottom-right

        // --- TOP FACE (y = +0.5) ---
        // Normal points up (0, 1, 0)
        -0.5,  0.5, -0.5,   0, 1, 0,   0, 1,   // back-left
        -0.5,  0.5,  0.5,   0, 1, 0,   0, 0,   // front-left
         0.5,  0.5,  0.5,   0, 1, 0,   1, 0,   // front-right
         0.5,  0.5, -0.5,   0, 1, 0,   1, 1,   // back-right

        // --- BOTTOM FACE (y = -0.5) ---
        // Normal points down (0, -1, 0)
        -0.5, -0.5, -0.5,   0, -1, 0,  0, 1,   // back-left
         0.5, -0.5, -0.5,   0, -1, 0,  1, 1,   // back-right
         0.5, -0.5,  0.5,   0, -1, 0,  1, 0,   // front-right
        -0.5, -0.5,  0.5,   0, -1, 0,  0, 0,   // front-left

        // --- RIGHT FACE (x = +0.5) ---
        // Normal points right (1, 0, 0)
         0.5, -0.5, -0.5,   1, 0, 0,   0, 0,   // back-bottom
         0.5,  0.5, -0.5,   1, 0, 0,   1, 0,   // back-top
         0.5,  0.5,  0.5,   1, 0, 0,   1, 1,   // front-top
         0.5, -0.5,  0.5,   1, 0, 0,   0, 1,   // front-bottom

        // --- LEFT FACE (x = -0.5) ---
        // Normal points left (-1, 0, 0)
        -0.5, -0.5, -0.5,  -1, 0, 0,   0, 0,   // back-bottom
        -0.5, -0.5,  0.5,  -1, 0, 0,   1, 0,   // front-bottom
        -0.5,  0.5,  0.5,  -1, 0, 0,   1, 1,   // front-top
        -0.5,  0.5, -0.5,  -1, 0, 0,   0, 1,   // back-top
    ]);

    const indices = new Uint16Array([
        // Front face (vertices 0-3)
        0,  1,  2,      0,  2,  3,
        // Back face (vertices 4-7)
        4,  5,  6,      4,  6,  7,
        // Top face (vertices 8-11)
        8,  9,  10,     8,  10, 11,
        // Bottom face (vertices 12-15)
        12, 13, 14,     12, 14, 15,
        // Right face (vertices 16-19)
        16, 17, 18,     16, 18, 19,
        // Left face (vertices 20-23)
        20, 21, 22,     20, 22, 23,
    ]);

    return mesh_upload_data(gl, vertices, indices);
}

export function mesh_load_quad(gl: WebGL2RenderingContext): Mesh {
    const vertices = new Float32Array([
        // position(x,y,z)    normal(0,0,1)    uv(u,v)
        -0.5, -0.5,  0.0,   0, 0, 1,   0, 0,   // bottom-left
         0.5, -0.5,  0.0,   0, 0, 1,   1, 0,   // bottom-right
         0.5,  0.5,  0.0,   0, 0, 1,   1, 1,   // top-right
        -0.5,  0.5,  0.0,   0, 0, 1,   0, 1,   // top-left
    ]);

    const indices = new Uint16Array([
        0,  1,  2,      0,  2,  3,
    ]);

    return mesh_upload_data(gl, vertices, indices);
}

function mesh_upload_data(gl: WebGL2RenderingContext, vertices: Float32Array, indices: Uint16Array): Mesh {
    const stride = 8 * 4;

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const vertex_buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const a_position_location = 0;
    const a_normal_location = 1;
    const a_uv_location = 2;

    gl.vertexAttribPointer(a_position_location, 3, gl.FLOAT, false, stride, 0);     // position
    gl.vertexAttribPointer(a_normal_location, 3, gl.FLOAT, false, stride, 3 * 4);   // normal
    gl.vertexAttribPointer(a_uv_location, 2, gl.FLOAT, false, stride, 6 * 4);       // uv

    gl.enableVertexAttribArray(a_position_location);
    gl.enableVertexAttribArray(a_normal_location);
    gl.enableVertexAttribArray(a_uv_location);

    const index_buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return {
        vao,
        index_buffer,
        index_count: indices.length
    };
}