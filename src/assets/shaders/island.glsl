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

uniform vec3 u_sun_direction;
uniform sampler2D u_stone_texture;

const float GRASS_SLOPE_CUTOFF = 0.8;
const float BEACH_HEIGHT_CUTOFF = 1.0;

const vec3 GRASS_COLOUR = vec3(0.08, 0.3, 0.08);
const vec3 STONE_COLOUR = vec3(0.4, 0.4, 0.4);
const vec3 BEACH_COLOUR = vec3(0.76, 0.7, 0.5);

void main() {
    float world_slope = v_world_normal.y;
    float world_height = v_world_position.y;

    vec3 normal = normalize(v_normal);
    vec3 sun_dir = normalize(u_sun_direction);
    
    float diffuse = max(dot(normal, -sun_dir), 0.0);
    vec3 ambient = vec3(0.2);
    vec3 light = ambient + vec3(diffuse);
     
    vec3 base_colour = GRASS_COLOUR;

    if (world_height < BEACH_HEIGHT_CUTOFF) {
        base_colour = BEACH_COLOUR;
    }

    if (world_slope < GRASS_SLOPE_CUTOFF) {
        // base_colour = STONE_COLOUR;
        base_colour = texture(u_stone_texture, v_world_position.xz * 0.5).rgb;
    }

    frag_colour = vec4(base_colour * light, 1.0);
    // frag_colour = vec4(world_slope, world_height, 0, 1.0);
    // frag_colour = vec4(v_uv.rg, 0, 1.0);
}
