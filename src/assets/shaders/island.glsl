@vertex
#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

out vec2 v_uv;
out vec3 v_normal;
out float v_slope;
out float v_height;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform vec3 u_sun_direction;

void main() {
    v_uv = a_uv;
    v_normal = mat3(u_model) * a_normal;
    
    v_slope = v_normal.y;
    v_height = (u_model * vec4(a_position, 1.0)).y;
    
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
}

@fragment
#version 300 es
precision mediump float;

in vec2 v_uv;
in vec3 v_normal;
in float v_slope;
in float v_height;

out vec4 frag_colour;

uniform vec3 u_sun_direction;

const float GRASS_SLOPE_CUTOFF = 0.8;
const float BEACH_HEIGHT = 2.0;

void main() {
    vec3 normal = normalize(v_normal);
    vec3 sun_dir = normalize(u_sun_direction);
    
    float diffuse = max(dot(normal, -sun_dir), 0.0);
    vec3 ambient = vec3(0.2);
    vec3 light = ambient + vec3(diffuse);
    
    vec3 green = vec3(0.0, 0.5, 0.0);
    vec3 gray = vec3(0.4, 0.4, 0.4);
    vec3 beach = vec3(0.76, 0.7, 0.5);
    
    vec3 base_colour = green;
    if (v_slope < GRASS_SLOPE_CUTOFF) {
        base_colour = gray;
    }
    
    if (v_height < BEACH_HEIGHT) {
        base_colour = beach;
    }

    frag_colour = vec4(base_colour * light, 1.0);
}
