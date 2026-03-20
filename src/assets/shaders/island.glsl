@vertex
#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;
out vec3 v_normal;
out vec3 v_world_normal;
out vec3 v_world_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

void main() {
    vec4 world_normal = u_model * vec4(a_normal, 1);
    vec4 world_position = u_model * vec4(a_position, 1);

    v_uv = a_uv;
    v_normal = a_normal;
    v_world_normal = world_normal.xyz;
    v_world_position = world_position.xyz;

    gl_Position = u_projection * u_view * world_position;
}

@fragment
#version 300 es
precision mediump float;

in vec2 v_uv;
in vec3 v_normal;
in vec3 v_world_normal;
in vec3 v_world_position;

out vec4 frag_colour;

uniform vec4 u_ambient_colour;
uniform vec3 u_sun_direction;
uniform sampler2D u_stone_texture;

#define RGB(r, g, b) vec3(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0)

#define SRGB(r, g, b) (vec3( \
    ((float(r) / 255.0) <= 0.04045 ? (float(r) / 255.0) / 12.92 : pow((float(r) / 255.0 + 0.055) / 1.055, 2.4)), \
    ((float(g) / 255.0) <= 0.04045 ? (float(g) / 255.0) / 12.92 : pow((float(g) / 255.0 + 0.055) / 1.055, 2.4)), \
    ((float(b) / 255.0) <= 0.04045 ? (float(b) / 255.0) / 12.92 : pow((float(b) / 255.0 + 0.055) / 1.055, 2.4)) \
))

const float GRASS_SLOPE_CUTOFF = 0.8;
const float BEACH_HEIGHT_CUTOFF = 1.0;

const vec3 GRASS_COLOUR = RGB(21, 77, 21);
const vec3 STONE_COLOUR = SRGB(240, 240, 240);
const vec3 BEACH_COLOUR = SRGB(238, 193, 119);

const float STONE_TEXTURE_SCALE = 10.0;

const float AMBIENT_STRENGTH = 0.0;
const float DIFFUSE_STRENGTH = 1.0;

void main() {
    float world_slope = v_world_normal.y;
    float world_height = v_world_position.y;
 
    vec3 base_colour = GRASS_COLOUR;

    if (world_height < BEACH_HEIGHT_CUTOFF) {
        base_colour = BEACH_COLOUR;
    }

    if (world_slope < GRASS_SLOPE_CUTOFF) {
        // base_colour = texture(u_stone_texture, v_uv * STONE_TEXTURE_SCALE).rgb;
        base_colour = STONE_COLOUR;
    }

    vec3 light = vec3(1.0);

    if (true) {
        vec3 normal = normalize(v_normal);
        vec3 sun_dir = normalize(u_sun_direction);
        
        float diffuse = max(dot(normal, -sun_dir), 0.0) * DIFFUSE_STRENGTH;
        vec3 ambient = u_ambient_colour.rgb * AMBIENT_STRENGTH;

        light = ambient + vec3(diffuse);
    }

    frag_colour = vec4(base_colour * light, 1.0);
    // frag_colour = vec4(world_slope, world_height, 0, 1.0);
    // frag_colour = vec4(v_uv.rg, 0, 1.0);
}
