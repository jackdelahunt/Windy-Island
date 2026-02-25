import { mat4, vec2, vec3, vec4 } from "gl-matrix";

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

function webgl_init() {
	canvas = document.getElementById("canvas")! as HTMLCanvasElement;
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	gl = canvas.getContext("webgl2")! as WebGL2RenderingContext;
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
		vec3.fromValues(renderer.camera.position[0], renderer.camera.position[1], renderer.camera.position[2] - 1), 
		vec3.fromValues(0, 1, 0)
	);

	const projection_matrix = mat4.create();
	mat4.orthoNO(projection_matrix,
		-renderer.camera.orthographic_size * aspect_ratio,
		renderer.camera.orthographic_size * aspect_ratio,
		renderer.camera.orthographic_size, 
		-renderer.camera.orthographic_size,
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
	webgl_init();
	renderer_init();

	requestAnimationFrame(frame);
}

function frame(time: DOMHighResTimeStamp) {
	update_and_draw();
	renderer_draw();

	requestAnimationFrame(frame);
}

function update_and_draw() {
	let quad: Quad = {
		position: [0, 0, 0],
		scale: [1, 1],
		rotation: 0,
		colour: BLUE,
	}

	renderer.quads.push(quad);

	quad = {
		position: [2, 0, 0],
		scale: [1, 2],
		rotation: 45,
		colour: WHITE,
	}

	renderer.quads.push(quad);
}

function log_error(message: string) {
	console.error(`ERROR: ${message}`);
}

main();