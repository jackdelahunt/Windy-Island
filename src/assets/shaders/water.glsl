@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}

@fragment

#version 300 es
precision highp float;

out vec4 frag_colour;

uniform vec4 u_colour;
uniform float u_window_width;
uniform float u_window_height;
uniform sampler2D u_depth_texture;

const float NEAR_PLANE = 0.1;
const float FAR_PLANE = 200.0;
const float SHORE_FADE_DISTANCE = 0.05;

float depth_to_linear(float depth) {
    float clip_depth = depth * 2.0 - 1.0;
    return (2.0 * NEAR_PLANE * FAR_PLANE) /
        (FAR_PLANE + NEAR_PLANE - clip_depth * (FAR_PLANE - NEAR_PLANE));
}

void main() {
    vec4 colour = u_colour;

    vec2 depth_uv = gl_FragCoord.xy / vec2(textureSize(u_depth_texture, 0));

    float floor_depth = texture(u_depth_texture, depth_uv).r;
    floor_depth = depth_to_linear(floor_depth);

    float water_depth = gl_FragCoord.z;
    water_depth = depth_to_linear(water_depth);

    float water_thickness = max(floor_depth - water_depth, 0.0);
    float shoreline_alpha = smoothstep(0.0, SHORE_FADE_DISTANCE, water_thickness);

    // colour.a *= shoreline_alpha;

    colour = mix(vec4(1.0), colour, shoreline_alpha);

    frag_colour = colour;
}
