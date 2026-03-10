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
uniform sampler2D u_wind_texture;
uniform vec4 u_colour;
uniform float u_time;

const float NOISE_SCALE = 0.02;
const float WIND_SCALE = 0.01;
const float WIND_SPEED = 0.07;

const float MIN_NOISE_COLOUR_EFFECT = 0.7;
const float MIN_WIND_COLOUR_EFFECT = 0.1;
const float MIN_HEIGHT_COLOUR_EFFECT = 0.3;

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

    // effect colour based on random noise for natural variation
    vec2 world_uv = v_world_position.xz * NOISE_SCALE;
    float noise = texture(u_noise_texture, world_uv).r;
    float noise_effect = mix(MIN_NOISE_COLOUR_EFFECT, 1.0, noise);
    colour.rgb *= noise_effect;

    // effect colour based on wind noise
    vec2 wind_uv = v_world_position.xz * WIND_SCALE;
    wind_uv += vec2(u_time * WIND_SPEED, u_time * WIND_SPEED);

    float wind = texture(u_wind_texture, wind_uv).r;
    float wind_effect = mix(MIN_WIND_COLOUR_EFFECT, 1.0, wind);
    colour.rgb *= wind_effect;

    // effect colour based on distance to the ground for shadow effect
    float height_effect = ease_out_quad(max(MIN_HEIGHT_COLOUR_EFFECT, v_uv.g));
    colour.rgb *= height_effect;

    // colour.rgb = vec3(noise_effect, 0, 0);
    // colour.rgb = vec3(wind_effect, 0, 0);
    // colour.rgb = vec3(height_effect, 0, 0);

    frag_colour = colour;
}