@vertex

#version 300 es

in vec3 a_position;

out vec3 v_direction;

uniform mat4 u_projection;
uniform mat4 u_view;

void main() {
    v_direction = a_position;

    vec4 clip_position = u_projection * u_view * vec4(a_position, 1.0);
    gl_Position = clip_position.xyww;
}

@fragment

#version 300 es
precision mediump float;

in vec3 v_direction;

out vec4 frag_colour;

uniform samplerCube u_skybox;

void main() {
    frag_colour = texture(u_skybox, normalize(v_direction));
}
