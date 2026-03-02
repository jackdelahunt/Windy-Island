import { mat4, vec2, vec3, vec4, quat } from "gl-matrix";

import { InputState, Key, keyboard, input_init } from "./input";
import type { Mesh } from "./mesh";
import { mesh_load_cube, mesh_load_quad, mesh_load_obj } from "./mesh";

import MESH_VERTEX_SHADER_SOURCE from "./assets/shaders/mesh_vertex.glsl?raw";
import MESH_FRAGMENT_SHADER_SOURCE from "./assets/shaders/mesh_fragment.glsl?raw";

import CUBE_MODEL_SOURCE from "./assets/models/cube.obj?raw";

function hex_to_colour(hex: string): vec4 {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const a = parseInt(hex.slice(7, 9), 16) / 255;
    return vec4.fromValues(r, g, b, a);
}

function toRadian(degrees: number): number {
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
    const pitch = camera.rotation[0];
    const yaw = camera.rotation[1];
    return vec3.fromValues(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    );
}

function camera_right(camera: Camera): vec3 {
    const yaw = camera.rotation[1];
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
    colour: vec4;
};

type Renderer = {
    camera: Camera;
    shader_program: WebGLProgram;
    meshes: Map<string, Mesh>;
    instances: MeshInstance[];
    sun_direction: vec3;
};

const WHITE: vec4 = [1, 1, 1, 1];
const BLACK: vec4 = [0, 0, 0, 1];
const RED: vec4 = [1, 0, 0, 1];
const GREEN: vec4 = [0, 1, 0, 1];
const BLUE: vec4 = [0, 0, 1, 1];
const BROWN = hex_to_colour("#9e6b46ff");

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
            position: vec3.fromValues(0, 0, 10),
            rotation: vec3.fromValues(0, 0, 0),
            fov: 90,
            near_plane: 0.1,
            far_plane: 100,
        },
        shader_program: {} as WebGLProgram,
        meshes: new Map(),
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

    gl.clearColor(0.8, 0.8, 1, 1);

    renderer.shader_program = load_shader_program(gl, MESH_VERTEX_SHADER_SOURCE, MESH_FRAGMENT_SHADER_SOURCE)!;

    renderer.meshes.set("cube", mesh_load_cube(gl));
    renderer.meshes.set("quad", mesh_load_quad(gl));
    renderer.meshes.set("obj", mesh_load_obj(gl, CUBE_MODEL_SOURCE));

    return renderer;
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
        renderer.camera.fov, 
        aspect_ratio, 
        renderer.camera.near_plane, 
        renderer.camera.far_plane
    );

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(renderer.shader_program);
    gl.uniformMatrix4fv(gl.getUniformLocation(renderer.shader_program, "u_projection")!, false, projection_matrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(renderer.shader_program, "u_view")!, false, view_matrix);
    gl.uniform3fv(gl.getUniformLocation(renderer.shader_program, "u_sun_direction")!, renderer.sun_direction);

    for (const instance of renderer.instances) {
        const model_matrix = mat4.create();
        mat4.translate(model_matrix, model_matrix, instance.position);
        mat4.rotateX(model_matrix, model_matrix, toRadian(instance.rotation[0]));
        mat4.rotateY(model_matrix, model_matrix, toRadian(instance.rotation[1]));
        mat4.rotateZ(model_matrix, model_matrix, toRadian(instance.rotation[2]));
        mat4.scale(model_matrix, model_matrix, instance.scale);

        gl.bindVertexArray(instance.mesh.vao);
        gl.uniformMatrix4fv(gl.getUniformLocation(renderer.shader_program, "u_model")!, false, model_matrix);
        gl.uniform4fv(gl.getUniformLocation(renderer.shader_program, "u_colour")!, instance.colour);

        gl.drawElements(gl.TRIANGLES, instance.mesh.index_count, gl.UNSIGNED_SHORT, 0);
    }
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

    const cube_mesh = renderer.meshes.get("cube")!;
    const quad_mesh = renderer.meshes.get("quad")!;
    const obj_mesh = renderer.meshes.get("obj")!;

    const cube: MeshInstance = {
        mesh: cube_mesh,
        position: vec3.fromValues(0, 0, 0),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(1, 1, 1),
        colour: WHITE,
    };

    const ground: MeshInstance = {
        mesh: quad_mesh,
        position: vec3.fromValues(0, -1, 0),
        rotation: vec3.fromValues(-90, 0, 0),
        scale: vec3.fromValues(100, 100, 1),
        colour: BROWN,
    };

    const obj: MeshInstance = {
        mesh: obj_mesh,
        position: vec3.fromValues(2, 0, 0),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(1, 1, 1),
        colour: GREEN,
    };

    renderer.instances.push(cube);
    renderer.instances.push(ground);
    renderer.instances.push(obj);

    requestAnimationFrame(frame);
}

function frame(time: DOMHighResTimeStamp) {
    update_and_draw();
    renderer_draw();

    requestAnimationFrame(frame);
}

function update_and_draw() {
    const speed = 0.09;
    const input = [0, 0, 0];

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
        input[2] -= 1;
    }

    if (keyboard.keys[Key.S] === InputState.Down) {
        input[2] += 1;
    }

    renderer.camera.position[0] += input[0] * speed;
    renderer.camera.position[1] += input[1] * speed;
    renderer.camera.position[2] += input[2] * speed;
}

function log_error(message: string) {
    console.error(`ERROR: ${message}`);
}

function log_warn(message: string) {
    console.warn(`WARN: ${message}`);
}

main();
