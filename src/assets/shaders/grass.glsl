@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;
out vec3 v_normal;
out vec3 v_world_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

void main() {
    v_uv = a_uv;
    v_normal = mat3(u_model) * a_normal;
    v_world_position = (u_model * vec4(a_position, 1)).xyz;
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}

@fragment

#version 300 es
precision mediump float;

in vec2 v_uv;
in vec3 v_normal;
in vec3 v_world_position;

out vec4 frag_colour;

uniform vec3 u_sun_direction;
uniform sampler2D u_texture;
uniform sampler2D u_noise_texture;
uniform vec4 u_colour;

const float NOISE_SCALE = 0.02;

// https://easings.net/#easeOutQuad
float ease_out_quad(float x) {
    return 1.0f - (1.0f - x) * (1.0f - x);
}

void main() {
    vec4 texture_colour = texture(u_texture, v_uv);

    vec4 colour = u_colour * texture_colour;
    if (colour.a == 0.0f) {
        discard;
    }

    vec2 world_uv = v_world_position.xz * NOISE_SCALE;
    float noise = texture(u_noise_texture, world_uv).r;
    colour.rgb *= mix(0.5, 1.0, noise);

    colour.rgb *= ease_out_quad(max(0.3, v_uv.g));

    frag_colour = colour;
}