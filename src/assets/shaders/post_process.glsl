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
uniform vec3 u_fog_colour;
uniform float u_near_plane;
uniform float u_far_plane;
uniform float u_fog_start;
uniform float u_fog_density;
uniform float u_horizon_height;
uniform float u_horizon_falloff;
uniform float u_horizon_strength;

const float GAMMA = 2.2;

float depth_to_linear(float depth) {
    if (depth >= 1.0) {
        return u_far_plane;
    }

    float clip_depth = depth * 2.0 - 1.0;
    return (2.0 * u_near_plane * u_far_plane) /
        (u_far_plane + u_near_plane - clip_depth * (u_far_plane - u_near_plane));
}

vec3 apply_fog(vec3 scene_colour, float linear_depth, vec2 uv) {
    float fog_distance = max(linear_depth - u_fog_start, 0.0);
    float distance_fog = 1.0 - exp(-fog_distance * u_fog_density);

    float horizon_distance = abs(uv.y - u_horizon_height);
    float horizon_fog = exp(-horizon_distance / max(u_horizon_falloff, 0.0001));
    float height_attenuation = mix(1.0 - u_horizon_strength, 1.0, horizon_fog);

    float fog_factor = clamp(distance_fog * height_attenuation, 0.0, 1.0);
    return mix(scene_colour, u_fog_colour, fog_factor);
}

vec3 gamma_correct(vec3 colour) {
    return pow(colour, vec3(1.0 / GAMMA));
}

void main() {
    vec4 scene_colour = texture(u_scene_texture, v_uv);
    float depth = texture(u_depth_texture, v_uv).r;
    float linear_depth = depth_to_linear(depth);
    vec3 fogged_colour = apply_fog(scene_colour.rgb, linear_depth, v_uv);
    vec3 gamma_corrected = gamma_correct(fogged_colour);
    frag_colour = vec4(gamma_corrected, scene_colour.a);
}
