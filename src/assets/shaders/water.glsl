@vertex

#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}

@fragment

#version 300 es
precision highp float;

in vec2 v_uv;

out vec4 frag_colour;

uniform float u_window_width;
uniform float u_window_height;
uniform sampler2D u_depth_texture;
uniform sampler2D u_water_texture;

const vec3 WATER_COLOUR = vec3(0.0, 0.4, 0.8);
const vec3 FOAM_COLOUR = vec3(0.1, 0.5, 0.8);
const vec3 LIGHT_FOAM_COLOUR = vec3(0.0, 0.42, 0.8);
const float FOAM_SCALE = 0.02;
const float LIGHT_FOAM_SCALE = 0.04;

const float NEAR_PLANE = 0.1;
const float FAR_PLANE = 200.0;
const float SHORE_DEPTH_START = 0.2;


float depth_to_linear(float depth) {
    float clip_depth = depth * 2.0 - 1.0;
    return (2.0 * NEAR_PLANE * FAR_PLANE) /
        (FAR_PLANE + NEAR_PLANE - clip_depth * (FAR_PLANE - NEAR_PLANE));
}

void main() {
    vec4 colour = vec4(WATER_COLOUR, 1.0);

    {
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
    float shore_strength = 1.0 - smoothstep(0.0, SHORE_DEPTH_START, depth);

    colour.a = 1.0 - shore_strength;

    frag_colour = colour;
}
