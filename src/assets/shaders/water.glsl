@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform float u_time;

out vec2 v_uv;
out float v_wave;

void main() {
    vec4 world_position = (u_model * vec4(a_position, 1));
    float wave = sin(u_time * 0.5) / 10.0;

    world_position.y = wave;
    vec4 clip_position = u_projection * u_view * world_position;

    v_uv = a_uv;
    v_wave = wave;
    gl_Position = clip_position;
}

@fragment

#version 300 es
precision highp float;

in vec2 v_uv;
in float v_wave;

out vec4 frag_colour;

uniform sampler2D u_depth_texture;
uniform sampler2D u_water_texture;
uniform sampler2D u_edge_texture;

#define SRGB(r, g, b) (vec3( \
    ((float(r) / 255.0) <= 0.04045 ? (float(r) / 255.0) / 12.92 : pow((float(r) / 255.0 + 0.055) / 1.055, 2.4)), \
    ((float(g) / 255.0) <= 0.04045 ? (float(g) / 255.0) / 12.92 : pow((float(g) / 255.0 + 0.055) / 1.055, 2.4)), \
    ((float(b) / 255.0) <= 0.04045 ? (float(b) / 255.0) / 12.92 : pow((float(b) / 255.0 + 0.055) / 1.055, 2.4)) \
))

const vec3 WATER_COLOUR = SRGB(36, 75, 148);
const vec3 FOAM_COLOUR = SRGB(255, 255, 255);
const vec3 LIGHT_FOAM_COLOUR = vec3(0.0, 0.42, 0.8);
const float FOAM_SCALE = 0.02;
const float LIGHT_FOAM_SCALE = 0.04;
const float EDGE_SCALE = 0.02;

const float NEAR_PLANE = 0.1;
const float FAR_PLANE = 200.0;
const float SHORE_DEPTH_START = 1.5;

float depth_to_linear(float depth) {
    float clip_depth = depth * 2.0 - 1.0;
    return (2.0 * NEAR_PLANE * FAR_PLANE) /
        (FAR_PLANE + NEAR_PLANE - clip_depth * (FAR_PLANE - NEAR_PLANE));
}

void main() {
    vec4 colour = vec4(WATER_COLOUR, 1.0);

    if (false){
        // check light foam first so if it is also regular foam, the normal foam will take precedence
        float light_foam = texture(u_water_texture, (v_uv * -1.0) / LIGHT_FOAM_SCALE).r;
        if (light_foam > 0.9) {
            colour.rgb = LIGHT_FOAM_COLOUR;
        }

        float foam = texture(u_water_texture, v_uv / FOAM_SCALE).r;
        if (foam > 0.9) {
            colour.rgb = FOAM_COLOUR;
        }
    }

    vec2 depth_uv = gl_FragCoord.xy / vec2(textureSize(u_depth_texture, 0));

    float floor_depth = texture(u_depth_texture, depth_uv).r;
    floor_depth = depth_to_linear(floor_depth);

    float water_depth = gl_FragCoord.z;
    water_depth = depth_to_linear(water_depth);

    float depth = max(floor_depth - water_depth, 0.0);

    float shore_depth = 1.0 - v_wave;
    shore_depth = shore_depth * shore_depth * shore_depth; // cube so that the shore effect is more concentrated at the edge and less noticeable further in
    float shore_strength = 1.0 - smoothstep(0.0, shore_depth, depth);

#if 0
    if (shore_strength < 0.9) {
        colour.a = 1.0 - shore_strength;
    } else {
        colour.rgb = vec3(1.0);
    }
#endif

#if 1
    if (shore_strength > 0.0) {
        float edge = texture(u_edge_texture, vec2(shore_strength, 0.0)).r;
        if (edge > 0.1) {
            colour.rgb = vec3(1.0);
        }
    }
#endif

#if 0
    if (shore_strength > 0.0) {
        colour.rgb = mix(WATER_COLOUR, FOAM_COLOUR, shore_strength);
        colour.a = 1.0 - (shore_strength * shore_strength * shore_strength);
    }
#endif

    frag_colour = colour;
}
