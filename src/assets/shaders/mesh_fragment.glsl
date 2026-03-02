#version 300 es
precision mediump float;

in vec2 v_uv;
in vec3 v_normal;

out vec4 frag_colour;

uniform vec3 u_sun_direction;
uniform vec4 u_colour;

void main() {
    vec3 normal = normalize(v_normal);
    vec3 sun_dir = normalize(u_sun_direction);
    
    float diffuse = max(dot(normal, -sun_dir), 0.0);
    
    vec3 ambient = vec3(0.2);
    vec3 light = ambient + vec3(diffuse);
    
    frag_colour = vec4(u_colour.rgb * light, u_colour.a);
}