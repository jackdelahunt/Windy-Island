import { mat4, vec2, vec3, vec4, quat } from "gl-matrix";

import { InputState, Key, keyboard, mouse, input_init, input_reset, input_poll } from "./input";
import type { Mesh } from "./mesh";
import { mesh_load_cube, mesh_load_quad, mesh_load_obj, mesh_get_vertices, mesh_get_indices } from "./mesh";
import { sampleIslandSurface } from "./raycast";

import DEPTH_SHADER_SOURCE from "./assets/shaders/depth.glsl?raw";
import MESH_SHADER_SOURCE from "./assets/shaders/mesh.glsl?raw";
import GRASS_SHADER_SOURCE from "./assets/shaders/grass.glsl?raw";
import ISLAND_SHADER_SOURCE from "./assets/shaders/island.glsl?raw";
import WATER_SHADER_SOURCE from "./assets/shaders/water.glsl?raw";

import TREE_MODEL_SOURCE from "./assets/models/birch_tree_dead_4/BirchTree_Dead_4.obj?raw";
import GRASS_MODEL_SOURCE from "./assets/models/grass/grass.obj?raw";
import ISLAND_MODEL_SOURCE from "./assets/models/island/island.obj?raw";

import DEFAULT_TEXTURE_SOURCE from "./assets/textures/default/default.png";
import GRASS_TEXTURE_SOURCE from "./assets/textures/grass/grass.png";
import WIND_TEXTURE_SOURCE from "./assets/textures/wind/wind.png";

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

type MeshShaderInputs = {
    type: "mesh";
    texture: WebGLTexture;
    sunDirection: vec3;
    colour: vec4;
};

type WaterShaderInputs = {
    type: "water";
    colour: vec4;
};

type IslandShaderInputs = {
    type: "island";
    sunDirection: vec3;
};

type GrassShaderInputs = {
    type: "grass";
    texture: WebGLTexture;
    noiseTexture: WebGLTexture;
    windTexture: WebGLTexture;
    colour: vec4;
};

type ShaderInputs = MeshShaderInputs | WaterShaderInputs | IslandShaderInputs | GrassShaderInputs;

type MeshInstance = {
    mesh: Mesh;
    position: vec3;
    rotation: vec3;
    scale: vec3;
    back_face_culling: boolean;
    shader_inputs: ShaderInputs;
};

type Framebuffer = {
    framebuffer: WebGLFramebuffer;
    colour_texture: WebGLTexture;
    depth_texture: WebGLTexture;
    width: number;
    height: number;
};

function framebuffer_configure(fbo: Framebuffer) {
    gl.bindTexture(gl.TEXTURE_2D, fbo.colour_texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbo.width, fbo.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, fbo.depth_texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, fbo.width, fbo.height, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo.colour_texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, fbo.depth_texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function framebuffer_create(width: number, height: number): Framebuffer {
    const fbo = {
        framebuffer: gl.createFramebuffer()!,
        colour_texture: gl.createTexture()!,
        depth_texture: gl.createTexture()!,
        width,
        height,
    };

    framebuffer_configure(fbo);

    return fbo;
}

function framebuffer_bind(fbo: Framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
    gl.viewport(0, 0, fbo.width, fbo.height);
}

function framebuffer_unbind() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function framebuffer_destroy(fbo: Framebuffer) {
    gl.deleteTexture(fbo.colour_texture);
    gl.deleteTexture(fbo.depth_texture);
    gl.deleteFramebuffer(fbo.framebuffer);
}

function framebuffer_resize(fbo: Framebuffer, width: number, height: number) {
    fbo.width = width;
    fbo.height = height;

    framebuffer_configure(fbo);
}

type Renderer = {
    camera: Camera;

    depth_shader: WebGLProgram;
    mesh_shader: WebGLProgram;
    grass_shader: WebGLProgram;
    island_shader: WebGLProgram;
    water_shader: WebGLProgram;

    cube_mesh: Mesh;
    quad_mesh: Mesh;
    tree_mesh: Mesh;
    grass_mesh: Mesh;
    island_mesh: Mesh;

    default_texture: WebGLTexture;
    grass_texture: WebGLTexture;
    noise_texture: WebGLTexture;
    wind_texture: WebGLTexture;

    instances: MeshInstance[];
    sun_direction: vec3;
    depth_framebuffer: Framebuffer;
    main_framebuffer: Framebuffer;
};

const WHITE: vec4 = [1, 1, 1, 1];
const BLACK: vec4 = [0, 0, 0, 1];
const RED: vec4 = [1, 0, 0, 1];
const GREEN: vec4 = [0, 1, 0, 1];
const BLUE: vec4 = [0, 0, 1, 1];
const GROUND_GREEN = [0.08, 0.3, 0.08, 1]; 
const GRASS_GREEN = hex_to_colour("#86ad3cff");
const TREE_BROWN = hex_to_colour("#605025ff");

let canvas: HTMLCanvasElement = {} as HTMLCanvasElement;
let gl: WebGL2RenderingContext = {} as WebGL2RenderingContext;
let renderer: Renderer = {} as Renderer;
let island_surface_points: vec3[] = [];

function browser_init() {
    canvas = document.getElementById("canvas")! as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = canvas.getContext("webgl2", { antialias: false })! as WebGL2RenderingContext;

    input_init(canvas);
}

function renderer_init() {
    renderer = {
        camera: {
            position: vec3.fromValues(0, 30, 60),
            rotation: vec3.fromValues(-20, 0, 0),
            fov: 80,
            near_plane: 0.1,
            far_plane: 200,
        },
        depth_shader: {} as WebGLProgram,
        mesh_shader: {} as WebGLProgram,
        grass_shader: {} as WebGLProgram,
        island_shader: {} as WebGLProgram,
        water_shader: {} as WebGLProgram,
        cube_mesh: mesh_load_cube(gl),
        quad_mesh: mesh_load_quad(gl),
        tree_mesh: mesh_load_obj(gl, TREE_MODEL_SOURCE),
        grass_mesh: mesh_load_obj(gl, GRASS_MODEL_SOURCE),
        island_mesh: mesh_load_obj(gl, ISLAND_MODEL_SOURCE),
        default_texture: load_texture(DEFAULT_TEXTURE_SOURCE, gl.CLAMP_TO_EDGE, gl.NEAREST),
        grass_texture: load_texture(GRASS_TEXTURE_SOURCE, gl.CLAMP_TO_EDGE, gl.NEAREST),
        noise_texture: texture_generate_noise(),
        wind_texture: load_texture(WIND_TEXTURE_SOURCE, gl.REPEAT, gl.LINEAR),
        instances: [],
        sun_direction: vec3.fromValues(0, -1, 0),
        depth_framebuffer: framebuffer_create(canvas.width, canvas.height),
        main_framebuffer: framebuffer_create(canvas.width, canvas.height),
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

    gl.clearColor(0, 0, 0, 1);

    const depth_shaders = parse_shader_file(DEPTH_SHADER_SOURCE);
    renderer.depth_shader = load_shader_program(gl, depth_shaders.vertex, depth_shaders.fragment)!;

    const mesh_shaders = parse_shader_file(MESH_SHADER_SOURCE);
    renderer.mesh_shader = load_shader_program(gl, mesh_shaders.vertex, mesh_shaders.fragment)!;

    const grass_shaders = parse_shader_file(GRASS_SHADER_SOURCE);
    renderer.grass_shader = load_shader_program(gl, grass_shaders.vertex, grass_shaders.fragment)!;

    const island_shaders = parse_shader_file(ISLAND_SHADER_SOURCE);
    renderer.island_shader = load_shader_program(gl, island_shaders.vertex, island_shaders.fragment)!;

    const water_shaders = parse_shader_file(WATER_SHADER_SOURCE);
    renderer.water_shader = load_shader_program(gl, water_shaders.vertex, water_shaders.fragment)!;

    return renderer;
}

function load_texture(image_source: string, wrap_method: GLint, filter_method: GLint): WebGLTexture {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const image = new Image();
    image.src = image_source;

    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap_method);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap_method);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter_method);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter_method);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    };

    image.onerror = () => {
        log_error("failed to load texture");
    }

    return texture;
}

function texture_generate_noise(): WebGLTexture {
    const width = 256;
    const height = 256;
    const data = new Uint8Array(width * height * 4);

    for (let i = 0; i < width * height; i++) {
        const value = Math.floor(Math.random() * 256);
        data[i * 4 + 0] = value;
        data[i * 4 + 1] = value;
        data[i * 4 + 2] = value;
        data[i * 4 + 3] = 255;
    }

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

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

    renderer_depth_pass(view_matrix, projection_matrix);
    renderer_main_pass(view_matrix, projection_matrix);

    { // blit
        const blit_buffer = renderer.main_framebuffer;

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, blit_buffer.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.blitFramebuffer(0, 0, blit_buffer.width, blit_buffer.height, 0, 0, canvas.width, canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
}

function renderer_depth_pass(view_matrix: mat4, projection_matrix: mat4) {
    framebuffer_bind(renderer.depth_framebuffer);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

    for (const instance of renderer.instances) {
        if (instance.shader_inputs.type === "grass" || instance.shader_inputs.type === "water") {
            continue; // skip grass and water in depth pass
        }

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

        gl.useProgram(renderer.depth_shader);

        gl.uniformMatrix4fv(gl.getUniformLocation(renderer.depth_shader, "u_model")!, false, model_matrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(renderer.depth_shader, "u_view")!, false, view_matrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(renderer.depth_shader, "u_projection")!, false, projection_matrix);

        gl.bindVertexArray(instance.mesh.vao);
        gl.drawElements(gl.TRIANGLES, instance.mesh.index_count, gl.UNSIGNED_SHORT, 0);
    }
}

function renderer_main_pass(view_matrix: mat4, projection_matrix: mat4) {
    framebuffer_bind(renderer.main_framebuffer);
    gl.clearColor(0, 0, 0, 1);
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

        const shader_inputs = instance.shader_inputs;

        if (shader_inputs.type === "mesh") {
            gl.useProgram(renderer.mesh_shader);

            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.mesh_shader, "u_model")!, false, model_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.mesh_shader, "u_view")!, false, view_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.mesh_shader, "u_projection")!, false, projection_matrix);

            gl.uniform4fv(gl.getUniformLocation(renderer.mesh_shader, "u_colour")!, shader_inputs.colour);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, shader_inputs.texture);

            gl.bindVertexArray(instance.mesh.vao);
            gl.drawElements(gl.TRIANGLES, instance.mesh.index_count, gl.UNSIGNED_SHORT, 0);
        }

        if (shader_inputs.type === "grass") {
            gl.useProgram(renderer.grass_shader);

            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.grass_shader, "u_model")!, false, model_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.grass_shader, "u_view")!, false, view_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.grass_shader, "u_projection")!, false, projection_matrix);
            gl.uniform1f(gl.getUniformLocation(renderer.grass_shader, "u_time")!, performance.now() / 1000);

            gl.uniform4fv(gl.getUniformLocation(renderer.grass_shader, "u_colour")!, shader_inputs.colour);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, shader_inputs.texture);
            gl.uniform1i(gl.getUniformLocation(renderer.grass_shader, "u_texture")!, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, shader_inputs.noiseTexture);
            gl.uniform1i(gl.getUniformLocation(renderer.grass_shader, "u_noise_texture")!, 1);

            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, shader_inputs.windTexture);
            gl.uniform1i(gl.getUniformLocation(renderer.grass_shader, "u_wind_texture")!, 2);

            gl.bindVertexArray(instance.mesh.vao);
            gl.drawElements(gl.TRIANGLES, instance.mesh.index_count, gl.UNSIGNED_SHORT, 0);
        }

        if (shader_inputs.type === "island") {
            gl.useProgram(renderer.island_shader);

            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.island_shader, "u_model")!, false, model_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.island_shader, "u_view")!, false, view_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.island_shader, "u_projection")!, false, projection_matrix);

            gl.uniform3fv(gl.getUniformLocation(renderer.island_shader, "u_sun_direction")!, shader_inputs.sunDirection);

            gl.bindVertexArray(instance.mesh.vao);
            gl.drawElements(gl.TRIANGLES, instance.mesh.index_count, gl.UNSIGNED_SHORT, 0);
        }

        if (shader_inputs.type === "water") {
            gl.useProgram(renderer.water_shader);

            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.water_shader, "u_model")!, false, model_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.water_shader, "u_view")!, false, view_matrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(renderer.water_shader, "u_projection")!, false, projection_matrix);

            gl.uniform4fv(gl.getUniformLocation(renderer.water_shader, "u_colour")!, shader_inputs.colour);
            gl.uniform1f(gl.getUniformLocation(renderer.water_shader, "u_window_width")!, canvas.width);
            gl.uniform1f(gl.getUniformLocation(renderer.water_shader, "u_window_height")!, canvas.height);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, renderer.depth_framebuffer.depth_texture);
            gl.uniform1i(gl.getUniformLocation(renderer.water_shader, "u_depth_texture")!, 0);

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

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        framebuffer_resize(renderer.depth_framebuffer, canvas.width, canvas.height);
        framebuffer_resize(renderer.main_framebuffer, canvas.width, canvas.height);
    });

    const surfaceStart = performance.now();
    island_surface_points = sampleIslandSurface(renderer.island_mesh, 80, 0.7, 0.1, 50);
    const surfaceEnd = performance.now();
    console.log(`Surface sampling: ${island_surface_points.length} points in ${(surfaceEnd - surfaceStart).toFixed(2)}ms`);

if (true) {
    const island: MeshInstance = {
        mesh: renderer.island_mesh,
        position: vec3.fromValues(0, 0, 0),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(1, 1, 1),
        back_face_culling: true,
        shader_inputs: {
            type: "island",
            sunDirection: renderer.sun_direction,
        },
    };

    renderer.instances.push(island);
}

    const tree: MeshInstance = {
        mesh: renderer.tree_mesh,
        position: vec3.fromValues(-5, 14, 0),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(3, 3, 3),
        back_face_culling: true,
        shader_inputs: {
            type: "mesh",
            sunDirection: renderer.sun_direction,
            texture: renderer.default_texture,
            colour: TREE_BROWN,
        },
    };

    renderer.instances.push(tree);
if (true) {
    const water: MeshInstance = {
        mesh: renderer.quad_mesh,
        position: vec3.fromValues(0, 0.1, 0),
        rotation: vec3.fromValues(-90, 0, 0),
        scale: vec3.fromValues(300, 300, 1),
        back_face_culling: true,
        shader_inputs: {
            type: "water",
            colour: BLUE,
        },
    };

    renderer.instances.push(water);
}

if (false) {
    const wind: MeshInstance = {
        mesh: renderer.quad_mesh,
        position: vec3.fromValues(-2, 2, 8),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(1, 1, 1),
        back_face_culling: true,
        shader_inputs: {
            type: "mesh",
            sunDirection: renderer.sun_direction,
            texture: renderer.wind_texture,
            colour: WHITE,
        },
    };

    renderer.instances.push(wind);

    const noise: MeshInstance = {
        mesh: renderer.quad_mesh,
        position: vec3.fromValues(-2, 3, 8),
        rotation: vec3.fromValues(0, 0, 0),
        scale: vec3.fromValues(1, 1, 1),
        back_face_culling: true,
        shader_inputs: {
            type: "mesh",
            sunDirection: renderer.sun_direction,
            texture: renderer.noise_texture,
            colour: WHITE,
        },
    };

    renderer.instances.push(noise);
}

if (false) {
    const ground: MeshInstance = {
        mesh: renderer.quad_mesh,
        position: vec3.fromValues(0, 10, 0),
        rotation: vec3.fromValues(-90, 0, 0),
        scale: vec3.fromValues(100, 100, 1),
        back_face_culling: true,
        shader_inputs: {
            type: "mesh",
            sunDirection: renderer.sun_direction,
            texture: renderer.default_texture,
            colour: GROUND_GREEN,
        },
    };

    renderer.instances.push(ground);
}

if (true) {
    for (const point of island_surface_points) {
        const grass: MeshInstance = {
            mesh: renderer.grass_mesh,
            position: vec3.fromValues(point[0], point[1], point[2]),
            rotation: vec3.fromValues(0, Math.random() * 360, 0),
            scale: vec3.fromValues(0.4, 0.4, 0.4),
            back_face_culling: false,
            shader_inputs: {
                type: "grass",
                texture: renderer.grass_texture,
                noiseTexture: renderer.noise_texture,
                windTexture: renderer.wind_texture,
                colour: GRASS_GREEN,
            } as ShaderInputs,
        };

        renderer.instances.push(grass);
    }
}

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

    const speed = 1;
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

function renderer_cleanup() {
    framebuffer_destroy(renderer.depth_framebuffer);
    framebuffer_destroy(renderer.main_framebuffer);
}

window.addEventListener("beforeunload", renderer_cleanup);

main();
