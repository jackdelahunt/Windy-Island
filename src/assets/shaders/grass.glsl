@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;
out vec3 v_normal;
out vec3 v_world_position;
out float v_wind_strength;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform float u_time;

uniform sampler2D u_wind_texture;

const float WIND_SCALE = 0.02;
const float WIND_SPEED = 0.03;

const float WIND_STRENGTH_MULTIPLIER = 0.6;

void main() {
    vec4 world_position = (u_model * vec4(a_position, 1));

    vec2 wind_uv = world_position.xz * WIND_SCALE;
    wind_uv += vec2(u_time * WIND_SPEED, u_time * WIND_SPEED);

    float wind_strength = texture(u_wind_texture, wind_uv).r; // 0 -> no wind (straight grass), 1 -> full wind (full bent grass pointing -x +z)
    float wind_effect = wind_strength * WIND_STRENGTH_MULTIPLIER * a_uv.y;
    world_position.xz -= wind_effect;

    vec4 clip_position = u_projection * u_view * world_position;

    v_uv = a_uv;
    v_normal = mat3(u_model) * a_normal;
    v_world_position = world_position.xyz;
    v_wind_strength = wind_strength;
    gl_Position = clip_position;
}

@fragment

#version 300 es
precision mediump float;

in vec2 v_uv;
in vec3 v_normal;
in vec3 v_world_position;
in float v_wind_strength;

out vec4 frag_colour;

uniform sampler2D u_texture;
uniform sampler2D u_noise_texture;
uniform vec4 u_colour;

const float NOISE_SCALE = 0.02;

const float MIN_NOISE_COLOUR_EFFECT = 0.5;
const float MIN_HEIGHT_COLOUR_EFFECT = 0.3;

const vec3 DEFAULT_BASE_COLOUR = vec3(0.05, 0.25, 0.05);
const vec3 DEFAULT_TIP_COLOUR = vec3(0.3, 0.7, 0.2);
const vec3 DEFAULT_WIND_COLOUR = vec3(0.55, 0.85, 0.45);

// https://easings.net/#easeOutQuad
float ease_out_quad(float x) {
    return 1.0f - (1.0f - x) * (1.0f - x);
}

// https://easings.net/#easeInCubic
float ease_in_cubic(float x) {
    return x * x * x;
}

void main() {
    vec4 texture_colour = texture(u_texture, v_uv);
    if (texture_colour.a == 0.0f) {
        discard;
    }

    vec4 colour = texture_colour;
    vec3 tip_colour = DEFAULT_TIP_COLOUR;

    // effect colour based on random noise for natural variation
    vec2 world_uv = v_world_position.xz * NOISE_SCALE;
    float noise = texture(u_noise_texture, world_uv).r;
    float noise_effect = mix(MIN_NOISE_COLOUR_EFFECT, 1.0, noise);
    tip_colour *= noise_effect;

    // effect colour based on wind strength
    float wind_effect = abs(v_wind_strength);
    tip_colour = mix(tip_colour, DEFAULT_WIND_COLOUR, wind_effect);

    // effect colour based on distance to the ground for shadow effect
    float height_effect = ease_in_cubic(v_uv.g);
    colour.rgb = mix(DEFAULT_BASE_COLOUR, tip_colour, height_effect);

    // colour.rgb = vec3(noise_effect, 0, 0);
    // colour.rgb = vec3(wind_effect, 0, 0);
    // colour.rgb = vec3(v_wind_strength, 0, 0);
    // colour.rgb = vec3(height_effect, 0, 0);

    frag_colour = colour;
}