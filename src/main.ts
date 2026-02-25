import { mat4, vec2, vec3, vec4 } from "gl-matrix";

const InputState = {
  Up: "up",             // currently up
  Down: "down",         // currently down
//   Pressed: "pressed",   // just pressed 
//   Released: "released", // just released
} as const;

type InputState = typeof InputState[keyof typeof InputState];

const MouseButton = {
  Left: 0,
  Middle: 1,
  Right: 2,
  Four: 3,
  Five: 4,
} as const;

type MouseButton = typeof MouseButton[keyof typeof MouseButton];

type Mouse = {
    x: number;
    y: number;
    buttons: InputState[];
};

const Key = {
    Number0:  0, Number1:  1, Number2:  2, Number3:  3, Number4:  4,
    Number5:  5, Number6:  6, Number7:  7, Number8:  8, Number9:  9,

    A: 10, B: 11, C: 12, D: 13, E: 14,
    F: 15, G: 16, H: 17, I: 18, J: 19,
    K: 20, L: 21, M: 22, N: 23, O: 24,
    P: 25, Q: 26, R: 27, S: 28, T: 29,
    U: 30, V: 31, W: 32, X: 33, Y: 34, 
    Z: 35,

    Control: 36, Shift: 37, Space: 38, Escape: 39,
} as const;

type Key = typeof Key[keyof typeof Key];

type Keyboard = {
    keys: InputState[];
};

type Camera = {
    position: vec3;
    orthographic_size: number;
    near_plane: number;
    far_plane: number;
};

type Quad = {
    position: vec3;
    scale: vec2;
    rotation: number;
    colour: vec4;
};

const WHITE: vec4 = [1, 1, 1, 1];
const BLACK: vec4 = [0, 0, 0, 1];
const RED: vec4 = [1, 0, 0, 1];
const GREEN: vec4 = [0, 1, 0, 1];
const BLUE: vec4 = [0, 0, 1, 1];

type Renderer = {
    camera: Camera;
    shader_program: WebGLProgram;
    vertex_array: WebGLBuffer;
    array_buffer: WebGLBuffer;
    index_buffer: WebGLBuffer;
    quads: Quad[];
};

let canvas: HTMLCanvasElement = {} as HTMLCanvasElement;
let gl: WebGL2RenderingContext = {} as WebGL2RenderingContext;
let renderer: Renderer = {} as Renderer;
let mouse: Mouse = {} as Mouse;
let keyboard: Keyboard = {} as Keyboard;

function browser_init() {
    canvas = document.getElementById("canvas")! as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = canvas.getContext("webgl2")! as WebGL2RenderingContext;

    mouse = {
        x: 0,
        y: 0,
        buttons: Array(Object.keys(MouseButton).length).fill(InputState.Up),
    };

    canvas.addEventListener("mousemove", event_handler_mouse_move);
    canvas.addEventListener("mousedown", event_handler_mouse_down);
    canvas.addEventListener("mouseup", event_handler_mouse_up);
    canvas.addEventListener("contextmenu", e => e.preventDefault()); // disable right click menu

    keyboard = {
        keys: Array(Object.keys(Key).length).fill(InputState.Up),
    };

    window.addEventListener("keydown", event_handler_keys);
    window.addEventListener("keyup", event_handler_keys);
}

function event_handler_mouse_move(event: MouseEvent) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
}

function event_handler_mouse_down(event: MouseEvent) {
    if (event.button < 0 || event.button >= mouse.buttons.length) {
        log_warn(`mouse button ${event.button} is not recognized`);
        return;
    }

    mouse.buttons[event.button] = InputState.Down;
}

function event_handler_mouse_up(event: MouseEvent) {
    if (event.button < 0 || event.button >= mouse.buttons.length) {
        log_warn(`mouse button ${event.button} is not recognized`);
        return;
    }

    mouse.buttons[event.button] = InputState.Up;
}

function event_handler_keys(event: KeyboardEvent) {
    let state: InputState;
    switch (event.type) {
        case "keydown": state = InputState.Down; break;
        case "keyup": state = InputState.Up; break;
        default: log_warn(`event type ${event.type} is not recognized`); return;
    }

    switch (event.key.toLocaleLowerCase()) {
        case "0": keyboard.keys[Key.Number0] = state; break;
        case "1": keyboard.keys[Key.Number1] = state; break;
        case "2": keyboard.keys[Key.Number2] = state; break;
        case "3": keyboard.keys[Key.Number3] = state; break;
        case "4": keyboard.keys[Key.Number4] = state; break;
        case "5": keyboard.keys[Key.Number5] = state; break;
        case "6": keyboard.keys[Key.Number6] = state; break;
        case "7": keyboard.keys[Key.Number7] = state; break;
        case "8": keyboard.keys[Key.Number8] = state; break;
        case "9": keyboard.keys[Key.Number9] = state; break;
        
        case "a": keyboard.keys[Key.A] = state; break;
        case "b": keyboard.keys[Key.B] = state; break;
        case "c": keyboard.keys[Key.C] = state; break;
        case "d": keyboard.keys[Key.D] = state; break;
        case "e": keyboard.keys[Key.E] = state; break;
        case "f": keyboard.keys[Key.F] = state; break;
        case "g": keyboard.keys[Key.G] = state; break;
        case "h": keyboard.keys[Key.H] = state; break;
        case "i": keyboard.keys[Key.I] = state; break;
        case "j": keyboard.keys[Key.J] = state; break;
        case "k": keyboard.keys[Key.K] = state; break;
        case "l": keyboard.keys[Key.L] = state; break;
        case "m": keyboard.keys[Key.M] = state; break;
        case "n": keyboard.keys[Key.N] = state; break;
        case "o": keyboard.keys[Key.O] = state; break;
        case "p": keyboard.keys[Key.P] = state; break;
        case "q": keyboard.keys[Key.Q] = state; break;
        case "r": keyboard.keys[Key.R] = state; break;
        case "s": keyboard.keys[Key.S] = state; break;
        case "t": keyboard.keys[Key.T] = state; break;
        case "u": keyboard.keys[Key.U] = state; break;
        case "v": keyboard.keys[Key.V] = state; break;
        case "w": keyboard.keys[Key.W] = state; break;
        case "x": keyboard.keys[Key.X] = state; break;
        case "y": keyboard.keys[Key.Y] = state; break;
        case "z": keyboard.keys[Key.Z] = state; break;

        case "control": keyboard.keys[Key.Control]  = state; break;
        case "shift":   keyboard.keys[Key.Shift]    = state; break;
        case " ":       keyboard.keys[Key.Space]    = state; break;
        case "escape":  keyboard.keys[Key.Escape]   = state; break;
        
        default: log_warn(`key ${event.key} is not recognized`); break;
    }
}

function renderer_init() {
    renderer = {
        camera: {
            position: vec3.fromValues(0, 0, 1), // +z is out of the screen
            orthographic_size: 5,
            near_plane: 0,
            far_plane: 100,
        },
        shader_program: {} as WebGLProgram,
        vertex_array: {} as WebGLBuffer,
        array_buffer: {} as WebGLBuffer,
        index_buffer: {} as WebGLBuffer,
        quads: [],
    }

    gl.clearColor(0.3, 0.3, 0.5, 1);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const vertex_shader = `#version 300 es

    in vec3 a_position;

    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_model;

    void main() {
        gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
    }
    `;

    const fragment_shader = `#version 300 es
    precision mediump float;

    out vec4 frag_colour;

    uniform vec4 u_colour;

    void main() {
        frag_colour = u_colour;
    }
    `;

    renderer.shader_program = load_shader_program(gl, vertex_shader, fragment_shader)!;

    const a_position_location = gl.getAttribLocation(renderer.shader_program, "a_position");

    renderer.vertex_array = gl.createVertexArray();
    gl.bindVertexArray(renderer.vertex_array);

    // CCW winding order
    const indicies = [
        0, 2, 1,
        0, 3, 2,
    ]

    renderer.index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderer.index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indicies), gl.STATIC_DRAW);

    const verticies = [
        // position
        -0.5,  0.5, 0, // top left
         0.5,  0.5, 0, // top right
         0.5, -0.5, 0, // bottom right
        -0.5, -0.5, 0, // bottom left
    ]

    renderer.array_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.array_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticies), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_position_location, 3, gl.FLOAT, false, 3 * 4, 0 * 4);
    gl.enableVertexAttribArray(a_position_location);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return renderer;
}

function renderer_draw() {
    const aspect_ratio = canvas.width / canvas.height;

    const view_matrix = mat4.create();
    mat4.lookAt(view_matrix, 
        renderer.camera.position, 
        [renderer.camera.position[0], renderer.camera.position[1], renderer.camera.position[2] - 1],
        [0, 1, 0]
    );

    const projection_matrix = mat4.create();
    mat4.orthoNO(projection_matrix,
        -renderer.camera.orthographic_size * aspect_ratio,
        renderer.camera.orthographic_size * aspect_ratio,
        -renderer.camera.orthographic_size, 
        renderer.camera.orthographic_size,
        renderer.camera.near_plane, 
        renderer.camera.far_plane
    );

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const quad of renderer.quads) {
        const model_matrix = mat4.create();
        mat4.translate(model_matrix, model_matrix, quad.position);
        mat4.rotateZ(model_matrix, model_matrix, quad.rotation);
        mat4.scale(model_matrix, model_matrix, vec3.fromValues(quad.scale[0], quad.scale[1], 1));

        gl.bindVertexArray(renderer.vertex_array);
        gl.useProgram(renderer.shader_program);

        gl.uniformMatrix4fv(gl.getUniformLocation(renderer.shader_program, "u_projection")!, false, projection_matrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(renderer.shader_program, "u_view")!, false, view_matrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(renderer.shader_program, "u_model")!, false, model_matrix);
        gl.uniform4fv(gl.getUniformLocation(renderer.shader_program, "u_colour")!, quad.colour);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
    }

    renderer.quads = [];
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

    requestAnimationFrame(frame);
}

function frame(time: DOMHighResTimeStamp) {
    update_and_draw();
    renderer_draw();

    requestAnimationFrame(frame);
}

let quad: Quad = {
    position: [0, 0, 0],
    scale: [1, 1],
    rotation: 0,
    colour: RED,
}

let quad2: Quad = {
    position: [-1, 2, 0],
    scale: [1, 1],
    rotation: 0,
    colour: WHITE,
}

function update_and_draw() {
    const speed = 0.09;
    const input = [0, 0];

    if (keyboard.keys[Key.A] === InputState.Down) {
        input[0] -= 1;
    }

    if (keyboard.keys[Key.D] === InputState.Down) {
        input[0] += 1;
    }

    if (keyboard.keys[Key.W] === InputState.Down) {
        input[1] += 1;
    }

    if (keyboard.keys[Key.S] === InputState.Down) {
        input[1] -= 1;
    }

    quad.position[0] += input[0] * speed;
    quad.position[1] += input[1] * speed;

    renderer.quads.push(quad);
    renderer.quads.push(quad2);
}

function log_error(message: string) {
    console.error(`ERROR: ${message}`);
}

function log_warn(message: string) {
    console.warn(`WARN: ${message}`);
}

main();