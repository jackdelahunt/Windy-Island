@vertex

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

@fragment

#version 300 es
precision mediump float;

in vec2 v_uv;
in vec3 v_normal;

out vec4 frag_colour;

uniform vec3 u_sun_direction;
uniform sampler2D u_texture;
uniform vec4 u_colour;

// https://easings.net/#easeOutQuad
float ease_out_quad(float x) {
    return 1.0f - (1.0f - x) * (1.0f - x);
}

void main() {
    vec4 texture_colour = texture(u_texture, v_uv);

    vec4 colour = u_colour * texture_colour;

    colour.rgb *= ease_out_quad(max(0.3, v_uv.g));

    if (colour.a < 0.01) {
        discard;
    }

    frag_colour = colour;
}