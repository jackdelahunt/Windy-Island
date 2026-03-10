import { mat4, vec2, vec3, vec4, quat } from "gl-matrix";

import { InputState, Key, keyboard, mouse, input_init, input_reset, input_poll } from "./input";
import type { Mesh } from "./mesh";
import { mesh_load_cube, mesh_load_quad, mesh_load_obj } from "./mesh";

import MESH_SHADER_SOURCE from "./assets/shaders/mesh.glsl?raw";
import GRASS_SHADER_SOURCE from "./assets/shaders/grass.glsl?raw";

import TREE_MODEL_SOURCE from "./assets/models/birch_tree_dead_4/BirchTree_Dead_4.obj?raw";
import GRASS_MODEL_SOURCE from "./assets/models/grass/grass.obj?raw";
import ISLAND_MODEL_SOURCE from "./assets/models/island/island.obj?raw";

import DEFAULT_TEXTURE_SOURCE from "./assets/textures/default/default.png";
import GRASS_TEXTURE_SOURCE from "./assets/textures/grass/grass.png";

function hex_to_colour(hex: string): vec4 {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const a = parseInt(hex.slice(7, 9), 16) / 255;
    return vec4.fromValues(r, g, b, a);
}

function to_radian(degrees: number): number {
    return degrees * (Math.PI / 180);
}

type Camera = {
    position: vec3;
    rotation: vec3;
    fov: number;
    near_plane: number;
    far_plane: number;
};

function camera_forward(camera: Camera): vec3 {
    const pitch = to_radian(camera.rotation[0]);
    const yaw = to_radian(camera.rotation[1]);
    return vec3.fromValues(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    );
}

function camera_right(camera: Camera): vec3 {
    const yaw = to_radian(camera.rotation[1]);
    return vec3.fromValues(Math.cos(yaw), 0, Math.sin(yaw));
}

function camera_up(camera: Camera): vec3 {
    const forward = camera_forward(camera);
    const right = camera_right(camera);
    
    const up = vec3.create();
    vec3.cross(up, right, forward);
    vec3.normalize(up, up);
    
    return up;
}

type MeshInstance = {
    mesh: Mesh;
    position: vec3;
    rotation: vec3;
    scale: vec3;
    shader: WebGLProgram;
    texture: WebGLTexture;
    colour: vec4;
    back_face_culling: boolean;
};

type Renderer = {
    camera: Camera;

    mesh_shader: WebGLProgram;
    grass_shader: WebGLProgram;

    cube_mesh: Mesh;
    quad_mesh: Mesh;
    tree_mesh: Mesh;
    grass_mesh: Mesh;
    island_mesh: Mesh;

    default_texture: WebGLTexture;
    grass_texture: WebGLTexture;

    instances: MeshInstance[];
    sun_direction: vec3;
};

const WHITE: vec4 = [1, 1, 1, 1];
const BLACK: vec4 = [0, 0, 0, 1];
const RED: vec4 = [1, 0, 0, 1];
const GREEN: vec4 = [0, 1, 0, 1];
const BLUE: vec4 = [0, 0, 1, 1];
const GROUND_GREEN = [0.28, 0.35, 0.18, 1];
const GRASS_GREEN = hex_to_colour("#86ad3cff");
const TREE_BROWN = hex_to_colour("#605025ff");

let canvas: HTMLCanvasElement = {} as HTMLCanvasElement;
let gl: WebGL2RenderingContext = {} as WebGL2RenderingContext;
let renderer: Renderer = {} as Renderer;

function browser_init() {
    canvas = document.getElementById("canvas")! as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = canvas.getContext("webgl2")! as WebGL2RenderingContext;

    input_init(canvas);
}

function renderer_init() {
    renderer = {
        camera: {
            position: vec3.fromValues(0, 2, 10),
            rotation: vec3.fromValues(0, 0, 0),
            fov: 80,
            near_plane: 0.1,
            far_plane: 200,
        },
        mesh_shader: {} as WebGLProgram,
        grass_shader: {} as WebGLProgram,
        cube_mesh: mesh_load_cube(gl),
        quad_mesh: mesh_load_quad(gl),
        tree_mesh: mesh_load_obj(gl, TREE_MODEL_SOURCE),
        grass_mesh: mesh_load_obj(gl, GRASS_MODEL_SOURCE),
        island_mesh: mesh_load_obj(gl, ISLAND_MODEL_SOURCE),
        default_texture: renderer_load_texture(DEFAULT_TEXTURE_SOURCE),
        grass_texture: renderer_load_texture(GRASS_TEXTURE_SOURCE),
        instances: [],
        sun_direction: vec3.fromValues(0, -1, 0),
    }

    vec3.normalize(renderer.sun_direction, renderer.sun_direction);

    // webGL blend settings 
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // webGL depth test settings 
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    gl.frontFace(gl.CCW);
    gl.enable(gl.CULL_FACE);

    gl.clearColor(0.5, 0.7, 1, 1);

    const mesh_shaders = parse_shader_file(MESH_SHADER_SOURCE);
    renderer.mesh_shader = load_shader_program(gl, mesh_shaders.vertex, mesh_shaders.fragment)!;

    const grass_shaders = parse_shader_file(GRASS_SHADER_SOURCE);
    renderer.grass_shader = load_shader_program(gl, grass_shaders.vertex, grass_shaders.fragment)!;

    return renderer;
}

function renderer_load_texture(image_source: string): WebGLTexture {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const image = new Image();
    image.src = image_source;

    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    };

    image.onerror = () => {
        log_error("failed to load texture");
    }

    return texture;
}

function renderer_draw() {
    const aspect_ratio = canvas.width / canvas.height;

    const forward = camera_forward(renderer.camera);
    const target = vec3.create();
    vec3.add(target, renderer.camera.position, forward);

    const view_matrix = mat4.create();
    mat4.lookAt(view_matrix, 
        renderer.camera.position, 
        target,
        camera_up(renderer.camera)
    );

    const projection_matrix = mat4.create();
    mat4.perspectiveNO(
        projection_matrix, 
        to_radian(renderer.camera.fov), 
        aspect_ratio, 
        renderer.camera.near_plane, 
        renderer.camera.far_plane
    );

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const instance of renderer.instances) {
        if (instance.back_face_culling) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }

        const model_matrix = mat4.create();
        mat4.translate(model_matrix, model_matrix, instance.position);
        mat4.rotateX(model_matrix, model_matrix, to_radian(instance.rotation[0]));
        mat4.rotateY(model_matrix, model_matrix, to_radian(instance.rotation[1]));
        mat4.rotateZ(model_matrix, model_matrix, to_radian(instance.rotation[2]));
        mat4.scale(model_matrix, model_matrix, instance.scale);

        if (instance.shader == renderer.mesh_shader) {
            gl.useProgram(instance.shader);
            gl.uniformMatrix4fv(gl.getUniformLocation(instance.shader, "u_projection")!, false, projection_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(instance.shader, "u_view")!, false, view_matrix);
            gl.uniform3fv(gl.getUniformLocation(instance.shader, "u_sun_direction")!, renderer.sun_direction);
            gl.uniformMatrix4fv(gl.getUniformLocation(instance.shader, "u_model")!, false, model_matrix);
            gl.uniform4fv(gl.getUniformLocation(instance.shader, "u_colour")!, instance.colour);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, instance.texture);

            gl.bindVertexArray(instance.mesh.vao);
            gl.drawElements(gl.TRIANGLES, instance.mesh.index_count, gl.UNSIGNED_SHORT, 0);
        }
        
        if (instance.shader == renderer.grass_shader) {
            gl.useProgram(instance.shader);
            gl.uniformMatrix4fv(gl.getUniformLocation(instance.shader, "u_projection")!, false, projection_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(instance.shader, "u_view")!, false, view_matrix);
            gl.uniform3fv(gl.getUniformLocation(instance.shader, "u_sun_direction")!, renderer.sun_direction);
            gl.uniformMatrix4fv(gl.getUniformLocation(instance.shader, "u_model")!, false, model_matrix);
            gl.uniform4fv(gl.getUniformLocation(instance.shader, "u_colour")!, instance.colour);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, instance.texture);

            gl.bindVertexArray(instance.mesh.vao);
            gl.drawElements(gl.TRIANGLES, instance.mesh.index_count, gl.UNSIGNED_SHORT, 0);
        }
    }
}

function parse_shader_file(source: string): { vertex: string; fragment: string } {
    const lines = source.split("\n");
    let current_section = "";
    let vertex_source = "";
    let fragment_source = "";

    for (const line of lines) {
        if (line.startsWith("@vertex")) {
            current_section = "vertex";
        } else if (line.startsWith("@fragment")) {
            current_section = "fragment";
        } else if (current_section === "vertex") {
            vertex_source += line + "\n";
        } else if (current_section === "fragment") {
            fragment_source += line + "\n";
        }
    }

    return { vertex: vertex_source.trim(), fragment: fragment_source.trim() };
}

function load_shader_program(gl: WebGL2RenderingContext, vertex_shader_source: string, fragment_shader_source: string): WebGLProgram | null {
    const vertex_shader = load_shader(gl, gl.VERTEX_SHADER, vertex_shader_source)!;
    const fragment_shader = load_shader(gl, gl.FRAGMENT_SHADER, fragment_shader_source)!;

    const shader_program = gl.createProgram();
    gl.attachShader(shader_program, vertex_shader);
    gl.attachShader(shader_program, fragment_shader);
    gl.linkProgram(shader_program);

    if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(shader_program);
        log_error(`Unable to load shader program: ${message}`);
        return null;
    }

    return shader_program;
}

function load_shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (shader === null) {
        log_error("failed to create shader");
        return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        log_error(`failed to compile shader: ${message}`);
        return null;
    }

    return shader;
}

function main() {
    browser_init();
    renderer_init();

    /*
    const ground: MeshInstance = {
        mesh: renderer.island_mesh,
        position: vec3.fromValues(0, 0, 0),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(1, 1, 1),
        texture: renderer.default_texture,
        colour: GROUND_GREEN,
        back_face_culling: true,
    };
    */

    const ground: MeshInstance = {
        mesh: renderer.quad_mesh,
        position: vec3.fromValues(0, 1, 0),
        rotation: vec3.fromValues(-90, 0, 0),
        scale: vec3.fromValues(40, 40, 1),
        shader: renderer.mesh_shader,
        texture: renderer.default_texture,
        colour: GROUND_GREEN,
        back_face_culling: true,
    };

    const tree: MeshInstance = {
        mesh: renderer.tree_mesh,
        position: vec3.fromValues(-5, 1, 0),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(3, 3, 3),
        shader: renderer.mesh_shader,
        texture: renderer.default_texture,
        colour: TREE_BROWN,
        back_face_culling: true,
    };

    const ocean: MeshInstance = {
        mesh: renderer.quad_mesh,
        position: vec3.fromValues(0, 0, 0),
        rotation: vec3.fromValues(-90, 0, 0),
        scale: vec3.fromValues(300, 300, 1),
        shader: renderer.mesh_shader,
        texture: renderer.default_texture,
        colour: BLUE,
        back_face_culling: true,
    };

    const grass_width = 100;
    const grass_spacing = 0.2;

    for (let x = 0; x < grass_width; x++) {
        for (let z = 0; z < grass_width; z++) {
            const grass: MeshInstance = {
                mesh: renderer.grass_mesh,
                position: vec3.fromValues(x * grass_spacing - (grass_width * grass_spacing / 2), 1, z * grass_spacing - (grass_width * grass_spacing / 2)),
                rotation: vec3.fromValues(0, Math.random() * 360, 0),
                scale: vec3.fromValues(0.4, 0.4, 0.4),
                shader: renderer.grass_shader,
                texture: renderer.grass_texture,
                colour: GRASS_GREEN,
                back_face_culling: false,
            };

            renderer.instances.push(grass);
        }
    }

    renderer.instances.push(ground);
    renderer.instances.push(tree);
    renderer.instances.push(ocean);

    requestAnimationFrame(frame);
}

function frame(time: DOMHighResTimeStamp) {
    input_poll();

    update_and_draw();
    renderer_draw();

    input_reset();

    requestAnimationFrame(frame);
}

function update_and_draw() {
    if (!mouse.pointer_locked) {
        return;
    }

    const speed = 0.09;
    const input: vec3 = vec3.fromValues(0, 0, 0);

    if (keyboard.keys[Key.A] === InputState.Down) {
        input[0] -= 1;
    }

    if (keyboard.keys[Key.D] === InputState.Down) {
        input[0] += 1;
    }

    if (keyboard.keys[Key.Space] === InputState.Down) {
        input[1] += 1;
    }

    if (keyboard.keys[Key.Shift] === InputState.Down) {
        input[1] -= 1;
    }

    if (keyboard.keys[Key.W] === InputState.Down) {
        input[2] += 1;
    }

    if (keyboard.keys[Key.S] === InputState.Down) {
        input[2] -= 1;
    }

    const forward = camera_forward(renderer.camera);
    const right = camera_right(renderer.camera);

    renderer.camera.position[0] += (forward[0] * input[2] + right[0] * input[0]) * speed;
    renderer.camera.position[1] += input[1] * speed;
    renderer.camera.position[2] += (forward[2] * input[2] + right[2] * input[0]) * speed;

    const rotation_speed = 0.2;
    renderer.camera.rotation[1] += mouse.deltaX * rotation_speed;
    renderer.camera.rotation[0] -= mouse.deltaY * rotation_speed;
    renderer.camera.rotation[0] = Math.max(-89.99, Math.min(89.99, renderer.camera.rotation[0]));
}

function log_error(message: string) {
    console.error(`ERROR: ${message}`);
}

function log_warn(message: string) {
    console.warn(`WARN: ${message}`);
}

main();
