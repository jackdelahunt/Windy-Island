@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

void main() {
    v_uv = a_uv;
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}

@fragment

#version 300 es
precision mediump float;

in vec2 v_uv;

out vec4 frag_colour;

uniform sampler2D u_texture;
uniform vec4 u_colour;

void main() {
    vec4 texture_colour = texture(u_texture, v_uv);
    if (texture_colour.a < 0.01) {
        discard;
    }

    vec4 colour = u_colour * texture_colour;
    
    frag_colour = colour;
}