@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position.xy * 2.0, 0.0, 1.0);
}

@fragment

#version 300 es
precision highp float;

in vec2 v_uv;

out vec4 frag_colour;

uniform sampler2D u_scene_texture;
uniform sampler2D u_depth_texture;
uniform float u_near_plane;
uniform float u_far_plane;

const float GAMMA = 2.2;

const vec3 FOG_COLOUR = vec3(1.0, 1.0, 1.0);
// const vec3 FOG_COLOUR = vec3(1.0, 0.0, 0.0);
const float FOG_START = 150.0;
const float FOG_DENSITY = 0.001;
const float FOG_HORIZON_HEIGHT = 0.7;
const float FOG_HORIZON_FALLOFF = 0.07;
const float FOG_HORIZON_STRENGTH = 1.0;
const float FOG_HORIZON_POWER = 0.35;

const float VIGNETTE_STRENGTH = 0.4;
const float VIGNETTE_RADIUS = 0.95;
const float VIGNETTE_SOFTNESS = 0.3;

float depth_to_linear(float depth) {
    if (depth >= 1.0) {
        return u_far_plane;
    }

    float clip_depth = depth * 2.0 - 1.0;
    return (2.0 * u_near_plane * u_far_plane) /
        (u_far_plane + u_near_plane - clip_depth * (u_far_plane - u_near_plane));
}

vec3 apply_fog(vec3 scene_colour, float depth, float linear_depth, vec2 uv) {
    float fog_distance = max(linear_depth - FOG_START, 0.0);
    float distance_fog = 1.0 - exp(-fog_distance * FOG_DENSITY);
    if (depth >= 1.0) {
        distance_fog = 0.0;
    }

    float horizon_distance = abs(uv.y - FOG_HORIZON_HEIGHT);
    float horizon_fog = exp(-horizon_distance / max(FOG_HORIZON_FALLOFF, 0.0001));
    horizon_fog = pow(horizon_fog, FOG_HORIZON_POWER);
    float depth_gate = depth >= 1.0 ? 1.0 : smoothstep(FOG_START, u_far_plane, linear_depth);
    float horizon_blend = clamp(horizon_fog * FOG_HORIZON_STRENGTH * depth_gate, 0.0, 1.0);
    float fog_factor = max(distance_fog, horizon_blend);
    return mix(scene_colour, FOG_COLOUR, fog_factor);
}

vec3 apply_vignette(vec3 scene_colour, vec2 uv) {
    vec2 centered_uv = uv - 0.5;
    float distance_from_center = length(centered_uv) * 1.41421356;
    float vignette = smoothstep(VIGNETTE_RADIUS - VIGNETTE_SOFTNESS, VIGNETTE_RADIUS, distance_from_center);
    float vignette_mix = vignette * VIGNETTE_STRENGTH;
    return scene_colour * (1.0 - vignette_mix);
}

vec3 gamma_correct(vec3 colour) {
    return pow(colour, vec3(1.0 / GAMMA));
}

void main() {
    vec4 scene_sample = texture(u_scene_texture, v_uv);
    vec3 colour = scene_sample.rgb;

    float depth = texture(u_depth_texture, v_uv).r;
    float linear_depth = depth_to_linear(depth);

    colour = apply_fog(colour, depth, linear_depth, v_uv);
    colour = apply_vignette(colour, v_uv);

    colour = gamma_correct(colour);
    frag_colour = vec4(colour, scene_sample.a);
}
