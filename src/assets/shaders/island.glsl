@vertex
#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;
out vec3 v_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

void main() {
    v_uv = a_uv;
    v_normal = a_normal;

    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}

@fragment
#version 300 es
precision mediump float;

in vec2 v_uv;
in vec3 v_normal;

out vec4 frag_colour;

uniform vec3 u_sun_direction;
uniform sampler2D u_texture;

const float GRASS_SLOPE_CUTOFF = 0.8;
const float BEACH_HEIGHT = 1.0;

void main() {
    vec3 texture_sample = texture(u_texture, v_uv).rgb;
    float world_slope = texture_sample.r;
    float world_height = texture_sample.g;

    vec3 normal = normalize(v_normal);
    vec3 sun_dir = normalize(u_sun_direction);
    
    float diffuse = max(dot(normal, -sun_dir), 0.0);
    vec3 ambient = vec3(0.2);
    vec3 light = ambient + vec3(diffuse);
    
    vec3 green = vec3(0.0, 0.5, 0.0);
    vec3 gray = vec3(0.4, 0.4, 0.4);
    vec3 beach = vec3(0.76, 0.7, 0.5);
    
    vec3 base_colour = green;
    #if 0
    if (v_slope < GRASS_SLOPE_CUTOFF) {
        base_colour = gray;
    }

    if (v_world_height < BEACH_HEIGHT) {
        base_colour = beach;
    }
    #endif

    // frag_colour = vec4(base_colour * light, 1.0);
    frag_colour = vec4(world_slope, world_height / 2.0, 0, 1.0);
    // frag_colour = vec4(v_uv.rg, 0, 1.0);
}
