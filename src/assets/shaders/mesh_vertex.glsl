#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;
out vec3 v_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

void main() {
    v_uv = a_uv;
    v_normal = mat3(u_model) * a_normal;
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}