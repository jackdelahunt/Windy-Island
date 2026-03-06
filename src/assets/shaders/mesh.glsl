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
    v_normal = mat3(u_model) * a_normal;
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
uniform vec4 u_colour;

void main() {
    vec3 normal = normalize(v_normal);
    vec3 sun_dir = normalize(u_sun_direction);
    
    float diffuse = max(dot(normal, -sun_dir), 0.0);
    
    vec3 ambient = vec3(0.2);
    vec3 light = ambient + vec3(diffuse);

    vec4 texture_colour = texture(u_texture, v_uv);

    vec3 colour_rgb = u_colour.rgb * texture_colour.rgb;
    float colour_a = u_colour.a * texture_colour.a;
    
    if (colour_a < 0.01) {
        discard;
    }

    // light = vec3(1.0);
    
    frag_colour = vec4(colour_rgb * light, colour_a);
}