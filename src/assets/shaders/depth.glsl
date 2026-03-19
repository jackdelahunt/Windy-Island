@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}

@fragment

#version 300 es
precision highp float;

out vec4 frag_colour;

void main() {
    float depth = gl_FragCoord.z;
    frag_colour = vec4(depth, 0, 0, 1);
}